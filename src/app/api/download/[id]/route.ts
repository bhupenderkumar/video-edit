import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import fs from "fs";
import path from "path";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const project = db.getProject(id);

    if (!project || !project.output_path) {
      return NextResponse.json(
        { error: "Video not found or not yet processed" },
        { status: 404 }
      );
    }

    if (!fs.existsSync(project.output_path)) {
      return NextResponse.json(
        { error: "Output file not found on disk" },
        { status: 404 }
      );
    }

    const stat = fs.statSync(project.output_path);
    const fileBuffer = fs.readFileSync(project.output_path);

    const filename = `${project.title.replace(/[^a-zA-Z0-9]/g, "_")}_edited.mp4`;

    return new NextResponse(fileBuffer, {
      headers: {
        "Content-Type": "video/mp4",
        "Content-Length": stat.size.toString(),
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    console.error("Download error:", err);
    return NextResponse.json(
      { error: "Download failed" },
      { status: 500 }
    );
  }
}
