import path from "path";
import fs from "fs";
import { db as store } from "../db";
import type { ProfileRow } from "../db";
import { extractAudio, extractFrames, getVideoMetadata, renderEditedVideo } from "../video/ffmpeg";
import { transcribeAudio } from "../ai/transcribe";
import { analyzeFrames } from "../ai/analyze-frames";
import { generateEditPlan } from "../ai/generate-edit-plan";
import { createClient } from "@supabase/supabase-js";

const IS_VERCEL = !!process.env.VERCEL;
const TEMP_DIR = IS_VERCEL ? "/tmp" : (process.env.TEMP_DIR || "./tmp");
const OUTPUT_DIR = IS_VERCEL ? "/tmp/output" : (process.env.OUTPUT_DIR || "./output");

/**
 * On Vercel: download the video from Supabase Storage to /tmp
 * so it's available for processing in this function instance.
 */
async function ensureVideoFile(originalPath: string): Promise<string> {
  if (!IS_VERCEL) return originalPath;

  // Check if file already exists in /tmp
  if (fs.existsSync(originalPath)) return originalPath;

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) throw new Error("Supabase credentials missing");

  const supabase = createClient(supabaseUrl, supabaseKey);
  const fileName = path.basename(originalPath);
  const storagePath = `uploads/${fileName}`;

  console.log(`[processor] Downloading video from Supabase Storage: ${storagePath}`);
  const { data, error } = await supabase.storage.from("videos").download(storagePath);
  if (error || !data) throw new Error(`Failed to download video: ${error?.message || "no data"}`);

  const dir = path.dirname(originalPath);
  fs.mkdirSync(dir, { recursive: true });
  const buffer = Buffer.from(await data.arrayBuffer());
  fs.writeFileSync(originalPath, buffer);
  console.log(`[processor] Video downloaded to ${originalPath} (${buffer.length} bytes)`);
  return originalPath;
}

/**
 * Vercel pipeline: no FFmpeg available, so we use AI-only analysis.
 * Steps: download video → transcribe audio (Groq Whisper) → generate edit plan (Groq LLM)
 * Frame analysis is skipped (no ffmpeg to extract frames).
 * Rendering is skipped (no ffmpeg) — we produce the analysis/plan only.
 */
async function processVideoVercel(projectId: string): Promise<void> {
  const project = await store.getProject(projectId);
  if (!project) throw new Error("Project not found");

  const profile = await store.getProfile(project.profile_id || "default");

  try {
    await store.updateProject(projectId, { status: "processing", processing_started_at: new Date().toISOString() });

    // Download video from Supabase Storage
    const videoPath = await ensureVideoFile(project.original_path);
    const fileStats = fs.statSync(videoPath);

    await store.updateProject(projectId, {
      file_size: fileStats.size,
    });

    // Transcribe — Groq Whisper accepts video files directly (extracts audio server-side)
    await store.updateProject(projectId, { status: "transcribing" });
    let transcript;
    try {
      transcript = await transcribeAudio(videoPath);
    } catch (err) {
      console.error("[processor] Transcription failed, using empty transcript:", err);
      transcript = { text: "", segments: [], duration: 0 };
    }
    await store.updateProject(projectId, {
      transcript: JSON.stringify(transcript),
      duration: transcript.duration || null,
    });

    // Frame analysis — skip on Vercel (no ffmpeg to extract frames)
    await store.updateProject(projectId, { status: "analyzing" });
    const frameAnalysis = [{
      frameIndex: 0,
      timestamp: 0,
      description: "Video content inferred from transcript",
      objects: [],
      people: 0,
      action: "speaking",
      emotion: "neutral",
      setting: "unknown",
      quality: 5,
    }];
    await store.updateProject(projectId, { frame_analysis: JSON.stringify(frameAnalysis) });

    // Generate edit plan via LLM
    await store.updateProject(projectId, { status: "planning" });
    const editPlan = await generateEditPlan(
      transcript,
      frameAnalysis,
      {
        businessName: profile?.business_name || "My Business",
        industry: profile?.industry || "general",
        brandDescription: profile?.brand_description || "",
        brandTone: profile?.brand_tone || "professional",
        targetAudience: profile?.target_audience || "general",
      },
      project.target_platform,
      project.target_duration,
      transcript.duration || 30
    );
    await store.updateProject(projectId, { edit_plan: JSON.stringify(editPlan) });

    // Skip rendering on Vercel (no ffmpeg) — mark as completed with plan
    await store.updateProject(projectId, {
      status: "completed",
      processing_completed_at: new Date().toISOString(),
    });

    console.log(`[processor] Vercel pipeline completed for ${projectId}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error(`[processor] Failed for ${projectId}:`, message);
    await store.updateProject(projectId, { status: "failed", error_message: message });
    throw err;
  }
}

export async function processVideo(projectId: string): Promise<void> {
  // On Vercel, use the cloud-only pipeline (no FFmpeg)
  if (IS_VERCEL) {
    return processVideoVercel(projectId);
  }

  // Local pipeline with FFmpeg
  const project = await store.getProject(projectId);
  if (!project) throw new Error("Project not found");

  const profile = await store.getProfile(project.profile_id || "default");

  const workDir = path.join(TEMP_DIR, projectId);
  fs.mkdirSync(workDir, { recursive: true });
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  try {
    // Update status
    await store.updateProject(projectId, { status: "processing", processing_started_at: new Date().toISOString() });

    // Step 1: Get metadata
    const metadata = getVideoMetadata(project.original_path);
    await store.updateProject(projectId, {
      duration: metadata.duration,
      resolution: `${metadata.width}x${metadata.height}`,
      file_size: metadata.fileSize,
    });

    // Step 2: Extract audio
    await store.updateProject(projectId, { status: "extracting" });
    const audioPath = extractAudio(project.original_path, workDir);

    // Step 3: Extract frames
    const frameInterval = Math.max(3, Math.ceil(metadata.duration / 40));
    const frames = extractFrames(project.original_path, workDir, frameInterval);

    // Step 4: Transcribe
    await store.updateProject(projectId, { status: "transcribing" });
    const transcript = await transcribeAudio(audioPath);
    await store.updateProject(projectId, { transcript: JSON.stringify(transcript) });

    // Step 5: Analyze frames
    await store.updateProject(projectId, { status: "analyzing" });
    const frameAnalysis = await analyzeFrames(frames.slice(0, 20));
    await store.updateProject(projectId, { frame_analysis: JSON.stringify(frameAnalysis) });

    // Step 6: Generate edit plan
    await store.updateProject(projectId, { status: "planning" });
    const editPlan = await generateEditPlan(
      transcript,
      frameAnalysis,
      {
        businessName: profile?.business_name || "My Business",
        industry: profile?.industry || "general",
        brandDescription: profile?.brand_description || "",
        brandTone: profile?.brand_tone || "professional",
        targetAudience: profile?.target_audience || "general",
      },
      project.target_platform,
      project.target_duration,
      metadata.duration
    );
    await store.updateProject(projectId, { edit_plan: JSON.stringify(editPlan) });

    // Step 7: Render
    await store.updateProject(projectId, { status: "rendering" });
    const outputPath = path.join(OUTPUT_DIR, `${projectId}.mp4`);
    await renderEditedVideo(
      project.original_path,
      outputPath,
      editPlan.segments,
      editPlan.captions,
      {
        normalize_audio: editPlan.audio_adjustments.normalize,
        aspect_ratio: editPlan.output_format.aspect_ratio,
        resolution: editPlan.output_format.resolution,
      }
    );

    // Done
    await store.updateProject(projectId, {
      status: "completed",
      output_path: outputPath,
      processing_completed_at: new Date().toISOString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    await store.updateProject(projectId, { status: "failed", error_message: message });
    throw err;
  } finally {
    // Cleanup temp files
    try { fs.rmSync(workDir, { recursive: true, force: true }); } catch {}
  }
}
