import path from "path";
import fs from "fs";
import { db as store } from "../db";
import type { ProfileRow } from "../db";
import { extractAudio, extractFrames, getVideoMetadata, renderEditedVideo } from "../video/ffmpeg";
import { transcribeAudio } from "../ai/transcribe";
import { analyzeFrames } from "../ai/analyze-frames";
import { generateEditPlan } from "../ai/generate-edit-plan";

const IS_VERCEL = !!process.env.VERCEL;
const TEMP_DIR = IS_VERCEL ? "/tmp" : (process.env.TEMP_DIR || "./tmp");
const OUTPUT_DIR = IS_VERCEL ? "/tmp/output" : (process.env.OUTPUT_DIR || "./output");

export async function processVideo(projectId: string): Promise<void> {
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
