"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Download,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  Film,
  MessageSquare,
  Eye,
  Scissors,
  Palette,
  Volume2,
  Play,
  Pause,
} from "lucide-react";
import { cn, formatDuration, formatFileSize } from "@/lib/utils";

type ProjectDetail = {
  id: string;
  title: string;
  status: string;
  original_path: string;
  output_path: string | null;
  target_platform: string;
  target_duration: number;
  transcript: { text: string; segments: { start: number; end: number; text: string }[] } | null;
  frame_analysis: {
    frameIndex: number;
    timestamp: number;
    description: string;
    action: string;
    emotion: string;
    quality: number;
  }[] | null;
  edit_plan: {
    segments: { start: number; end: number; reason: string }[];
    captions: { start: number; end: number; text: string; style: string }[];
    color_grade: string;
    audio_adjustments: { normalize: boolean; remove_silence: boolean };
    output_format: { aspect_ratio: string; resolution: string };
  } | null;
  duration: number | null;
  resolution: string | null;
  file_size: number | null;
  error_message: string | null;
  created_at: string;
};

const pipelineSteps = [
  { key: "uploaded", label: "Uploaded", icon: Film },
  { key: "extracting", label: "Extracting", icon: Film },
  { key: "transcribing", label: "Transcribing", icon: MessageSquare },
  { key: "analyzing", label: "Analyzing Scenes", icon: Eye },
  { key: "planning", label: "Planning Edit", icon: Scissors },
  { key: "rendering", label: "Rendering", icon: Palette },
  { key: "completed", label: "Done", icon: CheckCircle2 },
];

const stepOrder = [
  "uploaded",
  "processing",
  "extracting",
  "transcribing",
  "analyzing",
  "planning",
  "rendering",
  "completed",
];

export default function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProject();
    const interval = setInterval(fetchProject, 2000);
    return () => clearInterval(interval);
  }, [id]);

  async function fetchProject() {
    try {
      const res = await fetch(`/api/projects/${id}`);
      if (res.ok) {
        const data = await res.json();
        setProject(data);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="py-20 text-center">
        <p className="text-lg text-muted-foreground">Project not found</p>
        <Link href="/" className="mt-4 inline-block text-primary hover:underline">
          Back to Dashboard
        </Link>
      </div>
    );
  }

  const isProcessing = !["uploaded", "completed", "failed"].includes(project.status);
  const currentStepIndex = stepOrder.indexOf(project.status);

  return (
    <div>
      {/* Back + Header */}
      <Link
        href="/"
        className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Dashboard
      </Link>

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between lg:mb-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{project.title}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground sm:mt-2 sm:gap-3 sm:text-sm">
            {project.duration && (
              <span>Duration: {formatDuration(project.duration)}</span>
            )}
            {project.resolution && <span>• {project.resolution}</span>}
            {project.file_size && (
              <span>• {formatFileSize(project.file_size)}</span>
            )}
          </div>
        </div>

        {project.status === "completed" && (
          <div className="flex w-full gap-2 sm:w-auto">
            <a
              href={`/api/download/${project.id}?type=original`}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium transition-colors hover:bg-secondary sm:flex-initial"
            >
              <Download className="h-4 w-4" />
              Original
            </a>
            {project.output_path && (
              <a
                href={`/api/download/${project.id}?type=edited`}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 sm:flex-initial"
              >
                <Download className="h-4 w-4" />
                Edited
              </a>
            )}
          </div>
        )}
      </div>

      {/* Pipeline Status */}
      <div className="mb-6 rounded-xl border border-border bg-card p-4 sm:p-6 lg:mb-8">
        <h2 className="mb-3 text-base font-semibold sm:mb-4 sm:text-lg">Processing Pipeline</h2>

        {project.status === "failed" ? (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
            <div className="flex items-center gap-2 text-destructive">
              <XCircle className="h-5 w-5" />
              <span className="font-medium">Processing Failed</span>
            </div>
            {project.error_message && (
              <p className="mt-2 text-sm text-muted-foreground">
                {project.error_message}
              </p>
            )}
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            {pipelineSteps.map((step, i) => {
              const stepIdx = stepOrder.indexOf(step.key);
              const isComplete = currentStepIndex > stepIdx;
              const isCurrent = project.status === step.key || (project.status === "processing" && step.key === "extracting");
              const StepIcon = step.icon;

              return (
                <div key={step.key} className="flex items-center gap-2">
                  <div
                    className={cn(
                      "flex items-center gap-1.5 rounded-full px-2 py-1 text-[10px] font-medium transition-all sm:gap-2 sm:px-3 sm:py-1.5 sm:text-xs",
                      isComplete
                        ? "bg-success/10 text-success"
                        : isCurrent
                        ? "bg-primary/10 text-primary"
                        : "bg-secondary text-muted-foreground"
                    )}
                  >
                    {isCurrent && isProcessing ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : isComplete ? (
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    ) : (
                      <StepIcon className="h-3.5 w-3.5" />
                    )}
                    <span className="hidden sm:inline">{step.label}</span>
                  </div>
                  {i < pipelineSteps.length - 1 && (
                    <div
                      className={cn(
                        "hidden h-0.5 w-3 sm:block sm:w-4",
                        isComplete ? "bg-success/50" : "bg-border"
                      )}
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Video Player */}
      {project.status === "completed" && (
        <div className="mb-6 rounded-xl border border-border bg-card p-4 sm:p-6 lg:mb-8">
          <div className="mb-4 flex items-center gap-2">
            <Play className="h-5 w-5 text-primary" />
            <h2 className="text-base font-semibold sm:text-lg">Video Preview</h2>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {/* Original Video */}
            <div>
              <p className="mb-2 text-center text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Original Video
              </p>
              <div className="overflow-hidden rounded-lg border border-border bg-black">
                <video
                  controls
                  playsInline
                  preload="metadata"
                  className="aspect-video w-full"
                  src={`/api/video/${project.id}`}
                >
                  Your browser does not support video playback.
                </video>
              </div>
              <div className="mt-2 flex justify-center">
                <a
                  href={`/api/download/${project.id}?type=original`}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-secondary"
                >
                  <Download className="h-3 w-3" />
                  Download Original
                </a>
              </div>
            </div>

            {/* Edited Video (if available) or Analysis Summary */}
            <div>
              <p className="mb-2 text-center text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {project.output_path ? "Edited Video" : "AI Analysis"}
              </p>
              {project.output_path ? (
                <>
                  <div className="overflow-hidden rounded-lg border border-border bg-black">
                    <video
                      controls
                      playsInline
                      preload="metadata"
                      className="aspect-video w-full"
                      src={`/api/download/${project.id}?type=edited`}
                    >
                      Your browser does not support video playback.
                    </video>
                  </div>
                  <div className="mt-2 flex justify-center">
                    <a
                      href={`/api/download/${project.id}?type=edited`}
                      className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                    >
                      <Download className="h-3 w-3" />
                      Download Edited
                    </a>
                  </div>
                </>
              ) : (
                <div className="flex aspect-video flex-col items-center justify-center rounded-lg border border-dashed border-border bg-secondary/30 p-6">
                  <Scissors className="mb-3 h-8 w-8 text-muted-foreground" />
                  <p className="text-center text-sm font-medium text-muted-foreground">
                    AI Edit Plan Ready
                  </p>
                  <p className="mt-1 text-center text-xs text-muted-foreground/70">
                    Video rendering is available in local processing mode.
                    {project.edit_plan && (
                      <span className="mt-1 block">
                        {project.edit_plan.segments.length} segments • {project.edit_plan.captions.length} captions planned
                      </span>
                    )}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Results Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Transcript */}
        {project.transcript && (
          <div className="rounded-xl border border-border bg-card p-6">
            <div className="mb-4 flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-primary" />
              <h3 className="text-lg font-semibold">Transcript</h3>
            </div>
            <div className="max-h-64 space-y-2 overflow-y-auto pr-2">
              {project.transcript.segments.map((seg, i) => (
                <div
                  key={i}
                  className="flex gap-3 rounded-lg bg-secondary/50 p-3"
                >
                  <span className="flex-shrink-0 text-xs font-mono text-muted-foreground">
                    {formatDuration(seg.start)}
                  </span>
                  <p className="text-sm">{seg.text}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Scene Analysis */}
        {project.frame_analysis && (
          <div className="rounded-xl border border-border bg-card p-6">
            <div className="mb-4 flex items-center gap-2">
              <Eye className="h-5 w-5 text-primary" />
              <h3 className="text-lg font-semibold">Scene Analysis</h3>
            </div>
            <div className="max-h-64 space-y-2 overflow-y-auto pr-2">
              {project.frame_analysis.map((frame, i) => (
                <div
                  key={i}
                  className="flex gap-3 rounded-lg bg-secondary/50 p-3"
                >
                  <span className="flex-shrink-0 text-xs font-mono text-muted-foreground">
                    {formatDuration(frame.timestamp)}
                  </span>
                  <div className="text-sm">
                    <p>{frame.description}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {frame.action} • {frame.emotion} • Quality: {frame.quality}/10
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Edit Plan */}
        {project.edit_plan && (
          <div className="rounded-xl border border-border bg-card p-6">
            <div className="mb-4 flex items-center gap-2">
              <Scissors className="h-5 w-5 text-primary" />
              <h3 className="text-lg font-semibold">AI Edit Plan</h3>
            </div>
            <div className="space-y-3">
              <div>
                <p className="text-xs font-medium text-muted-foreground">
                  SEGMENTS TO KEEP
                </p>
                <div className="mt-2 space-y-1.5">
                  {project.edit_plan.segments.map((seg, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2 rounded-lg bg-secondary/50 px-3 py-2 text-sm"
                    >
                      <span className="font-mono text-xs text-primary">
                        {formatDuration(seg.start)} → {formatDuration(seg.end)}
                      </span>
                      <span className="text-muted-foreground">
                        {seg.reason}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {project.edit_plan.captions.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground">
                    CAPTIONS
                  </p>
                  <div className="mt-2 space-y-1.5">
                    {project.edit_plan.captions.map((cap, i) => (
                      <div
                        key={i}
                        className="rounded-lg bg-secondary/50 px-3 py-2 text-sm"
                      >
                        &quot;{cap.text}&quot;
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Output Info */}
        {project.edit_plan && (
          <div className="rounded-xl border border-border bg-card p-6">
            <div className="mb-4 flex items-center gap-2">
              <Palette className="h-5 w-5 text-primary" />
              <h3 className="text-lg font-semibold">Output Settings</h3>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {[
                { label: "Aspect Ratio", value: project.edit_plan.output_format.aspect_ratio },
                { label: "Resolution", value: project.edit_plan.output_format.resolution },
                { label: "Color Grade", value: project.edit_plan.color_grade },
                { label: "Audio", value: project.edit_plan.audio_adjustments.normalize ? "Normalized" : "Original" },
              ].map((item) => (
                <div key={item.label} className="rounded-lg bg-secondary/50 p-3">
                  <p className="text-xs text-muted-foreground">{item.label}</p>
                  <p className="mt-0.5 text-sm font-medium capitalize">
                    {item.value}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
