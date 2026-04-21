import fs from "fs";
import { execSync } from "child_process";

const IS_VERCEL = !!process.env.VERCEL;

export interface FrameAnalysis {
  frameIndex: number;
  timestamp: number;
  description: string;
  objects: string[];
  people: number;
  action: string;
  emotion: string;
  setting: string;
  quality: number;
}

async function analyzeFrameWithGroq(
  framePath: string,
  frameIndex: number,
  timestamp: number
): Promise<FrameAnalysis> {
  const OpenAI = (await import("openai")).default;
  const groq = new OpenAI({
    apiKey: process.env.GROQ_API_KEY || "",
    baseURL: "https://api.groq.com/openai/v1",
  });

  const imageBuffer = fs.readFileSync(framePath);
  const base64 = imageBuffer.toString("base64");

  const response = await groq.chat.completions.create({
    model: "meta-llama/llama-4-scout-17b-16e-instruct",
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `Analyze this video frame. Return a JSON object with these exact keys:
- "description": brief description of what's happening
- "objects": array of key objects visible
- "people": number of people visible
- "action": main action happening
- "emotion": overall emotional tone
- "setting": the environment/location
- "quality": visual quality score 1-10

Return ONLY valid JSON, no other text.`,
          },
          {
            type: "image_url",
            image_url: { url: `data:image/jpeg;base64,${base64}` },
          },
        ],
      },
    ],
    response_format: { type: "json_object" },
    max_completion_tokens: 512,
    temperature: 0.3,
  });

  const content = response.choices[0]?.message?.content || "{}";
  const parsed = JSON.parse(content);

  return {
    frameIndex,
    timestamp,
    description: parsed.description || "",
    objects: parsed.objects || [],
    people: parsed.people || 0,
    action: parsed.action || "",
    emotion: parsed.emotion || "",
    setting: parsed.setting || "",
    quality: parsed.quality || 5,
  };
}

function analyzeFrameLocal(
  framePath: string,
  frameIndex: number,
  timestamp: number
): FrameAnalysis {
  let quality = 5;
  try {
    const stats = execSync(
      `ffprobe -v quiet -print_format json -show_entries frame=width,height -i "${framePath}"`,
      { encoding: "utf-8", timeout: 10_000 }
    );
    const parsed = JSON.parse(stats);
    const w = parsed?.frames?.[0]?.width || 0;
    const h = parsed?.frames?.[0]?.height || 0;
    quality = Math.min(10, Math.max(3, Math.round((w * h) / 200000)));
  } catch {
    // ignore
  }

  return {
    frameIndex,
    timestamp,
    description: `Frame at ${timestamp.toFixed(1)}s`,
    objects: [],
    people: 0,
    action: "scene",
    emotion: "neutral",
    setting: "unknown",
    quality,
  };
}

export async function analyzeFrames(
  framePaths: { path: string; index: number; timestamp: number }[]
): Promise<FrameAnalysis[]> {
  console.log(`[analyze-frames] Analyzing ${framePaths.length} frames (vercel=${IS_VERCEL})...`);
  const results: FrameAnalysis[] = [];

  // On Vercel, limit to 5 frames to stay within rate limits
  const toAnalyze = IS_VERCEL ? framePaths.slice(0, 5) : framePaths;

  for (const frame of toAnalyze) {
    try {
      if (IS_VERCEL) {
        const analysis = await analyzeFrameWithGroq(frame.path, frame.index, frame.timestamp);
        results.push(analysis);
        // Rate limiting: 2.5s between calls (Groq free tier)
        await new Promise((r) => setTimeout(r, 2500));
      } else {
        results.push(analyzeFrameLocal(frame.path, frame.index, frame.timestamp));
      }
    } catch (err) {
      console.error(`Failed to analyze frame ${frame.index}:`, err);
      results.push({
        frameIndex: frame.index,
        timestamp: frame.timestamp,
        description: "Analysis failed",
        objects: [],
        people: 0,
        action: "unknown",
        emotion: "neutral",
        setting: "unknown",
        quality: 5,
      });
    }
  }

  console.log(`[analyze-frames] Done — ${results.length} frames analyzed`);
  return results;
}
