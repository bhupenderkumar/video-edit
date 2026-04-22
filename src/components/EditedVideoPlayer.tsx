"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import {
  Play, Pause, Download, Loader2, RotateCcw,
  Sun, Contrast, Droplets, Volume2, VolumeX,
  Music, Upload, Sparkles, Zap, Eye,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  ANIMATIONS, ANIMATION_NAMES, getAnimation, applyAnimTransform,
  COLOR_PRESETS, buildFilter, autoAssignAnimations,
} from "@/lib/animations";

// ── Types ──────────────────────────────────────────────────────────────────

interface EditSegment { start: number; end: number; reason: string; animation?: string }
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

// ── Intro/Outro slide renderer ─────────────────────────────────────────────

function drawSlide(
  ctx: CanvasRenderingContext2D,
  slide: IntroSlide,
  w: number,
  h: number,
  progress: number
) {
  const color = slide.color || "#6d28d9";
  const ep = Math.min(1, progress);

  // Background
  if (slide.style === "school") {
    const grd = ctx.createLinearGradient(0, 0, 0, h);
    grd.addColorStop(0, "#1a2e1a");
    grd.addColorStop(0.5, "#1d3420");
    grd.addColorStop(1, "#152a15");
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "rgba(255,255,255,0.015)";
    for (let i = 0; i < 200; i++) {
      const x = (Math.sin(i * 17.3 + 0.5) * 0.5 + 0.5) * w;
      const y = (Math.cos(i * 23.7 + 0.3) * 0.5 + 0.5) * h;
      ctx.fillRect(x, y, 1 + Math.random(), 1 + Math.random());
    }
    ctx.strokeStyle = "#5C4033";
    ctx.lineWidth = Math.max(8, w * 0.012);
    ctx.strokeRect(10, 10, w - 20, h - 20);
    ctx.strokeStyle = "#8B6914";
    ctx.lineWidth = 2;
    ctx.strokeRect(14, 14, w - 28, h - 28);
  } else if (slide.style === "bold") {
    const grd = ctx.createLinearGradient(0, 0, w, h);
    grd.addColorStop(0, color);
    grd.addColorStop(0.4, "#ec4899");
    grd.addColorStop(0.7, "#f59e0b");
    grd.addColorStop(1, "#06b6d4");
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, w, h);
    ctx.globalAlpha = 0.08;
    for (let i = 0; i < 6; i++) {
      ctx.beginPath();
      const cx = w * (0.2 + i * 0.12), cy = h * (0.3 + Math.sin(i) * 0.2);
      ctx.arc(cx, cy, 30 + i * 20 + ep * 20, 0, Math.PI * 2);
      ctx.fillStyle = "#fff";
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  } else if (slide.style === "minimal") {
    ctx.fillStyle = "#0a0a0a";
    ctx.fillRect(0, 0, w, h);
    const lineW = w * 0.3 * Math.min(1, ep * 2);
    ctx.fillStyle = color;
    ctx.fillRect(w / 2 - lineW / 2, h * 0.55, lineW, 2);
    ctx.globalAlpha = 0.3;
    ctx.fillRect(0, 0, w * 0.08 * Math.min(1, ep * 3), 2);
    ctx.fillRect(0, 0, 2, h * 0.08 * Math.min(1, ep * 3));
    ctx.fillRect(w - w * 0.08 * Math.min(1, ep * 3), h - 2, w * 0.08, 2);
    ctx.fillRect(w - 2, h - h * 0.08 * Math.min(1, ep * 3), 2, h * 0.08);
    ctx.globalAlpha = 1;
  } else {
    const grd = ctx.createRadialGradient(w / 2, h * 0.4, 0, w / 2, h / 2, w * 0.7);
    grd.addColorStop(0, color);
    grd.addColorStop(0.6, "#1a1a2e");
    grd.addColorStop(1, "#09090b");
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, w, h);
  }

  // Particles
  ctx.fillStyle = "rgba(255,255,255,0.06)";
  for (let i = 0; i < 15; i++) {
    const angle = ep * Math.PI * 1.5 + i * 0.7;
    const radius = 40 + i * 18;
    const px = w / 2 + Math.cos(angle) * radius;
    const py = h * 0.4 + Math.sin(angle) * radius * 0.4;
    const size = 1.5 + Math.sin(ep * 4 + i) * 1.5;
    ctx.beginPath();
    ctx.arc(px, py, Math.max(0.5, size), 0, Math.PI * 2);
    ctx.fill();
  }

  // Title
  const titleAlpha = Math.min(1, ep * 3);
  const titleY = h * 0.42 + (1 - Math.min(1, ep * 2.5)) * 25;
  const titleSize = Math.round(Math.min(w / 11, h / 7));
  ctx.font = `700 ${titleSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = `rgba(255,255,255,${titleAlpha})`;
  ctx.shadowColor = "rgba(0,0,0,0.4)";
  ctx.shadowBlur = 6;
  ctx.shadowOffsetY = 2;
  ctx.fillText(slide.title, w / 2, titleY, w * 0.85);
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  // Subtitle
  const subAlpha = Math.max(0, Math.min(1, (ep - 0.25) * 3));
  if (subAlpha > 0) {
    const subSize = Math.round(Math.min(w / 22, h / 14));
    ctx.font = `400 ${subSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif`;
    ctx.fillStyle = `rgba(255,255,255,${subAlpha * 0.7})`;
    ctx.fillText(slide.subtitle, w / 2, titleY + titleSize * 1.2, w * 0.8);
  }

  // Fade in/out
  if (ep < 0.12) {
    ctx.fillStyle = `rgba(0,0,0,${1 - ep / 0.12})`;
    ctx.fillRect(0, 0, w, h);
  } else if (ep > 0.88) {
    ctx.fillStyle = `rgba(0,0,0,${(ep - 0.88) / 0.12})`;
    ctx.fillRect(0, 0, w, h);
  }
}

// ── Caption renderer ───────────────────────────────────────────────────────

function easeOutCubic(t: number): number { return 1 - Math.pow(1 - t, 3); }

function drawCaption(ctx: CanvasRenderingContext2D, caption: EditCaption, w: number, h: number, progress: number) {
  const fontSize = caption.style === "title_center" ? Math.round(Math.min(w / 14, h / 9)) : Math.round(Math.min(w / 22, h / 14));
  ctx.font = `600 ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const y = caption.style === "title_center" ? h / 2 : caption.style === "lower_third" ? h * 0.78 : h - fontSize * 1.5;
  const metrics = ctx.measureText(caption.text);
  const padX = fontSize * 0.6, padY = fontSize * 0.35;
  const boxW = metrics.width + padX * 2, boxH = fontSize + padY * 2;

  const entryP = Math.min(1, progress * 6);
  const exitP = Math.max(0, (progress - 0.85) / 0.15);
  const alpha = Math.min(easeOutCubic(entryP), 1 - exitP);
  const slideUp = (1 - easeOutCubic(entryP)) * 15;

  ctx.globalAlpha = alpha;
  ctx.fillStyle = "rgba(0,0,0,0.6)";
  ctx.beginPath();
  ctx.roundRect(w / 2 - boxW / 2, y - boxH / 2 + slideUp, boxW, boxH, boxH / 2);
  ctx.fill();

  if (caption.style === "lower_third") {
    ctx.fillStyle = "#6d28d9";
    ctx.fillRect(w / 2 - boxW / 2 + padX * 0.5, y - boxH / 2 + slideUp, 3, boxH);
  }

  ctx.fillStyle = "#fff";
  ctx.fillText(caption.text, w / 2, y + slideUp, w * 0.9);
  ctx.globalAlpha = 1;
}

// ── Transition renderer ────────────────────────────────────────────────────

function drawTransition(ctx: CanvasRenderingContext2D, type: string, progress: number, w: number, h: number) {
  if (type === "fade_black") {
    const alpha = progress < 0.5 ? progress * 2 : (1 - progress) * 2;
    ctx.fillStyle = `rgba(0,0,0,${alpha * 0.8})`;
    ctx.fillRect(0, 0, w, h);
  } else if (type === "crossfade") {
    const alpha = progress < 0.5 ? progress : (1 - progress);
    ctx.fillStyle = `rgba(0,0,0,${alpha * 0.4})`;
    ctx.fillRect(0, 0, w, h);
  } else if (type === "flash") {
    const alpha = Math.sin(progress * Math.PI) * 0.5;
    ctx.fillStyle = `rgba(255,255,255,${alpha})`;
    ctx.fillRect(0, 0, w, h);
  }
}

// ── Main Component ─────────────────────────────────────────────────────────

export default function EditedVideoPlayer({ videoSrc, editPlan, projectId, projectTitle }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bgMusicRef = useRef<HTMLAudioElement | null>(null);
  const animFrameRef = useRef<number>(0);

  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState(0);

  const [brightness, setBrightness] = useState(editPlan.effects?.brightness ?? 1.0);
  const [contrast, setContrast] = useState(editPlan.effects?.contrast ?? 1.0);
  const [saturation, setSaturation] = useState(editPlan.effects?.saturation ?? 1.0);
  const [colorGrade, setColorGrade] = useState(editPlan.color_grade || "natural");

  const [originalVolume, setOriginalVolume] = useState(1.0);
  const [musicVolume, setMusicVolume] = useState(0.3);
  const [originalMuted, setOriginalMuted] = useState(false);

  const [selectedTrack, setSelectedTrack] = useState("");
  const [customMusicUrl, setCustomMusicUrl] = useState("");
  const [musicLoading, setMusicLoading] = useState(false);

  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportUrl, setExportUrl] = useState<string | null>(null);

  const [showEffects, setShowEffects] = useState(false);
  const [showMusic, setShowMusic] = useState(false);
  const [showAnimations, setShowAnimations] = useState(false);

  const [segmentAnimations, setSegmentAnimations] = useState<string[]>(() => {
    const autoList = autoAssignAnimations(editPlan.segments.length);
    return editPlan.segments.map((seg, i) =>
      seg.animation && ANIMATIONS[seg.animation] ? seg.animation : autoList[i]
    );
  });

  const introDuration = editPlan.intro_slide?.duration ?? 4;
  const outroDuration = editPlan.outro_slide?.duration ?? 3;
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

  const outTimeToSrcTime = useCallback((outTime: number): { srcTime: number; segIndex: number; phase: "intro" | "video" | "outro" } | null => {
    if (outTime < introDuration) return { srcTime: 0, segIndex: -1, phase: "intro" };
    for (const entry of timeline.current) {
      if (outTime >= entry.outStart && outTime < entry.outEnd)
        return { srcTime: entry.segStart + (outTime - entry.outStart), segIndex: entry.segIndex, phase: "video" };
    }
    const last = timeline.current[timeline.current.length - 1];
    if (last && outTime >= last.outEnd) return { srcTime: last.segEnd, segIndex: -2, phase: "outro" };
    return null;
  }, [introDuration]);

  const getCaptionAtTime = useCallback((outTime: number): { caption: EditCaption; progress: number } | null => {
    for (const cap of editPlan.captions) {
      for (const entry of timeline.current) {
        if (cap.start >= entry.segStart && cap.start < entry.segEnd) {
          const capOutStart = entry.outStart + (cap.start - entry.segStart);
          const capOutEnd = capOutStart + (cap.end - cap.start);
          if (outTime >= capOutStart && outTime < capOutEnd)
            return { caption: cap, progress: (outTime - capOutStart) / (capOutEnd - capOutStart) };
        }
      }
    }
    return null;
  }, [editPlan.captions]);

  const getTransitionAt = useCallback((outTime: number): { type: string; progress: number } | null => {
    for (const trans of editPlan.transitions) {
      for (const entry of timeline.current) {
        if (trans.at >= entry.segStart && trans.at <= entry.segEnd) {
          const transOutTime = entry.outStart + (trans.at - entry.segStart);
          const halfDur = trans.duration / 2;
          if (outTime >= transOutTime - halfDur && outTime <= transOutTime + halfDur)
            return { type: trans.type, progress: (outTime - (transOutTime - halfDur)) / trans.duration };
        }
      }
    }
    return null;
  }, [editPlan.transitions]);

  const getSegmentProgress = useCallback((outTime: number, segIndex: number): number => {
    const entry = timeline.current[segIndex];
    if (!entry) return 0;
    return Math.max(0, Math.min(1, (outTime - entry.outStart) / (entry.outEnd - entry.outStart)));
  }, []);

  // ── Render ───────────────────────────────────────────────────────────────

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

    if (mapped.phase === "intro" && editPlan.intro_slide) {
      drawSlide(ctx, editPlan.intro_slide, w, h, currentTime / introDuration);
      return;
    }
    if (mapped.phase === "outro" && editPlan.outro_slide) {
      const last = timeline.current[timeline.current.length - 1];
      const outroStart = last ? last.outEnd : introDuration;
      drawSlide(ctx, editPlan.outro_slide, w, h, Math.min(1, (currentTime - outroStart) / outroDuration));
      return;
    }

    // Video phase
    const vw = video.videoWidth || w, vh = video.videoHeight || h;
    ctx.filter = buildFilter(brightness, contrast, saturation, colorGrade);

    const animName = segmentAnimations[mapped.segIndex] || "none";
    const animFn = getAnimation(animName);
    const segProgress = getSegmentProgress(currentTime, mapped.segIndex);
    const transform = animFn(segProgress, vw, vh, w, h);
    applyAnimTransform(ctx, video, transform, w, h);

    ctx.filter = "none";

    // Cinematic letterbox
    if (colorGrade === "cinematic") {
      const barH = h * 0.055;
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, w, barH);
      ctx.fillRect(0, h - barH, w, barH);
    }

    // Transition
    const trans = getTransitionAt(currentTime);
    if (trans) drawTransition(ctx, trans.type, trans.progress, w, h);

    // Caption
    const capResult = getCaptionAtTime(currentTime);
    if (capResult) drawCaption(ctx, capResult.caption, w, h, capResult.progress);

    // Animation label
    if (animName !== "none") {
      ctx.font = "10px monospace";
      ctx.fillStyle = "rgba(255,255,255,0.25)";
      ctx.textAlign = "right";
      ctx.textBaseline = "top";
      ctx.fillText(animName.replace(/_/g, " "), w - 8, 8);
      ctx.textAlign = "center";
      ctx.textBaseline = "alphabetic";
    }
  }, [currentTime, brightness, contrast, saturation, colorGrade,
      editPlan.intro_slide, editPlan.outro_slide, introDuration, outroDuration,
      segmentAnimations, outTimeToSrcTime, getCaptionAtTime, getTransitionAt, getSegmentProgress]);

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

  useEffect(() => {
    const v = videoRef.current;
    if (v) { v.volume = originalMuted ? 0 : originalVolume; v.muted = originalMuted; }
  }, [originalVolume, originalMuted]);

  useEffect(() => {
    if (bgMusicRef.current) bgMusicRef.current.volume = musicVolume;
  }, [musicVolume]);

  // ── Controls ─────────────────────────────────────────────────────────────

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
  const currentSegAnim = mapped && mapped.segIndex >= 0 ? segmentAnimations[mapped.segIndex] : null;

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
        <div className="absolute left-2 top-2 flex items-center gap-1.5">
          <span className="rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-medium text-white">
            {currentPhase === "intro" ? "Intro" : currentPhase === "outro" ? "Outro" : "Playing"}
          </span>
          {currentSegAnim && currentSegAnim !== "none" && (
            <span className="rounded-full bg-primary/70 px-2 py-0.5 text-[10px] font-medium text-white">
              {currentSegAnim.replace(/_/g, " ")}
            </span>
          )}
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

      {/* Panel toggles */}
      <div className="flex flex-wrap gap-2">
        <button onClick={() => { setShowAnimations(!showAnimations); setShowEffects(false); setShowMusic(false); }}
          className={cn("inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-colors",
            showAnimations ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-secondary")}>
          <Zap className="h-3.5 w-3.5" /> Animations ({ANIMATION_NAMES.length})
        </button>
        <button onClick={() => { setShowEffects(!showEffects); setShowAnimations(false); setShowMusic(false); }}
          className={cn("inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-colors",
            showEffects ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-secondary")}>
          <Eye className="h-3.5 w-3.5" /> Color & Effects
        </button>
        <button onClick={() => { setShowMusic(!showMusic); setShowAnimations(false); setShowEffects(false); }}
          className={cn("inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-colors",
            showMusic ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-secondary")}>
          <Music className="h-3.5 w-3.5" /> Music & Audio
        </button>
      </div>

      {/* Animations Panel */}
      {showAnimations && (
        <div className="space-y-4 rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Segment Animations</h3>
            <button onClick={() => setSegmentAnimations(autoAssignAnimations(editPlan.segments.length))}
              className="text-[10px] font-medium text-primary hover:underline">Randomize All</button>
          </div>
          <div className="space-y-2 max-h-[280px] overflow-y-auto">
            {editPlan.segments.map((seg, i) => (
              <div key={i} className="flex items-center gap-2 rounded-lg bg-secondary/50 p-2">
                <span className="min-w-[60px] text-[10px] font-mono text-muted-foreground">
                  {seg.start.toFixed(1)}–{seg.end.toFixed(1)}s
                </span>
                <select
                  value={segmentAnimations[i] || "none"}
                  onChange={(e) => {
                    const next = [...segmentAnimations];
                    next[i] = e.target.value;
                    setSegmentAnimations(next);
                  }}
                  className="flex-1 rounded border border-border bg-background px-2 py-1 text-xs"
                >
                  <option value="none">No Animation</option>
                  {ANIMATION_NAMES.map(name => (
                    <option key={name} value={name}>{name.replace(/_/g, " ")}</option>
                  ))}
                </select>
                <span className="max-w-[80px] truncate text-[10px] text-muted-foreground" title={seg.reason}>{seg.reason}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Effects Panel */}
      {showEffects && (
        <div className="space-y-4 rounded-xl border border-border bg-card p-4">
          <h3 className="text-sm font-semibold">Color Correction</h3>
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">Preset</label>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(COLOR_PRESETS).map(([key, { label }]) => (
                <button key={key} onClick={() => setColorGrade(key)}
                  className={cn("rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors",
                    colorGrade === key ? "bg-primary text-primary-foreground" : "bg-secondary hover:bg-secondary/80")}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-1 text-xs text-muted-foreground"><Sun className="h-3 w-3" /> Brightness</label>
                <span className="text-[10px] font-mono text-primary">{(brightness * 100).toFixed(0)}%</span>
              </div>
              <input type="range" min="50" max="150" value={brightness * 100} onChange={e => setBrightness(parseInt(e.target.value) / 100)} className="w-full accent-primary" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-1 text-xs text-muted-foreground"><Contrast className="h-3 w-3" /> Contrast</label>
                <span className="text-[10px] font-mono text-primary">{(contrast * 100).toFixed(0)}%</span>
              </div>
              <input type="range" min="50" max="150" value={contrast * 100} onChange={e => setContrast(parseInt(e.target.value) / 100)} className="w-full accent-primary" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-1 text-xs text-muted-foreground"><Droplets className="h-3 w-3" /> Saturation</label>
                <span className="text-[10px] font-mono text-primary">{(saturation * 100).toFixed(0)}%</span>
              </div>
              <input type="range" min="20" max="200" value={saturation * 100} onChange={e => setSaturation(parseInt(e.target.value) / 100)} className="w-full accent-primary" />
            </div>
          </div>
          <button onClick={() => { setBrightness(1.0); setContrast(1.0); setSaturation(1.0); setColorGrade("natural"); }}
            className="text-[10px] text-muted-foreground hover:text-foreground">Reset defaults</button>
        </div>
      )}

      {/* Music Panel */}
      {showMusic && (
        <div className="space-y-4 rounded-xl border border-border bg-card p-4">
          <h3 className="text-sm font-semibold">Music & Audio</h3>
          {editPlan.music_suggestion && (
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-primary"><Sparkles className="h-3.5 w-3.5" /> AI Suggestion</div>
              <p className="mt-1 text-xs text-muted-foreground">{editPlan.music_suggestion.description}</p>
              <div className="mt-1.5 flex flex-wrap gap-1">
                {[editPlan.music_suggestion.mood, editPlan.music_suggestion.genre, editPlan.music_suggestion.tempo].map(tag => (
                  <span key={tag} className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">{tag}</span>
                ))}
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-1 text-xs text-muted-foreground">
                  {originalMuted ? <VolumeX className="h-3 w-3" /> : <Volume2 className="h-3 w-3" />} Original
                </label>
                <button onClick={() => setOriginalMuted(!originalMuted)} className="text-[10px] text-primary hover:underline">
                  {originalMuted ? "Unmute" : "Mute"}
                </button>
              </div>
              <input type="range" min="0" max="100" value={originalMuted ? 0 : originalVolume * 100}
                onChange={e => { setOriginalVolume(parseInt(e.target.value) / 100); setOriginalMuted(false); }}
                className="w-full accent-primary" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-1 text-xs text-muted-foreground"><Music className="h-3 w-3" /> Music</label>
                <span className="text-[10px] font-mono text-primary">{(musicVolume * 100).toFixed(0)}%</span>
              </div>
              <input type="range" min="0" max="100" value={musicVolume * 100} onChange={e => setMusicVolume(parseInt(e.target.value) / 100)} className="w-full accent-primary" />
            </div>
          </div>
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
          <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-border p-2.5 hover:bg-secondary">
            <Upload className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Upload your own audio</span>
            <input type="file" accept="audio/*" className="hidden" onChange={handleCustomMusic} />
          </label>
          {musicLoading && <div className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading...</div>}
          {(selectedTrack || customMusicUrl) && !musicLoading && (
            <div className="flex items-center justify-between">
              <span className="text-xs text-green-400">♪ {selectedTrack === "custom" ? "Custom" : ROYALTY_FREE_TRACKS.find(t => t.id === selectedTrack)?.name} loaded</span>
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
