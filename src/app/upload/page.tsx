"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Upload,
  Film,
  Loader2,
  CheckCircle2,
  X,
  Sparkles,
  Clapperboard,
  Monitor,
  Smartphone,
  MessageCircle,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize2,
  Clock,
} from "lucide-react";
import { cn, formatFileSize } from "@/lib/utils";
import { createClient } from "@supabase/supabase-js";
import { v4 as uuid } from "uuid";

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

const platforms = [
  {
    id: "instagram_reels",
    label: "Instagram Reels",
    icon: Smartphone,
    duration: 30,
    aspect: "9:16",
  },
  {
    id: "youtube_shorts",
    label: "YouTube Shorts",
    icon: Clapperboard,
    duration: 60,
    aspect: "9:16",
  },
  {
    id: "youtube",
    label: "YouTube",
    icon: Monitor,
    duration: 120,
    aspect: "16:9",
  },
  {
    id: "tiktok",
    label: "TikTok",
    icon: Film,
    duration: 30,
    aspect: "9:16",
  },
  {
    id: "twitter",
    label: "X / Twitter",
    icon: MessageCircle,
    duration: 60,
    aspect: "16:9",
  },
];

export default function UploadPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [platform, setPlatform] = useState("instagram_reels");
  const [duration, setDuration] = useState(30);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState("");
  const [uploadProgress, setUploadProgress] = useState(0);

  // Video preview state
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [thumbnail, setThumbnail] = useState<string | null>(null);
  const [videoDuration, setVideoDuration] = useState(0);
  const [videoRes, setVideoRes] = useState({ w: 0, h: 0 });
  const [showPreview, setShowPreview] = useState(false);
  const [previewPlaying, setPreviewPlaying] = useState(false);
  const [previewMuted, setPreviewMuted] = useState(false);
  const [previewTime, setPreviewTime] = useState(0);
  const previewVideoRef = useRef<HTMLVideoElement>(null);

  // Generate thumbnail when file changes
  useEffect(() => {
    if (!file) {
      if (videoUrl) URL.revokeObjectURL(videoUrl);
      setVideoUrl(null);
      setThumbnail(null);
      setVideoDuration(0);
      setVideoRes({ w: 0, h: 0 });
      setShowPreview(false);
      return;
    }
    const url = URL.createObjectURL(file);
    setVideoUrl(url);

    const video = document.createElement("video");
    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;
    video.src = url;

    video.onloadedmetadata = () => {
      setVideoDuration(video.duration);
      setVideoRes({ w: video.videoWidth, h: video.videoHeight });
      // Seek to 1s or 25% for a good thumbnail frame
      video.currentTime = Math.min(1, video.duration * 0.25);
    };

    video.onseeked = () => {
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(video, 0, 0);
        setThumbnail(canvas.toDataURL("image/jpeg", 0.85));
      }
    };

    return () => {
      URL.revokeObjectURL(url);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file]);

  const togglePreviewPlay = useCallback(() => {
    const v = previewVideoRef.current;
    if (!v) return;
    if (v.paused) {
      v.play();
      setPreviewPlaying(true);
    } else {
      v.pause();
      setPreviewPlaying(false);
    }
  }, []);

  function handleFileSelect(selectedFile: File) {
    const allowedTypes = [
      "video/mp4",
      "video/quicktime",
      "video/x-msvideo",
      "video/webm",
    ];
    if (!allowedTypes.includes(selectedFile.type)) {
      setError("Invalid file type. Supported: MP4, MOV, AVI, WebM");
      return;
    }
    if (selectedFile.size > 500 * 1024 * 1024) {
      setError("File too large. Maximum size: 500MB");
      return;
    }
    setError("");
    setFile(selectedFile);
    if (!title) {
      setTitle(selectedFile.name.replace(/\.[^/.]+$/, ""));
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  }

  async function handleUpload() {
    if (!file) return;
    setUploading(true);
    setError("");
    setUploadProgress(0);

    try {
      const projectId = uuid();
      const ext = file.name.match(/\.[^/.]+$/)?.[0] || ".mp4";
      const sanitizedName = `${projectId}${ext}`;
      const storagePath = `uploads/${sanitizedName}`;

      // --- Direct upload to Supabase Storage from browser ---
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      if (!supabaseUrl || !supabaseAnonKey) {
        // Fallback: old FormData upload via API (works locally)
        const formData = new FormData();
        formData.append("video", file);
        formData.append("title", title || "Untitled");
        formData.append("target_platform", platform);
        formData.append("target_duration", duration.toString());

        const uploadRes = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });

        if (!uploadRes.ok) {
          const data = await uploadRes.json();
          throw new Error(data.error || "Upload failed");
        }

        const { id } = await uploadRes.json();
        fetch("/api/process", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ projectId: id }),
        }).catch(() => {});
        router.push(`/projects/${id}`);
        return;
      }

      // Upload directly to Supabase Storage (bypasses Vercel body limit)
      setUploadProgress(10);
      const supabase = createClient(supabaseUrl, supabaseAnonKey);
      const { error: storageError } = await supabase.storage
        .from("videos")
        .upload(storagePath, file, {
          contentType: file.type,
          upsert: true,
        });

      if (storageError) {
        throw new Error(`Storage upload failed: ${storageError.message}`);
      }

      setUploadProgress(70);

      // Send metadata-only request to create project record
      const metaRes = await fetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          title: title || "Untitled",
          target_platform: platform,
          target_duration: duration,
          file_size: file.size,
          file_name: sanitizedName,
          storage_path: storagePath,
        }),
      });

      if (!metaRes.ok) {
        const data = await metaRes.json();
        throw new Error(data.error || "Failed to create project");
      }

      setUploadProgress(90);

      // Start processing
      fetch("/api/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      }).catch(() => {});

      setUploadProgress(100);
      router.push(`/projects/${projectId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
      setUploading(false);
    }
  }

  const selectedPlatform = platforms.find((p) => p.id === platform);

  return (
    <div>
      <div className="mb-6 lg:mb-8">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Upload Video</h1>
        <p className="mt-1 text-sm text-muted-foreground sm:text-base">
          Upload your raw footage and AI will create a polished edit.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5 lg:gap-8">
        {/* Left: Upload & Settings */}
        <div className="space-y-6 lg:col-span-3">
          {/* Drop Zone */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              "relative cursor-pointer rounded-xl border-2 border-dashed p-6 text-center transition-all sm:p-12",
              dragOver
                ? "border-primary bg-primary/5"
                : file
                ? "border-success/50 bg-success/5"
                : "border-border hover:border-primary/50 hover:bg-secondary/30"
            )}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="video/mp4,video/quicktime,video/x-msvideo,video/webm"
              className="hidden"
              onChange={(e) =>
                e.target.files?.[0] && handleFileSelect(e.target.files[0])
              }
            />

            {file ? (
              <div className="flex flex-col items-center">
                {/* Thumbnail Preview */}
                {thumbnail ? (
                  <div className="relative mb-3 w-full max-w-md overflow-hidden rounded-lg">
                    <img
                      src={thumbnail}
                      alt="Video thumbnail"
                      className="w-full rounded-lg object-cover"
                      style={{ maxHeight: 220 }}
                    />
                    {/* Play overlay */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowPreview(true);
                        setPreviewPlaying(false);
                        setPreviewTime(0);
                      }}
                      className="absolute inset-0 flex items-center justify-center bg-black/30 transition-colors hover:bg-black/40"
                    >
                      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/90 text-gray-900 shadow-lg transition-transform hover:scale-110">
                        <Play className="ml-1 h-7 w-7" fill="currentColor" />
                      </div>
                    </button>
                    {/* Duration badge */}
                    <div className="absolute bottom-2 right-2 rounded bg-black/70 px-2 py-0.5 text-xs font-medium text-white">
                      {formatTime(videoDuration)}
                    </div>
                    {/* Resolution badge */}
                    <div className="absolute bottom-2 left-2 rounded bg-black/70 px-2 py-0.5 text-xs font-medium text-white">
                      {videoRes.w}×{videoRes.h}
                    </div>
                  </div>
                ) : (
                  <CheckCircle2 className="h-12 w-12 text-success" />
                )}
                <p className="mt-1 text-lg font-medium">{file.name}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {formatFileSize(file.size)} • {file.type.split("/")[1]?.toUpperCase()}
                  {videoDuration > 0 && ` • ${formatTime(videoDuration)}`}
                </p>
                <div className="mt-3 flex items-center gap-3">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowPreview(true);
                      setPreviewPlaying(false);
                      setPreviewTime(0);
                    }}
                    className="inline-flex items-center gap-1.5 rounded-md bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary hover:bg-primary/20 transition-colors"
                  >
                    <Play className="h-3.5 w-3.5" />
                    Preview
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setFile(null);
                      setTitle("");
                    }}
                    className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                    Remove
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center">
                <Upload className="h-12 w-12 text-muted-foreground/50" />
                <p className="mt-4 text-lg font-medium">
                  Drop your video here
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  or click to browse • MP4, MOV, AVI, WebM • Up to 500MB
                </p>
              </div>
            )}
          </div>

          {/* Project Title */}
          <div>
            <label className="mb-2 block text-sm font-medium">
              Project Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="My awesome video"
              className="w-full rounded-lg border border-border bg-secondary/50 px-4 py-2.5 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          {/* Platform Selection */}
          <div>
            <label className="mb-3 block text-sm font-medium">
              Target Platform
            </label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3">
              {platforms.map((p) => (
                <button
                  key={p.id}
                  onClick={() => {
                    setPlatform(p.id);
                    setDuration(p.duration);
                  }}
                  className={cn(
                    "flex items-center gap-2 rounded-lg border px-3 py-2.5 text-left text-sm transition-all sm:gap-3 sm:px-4 sm:py-3",
                    platform === p.id
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-border hover:border-primary/30"
                  )}
                >
                  <p.icon className="h-4 w-4 flex-shrink-0" />
                  <div>
                    <p className="font-medium">{p.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {p.aspect} • ~{p.duration}s
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Target Duration */}
          <div>
            <label className="mb-2 block text-sm font-medium">
              Target Duration:{" "}
              <span className="text-primary">{duration}s</span>
            </label>
            <input
              type="range"
              min={10}
              max={180}
              step={5}
              value={duration}
              onChange={(e) => setDuration(parseInt(e.target.value))}
              className="w-full accent-primary"
            />
            <div className="mt-1 flex justify-between text-xs text-muted-foreground">
              <span>10s</span>
              <span>60s</span>
              <span>120s</span>
              <span>180s</span>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
              {error}
            </div>
          )}

          {/* Upload Button */}
          <button
            onClick={handleUpload}
            disabled={!file || uploading}
            className={cn(
              "w-full rounded-lg px-6 py-3 text-sm font-semibold transition-all",
              file && !uploading
                ? "bg-primary text-primary-foreground hover:bg-primary/90 active:scale-[0.98]"
                : "cursor-not-allowed bg-secondary text-muted-foreground"
            )}
          >
            {uploading ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                {uploadProgress < 70 ? `Uploading... ${uploadProgress}%` : uploadProgress < 100 ? "Creating project..." : "Redirecting..."}
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <Sparkles className="h-4 w-4" />
                Upload & Auto-Edit
              </span>
            )}
          </button>
        </div>

        {/* Right: How It Works */}
        <div className="lg:col-span-2">
          <div className="sticky top-8 rounded-xl border border-border bg-card p-6">
            <h3 className="text-lg font-semibold">How It Works</h3>
            <div className="mt-5 space-y-5">
              {[
                {
                  step: "1",
                  title: "Upload",
                  desc: "Drop your raw footage — any length, any quality",
                },
                {
                  step: "2",
                  title: "AI Analyzes",
                  desc: "Transcribes speech, analyzes scenes, understands context",
                },
                {
                  step: "3",
                  title: "Smart Edit",
                  desc: "AI picks the best moments, adds transitions & captions",
                },
                {
                  step: "4",
                  title: "Download",
                  desc: "Get your polished video ready for social media",
                },
              ].map((item) => (
                <div key={item.step} className="flex gap-4">
                  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                    {item.step}
                  </div>
                  <div>
                    <p className="font-medium">{item.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {item.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 rounded-lg bg-secondary/50 p-4">
              <p className="text-xs font-medium">
                Selected: {selectedPlatform?.label}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {selectedPlatform?.aspect} aspect ratio •{" "}
                ~{duration}s target duration
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Video Preview Modal */}
      {showPreview && videoUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
          onClick={() => {
            setShowPreview(false);
            if (previewVideoRef.current) previewVideoRef.current.pause();
            setPreviewPlaying(false);
          }}
        >
          <div
            className="relative mx-4 w-full max-w-3xl overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <div className="flex items-center gap-2">
                <Film className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">Video Preview</span>
                <span className="rounded bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
                  {videoRes.w}×{videoRes.h}
                </span>
              </div>
              <button
                onClick={() => {
                  setShowPreview(false);
                  if (previewVideoRef.current) previewVideoRef.current.pause();
                  setPreviewPlaying(false);
                }}
                className="rounded-lg p-1.5 hover:bg-secondary"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Video */}
            <div className="relative bg-black">
              <video
                ref={previewVideoRef}
                src={videoUrl}
                className="mx-auto max-h-[60vh] w-full object-contain"
                playsInline
                muted={previewMuted}
                onTimeUpdate={() => {
                  if (previewVideoRef.current)
                    setPreviewTime(previewVideoRef.current.currentTime);
                }}
                onEnded={() => setPreviewPlaying(false)}
                onClick={togglePreviewPlay}
              />
              {/* Center play button when paused */}
              {!previewPlaying && (
                <button
                  onClick={togglePreviewPlay}
                  className="absolute inset-0 flex items-center justify-center"
                >
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/90 text-gray-900 shadow-lg transition-transform hover:scale-110">
                    <Play className="ml-1 h-8 w-8" fill="currentColor" />
                  </div>
                </button>
              )}
            </div>

            {/* Controls */}
            <div className="border-t border-border bg-card px-4 py-3">
              {/* Progress bar */}
              <div
                className="group mb-3 h-1.5 cursor-pointer rounded-full bg-secondary"
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const pct = (e.clientX - rect.left) / rect.width;
                  const time = pct * videoDuration;
                  if (previewVideoRef.current) previewVideoRef.current.currentTime = time;
                  setPreviewTime(time);
                }}
              >
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${videoDuration ? (previewTime / videoDuration) * 100 : 0}%` }}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <button onClick={togglePreviewPlay} className="rounded-lg p-1.5 hover:bg-secondary">
                    {previewPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
                  </button>
                  <button
                    onClick={() => setPreviewMuted(!previewMuted)}
                    className="rounded-lg p-1.5 hover:bg-secondary"
                  >
                    {previewMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                  </button>
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {formatTime(previewTime)} / {formatTime(videoDuration)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" />
                    {formatTime(videoDuration)}
                  </div>
                  <button
                    onClick={() => {
                      if (previewVideoRef.current && previewVideoRef.current.requestFullscreen) {
                        previewVideoRef.current.requestFullscreen();
                      }
                    }}
                    className="rounded-lg p-1.5 hover:bg-secondary"
                  >
                    <Maximize2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Verify banner */}
            <div className="flex items-center justify-between border-t border-border bg-secondary/30 px-4 py-2.5">
              <p className="text-xs text-muted-foreground">
                Verify this is the right video before uploading
              </p>
              <button
                onClick={() => {
                  setShowPreview(false);
                  if (previewVideoRef.current) previewVideoRef.current.pause();
                  setPreviewPlaying(false);
                }}
                className="rounded-lg bg-primary px-4 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
              >
                Looks Good
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
