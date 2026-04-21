import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const project = db.getProject(id);

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    return NextResponse.json({
      id: project.id,
      status: project.status,
      error_message: project.error_message,
      output_path: project.output_path,
    });
  } catch (err) {
    console.error("Status check error:", err);
    return NextResponse.json(
      { error: "Failed to check status" },
      { status: 500 }
    );
  }
}
