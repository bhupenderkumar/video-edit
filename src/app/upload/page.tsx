"use client";

import { useState, useRef } from "react";
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
} from "lucide-react";
import { cn, formatFileSize } from "@/lib/utils";

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

    try {
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

      // Start processing
      await fetch("/api/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: id }),
      });

      router.push(`/projects/${id}`);
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
                <CheckCircle2 className="h-12 w-12 text-success" />
                <p className="mt-3 text-lg font-medium">{file.name}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {formatFileSize(file.size)} • {file.type.split("/")[1]?.toUpperCase()}
                </p>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setFile(null);
                    setTitle("");
                  }}
                  className="mt-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                  Remove
                </button>
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
                Uploading & Starting AI...
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
    </div>
  );
}
