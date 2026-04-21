import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { v4 as uuid } from "uuid";
import { db } from "@/lib/db";

const IS_VERCEL = !!process.env.VERCEL;
const UPLOAD_DIR = IS_VERCEL ? "/tmp/uploads" : (process.env.UPLOAD_DIR || "./uploads");

export async function POST(request: NextRequest) {
  try {
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
    await writeFile(filePath, Buffer.from(bytes));

    db.createProject({
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
