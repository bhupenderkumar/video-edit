import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { processVideo } from "@/lib/queue/processor";

export async function POST(request: NextRequest) {
  try {
    const { projectId } = await request.json();

    if (!projectId) {
      return NextResponse.json(
        { error: "projectId is required" },
        { status: 400 }
      );
    }

    // Use after() to keep serverless function alive on Vercel
    after(async () => {
      try {
        await processVideo(projectId);
      } catch (err) {
        console.error(`Processing failed for ${projectId}:`, err);
      }
    });

    return NextResponse.json({
      message: "Processing started",
      projectId,
    });
  } catch (err) {
    console.error("Process error:", err);
    return NextResponse.json(
      { error: "Failed to start processing" },
      { status: 500 }
    );
  }
}
