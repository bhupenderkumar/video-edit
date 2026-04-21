import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const IS_VERCEL = !!process.env.VERCEL;
const OUTPUT_DIR = IS_VERCEL ? "/tmp/output" : (process.env.OUTPUT_DIR || "./output");

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const filePath = path.join(OUTPUT_DIR, "photos", `${id}_enhanced.jpg`);

    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ error: "Photo not found" }, { status: 404 });
    }

    const fileBuffer = fs.readFileSync(filePath);

    return new NextResponse(fileBuffer, {
      headers: {
        "Content-Type": "image/jpeg",
        "Content-Length": fileBuffer.length.toString(),
      },
    });
  } catch (err) {
    console.error("Photo serve error:", err);
    return NextResponse.json(
      { error: "Failed to serve photo" },
      { status: 500 }
    );
  }
}
