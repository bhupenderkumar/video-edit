import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { v4 as uuid } from "uuid";
import { db } from "@/lib/db";
import { createClient } from "@supabase/supabase-js";

const IS_VERCEL = !!process.env.VERCEL;
const UPLOAD_DIR = IS_VERCEL ? "/tmp/uploads" : (process.env.UPLOAD_DIR || "./uploads");

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get("content-type") || "";

    // ── JSON metadata path (client already uploaded to Supabase Storage) ──
    if (contentType.includes("application/json")) {
      const body = await request.json();
      const {
        projectId,
        title = "Untitled",
        target_platform = "instagram_reels",
        target_duration = 30,
        file_size = 0,
        file_name,
        storage_path,
      } = body;

      if (!projectId || !file_name || !storage_path) {
        return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
      }

      // On Vercel we don't need a local file — processor downloads from Supabase Storage
      const filePath = IS_VERCEL ? `/tmp/uploads/${file_name}` : path.join(UPLOAD_DIR, file_name);

      await db.createProject({
        id: projectId,
        profile_id: "default",
        title,
        status: "uploaded",
        original_path: filePath,
        target_platform,
        target_duration: typeof target_duration === "string" ? parseInt(target_duration) : target_duration,
        file_size,
        output_path: null,
      });

      return NextResponse.json({
        id: projectId,
        title,
        status: "uploaded",
        message: "Project created successfully",
      });
    }

    // ── FormData path (local dev or fallback) ──────────────────────────────
    const formData = await request.formData();
    const file = formData.get("video") as File;
    const title = (formData.get("title") as string) || "Untitled Project";
    const targetPlatform =
      (formData.get("target_platform") as string) || "instagram_reels";
    const targetDuration = parseInt(
      (formData.get("target_duration") as string) || "30"
    );
    const profileId = (formData.get("profile_id") as string) || "default";

    if (!file) {
      return NextResponse.json({ error: "No video file provided" }, { status: 400 });
    }

    const allowedTypes = ["video/mp4", "video/quicktime", "video/x-msvideo", "video/webm"];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: "Invalid file type. Supported: MP4, MOV, AVI, WebM" },
        { status: 400 }
      );
    }

    if (file.size > 500 * 1024 * 1024) {
      return NextResponse.json(
        { error: "File too large. Maximum size: 500MB" },
        { status: 400 }
      );
    }

    await mkdir(UPLOAD_DIR, { recursive: true });

    const projectId = uuid();
    const ext = path.extname(file.name) || ".mp4";
    const sanitizedName = `${projectId}${ext}`;
    const filePath = path.join(UPLOAD_DIR, sanitizedName);

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(filePath, buffer);

    // On Vercel, also upload to Supabase Storage so the file survives across function instances
    if (IS_VERCEL) {
      const supabaseUrl = process.env.SUPABASE_URL;
      const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
      if (supabaseUrl && supabaseKey) {
        const supabase = createClient(supabaseUrl, supabaseKey);
        const storagePath = `uploads/${sanitizedName}`;
        const { error: uploadError } = await supabase.storage
          .from("videos")
          .upload(storagePath, buffer, {
            contentType: file.type,
            upsert: true,
          });
        if (uploadError) {
          console.error("[upload] Supabase Storage upload failed:", uploadError.message);
        } else {
          console.log(`[upload] Stored in Supabase Storage: ${storagePath}`);
        }
      }
    }

    await db.createProject({
      id: projectId,
      profile_id: profileId,
      title,
      status: "uploaded",
      original_path: filePath,
      target_platform: targetPlatform,
      target_duration: targetDuration,
      file_size: file.size,
      output_path: null,
    });

    return NextResponse.json({
      id: projectId,
      title,
      status: "uploaded",
      message: "Video uploaded successfully",
    });
  } catch (err) {
    console.error("Upload error:", err);
    return NextResponse.json(
      { error: "Upload failed" },
      { status: 500 }
    );
  }
}
