import { execSync, exec } from "child_process";
import path from "path";
import fs from "fs";

export interface VideoMetadata {
  duration: number;
  width: number;
  height: number;
  fps: number;
  codec: string;
  audioCodec: string;
  fileSize: number;
}

export function getVideoMetadata(videoPath: string): VideoMetadata {
  const result = execSync(
    `ffprobe -v quiet -print_format json -show_format -show_streams "${videoPath}"`,
    { encoding: "utf-8" }
  );
  const data = JSON.parse(result);
  const videoStream = data.streams?.find(
    (s: { codec_type: string }) => s.codec_type === "video"
  );
  const audioStream = data.streams?.find(
    (s: { codec_type: string }) => s.codec_type === "audio"
  );

  return {
    duration: parseFloat(data.format?.duration || "0"),
    width: videoStream?.width || 0,
    height: videoStream?.height || 0,
    fps: eval(videoStream?.r_frame_rate || "30/1"),
    codec: videoStream?.codec_name || "unknown",
    audioCodec: audioStream?.codec_name || "unknown",
    fileSize: parseInt(data.format?.size || "0"),
  };
}

export function extractAudio(videoPath: string, outputDir: string): string {
  const audioPath = path.join(outputDir, "audio.wav");
  execSync(
    `ffmpeg -y -i "${videoPath}" -vn -acodec pcm_s16le -ar 16000 -ac 1 "${audioPath}"`,
    { stdio: "pipe" }
  );
  return audioPath;
}

export function extractFrames(
  videoPath: string,
  outputDir: string,
  intervalSeconds: number = 5
): { path: string; index: number; timestamp: number }[] {
  const framesDir = path.join(outputDir, "frames");
  fs.mkdirSync(framesDir, { recursive: true });

  execSync(
    `ffmpeg -y -i "${videoPath}" -vf "fps=1/${intervalSeconds}" -q:v 2 "${framesDir}/frame_%04d.jpg"`,
    { stdio: "pipe" }
  );

  const frameFiles = fs
    .readdirSync(framesDir)
    .filter((f) => f.startsWith("frame_") && f.endsWith(".jpg"))
    .sort();

  return frameFiles.map((f, i) => ({
    path: path.join(framesDir, f),
    index: i,
    timestamp: i * intervalSeconds,
  }));
}

export function renderEditedVideo(
  inputPath: string,
  outputPath: string,
  segments: { start: number; end: number }[],
  captions: {
    start: number;
    end: number;
    text: string;
    style: string;
  }[],
  options: {
    normalize_audio: boolean;
    aspect_ratio: string;
    resolution: string;
  }
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (segments.length === 0) {
      reject(new Error("No segments to render"));
      return;
    }

    const filterParts: string[] = [];
    const segCount = segments.length;

    // Trim and prepare each segment
    segments.forEach((seg, i) => {
      filterParts.push(
        `[0:v]trim=${seg.start}:${seg.end},setpts=PTS-STARTPTS[v${i}]`
      );
      filterParts.push(
        `[0:a]atrim=${seg.start}:${seg.end},asetpts=PTS-STARTPTS[a${i}]`
      );
    });

    // Concat all segments
    const videoInputs = segments.map((_, i) => `[v${i}]`).join("");
    const audioInputs = segments.map((_, i) => `[a${i}]`).join("");

    if (segCount > 1) {
      filterParts.push(
        `${videoInputs}concat=n=${segCount}:v=1:a=0[vconcat]`
      );
      filterParts.push(
        `${audioInputs}concat=n=${segCount}:v=0:a=1[aconcat]`
      );
    } else {
      filterParts.push(`[v0]null[vconcat]`);
      filterParts.push(`[a0]anull[aconcat]`);
    }

    // Scale to target resolution
    const [w, h] = options.resolution.split("x").map(Number);
    filterParts.push(
      `[vconcat]scale=${w}:${h}:force_original_aspect_ratio=decrease,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2:black[vscaled]`
    );

    // Check if drawtext filter is available
    let hasDrawtext = false;
    try {
      execSync("ffmpeg -hide_banner -filters 2>/dev/null | grep drawtext", {
        encoding: "utf-8",
      });
      hasDrawtext = true;
    } catch {
      console.warn("[ffmpeg] drawtext filter not available — skipping captions");
    }

    // Add captions (only if drawtext is available)
    let lastVideo = "vscaled";
    // Recalculate caption timings relative to the concatenated output
    let cumulativeOffset = 0;
    const segmentOffsets = segments.map((seg) => {
      const offset = cumulativeOffset;
      cumulativeOffset += seg.end - seg.start;
      return { originalStart: seg.start, originalEnd: seg.end, newStart: offset };
    });

    if (hasDrawtext && captions.length > 0) {
      captions.forEach((cap, i) => {
        const escapedText = cap.text
          .replace(/'/g, "'\\''")
          .replace(/:/g, "\\:")
          .replace(/\\/g, "\\\\");

        // Map caption timing to output timeline
        let capStart = 0;
        let capEnd = 1;
        for (const so of segmentOffsets) {
          if (cap.start >= so.originalStart && cap.start < so.originalEnd) {
            capStart = so.newStart + (cap.start - so.originalStart);
            capEnd = capStart + (cap.end - cap.start);
            break;
          }
        }

        // Default: show caption at its relative position
        if (capStart === 0 && cap.start > 0) {
          capStart = cap.start;
          capEnd = cap.end;
        }

        const fontSize = cap.style === "title_center" ? 48 : 28;
        const yPos =
          cap.style === "title_center"
            ? "(h-th)/2"
            : cap.style === "lower_third"
            ? "h*3/4"
            : "h-80";

        const next = `vcap${i}`;
        filterParts.push(
          `[${lastVideo}]drawtext=text='${escapedText}':fontsize=${fontSize}:fontcolor=white:borderw=2:bordercolor=black:x=(w-tw)/2:y=${yPos}:enable='between(t,${capStart},${capEnd})'[${next}]`
        );
        lastVideo = next;
      });
    }

    // Audio normalization
    let audioOut = "aconcat";
    if (options.normalize_audio) {
      filterParts.push(
        `[aconcat]loudnorm=I=-16:LRA=11:TP=-1.5[anorm]`
      );
      audioOut = "anorm";
    }

    const filterComplex = filterParts.join(";");

    const cmd = `ffmpeg -y -i "${inputPath}" -filter_complex "${filterComplex}" -map "[${lastVideo}]" -map "[${audioOut}]" -c:v libx264 -preset fast -crf 23 -c:a aac -b:a 128k -movflags +faststart "${outputPath}"`;

    exec(cmd, { maxBuffer: 50 * 1024 * 1024 }, (error, _stdout, stderr) => {
      if (error) {
        console.error("FFmpeg error:", stderr);
        reject(new Error(`FFmpeg failed: ${error.message}`));
      } else {
        resolve();
      }
    });
  });
}
