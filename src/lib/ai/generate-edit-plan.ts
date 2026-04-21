import type { TranscriptSegment } from "./transcribe";
import type { FrameAnalysis } from "./analyze-frames";

const IS_VERCEL = !!process.env.VERCEL;

export interface EditSegment {
  start: number;
  end: number;
  reason: string;
}

export interface EditTransition {
  at: number;
  type: "crossfade" | "fade_black" | "cut";
  duration: number;
}

export interface EditCaption {
  start: number;
  end: number;
  text: string;
  style: "subtitle_bottom" | "title_center" | "lower_third";
}

export interface EditPlan {
  segments: EditSegment[];
  transitions: EditTransition[];
  captions: EditCaption[];
  color_grade: string;
  audio_adjustments: {
    normalize: boolean;
    remove_silence: boolean;
  };
  output_format: {
    aspect_ratio: string;
    resolution: string;
  };
}

async function llmGenerate(prompt: string, systemPrompt: string): Promise<string> {
  if (IS_VERCEL) {
    // Use Groq API
    const OpenAI = (await import("openai")).default;
    const groq = new OpenAI({
      apiKey: process.env.GROQ_API_KEY || "",
      baseURL: "https://api.groq.com/openai/v1",
    });

    console.log("[edit-plan] Calling Groq LLM...");
    const response = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_object" },
      max_completion_tokens: 4096,
      temperature: 0.7,
    });

    return response.choices[0]?.message?.content || "{}";
  } else {
    // Use local Ollama
    console.log("[edit-plan] Calling Ollama...");
    const response = await fetch("http://localhost:11434/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "qwen2.5:3b",
        prompt: `${systemPrompt}\n\n${prompt}`,
        stream: false,
        format: "json",
        options: { temperature: 0.7, num_predict: 2048 },
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama error: ${response.status}`);
    }

    const data = await response.json();
    return data.response || "{}";
  }
}

function buildFallbackPlan(
  videoDuration: number,
  targetDuration: number,
  targetPlatform: string,
  businessName: string,
  transcriptSegments: TranscriptSegment[]
): EditPlan {
  // Smart fallback: evenly sample from video to fill target duration
  const isVertical =
    targetPlatform === "instagram_reels" ||
    targetPlatform === "tiktok" ||
    targetPlatform === "youtube_shorts";

  const effectiveDuration = Math.min(targetDuration, videoDuration);
  const segmentCount = Math.max(1, Math.min(5, Math.ceil(effectiveDuration / 15)));
  const segLen = effectiveDuration / segmentCount;

  const segments: EditSegment[] = [];
  const transitions: EditTransition[] = [];

  if (videoDuration <= targetDuration) {
    // Use entire video
    segments.push({ start: 0, end: videoDuration, reason: "Full video" });
  } else {
    // Pick evenly spaced segments
    const gap = (videoDuration - effectiveDuration) / segmentCount;
    let cursor = 0;
    for (let i = 0; i < segmentCount; i++) {
      const start = Math.min(cursor + gap * 0.5, videoDuration - segLen);
      const end = Math.min(start + segLen, videoDuration);
      segments.push({
        start: Math.max(0, start),
        end,
        reason: `Segment ${i + 1}`,
      });
      if (i > 0) {
        transitions.push({ at: start, type: "crossfade", duration: 0.5 });
      }
      cursor = end;
    }
  }

  // Build captions from transcript
  const captions: EditCaption[] = [
    {
      start: 0,
      end: 3,
      text: businessName || "ClipAI Edit",
      style: "title_center",
    },
  ];

  // Add a few subtitle captions from transcript
  if (transcriptSegments.length > 0) {
    const step = Math.max(1, Math.floor(transcriptSegments.length / 4));
    for (let i = 0; i < transcriptSegments.length && captions.length < 5; i += step) {
      const seg = transcriptSegments[i];
      if (seg.text.length > 3) {
        captions.push({
          start: seg.start,
          end: seg.end,
          text: seg.text.slice(0, 60),
          style: "subtitle_bottom",
        });
      }
    }
  }

  return {
    segments,
    transitions,
    captions,
    color_grade: "natural",
    audio_adjustments: { normalize: true, remove_silence: false },
    output_format: {
      aspect_ratio: isVertical ? "9:16" : "16:9",
      resolution: isVertical ? "1080x1920" : "1920x1080",
    },
  };
}

export async function generateEditPlan(
  transcript: { text: string; segments: TranscriptSegment[] },
  frameAnalysis: FrameAnalysis[],
  businessContext: {
    businessName: string;
    industry: string;
    brandDescription: string;
    brandTone: string;
    targetAudience: string;
  },
  targetPlatform: string,
  targetDuration: number,
  videoDuration: number
): Promise<EditPlan> {
  // Try LLM first, fall back to smart rule-based plan
  try {
    const systemPrompt = "You are a professional video editor specializing in social media content for small businesses. You create engaging, platform-optimized edits. Always return valid JSON.";
    const prompt = `Create an edit plan for this video. Source video: ${videoDuration.toFixed(1)} seconds
Business: ${businessContext.businessName} (${businessContext.industry})
Platform: ${targetPlatform}
Target duration: ${targetDuration} seconds
Aspect ratio: ${targetPlatform === "instagram_reels" || targetPlatform === "tiktok" || targetPlatform === "youtube_shorts" ? "9:16" : "16:9"}

Transcript: ${transcript.text.slice(0, 500)}

Return ONLY this JSON structure:
{
  "segments": [{"start": 0, "end": 10, "reason": "opening scene"}],
  "transitions": [{"at": 10, "type": "crossfade", "duration": 0.5}],
  "captions": [{"start": 0, "end": 3, "text": "${businessContext.businessName}", "style": "title_center"}],
  "color_grade": "natural",
  "audio_adjustments": {"normalize": true, "remove_silence": false},
  "output_format": {"aspect_ratio": "${targetPlatform === "instagram_reels" || targetPlatform === "tiktok" || targetPlatform === "youtube_shorts" ? "9:16" : "16:9"}", "resolution": "${targetPlatform === "instagram_reels" || targetPlatform === "tiktok" || targetPlatform === "youtube_shorts" ? "1080x1920" : "1920x1080"}"}
}

Rules:
- All timestamps must be between 0 and ${videoDuration.toFixed(1)}
- Total segment duration should be ~${targetDuration} seconds
- segments.end must be > segments.start`;

    const response = await llmGenerate(prompt, systemPrompt);
    console.log("[edit-plan] LLM responded, parsing...");

    const parsed = JSON.parse(response);

    // Validate the plan
    const plan: EditPlan = {
      segments: (parsed.segments || []).filter(
        (s: EditSegment) =>
          typeof s.start === "number" &&
          typeof s.end === "number" &&
          s.end > s.start &&
          s.start >= 0 &&
          s.end <= videoDuration + 1
      ),
      transitions: parsed.transitions || [],
      captions: parsed.captions || [],
      color_grade: parsed.color_grade || "natural",
      audio_adjustments: parsed.audio_adjustments || {
        normalize: true,
        remove_silence: false,
      },
      output_format: parsed.output_format || {
        aspect_ratio: "9:16",
        resolution: "1080x1920",
      },
    };

    // If LLM returned no valid segments, fall back
    if (plan.segments.length === 0) {
      console.log("[edit-plan] LLM returned no valid segments, using fallback");
      return buildFallbackPlan(
        videoDuration, targetDuration, targetPlatform,
        businessContext.businessName, transcript.segments
      );
    }

    console.log(`[edit-plan] Done — ${plan.segments.length} segments, ${plan.captions.length} captions`);
    return plan;
  } catch (err) {
    console.error("[edit-plan] LLM failed, using fallback:", err);
    return buildFallbackPlan(
      videoDuration, targetDuration, targetPlatform,
      businessContext.businessName, transcript.segments
    );
  }
}
