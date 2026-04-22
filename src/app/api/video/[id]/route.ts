import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

const IS_VERCEL = !!process.env.VERCEL;

/**
 * Stream video for browser playback.
 * ?type=original (default) — serves the original uploaded video
 * Supports Range requests for seeking.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const project = await db.getProject(id);

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const videoPath = project.original_path;
    const fileName = path.basename(videoPath);

    if (IS_VERCEL) {
      return await streamFromSupabase(fileName, request);
    } else {
      return streamFromDisk(videoPath, request);
    }
  } catch (err) {
    console.error("Video stream error:", err);
    return NextResponse.json({ error: "Failed to stream video" }, { status: 500 });
  }
}

async function streamFromSupabase(fileName: string, request: NextRequest) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: "Storage not configured" }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const storagePath = `uploads/${fileName}`;

  const { data, error } = await supabase.storage.from("videos").download(storagePath);
  if (error || !data) {
    return NextResponse.json({ error: "Video not found in storage" }, { status: 404 });
  }

  const buffer = Buffer.from(await data.arrayBuffer());
  const total = buffer.length;
  const range = request.headers.get("range");

  if (range) {
    const match = range.match(/bytes=(\d+)-(\d*)/);
    if (match) {
      const start = parseInt(match[1], 10);
      const end = match[2] ? parseInt(match[2], 10) : total - 1;
      const chunk = buffer.subarray(start, end + 1);

      return new NextResponse(chunk, {
        status: 206,
        headers: {
          "Content-Type": "video/mp4",
          "Content-Range": `bytes ${start}-${end}/${total}`,
          "Accept-Ranges": "bytes",
          "Content-Length": chunk.length.toString(),
          "Cache-Control": "public, max-age=3600",
        },
      });
    }
  }

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "video/mp4",
      "Content-Length": total.toString(),
      "Accept-Ranges": "bytes",
      "Cache-Control": "public, max-age=3600",
    },
  });
}

function streamFromDisk(videoPath: string, request: NextRequest) {
  if (!fs.existsSync(videoPath)) {
    return NextResponse.json({ error: "Video file not found" }, { status: 404 });
  }

  const stat = fs.statSync(videoPath);
  const total = stat.size;
  const range = request.headers.get("range");

  if (range) {
    const match = range.match(/bytes=(\d+)-(\d*)/);
    if (match) {
      const start = parseInt(match[1], 10);
      const end = match[2] ? parseInt(match[2], 10) : total - 1;
      const chunk = fs.readFileSync(videoPath).subarray(start, end + 1);

      return new NextResponse(chunk, {
        status: 206,
        headers: {
          "Content-Type": "video/mp4",
          "Content-Range": `bytes ${start}-${end}/${total}`,
          "Accept-Ranges": "bytes",
          "Content-Length": chunk.length.toString(),
        },
      });
    }
  }

  const fileBuffer = fs.readFileSync(videoPath);
  return new NextResponse(fileBuffer, {
    headers: {
      "Content-Type": "video/mp4",
      "Content-Length": total.toString(),
      "Accept-Ranges": "bytes",
    },
  });
}
