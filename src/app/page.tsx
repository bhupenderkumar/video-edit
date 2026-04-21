"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Upload,
  Video,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  ArrowRight,
  Film,
  Sparkles,
  ImagePlus,
} from "lucide-react";
import { cn, formatDuration, formatFileSize, formatDate } from "@/lib/utils";

type Project = {
  id: string;
  title: string;
  status: string;
  target_platform: string;
  target_duration: number;
  duration: number | null;
  resolution: string | null;
  file_size: number | null;
  output_path: string | null;
  error_message: string | null;
  created_at: string;
};

const statusConfig: Record<
  string,
  { label: string; color: string; icon: React.ElementType }
> = {
  uploaded: { label: "Uploaded", color: "text-muted-foreground", icon: Clock },
  processing: { label: "Processing", color: "text-warning", icon: Loader2 },
  extracting: { label: "Extracting", color: "text-warning", icon: Loader2 },
  transcribing: {
    label: "Transcribing",
    color: "text-warning",
    icon: Loader2,
  },
  analyzing: { label: "Analyzing", color: "text-warning", icon: Loader2 },
  planning: { label: "Planning Edit", color: "text-warning", icon: Loader2 },
  rendering: { label: "Rendering", color: "text-primary", icon: Loader2 },
  completed: {
    label: "Completed",
    color: "text-success",
    icon: CheckCircle2,
  },
  failed: { label: "Failed", color: "text-destructive", icon: XCircle },
};

const platformLabels: Record<string, string> = {
  instagram_reels: "Instagram Reels",
  youtube_shorts: "YouTube Shorts",
  youtube: "YouTube",
  tiktok: "TikTok",
  twitter: "X / Twitter",
};

export default function DashboardPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProjects();
    const interval = setInterval(fetchProjects, 3000);
    return () => clearInterval(interval);
  }, []);

  async function fetchProjects() {
    try {
      const res = await fetch("/api/projects");
      const data = await res.json();
      setProjects(data.projects || []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  const activeCount = projects.filter((p) =>
    ["processing", "extracting", "transcribing", "analyzing", "planning", "rendering"].includes(
      p.status
    )
  ).length;
  const completedCount = projects.filter(
    (p) => p.status === "completed"
  ).length;
  const totalCount = projects.length;

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="mt-1 text-muted-foreground">
          Upload raw video and let AI create polished content for your business.
        </p>
      </div>

      {/* Stats */}
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          {
            label: "Total Projects",
            value: totalCount,
            icon: Film,
            color: "text-foreground",
          },
          {
            label: "Processing",
            value: activeCount,
            icon: Loader2,
            color: "text-warning",
          },
          {
            label: "Completed",
            value: completedCount,
            icon: CheckCircle2,
            color: "text-success",
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl border border-border bg-card p-5"
          >
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">{stat.label}</p>
              <stat.icon className={cn("h-5 w-5", stat.color)} />
            </div>
            <p className="mt-2 text-3xl font-bold">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Link
          href="/upload"
          className="group flex items-center gap-4 rounded-xl border border-border bg-card p-5 transition-all hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
            <Upload className="h-6 w-6 text-primary" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold">Upload Video</h3>
            <p className="text-sm text-muted-foreground">
              Drop your raw footage and let AI edit it
            </p>
          </div>
          <ArrowRight className="h-5 w-5 text-muted-foreground transition-transform group-hover:translate-x-1" />
        </Link>

        <Link
          href="/photos"
          className="group flex items-center gap-4 rounded-xl border border-border bg-card p-5 transition-all hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
            <ImagePlus className="h-6 w-6 text-primary" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold">Enhance Photos</h3>
            <p className="text-sm text-muted-foreground">
              Upscale, sharpen, and color-correct images
            </p>
          </div>
          <ArrowRight className="h-5 w-5 text-muted-foreground transition-transform group-hover:translate-x-1" />
        </Link>
      </div>

      {/* Projects List */}
      <div>
        <h2 className="mb-4 text-xl font-semibold">Recent Projects</h2>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-20">
            <Video className="h-12 w-12 text-muted-foreground/50" />
            <p className="mt-4 text-lg font-medium text-muted-foreground">
              No projects yet
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Upload a video to get started
            </p>
            <Link
              href="/upload"
              className="mt-6 inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              <Upload className="h-4 w-4" />
              Upload Video
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {projects.map((project) => {
              const config = statusConfig[project.status] || statusConfig.uploaded;
              const StatusIcon = config.icon;
              const isActive = [
                "processing",
                "extracting",
                "transcribing",
                "analyzing",
                "planning",
                "rendering",
              ].includes(project.status);

              return (
                <Link
                  key={project.id}
                  href={`/projects/${project.id}`}
                  className="group flex items-center gap-4 rounded-xl border border-border bg-card p-4 transition-all hover:border-primary/30 hover:bg-card/80"
                >
                  {/* Thumbnail placeholder */}
                  <div className="flex h-14 w-20 flex-shrink-0 items-center justify-center rounded-lg bg-secondary">
                    <Film className="h-6 w-6 text-muted-foreground" />
                  </div>

                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate font-medium">{project.title}</h3>
                    <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                      <span>
                        {platformLabels[project.target_platform] ||
                          project.target_platform}
                      </span>
                      {project.duration && (
                        <>
                          <span>•</span>
                          <span>{formatDuration(project.duration)}</span>
                        </>
                      )}
                      {project.file_size && (
                        <>
                          <span>•</span>
                          <span>{formatFileSize(project.file_size)}</span>
                        </>
                      )}
                      <span>•</span>
                      <span>{formatDate(project.created_at)}</span>
                    </div>
                  </div>

                  {/* Status */}
                  <div
                    className={cn(
                      "flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium",
                      config.color,
                      project.status === "completed"
                        ? "bg-success/10"
                        : project.status === "failed"
                        ? "bg-destructive/10"
                        : isActive
                        ? "bg-warning/10"
                        : "bg-secondary"
                    )}
                  >
                    <StatusIcon
                      className={cn(
                        "h-3.5 w-3.5",
                        isActive && "animate-spin"
                      )}
                    />
                    {config.label}
                  </div>

                  <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 transition-all group-hover:translate-x-1 group-hover:opacity-100" />
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
