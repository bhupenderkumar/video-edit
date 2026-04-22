"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import {
  Play, Pause, Download, Loader2, RotateCcw,
  Sun, Contrast, Droplets, Volume2, VolumeX,
  Music, Upload, Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ──────────────────────────────────────────────────────────────────

interface EditSegment { start: number; end: number; reason: string }
interface EditCaption { start: number; end: number; text: string; style: string }
interface EditTransition { at: number; type: string; duration: number }
interface IntroSlide { title: string; subtitle: string; duration: number; style: string; color: string }
interface MusicSuggestion { mood: string; genre: string; tempo: string; description: string; keywords: string[] }
interface EffectsConfig { brightness: number; contrast: number; saturation: number }

interface EditPlan {
  segments: EditSegment[];
  transitions: EditTransition[];
  captions: EditCaption[];
  color_grade: string;
  audio_adjustments: { normalize: boolean; remove_silence: boolean };
  output_format: { aspect_ratio: string; resolution: string };
  intro_slide?: IntroSlide;
  outro_slide?: IntroSlide;
  music_suggestion?: MusicSuggestion;
  effects?: EffectsConfig;
}

interface Props {
  videoSrc: string;
  editPlan: EditPlan;
  projectId: string;
  projectTitle: string;
}

// ── Royalty-free music tracks ──────────────────────────────────────────────

const ROYALTY_FREE_TRACKS = [
  { id: "uplifting", name: "Uplifting Journey", mood: "happy", tempo: "medium", url: "https://cdn.pixabay.com/audio/2024/11/29/audio_7e3dfe6f72.mp3" },
  { id: "corporate", name: "Corporate Inspire", mood: "professional", tempo: "medium", url: "https://cdn.pixabay.com/audio/2024/09/10/audio_6e1ebc2e5e.mp3" },
  { id: "cinematic", name: "Cinematic Emotional", mood: "dramatic", tempo: "slow", url: "https://cdn.pixabay.com/audio/2024/07/23/audio_ba3e8e0db1.mp3" },
  { id: "fun", name: "Fun & Playful", mood: "cheerful", tempo: "fast", url: "https://cdn.pixabay.com/audio/2024/02/14/audio_8e5e7cf05d.mp3" },
  { id: "chill", name: "Chill Lo-Fi", mood: "relaxed", tempo: "slow", url: "https://cdn.pixabay.com/audio/2024/04/15/audio_62b01623a7.mp3" },
  { id: "celebration", name: "Celebration Time", mood: "festive", tempo: "fast", url: "https://cdn.pixabay.com/audio/2022/10/30/audio_f2bd5bfbd6.mp3" },
];

// ── Color grade filters ────────────────────────────────────────────────────

const colorGradeFilters: Record<string, string> = {
  natural: "none",
  warm: "sepia(0.15) saturate(1.2) brightness(1.05)",
  cool: "hue-rotate(10deg) saturate(0.9) brightness(1.05)",
  vibrant: "saturate(1.5) contrast(1.1)",
  cinematic: "contrast(1.15) saturate(0.85) brightness(0.95)",
  vintage: "sepia(0.3) contrast(1.1) brightness(0.95)",
  bw: "grayscale(1) contrast(1.2)",
};

// ── Intro/Outro slide renderer ─────────────────────────────────────────────

function drawSlide(
  ctx: CanvasRenderingContext2D,
  slide: IntroSlide,
  w: number,
  h: number,
  progress: number
) {
  const color = slide.color || "#6d28d9";

  // Background based on style
  if (slide.style === "school") {
    ctx.fillStyle = "#1a2332";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "rgba(255,255,255,0.03)";
    for (let i = 0; i < 100; i++) {
      const x = (Math.sin(i * 17.3) * 0.5 + 0.5) * w;
      const y = (Math.cos(i * 23.7) * 0.5 + 0.5) * h;
      ctx.fillRect(x, y, 2, 2);
    }
    ctx.strokeStyle = "#8B7355";
    ctx.lineWidth = 12;
    ctx.strokeRect(20, 20, w - 40, h - 40);
  } else if (slide.style === "bold") {
    const grd = ctx.createLinearGradient(0, 0, w, h);
    grd.addColorStop(0, color);
    grd.addColorStop(0.5, "#ec4899");
    grd.addColorStop(1, "#f59e0b");
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, w, h);
  } else if (slide.style === "minimal") {
    ctx.fillStyle = "#0a0a0a";
    ctx.fillRect(0, 0, w, h);
    const lineW = w * 0.3 * Math.min(1, progress * 2);
    ctx.fillStyle = color;
    ctx.fillRect(w / 2 - lineW / 2, h * 0.55, lineW, 3);
  } else {
    // gradient (default)
    const grd = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w * 0.7);
    grd.addColorStop(0, color);
    grd.addColorStop(1, "#09090b");
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, w, h);
  }

  // Animated particles
  ctx.fillStyle = "rgba(255,255,255,0.1)";
  for (let i = 0; i < 20; i++) {
    const angle = progress * Math.PI * 2 + i * 0.5;
    const radius = 50 + i * 15;
    const px = w / 2 + Math.cos(angle) * radius;
    const py = h / 2 + Math.sin(angle) * radius * 0.5;
    const size = 2 + Math.sin(progress * 5 + i) * 2;
    ctx.beginPath();
    ctx.arc(px, py, Math.max(0.5, size), 0, Math.PI * 2);
    ctx.fill();
  }

  // Title with animated entrance
  const titleAlpha = Math.min(1, progress * 3);
  const titleY = h * 0.4 + (1 - Math.min(1, progress * 2)) * 30;
  const titleSize = Math.round(w / 12);
  ctx.font = `bold ${titleSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
  ctx.textAlign = "center";
  ctx.fillStyle = `rgba(255,255,255,${titleAlpha})`;
  ctx.shadowColor = "rgba(0,0,0,0.5)";
  ctx.shadowBlur = 8;
  ctx.fillText(slide.title, w / 2, titleY);

  // Subtitle (delayed entrance)
  const subAlpha = Math.max(0, Math.min(1, (progress - 0.3) * 3));
  if (subAlpha > 0) {
    const subSize = Math.round(w / 24);
    ctx.font = `${subSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
    ctx.fillStyle = `rgba(255,255,255,${subAlpha * 0.8})`;
    ctx.shadowBlur = 4;
    ctx.fillText(slide.subtitle, w / 2, titleY + titleSize * 1.5);
  }
  ctx.shadowBlur = 0;

  // Fade in/out
  if (progress < 0.15) {
    ctx.fillStyle = `rgba(0,0,0,${1 - progress / 0.15})`;
    ctx.fillRect(0, 0, w, h);
  } else if (progress > 0.85) {
    ctx.fillStyle = `rgba(0,0,0,${(progress - 0.85) / 0.15})`;
    ctx.fillRect(0, 0, w, h);
  }
}

// ── Main Component ─────────────────────────────────────────────────────────

export default function EditedVideoPlayer({ videoSrc, editPlan, projectId, projectTitle }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bgMusicRef = useRef<HTMLAudioElement | null>(null);
  const animFrameRef = useRef<number>(0);

  // Playback
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState(0);

  // Effects
  const [brightness, setBrightness] = useState(editPlan.effects?.brightness ?? 1.0);
  const [contrast, setContrast] = useState(editPlan.effects?.contrast ?? 1.05);
  const [saturation, setSaturation] = useState(editPlan.effects?.saturation ?? 1.1);
  const [colorGrade, setColorGrade] = useState(editPlan.color_grade || "natural");

  // Audio
  const [originalVolume, setOriginalVolume] = useState(1.0);
  const [musicVolume, setMusicVolume] = useState(0.3);
  const [originalMuted, setOriginalMuted] = useState(false);

  // Music
  const [selectedTrack, setSelectedTrack] = useState("");
  const [customMusicUrl, setCustomMusicUrl] = useState("");
  const [musicLoading, setMusicLoading] = useState(false);

  // Export
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportUrl, setExportUrl] = useState<string | null>(null);

  // Panel toggles
  const [showEffects, setShowEffects] = useState(false);
  const [showMusic, setShowMusic] = useState(false);

  // Timeline durations
  const introDuration = editPlan.intro_slide?.duration ?? 4;
  const outroDuration = editPlan.outro_slide?.duration ?? 3;

  // Build timeline: intro → segments → outro
  const timeline = useRef<{ segIndex: number; segStart: number; segEnd: number; outStart: number; outEnd: number }[]>([]);

  useEffect(() => {
    let cumulative = introDuration;
    timeline.current = editPlan.segments.map((seg, i) => {
      const duration = seg.end - seg.start;
      const entry = { segIndex: i, segStart: seg.start, segEnd: seg.end, outStart: cumulative, outEnd: cumulative + duration };
      cumulative += duration;
      return entry;
    });
    setTotalDuration(cumulative + outroDuration);
  }, [editPlan.segments, introDuration, outroDuration]);

  // Map output time → source time + phase
  const outTimeToSrcTime = useCallback((outTime: number): { srcTime: number; segIndex: number; phase: "intro" | "video" | "outro" } | null => {
    if (outTime < introDuration) return { srcTime: 0, segIndex: -1, phase: "intro" };
    for (const entry of timeline.current) {
      if (outTime >= entry.outStart && outTime < entry.outEnd) {
        return { srcTime: entry.segStart + (outTime - entry.outStart), segIndex: entry.segIndex, phase: "video" };
      }
    }
    const last = timeline.current[timeline.current.length - 1];
    if (last && outTime >= last.outEnd) return { srcTime: last.segEnd, segIndex: -2, phase: "outro" };
    return null;
  }, [introDuration]);

  // Get caption at output time
  const getCaptionAtTime = useCallback((outTime: number): EditCaption | null => {
    for (const cap of editPlan.captions) {
      for (const entry of timeline.current) {
        if (cap.start >= entry.segStart && cap.start < entry.segEnd) {
          const capOutStart = entry.outStart + (cap.start - entry.segStart);
          const capOutEnd = capOutStart + (cap.end - cap.start);
          if (outTime >= capOutStart && outTime < capOutEnd) return cap;
        }
      }
    }
    return null;
  }, [editPlan.captions]);

  // Get transition opacity at output time
  const getTransitionOpacity = useCallback((outTime: number): number => {
    for (const trans of editPlan.transitions) {
      for (const entry of timeline.current) {
        if (trans.at >= entry.segStart && trans.at <= entry.segEnd) {
          const transOutTime = entry.outStart + (trans.at - entry.segStart);
          const halfDur = trans.duration / 2;
          if ((trans.type === "fade_black" || trans.type === "crossfade") &&
              outTime >= transOutTime - halfDur && outTime <= transOutTime + halfDur) {
            return 1 - (Math.abs(outTime - transOutTime) / halfDur) * 0.7;
          }
        }
      }
    }
    return 1;
  }, [editPlan.transitions]);

  // Draw caption on canvas
  function drawCaption(ctx: CanvasRenderingContext2D, caption: EditCaption, w: number, h: number) {
    const fontSize = caption.style === "title_center" ? Math.round(w / 16) : Math.round(w / 22);
    ctx.font = `bold ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
    ctx.textAlign = "center";
    const y = caption.style === "title_center" ? h / 2 : caption.style === "lower_third" ? h * 0.75 : h - 40;
    const metrics = ctx.measureText(caption.text);
    const padX = 16, padY = 10, bgH = fontSize + padY * 2;
    ctx.fillStyle = "rgba(0,0,0,0.65)";
    ctx.beginPath();
    ctx.roundRect(w / 2 - metrics.width / 2 - padX, y - fontSize / 2 - padY, metrics.width + padX * 2, bgH, bgH / 2);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.shadowColor = "rgba(0,0,0,0.5)";
    ctx.shadowBlur = 4;
    ctx.fillText(caption.text, w / 2, y + fontSize * 0.35);
    ctx.shadowBlur = 0;
  }

  // Render frame
  const renderFrame = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const w = canvas.width, h = canvas.height;
    const mapped = outTimeToSrcTime(currentTime);
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, w, h);
    if (!mapped) return;

    // Intro slide
    if (mapped.phase === "intro" && editPlan.intro_slide) {
      drawSlide(ctx, editPlan.intro_slide, w, h, currentTime / introDuration);
      return;
    }
    // Outro slide
    if (mapped.phase === "outro" && editPlan.outro_slide) {
      const last = timeline.current[timeline.current.length - 1];
      const outroStart = last ? last.outEnd : introDuration;
      drawSlide(ctx, editPlan.outro_slide, w, h, Math.min(1, (currentTime - outroStart) / outroDuration));
      return;
    }

    // Video phase
    const opacity = getTransitionOpacity(currentTime);
    const gradeFilter = colorGradeFilters[colorGrade] || "none";
    const effectsFilter = `brightness(${brightness}) contrast(${contrast}) saturate(${saturation})`;
    ctx.filter = gradeFilter === "none" ? effectsFilter : `${gradeFilter} ${effectsFilter}`;
    ctx.globalAlpha = opacity;
    const vw = video.videoWidth || w, vh = video.videoHeight || h;
    const scale = Math.min(w / vw, h / vh);
    const dw = vw * scale, dh = vh * scale;
    ctx.drawImage(video, (w - dw) / 2, (h - dh) / 2, dw, dh);
    ctx.filter = "none";
    ctx.globalAlpha = 1;

    const caption = getCaptionAtTime(currentTime);
    if (caption) drawCaption(ctx, caption, w, h);

    // Progress bar
    const progress = totalDuration > 0 ? currentTime / totalDuration : 0;
    ctx.fillStyle = "rgba(255,255,255,0.15)";
    ctx.fillRect(0, h - 4, w, 4);
    ctx.fillStyle = "#6d28d9";
    ctx.fillRect(0, h - 4, w * progress, 4);
  }, [currentTime, totalDuration, brightness, contrast, saturation, colorGrade,
      editPlan.intro_slide, editPlan.outro_slide, introDuration, outroDuration,
      outTimeToSrcTime, getCaptionAtTime, getTransitionOpacity]);

  // Playback loop
  useEffect(() => {
    if (!playing) return;
    const video = videoRef.current;
    if (!video) return;
    let lastTs = 0;

    function tick(ts: number) {
      if (!video) return;
      const dt = lastTs ? (ts - lastTs) / 1000 : 0;
      lastTs = ts;
      setCurrentTime(prev => {
        const next = prev + dt;
        if (next >= totalDuration) {
          setPlaying(false);
          if (bgMusicRef.current) bgMusicRef.current.pause();
          return totalDuration;
        }
        const m = outTimeToSrcTime(next);
        if (m && m.phase === "video") {
          if (Math.abs(video.currentTime - m.srcTime) > 0.15) video.currentTime = m.srcTime;
          if (video.paused) video.play().catch(() => {});
        } else if (!video.paused) {
          video.pause();
        }
        return next;
      });
      animFrameRef.current = requestAnimationFrame(tick);
    }
    animFrameRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [playing, totalDuration, outTimeToSrcTime]);

  useEffect(() => { renderFrame(); }, [renderFrame]);

  // Init canvas
  useEffect(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    function onLoaded() {
      if (!video || !canvas) return;
      const [tw, th] = editPlan.output_format.resolution.split("x").map(Number);
      canvas.width = tw || video.videoWidth || 640;
      canvas.height = th || video.videoHeight || 360;
      setTimeout(renderFrame, 100);
    }
    video.addEventListener("loadeddata", onLoaded);
    if (video.readyState >= 2) onLoaded();
    return () => video.removeEventListener("loadeddata", onLoaded);
  }, [editPlan.output_format.resolution, renderFrame]);

  // Sync volumes
  useEffect(() => {
    const v = videoRef.current;
    if (v) { v.volume = originalMuted ? 0 : originalVolume; v.muted = originalMuted; }
  }, [originalVolume, originalMuted]);

  useEffect(() => {
    if (bgMusicRef.current) bgMusicRef.current.volume = musicVolume;
  }, [musicVolume]);

  // ── Control handlers ─────────────────────────────────────────────────────

  function togglePlay() {
    const video = videoRef.current;
    if (!video) return;
    if (playing) {
      video.pause();
      if (bgMusicRef.current) bgMusicRef.current.pause();
      setPlaying(false);
    } else {
      if (currentTime >= totalDuration) {
        setCurrentTime(0);
        if (bgMusicRef.current) bgMusicRef.current.currentTime = 0;
      }
      const m = outTimeToSrcTime(currentTime);
      if (m && m.phase === "video") video.play().catch(() => {});
      if (bgMusicRef.current && (selectedTrack || customMusicUrl)) bgMusicRef.current.play().catch(() => {});
      setPlaying(true);
    }
  }

  function handleRestart() {
    const video = videoRef.current;
    if (!video) return;
    setPlaying(false);
    setCurrentTime(0);
    video.pause();
    video.currentTime = 0;
    if (bgMusicRef.current) { bgMusicRef.current.pause(); bgMusicRef.current.currentTime = 0; }
    setTimeout(renderFrame, 50);
  }

  function handleSeek(e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const newTime = ratio * totalDuration;
    setCurrentTime(newTime);
    const video = videoRef.current;
    const m = outTimeToSrcTime(newTime);
    if (video && m && m.phase === "video") video.currentTime = m.srcTime;
    setTimeout(renderFrame, 50);
  }

  function handleSelectTrack(trackId: string) {
    const track = ROYALTY_FREE_TRACKS.find(t => t.id === trackId);
    if (!track) return;
    setSelectedTrack(trackId);
    setCustomMusicUrl("");
    setMusicLoading(true);
    if (bgMusicRef.current) { bgMusicRef.current.pause(); bgMusicRef.current.src = ""; }
    const audio = new Audio(track.url);
    audio.crossOrigin = "anonymous";
    audio.volume = musicVolume;
    audio.loop = true;
    audio.oncanplay = () => setMusicLoading(false);
    audio.onerror = () => { setMusicLoading(false); setSelectedTrack(""); };
    bgMusicRef.current = audio;
  }

  function handleCustomMusic(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setCustomMusicUrl(url);
    setSelectedTrack("custom");
    setMusicLoading(true);
    if (bgMusicRef.current) { bgMusicRef.current.pause(); bgMusicRef.current.src = ""; }
    const audio = new Audio(url);
    audio.volume = musicVolume;
    audio.loop = true;
    audio.oncanplay = () => setMusicLoading(false);
    bgMusicRef.current = audio;
  }

  function removeMusic() {
    if (bgMusicRef.current) { bgMusicRef.current.pause(); bgMusicRef.current.src = ""; }
    setSelectedTrack("");
    setCustomMusicUrl("");
  }

  async function handleExport() {
    setExporting(true);
    setExportProgress(0);
    try {
      const { FFmpeg } = await import("@ffmpeg/ffmpeg");
      const { fetchFile } = await import("@ffmpeg/util");
      const ffmpeg = new FFmpeg();
      ffmpeg.on("progress", ({ progress }) => setExportProgress(Math.round(progress * 100)));
      await ffmpeg.load({
        coreURL: "https://unpkg.com/@ffmpeg/core@0.12.10/dist/esm/ffmpeg-core.js",
        wasmURL: "https://unpkg.com/@ffmpeg/core@0.12.10/dist/esm/ffmpeg-core.wasm",
      });
      const videoData = await fetchFile(videoSrc);
      await ffmpeg.writeFile("input.mp4", videoData);
      const segs = editPlan.segments;
      if (segs.length === 0) throw new Error("No segments");
      const fp: string[] = [];
      segs.forEach((seg, i) => {
        fp.push(`[0:v]trim=${seg.start}:${seg.end},setpts=PTS-STARTPTS[v${i}]`);
        fp.push(`[0:a]atrim=${seg.start}:${seg.end},asetpts=PTS-STARTPTS[a${i}]`);
      });
      const vi = segs.map((_, i) => `[v${i}]`).join("");
      const ai = segs.map((_, i) => `[a${i}]`).join("");
      if (segs.length > 1) {
        fp.push(`${vi}concat=n=${segs.length}:v=1:a=0[vout]`);
        fp.push(`${ai}concat=n=${segs.length}:v=0:a=1[aout]`);
      } else {
        fp.push("[v0]null[vout]");
        fp.push("[a0]anull[aout]");
      }
      await ffmpeg.exec(["-i", "input.mp4", "-filter_complex", fp.join(";"), "-map", "[vout]", "-map", "[aout]", "-c:v", "libx264", "-preset", "fast", "-c:a", "aac", "-y", "output.mp4"]);
      const out = await ffmpeg.readFile("output.mp4");
      const blob = new Blob([new Uint8Array(out as Uint8Array)], { type: "video/mp4" });
      setExportUrl(URL.createObjectURL(blob));
    } catch (err) {
      console.error("Export failed:", err);
      alert("Export failed. Try downloading the original video instead.");
    } finally {
      setExporting(false);
    }
  }

  const fmt = (t: number) => `${Math.floor(t / 60)}:${Math.floor(t % 60).toString().padStart(2, "0")}`;
  const mapped = outTimeToSrcTime(currentTime);
  const currentPhase = mapped?.phase || "intro";

  return (
    <div className="space-y-3">
      <video ref={videoRef} src={videoSrc} playsInline preload="auto" crossOrigin="anonymous" className="hidden" />

      {/* Canvas */}
      <div className="relative overflow-hidden rounded-lg border border-border bg-black">
        <canvas
          ref={canvasRef}
          className="w-full cursor-pointer"
          style={{ aspectRatio: editPlan.output_format.aspect_ratio === "9:16" ? "9/16" : editPlan.output_format.aspect_ratio === "1:1" ? "1/1" : "16/9" }}
          onClick={togglePlay}
        />
        {!playing && currentTime === 0 && (
          <div className="absolute inset-0 flex cursor-pointer items-center justify-center bg-black/30" onClick={togglePlay}>
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/90 text-white shadow-lg">
              <Play className="h-7 w-7 pl-1" fill="currentColor" />
            </div>
          </div>
        )}
        <div className="absolute left-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-medium text-white">
          {currentPhase === "intro" ? "🎬 Intro" : currentPhase === "outro" ? "🎬 Outro" : "▶ Playing"}
        </div>
      </div>

      {/* Playback controls */}
      <div className="flex items-center gap-3">
        <button onClick={togglePlay} className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground hover:bg-primary/90">
          {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 pl-0.5" />}
        </button>
        <button onClick={handleRestart} className="flex h-9 w-9 items-center justify-center rounded-full border border-border hover:bg-secondary">
          <RotateCcw className="h-4 w-4" />
        </button>
        <div className="flex-1 cursor-pointer" onClick={handleSeek}>
          <div className="relative h-2 rounded-full bg-secondary">
            <div className="absolute left-0 top-0 h-full rounded-full bg-primary transition-all" style={{ width: `${totalDuration > 0 ? (currentTime / totalDuration) * 100 : 0}%` }} />
            {timeline.current.map((entry, i) => (
              <div key={i} className="absolute top-0 h-full w-px bg-white/30" style={{ left: `${(entry.outStart / totalDuration) * 100}%` }} />
            ))}
          </div>
        </div>
        <span className="min-w-[80px] text-right font-mono text-xs text-muted-foreground">{fmt(currentTime)} / {fmt(totalDuration)}</span>
      </div>

      {/* Caption */}
      {(() => {
        const cap = getCaptionAtTime(currentTime);
        return cap ? <div className="rounded-lg bg-primary/10 px-3 py-2 text-center text-sm font-medium text-primary">{cap.text}</div> : null;
      })()}

      {/* Panel toggles */}
      <div className="flex gap-2">
        <button onClick={() => { setShowEffects(!showEffects); setShowMusic(false); }}
          className={cn("inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-colors",
            showEffects ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-secondary")}>
          <Sparkles className="h-3.5 w-3.5" /> Effects & Color
        </button>
        <button onClick={() => { setShowMusic(!showMusic); setShowEffects(false); }}
          className={cn("inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-colors",
            showMusic ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-secondary")}>
          <Music className="h-3.5 w-3.5" /> Music & Audio
        </button>
      </div>

      {/* Effects Panel */}
      {showEffects && (
        <div className="space-y-4 rounded-xl border border-border bg-card p-4">
          <h3 className="text-sm font-semibold">Visual Effects</h3>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground"><Sun className="h-3.5 w-3.5" /> Brightness</label>
              <span className="text-xs font-mono text-primary">{(brightness * 100).toFixed(0)}%</span>
            </div>
            <input type="range" min="50" max="200" value={brightness * 100} onChange={e => setBrightness(parseInt(e.target.value) / 100)} className="w-full accent-primary" />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground"><Contrast className="h-3.5 w-3.5" /> Contrast</label>
              <span className="text-xs font-mono text-primary">{(contrast * 100).toFixed(0)}%</span>
            </div>
            <input type="range" min="50" max="200" value={contrast * 100} onChange={e => setContrast(parseInt(e.target.value) / 100)} className="w-full accent-primary" />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground"><Droplets className="h-3.5 w-3.5" /> Saturation</label>
              <span className="text-xs font-mono text-primary">{(saturation * 100).toFixed(0)}%</span>
            </div>
            <input type="range" min="0" max="300" value={saturation * 100} onChange={e => setSaturation(parseInt(e.target.value) / 100)} className="w-full accent-primary" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">Color Grade</label>
            <div className="flex flex-wrap gap-1.5">
              {Object.keys(colorGradeFilters).map(grade => (
                <button key={grade} onClick={() => setColorGrade(grade)}
                  className={cn("rounded-full px-3 py-1 text-xs font-medium capitalize transition-colors",
                    colorGrade === grade ? "bg-primary text-primary-foreground" : "bg-secondary hover:bg-secondary/80")}>
                  {grade}
                </button>
              ))}
            </div>
          </div>
          <button onClick={() => { setBrightness(1.0); setContrast(1.0); setSaturation(1.0); setColorGrade("natural"); }}
            className="text-xs text-muted-foreground hover:text-foreground">Reset to defaults</button>
        </div>
      )}

      {/* Music Panel */}
      {showMusic && (
        <div className="space-y-4 rounded-xl border border-border bg-card p-4">
          <h3 className="text-sm font-semibold">Music & Audio</h3>

          {editPlan.music_suggestion && (
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-primary"><Sparkles className="h-3.5 w-3.5" /> AI Music Suggestion</div>
              <p className="mt-1 text-xs text-muted-foreground">{editPlan.music_suggestion.description}</p>
              <div className="mt-2 flex flex-wrap gap-1">
                {[editPlan.music_suggestion.mood, editPlan.music_suggestion.genre, editPlan.music_suggestion.tempo].map(tag => (
                  <span key={tag} className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">{tag}</span>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                {originalMuted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />} Original Audio
              </label>
              <button onClick={() => setOriginalMuted(!originalMuted)} className="text-[10px] text-primary hover:underline">
                {originalMuted ? "Unmute" : "Mute"}
              </button>
            </div>
            <input type="range" min="0" max="100" value={originalMuted ? 0 : originalVolume * 100}
              onChange={e => { setOriginalVolume(parseInt(e.target.value) / 100); setOriginalMuted(false); }}
              className="w-full accent-primary" />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground"><Music className="h-3.5 w-3.5" /> Music Volume</label>
              <span className="text-xs font-mono text-primary">{(musicVolume * 100).toFixed(0)}%</span>
            </div>
            <input type="range" min="0" max="100" value={musicVolume * 100} onChange={e => setMusicVolume(parseInt(e.target.value) / 100)} className="w-full accent-primary" />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">Background Music (Royalty-Free)</label>
            <div className="grid grid-cols-2 gap-1.5">
              {ROYALTY_FREE_TRACKS.map(track => (
                <button key={track.id} onClick={() => handleSelectTrack(track.id)}
                  className={cn("rounded-lg border p-2 text-left text-xs transition-colors",
                    selectedTrack === track.id ? "border-primary bg-primary/10" : "border-border hover:bg-secondary")}>
                  <div className="font-medium">{track.name}</div>
                  <div className="text-[10px] text-muted-foreground">{track.mood} • {track.tempo}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">Or upload your own music</label>
            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-border p-3 hover:bg-secondary">
              <Upload className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Choose audio file (MP3, WAV, M4A)</span>
              <input type="file" accept="audio/*" className="hidden" onChange={handleCustomMusic} />
            </label>
          </div>

          {musicLoading && <div className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading music...</div>}
          {(selectedTrack || customMusicUrl) && !musicLoading && (
            <div className="flex items-center justify-between">
              <span className="text-xs text-green-400">♪ {selectedTrack === "custom" ? "Custom Track" : ROYALTY_FREE_TRACKS.find(t => t.id === selectedTrack)?.name} loaded</span>
              <button onClick={removeMusic} className="text-[10px] text-destructive hover:underline">Remove</button>
            </div>
          )}
        </div>
      )}

      {/* Export */}
      <div className="flex flex-wrap gap-2">
        {exportUrl ? (
          <a href={exportUrl} download={`${projectTitle.replace(/[^a-zA-Z0-9]/g, "_")}_edited.mp4`}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            <Download className="h-4 w-4" /> Save Edited Video
          </a>
        ) : (
          <button onClick={handleExport} disabled={exporting}
            className={cn("inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90", exporting && "opacity-70")}>
            {exporting ? <><Loader2 className="h-4 w-4 animate-spin" /> Rendering {exportProgress}%</> : <><Download className="h-4 w-4" /> Export Edited Video</>}
          </button>
        )}
      </div>
    </div>
  );
}
