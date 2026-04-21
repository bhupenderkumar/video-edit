import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { v4 as uuid } from "uuid";

const IS_VERCEL = !!process.env.VERCEL;
const UPLOAD_DIR = IS_VERCEL ? "/tmp/uploads" : (process.env.UPLOAD_DIR || "./uploads");
const OUTPUT_DIR = IS_VERCEL ? "/tmp/output" : (process.env.OUTPUT_DIR || "./output");

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("photo") as File;
    const enhancementType =
      (formData.get("enhancement_type") as string) || "auto";

    if (!file) {
      return NextResponse.json(
        { error: "No photo provided" },
        { status: 400 }
      );
    }

    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: "Invalid file type. Supported: JPEG, PNG, WebP" },
        { status: 400 }
      );
    }

    await mkdir(path.join(UPLOAD_DIR, "photos"), { recursive: true });
    await mkdir(path.join(OUTPUT_DIR, "photos"), { recursive: true });

    const jobId = uuid();
    const ext = path.extname(file.name) || ".jpg";
    const inputPath = path.join(UPLOAD_DIR, "photos", `${jobId}${ext}`);
    const outputPath = path.join(OUTPUT_DIR, "photos", `${jobId}_enhanced.jpg`);

    const bytes = await file.arrayBuffer();
    await writeFile(inputPath, Buffer.from(bytes));

    // Process with Sharp
    let pipeline = sharp(inputPath);
    const metadata = await pipeline.metadata();

    switch (enhancementType) {
      case "upscale":
        pipeline = sharp(inputPath).resize(
          (metadata.width || 1000) * 2,
          (metadata.height || 1000) * 2,
          { fit: "fill", kernel: "lanczos3" }
        );
        break;
      case "color_correct":
        pipeline = sharp(inputPath).normalise().modulate({
          brightness: 1.05,
          saturation: 1.2,
        });
        break;
      case "sharpen":
        pipeline = sharp(inputPath).sharpen({ sigma: 2, m1: 1, m2: 0.5 });
        break;
      case "auto":
      default:
        pipeline = sharp(inputPath)
          .resize((metadata.width || 1000) * 2, null, {
            withoutEnlargement: false,
            kernel: "lanczos3",
          })
          .sharpen({ sigma: 1.5 })
          .normalise()
          .modulate({ brightness: 1.03, saturation: 1.15 });
        break;
    }

    await pipeline.jpeg({ quality: 95 }).toFile(outputPath);

    const outputMeta = await sharp(outputPath).metadata();

    // On Vercel, /tmp is ephemeral — include base64 data so the client can download directly
    const outputBuffer = await import("fs/promises").then(f => f.readFile(outputPath));
    const base64 = outputBuffer.toString("base64");

    return NextResponse.json({
      id: jobId,
      status: "completed",
      original: {
        width: metadata.width,
        height: metadata.height,
        size: metadata.size,
      },
      enhanced: {
        width: outputMeta.width,
        height: outputMeta.height,
        path: `/api/photos/${jobId}`,
        dataUrl: `data:image/jpeg;base64,${base64}`,
      },
      enhancement_type: enhancementType,
    });
  } catch (err) {
    console.error("Photo enhancement error:", err);
    return NextResponse.json(
      { error: "Enhancement failed" },
      { status: 500 }
    );
  }
}
