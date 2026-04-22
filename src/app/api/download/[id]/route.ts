import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

const IS_VERCEL = !!process.env.VERCEL;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const type = request.nextUrl.searchParams.get("type") || "original";
    const project = await db.getProject(id);

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const title = project.title.replace(/[^a-zA-Z0-9]/g, "_");

    // If requesting edited video and it exists locally
    if (type === "edited" && project.output_path) {
      if (fs.existsSync(project.output_path)) {
        const stat = fs.statSync(project.output_path);
        const fileBuffer = fs.readFileSync(project.output_path);
        return new NextResponse(fileBuffer, {
          headers: {
            "Content-Type": "video/mp4",
            "Content-Length": stat.size.toString(),
            "Content-Disposition": `attachment; filename="${title}_edited.mp4"`,
          },
        });
      }
    }

    // Serve original video
    const videoPath = project.original_path;
    const fileName = path.basename(videoPath);

    if (IS_VERCEL) {
      // Download from Supabase Storage
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
      return new NextResponse(buffer, {
        headers: {
          "Content-Type": "video/mp4",
          "Content-Length": buffer.length.toString(),
          "Content-Disposition": `attachment; filename="${title}_original.mp4"`,
        },
      });
    } else {
      // Serve from local disk
      if (!fs.existsSync(videoPath)) {
        return NextResponse.json({ error: "Video file not found on disk" }, { status: 404 });
      }
      const stat = fs.statSync(videoPath);
      const fileBuffer = fs.readFileSync(videoPath);
      return new NextResponse(fileBuffer, {
        headers: {
          "Content-Type": "video/mp4",
          "Content-Length": stat.size.toString(),
          "Content-Disposition": `attachment; filename="${title}_original.mp4"`,
        },
      });
    }
  } catch (err) {
    console.error("Download error:", err);
    return NextResponse.json({ error: "Download failed" }, { status: 500 });
  }
}
