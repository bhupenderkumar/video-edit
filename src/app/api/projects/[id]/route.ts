import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const project = await db.getProject(id);

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    return NextResponse.json({
      ...project,
      transcript: project.transcript ? JSON.parse(project.transcript) : null,
      frame_analysis: project.frame_analysis
        ? JSON.parse(project.frame_analysis)
        : null,
      edit_plan: project.edit_plan ? JSON.parse(project.edit_plan) : null,
    });
  } catch (err) {
    console.error("Project fetch error:", err);
    return NextResponse.json(
      { error: "Failed to fetch project" },
      { status: 500 }
    );
  }
}
