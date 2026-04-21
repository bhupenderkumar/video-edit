import { NextRequest, NextResponse } from "next/server";
import { processVideo } from "@/lib/queue/processor";

const IS_VERCEL = !!process.env.VERCEL;

export async function POST(request: NextRequest) {
  try {
    const { projectId } = await request.json();

    if (!projectId) {
      return NextResponse.json(
        { error: "projectId is required" },
        { status: 400 }
      );
    }

    if (IS_VERCEL) {
      // On Vercel, await processing (serverless functions can't do background work)
      await processVideo(projectId);
      return NextResponse.json({
        message: "Processing completed",
        projectId,
      });
    } else {
      // Locally, start processing in the background (non-blocking)
      processVideo(projectId).catch((err) => {
        console.error(`Processing failed for ${projectId}:`, err);
      });
      return NextResponse.json({
        message: "Processing started",
        projectId,
      });
    }
  } catch (err) {
    console.error("Process error:", err);
    return NextResponse.json(
      { error: "Failed to start processing" },
      { status: 500 }
    );
  }
}
