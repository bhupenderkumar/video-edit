"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { Play, Pause, Download, Loader2, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

interface EditSegment {
  start: number;
  end: number;
  reason: string;
}

interface EditCaption {
  start: number;
  end: number;
  text: string;
  style: "subtitle_bottom" | "title_center" | "lower_third" | string;
}

interface EditTransition {
  at: number;
  type: string;
  duration: number;
}

interface EditPlan {
  segments: EditSegment[];
  transitions: EditTransition[];
  captions: EditCaption[];
  color_grade: string;
  audio_adjustments: { normalize: boolean; remove_silence: boolean };
  output_format: { aspect_ratio: string; resolution: string };
}

interface Props {
  videoSrc: string;
  editPlan: EditPlan;
  projectId: string;
  projectTitle: string;
}

// Map color grade names to CSS filter values
const colorGradeFilters: Record<string, string> = {
  natural: "none",
  warm: "sepia(0.15) saturate(1.2) brightness(1.05)",
  cool: "hue-rotate(10deg) saturate(0.9) brightness(1.05)",
  vibrant: "saturate(1.5) contrast(1.1)",
  cinematic: "contrast(1.15) saturate(0.85) brightness(0.95)",
  vintage: "sepia(0.3) contrast(1.1) brightness(0.95)",
  bw: "grayscale(1) contrast(1.2)",
};

export default function EditedVideoPlayer({ videoSrc, editPlan, projectId, projectTitle }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportUrl, setExportUrl] = useState<string | null>(null);

  // Build the timeline: map edit-plan segments to a continuous output timeline
  const timeline = useRef<{ segIndex: number; segStart: number; segEnd: number; outStart: number; outEnd: number }[]>([]);

  useEffect(() => {
    let cumulative = 0;
    timeline.current = editPlan.segments.map((seg, i) => {
      const duration = seg.end - seg.start;
      const entry = {
        segIndex: i,
        segStart: seg.start,
        segEnd: seg.end,
        outStart: cumulative,
        outEnd: cumulative + duration,
      };
      cumulative += duration;
      return entry;
    });
    setTotalDuration(cumulative);
  }, [editPlan.segments]);

  // Convert output timeline position to source video position
  const outTimeToSrcTime = useCallback((outTime: number): { srcTime: number; segIndex: number } | null => {
    for (const entry of timeline.current) {
      if (outTime >= entry.outStart && outTime < entry.outEnd) {
        const offset = outTime - entry.outStart;
        return { srcTime: entry.segStart + offset, segIndex: entry.segIndex };
      }
    }
    // Past the end
    const last = timeline.current[timeline.current.length - 1];
    if (last && outTime >= last.outEnd) {
      return { srcTime: last.segEnd, segIndex: last.segIndex };
    }
    return null;
  }, []);

  // Get active caption for a given output time
  const getCaptionAtTime = useCallback((outTime: number): EditCaption | null => {
    // Map captions to output timeline
    for (const cap of editPlan.captions) {
      // Find which output time this caption maps to
      for (const entry of timeline.current) {
        if (cap.start >= entry.segStart && cap.start < entry.segEnd) {
          const capOutStart = entry.outStart + (cap.start - entry.segStart);
          const capOutEnd = capOutStart + (cap.end - cap.start);
          if (outTime >= capOutStart && outTime < capOutEnd) {
            return cap;
          }
        }
      }
    }
    return null;
  }, [editPlan.captions]);

  // Get transition opacity for output time
  const getTransitionOpacity = useCallback((outTime: number): number => {
    for (const trans of editPlan.transitions) {
      // Find the output time for this transition point
      for (const entry of timeline.current) {
        if (trans.at >= entry.segStart && trans.at <= entry.segEnd) {
          const transOutTime = entry.outStart + (trans.at - entry.segStart);
          const halfDur = trans.duration / 2;
          if (trans.type === "fade_black" || trans.type === "crossfade") {
            if (outTime >= transOutTime - halfDur && outTime <= transOutTime + halfDur) {
              const dist = Math.abs(outTime - transOutTime);
              return 1 - (dist / halfDur) * 0.7; // fade to 30% opacity at transition point
            }
          }
        }
      }
    }
    return 1;
  }, [editPlan.transitions]);

  // Render frame to canvas
  const renderFrame = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;

    // Get transition opacity
    const opacity = getTransitionOpacity(currentTime);

    // Clear canvas
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, w, h);

    // Apply color grade filter
    const filterStr = colorGradeFilters[editPlan.color_grade] || "none";
    ctx.filter = filterStr === "none" ? "none" : filterStr;

    // Draw video frame with opacity
    ctx.globalAlpha = opacity;

    // Calculate aspect-ratio-correct drawing
    const vw = video.videoWidth || w;
    const vh = video.videoHeight || h;
    const scale = Math.min(w / vw, h / vh);
    const dw = vw * scale;
    const dh = vh * scale;
    const dx = (w - dw) / 2;
    const dy = (h - dh) / 2;

    ctx.drawImage(video, dx, dy, dw, dh);
    ctx.filter = "none";
    ctx.globalAlpha = 1;

    // Draw caption
    const caption = getCaptionAtTime(currentTime);
    if (caption) {
      drawCaption(ctx, caption, w, h);
    }

    // Draw progress bar
    const progress = totalDuration > 0 ? currentTime / totalDuration : 0;
    ctx.fillStyle = "rgba(255,255,255,0.15)";
    ctx.fillRect(0, h - 4, w, 4);
    ctx.fillStyle = "#6d28d9";
    ctx.fillRect(0, h - 4, w * progress, 4);
  }, [currentTime, totalDuration, editPlan.color_grade, getCaptionAtTime, getTransitionOpacity]);

  // Draw caption on canvas
  function drawCaption(ctx: CanvasRenderingContext2D, caption: EditCaption, w: number, h: number) {
    const fontSize = caption.style === "title_center" ? Math.round(w / 16) : Math.round(w / 22);
    ctx.font = `bold ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
    ctx.textAlign = "center";

    let y: number;
    if (caption.style === "title_center") {
      y = h / 2;
    } else if (caption.style === "lower_third") {
      y = h * 0.75;
    } else {
      // subtitle_bottom
      y = h - 40;
    }

    const text = caption.text;
    const metrics = ctx.measureText(text);
    const textW = metrics.width;

    // Background pill
    const padX = 16;
    const padY = 10;
    const bgH = fontSize + padY * 2;
    ctx.fillStyle = "rgba(0,0,0,0.65)";
    const radius = bgH / 2;
    const bgX = w / 2 - textW / 2 - padX;
    const bgY = y - fontSize / 2 - padY;
    const bgW = textW + padX * 2;

    ctx.beginPath();
    ctx.roundRect(bgX, bgY, bgW, bgH, radius);
    ctx.fill();

    // Text with slight shadow
    ctx.fillStyle = "#fff";
    ctx.shadowColor = "rgba(0,0,0,0.5)";
    ctx.shadowBlur = 4;
    ctx.fillText(text, w / 2, y + fontSize * 0.35);
    ctx.shadowBlur = 0;

    // Animated entrance - subtle scale effect based on how far into caption we are
  }

  // Playback loop
  useEffect(() => {
    if (!playing) return;

    const video = videoRef.current;
    if (!video) return;

    let lastTimestamp = 0;

    function tick(timestamp: number) {
      if (!video) return;
      const dt = lastTimestamp ? (timestamp - lastTimestamp) / 1000 : 0;
      lastTimestamp = timestamp;

      setCurrentTime((prev) => {
        const next = prev + dt;
        if (next >= totalDuration) {
          setPlaying(false);
          return totalDuration;
        }

        // Map to source time and seek video
        const mapped = outTimeToSrcTime(next);
        if (mapped && Math.abs(video.currentTime - mapped.srcTime) > 0.15) {
          video.currentTime = mapped.srcTime;
        }

        return next;
      });

      animFrameRef.current = requestAnimationFrame(tick);
    }

    animFrameRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [playing, totalDuration, outTimeToSrcTime]);

  // Render when currentTime changes
  useEffect(() => {
    renderFrame();
  }, [renderFrame]);

  // Initialize canvas dimensions
  useEffect(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    function onLoaded() {
      if (!video || !canvas) return;
      // Use edit plan resolution or video dimensions
      const [targetW, targetH] = editPlan.output_format.resolution.split("x").map(Number);
      if (targetW && targetH) {
        canvas.width = targetW;
        canvas.height = targetH;
      } else {
        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 360;
      }
      // Render first frame
      const mapped = outTimeToSrcTime(0);
      if (mapped) video.currentTime = mapped.srcTime;
      setTimeout(renderFrame, 100);
    }

    video.addEventListener("loadeddata", onLoaded);
    return () => video.removeEventListener("loadeddata", onLoaded);
  }, [editPlan.output_format.resolution, outTimeToSrcTime, renderFrame]);

  function togglePlay() {
    const video = videoRef.current;
    if (!video) return;

    if (playing) {
      video.pause();
      setPlaying(false);
    } else {
      if (currentTime >= totalDuration) {
        setCurrentTime(0);
        const mapped = outTimeToSrcTime(0);
        if (mapped) video.currentTime = mapped.srcTime;
      }
      // Keep video playing silently in background for frame extraction
      video.play().catch(() => {});
      setPlaying(true);
    }
  }

  function handleRestart() {
    const video = videoRef.current;
    if (!video) return;
    setPlaying(false);
    setCurrentTime(0);
    const mapped = outTimeToSrcTime(0);
    if (mapped) video.currentTime = mapped.srcTime;
    video.pause();
    setTimeout(renderFrame, 50);
  }

  function handleSeek(e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const newTime = ratio * totalDuration;
    setCurrentTime(newTime);
    const video = videoRef.current;
    const mapped = outTimeToSrcTime(newTime);
    if (video && mapped) {
      video.currentTime = mapped.srcTime;
      setTimeout(renderFrame, 50);
    }
  }

  // Export using FFmpeg WASM
  async function handleExport() {
    setExporting(true);
    setExportProgress(0);

    try {
      const { FFmpeg } = await import("@ffmpeg/ffmpeg");
      const { fetchFile } = await import("@ffmpeg/util");

      const ffmpeg = new FFmpeg();

      ffmpeg.on("progress", ({ progress }) => {
        setExportProgress(Math.round(progress * 100));
      });

      await ffmpeg.load({
        coreURL: "https://unpkg.com/@ffmpeg/core@0.12.10/dist/esm/ffmpeg-core.js",
        wasmURL: "https://unpkg.com/@ffmpeg/core@0.12.10/dist/esm/ffmpeg-core.wasm",
      });

      // Fetch the original video
      const videoData = await fetchFile(videoSrc);
      await ffmpeg.writeFile("input.mp4", videoData);

      // Build FFmpeg filter to concatenate segments
      const segments = editPlan.segments;
      if (segments.length === 0) throw new Error("No segments in edit plan");

      const filterParts: string[] = [];
      segments.forEach((seg, i) => {
        filterParts.push(`[0:v]trim=${seg.start}:${seg.end},setpts=PTS-STARTPTS[v${i}]`);
        filterParts.push(`[0:a]atrim=${seg.start}:${seg.end},asetpts=PTS-STARTPTS[a${i}]`);
      });

      const videoInputs = segments.map((_, i) => `[v${i}]`).join("");
      const audioInputs = segments.map((_, i) => `[a${i}]`).join("");

      if (segments.length > 1) {
        filterParts.push(`${videoInputs}concat=n=${segments.length}:v=1:a=0[vout]`);
        filterParts.push(`${audioInputs}concat=n=${segments.length}:v=0:a=1[aout]`);
      } else {
        filterParts.push(`[v0]null[vout]`);
        filterParts.push(`[a0]anull[aout]`);
      }

      const filterComplex = filterParts.join(";");

      await ffmpeg.exec([
        "-i", "input.mp4",
        "-filter_complex", filterComplex,
        "-map", "[vout]",
        "-map", "[aout]",
        "-c:v", "libx264",
        "-preset", "fast",
        "-c:a", "aac",
        "-y", "output.mp4",
      ]);

      const outputData = await ffmpeg.readFile("output.mp4");
      const blob = new Blob([new Uint8Array(outputData as Uint8Array)], { type: "video/mp4" });
      const url = URL.createObjectURL(blob);
      setExportUrl(url);
    } catch (err) {
      console.error("Export failed:", err);
      alert("Export failed. Your browser may not support WASM video encoding. Try downloading the original video instead.");
    } finally {
      setExporting(false);
    }
  }

  const formatTime = (t: number) => {
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div className="space-y-3">
      {/* Hidden source video */}
      <video
        ref={videoRef}
        src={videoSrc}
        muted={false}
        playsInline
        preload="auto"
        crossOrigin="anonymous"
        className="hidden"
      />

      {/* Canvas player */}
      <div className="relative overflow-hidden rounded-lg border border-border bg-black">
        <canvas
          ref={canvasRef}
          className="w-full"
          style={{ aspectRatio: editPlan.output_format.aspect_ratio === "9:16" ? "9/16" : editPlan.output_format.aspect_ratio === "1:1" ? "1/1" : "16/9" }}
          onClick={togglePlay}
        />

        {/* Play overlay when paused */}
        {!playing && currentTime === 0 && (
          <div
            className="absolute inset-0 flex cursor-pointer items-center justify-center bg-black/30"
            onClick={togglePlay}
          >
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/90 text-white shadow-lg">
              <Play className="h-7 w-7 pl-1" fill="currentColor" />
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3">
        <button
          onClick={togglePlay}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground transition-colors hover:bg-primary/90"
        >
          {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 pl-0.5" />}
        </button>

        <button
          onClick={handleRestart}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-border transition-colors hover:bg-secondary"
        >
          <RotateCcw className="h-4 w-4" />
        </button>

        {/* Seek bar */}
        <div className="flex-1 cursor-pointer" onClick={handleSeek}>
          <div className="relative h-2 rounded-full bg-secondary">
            <div
              className="absolute left-0 top-0 h-full rounded-full bg-primary transition-all"
              style={{ width: `${totalDuration > 0 ? (currentTime / totalDuration) * 100 : 0}%` }}
            />
          </div>
        </div>

        <span className="min-w-[80px] text-right font-mono text-xs text-muted-foreground">
          {formatTime(currentTime)} / {formatTime(totalDuration)}
        </span>
      </div>

      {/* Active caption indicator */}
      {(() => {
        const cap = getCaptionAtTime(currentTime);
        return cap ? (
          <div className="rounded-lg bg-primary/10 px-3 py-2 text-center text-sm font-medium text-primary">
            {cap.text}
          </div>
        ) : null;
      })()}

      {/* Export button */}
      <div className="flex flex-wrap gap-2">
        {exportUrl ? (
          <a
            href={exportUrl}
            download={`${projectTitle.replace(/[^a-zA-Z0-9]/g, "_")}_edited.mp4`}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <Download className="h-4 w-4" />
            Save Edited Video
          </a>
        ) : (
          <button
            onClick={handleExport}
            disabled={exporting}
            className={cn(
              "inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90",
              exporting && "opacity-70"
            )}
          >
            {exporting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Rendering {exportProgress}%
              </>
            ) : (
              <>
                <Download className="h-4 w-4" />
                Export Edited Video
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
