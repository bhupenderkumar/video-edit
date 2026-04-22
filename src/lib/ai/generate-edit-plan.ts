import type { TranscriptSegment } from "./transcribe";
import type { FrameAnalysis } from "./analyze-frames";

const IS_VERCEL = !!process.env.VERCEL;

export interface EditSegment {
  start: number;
  end: number;
  reason: string;
  animation?: string;
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

export interface IntroSlide {
  title: string;
  subtitle: string;
  duration: number;
  style: "gradient" | "minimal" | "bold" | "school";
  color: string;
}

export interface MusicSuggestion {
  mood: string;
  genre: string;
  tempo: string;
  description: string;
  keywords: string[];
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
  intro_slide?: IntroSlide;
  outro_slide?: IntroSlide;
  music_suggestion?: MusicSuggestion;
  effects?: {
    brightness: number;
    contrast: number;
    saturation: number;
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
  const isVertical =
    targetPlatform === "instagram_reels" ||
    targetPlatform === "tiktok" ||
    targetPlatform === "youtube_shorts";

  const effectiveDuration = Math.min(targetDuration, videoDuration);
  const animPool = ["zoom_in", "ken_burns", "pan_left", "drift_right", "parallax", "focus_pull", "glide", "zoom_out", "ken_burns_reverse", "pan_right"];

  const segments: EditSegment[] = [];
  const transitions: EditTransition[] = [];

  if (videoDuration <= targetDuration) {
    // Use entire video
    segments.push({ start: 0, end: videoDuration, reason: "Full video", animation: "ken_burns" });
  } else if (transcriptSegments.length > 2) {
    // ── Best-moment selection using transcript scoring ────────────────
    // Score each transcript segment by content quality
    const scored = transcriptSegments.map((seg, idx) => {
      let score = 0;
      const text = seg.text.trim();
      const wordCount = text.split(/\s+/).length;
      // Prefer segments with actual content (not filler)
      if (wordCount >= 3) score += 2;
      if (wordCount >= 6) score += 1;
      // Penalize very short or empty segments
      if (wordCount <= 1 || text.length < 3) score -= 3;
      // Bonus for questions, exclamations (engaging content)
      if (text.includes("?") || text.includes("!")) score += 2;
      // Bonus for key phrases indicating highlights
      const highlights = ["important", "amazing", "best", "welcome", "thank", "congratul", "winner", "award", "announce", "present", "special", "celebrate", "proud", "achieve", "success"];
      if (highlights.some(h => text.toLowerCase().includes(h))) score += 3;
      // Bonus for opening and closing (often contain key content)
      if (idx < 3) score += 1;
      if (idx >= transcriptSegments.length - 3) score += 1;
      // Prefer longer duration segments (more content)
      const duration = seg.end - seg.start;
      if (duration >= 2 && duration <= 10) score += 1;
      if (duration > 15) score -= 1;
      return { seg, score, idx };
    });

    // Sort by score descending, pick top segments
    scored.sort((a, b) => b.score - a.score);

    // Determine how many segments we need
    const segLen = 8; // target ~8s per segment
    const segmentCount = Math.max(1, Math.min(6, Math.ceil(effectiveDuration / segLen)));

    // Pick top-scored, non-overlapping segments
    const picked: { start: number; end: number; reason: string }[] = [];
    for (const item of scored) {
      if (picked.length >= segmentCount) break;
      const start = Math.max(0, item.seg.start - 0.5);
      const duration = Math.min(segLen, item.seg.end - item.seg.start + 2);
      const end = Math.min(videoDuration, start + Math.max(3, duration));
      // Check overlap with already picked segments
      const overlaps = picked.some(p => start < p.end + 0.5 && end > p.start - 0.5);
      if (!overlaps) {
        picked.push({ start, end, reason: item.seg.text.slice(0, 40) || `Best moment ${picked.length + 1}` });
      }
    }

    // Sort by time order for natural flow
    picked.sort((a, b) => a.start - b.start);

    // If we didn't pick enough, add evenly spaced filler
    if (picked.length === 0) {
      const gap = videoDuration / 3;
      for (let i = 0; i < 3 && picked.length < segmentCount; i++) {
        picked.push({ start: i * gap, end: Math.min((i + 1) * gap, videoDuration), reason: `Segment ${i + 1}` });
      }
    }

    picked.forEach((p, i) => {
      segments.push({ ...p, animation: animPool[i % animPool.length] });
      if (i > 0) transitions.push({ at: p.start, type: "crossfade", duration: 0.5 });
    });
  } else {
    // Very few transcript segments — evenly sample
    const segmentCount = Math.max(1, Math.min(5, Math.ceil(effectiveDuration / 15)));
    const segLen = effectiveDuration / segmentCount;
    const gap = (videoDuration - effectiveDuration) / segmentCount;
    let cursor = 0;
    for (let i = 0; i < segmentCount; i++) {
      const start = Math.min(cursor + gap * 0.5, videoDuration - segLen);
      const end = Math.min(start + segLen, videoDuration);
      segments.push({
        start: Math.max(0, start),
        end,
        reason: `Segment ${i + 1}`,
        animation: animPool[i % animPool.length],
      });
      if (i > 0) transitions.push({ at: start, type: "crossfade", duration: 0.5 });
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
    intro_slide: {
      title: businessName || "ClipAI Edit",
      subtitle: "Presents",
      duration: 4,
      style: "gradient",
      color: "#6d28d9",
    },
    outro_slide: {
      title: "Thank You!",
      subtitle: "Follow us for more",
      duration: 3,
      style: "minimal",
      color: "#6d28d9",
    },
    music_suggestion: {
      mood: "uplifting",
      genre: "pop",
      tempo: "medium",
      description: "A cheerful background track matching the video mood",
      keywords: ["happy", "upbeat", "background"],
    },
    effects: {
      brightness: 1.0,
      contrast: 1.0,
      saturation: 1.0,
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
    const systemPrompt = `You are a professional video editor specializing in social media content for businesses and schools. Your #1 job is to pick the BEST, most engaging moments from the source video — not evenly spaced clips, but the highlights. You create engaging, platform-optimized edits with intro slides, transitions, captions, and music suggestions. Always return valid JSON.`;
    const prompt = `Create an edit plan for this video. Source video: ${videoDuration.toFixed(1)} seconds
Business: ${businessContext.businessName} (${businessContext.industry})
Brand tone: ${businessContext.brandTone}
Target audience: ${businessContext.targetAudience}
Platform: ${targetPlatform}
Target duration: ${targetDuration} seconds
Aspect ratio: ${targetPlatform === "instagram_reels" || targetPlatform === "tiktok" || targetPlatform === "youtube_shorts" ? "9:16" : "16:9"}

Transcript (with timestamps):
${transcript.segments.slice(0, 40).map(s => `[${s.start.toFixed(1)}-${s.end.toFixed(1)}] ${s.text}`).join("\n")}

Scene descriptions:
${frameAnalysis.slice(0, 8).map(f => `[${f.timestamp.toFixed(1)}s] ${f.description} (action: ${f.action}, quality: ${f.quality}/10)`).join("\n")}

IMPORTANT RULES FOR SEGMENT SELECTION:
- Do NOT pick evenly spaced segments. Analyze the transcript and scene descriptions to find the BEST, most engaging moments.
- Prefer segments with: high quality scores, clear speech, action, emotional peaks, key information, visual interest.
- Skip segments with: silence, filler words, low quality, boring/static scenes, off-topic content.
- Each segment should be 3-15 seconds long — not too short, not too long.
- Total segment duration should sum to ~${targetDuration} seconds.
- Provide a specific "reason" for why each segment was chosen (e.g. "key announcement", "best visual moment", "emotional climax").

Return ONLY this JSON structure:
{
  "segments": [{"start": 0, "end": 10, "reason": "opening scene", "animation": "zoom_in"}],
  "transitions": [{"at": 10, "type": "crossfade", "duration": 0.5}],
  "captions": [{"start": 0, "end": 3, "text": "${businessContext.businessName}", "style": "title_center"}, {"start": 3, "end": 6, "text": "subtitle text", "style": "subtitle_bottom"}],
  "color_grade": "natural",
  "audio_adjustments": {"normalize": true, "remove_silence": false},
  "output_format": {"aspect_ratio": "${targetPlatform === "instagram_reels" || targetPlatform === "tiktok" || targetPlatform === "youtube_shorts" ? "9:16" : "16:9"}", "resolution": "${targetPlatform === "instagram_reels" || targetPlatform === "tiktok" || targetPlatform === "youtube_shorts" ? "1080x1920" : "1920x1080"}"},
  "intro_slide": {"title": "${businessContext.businessName}", "subtitle": "A catchy subtitle based on content", "duration": 4, "style": "gradient", "color": "#6d28d9"},
  "outro_slide": {"title": "Thank You!", "subtitle": "Follow us for more", "duration": 3, "style": "minimal", "color": "#6d28d9"},
  "music_suggestion": {"mood": "uplifting", "genre": "pop", "tempo": "medium", "description": "A cheerful background track", "keywords": ["happy", "celebration", "school"]},
  "effects": {"brightness": 1.0, "contrast": 1.0, "saturation": 1.0}
}

Rules:
- All timestamps must be between 0 and ${videoDuration.toFixed(1)}
- Total segment duration should be ~${targetDuration} seconds
- segments.end must be > segments.start
- For intro_slide style, use "school" for educational content, "gradient" for general, "bold" for energetic, "minimal" for corporate
- For music_suggestion, suggest appropriate mood/genre based on video content and tone
- For captions, include key moments from the transcript as subtitle_bottom and the title as title_center
- Add "lower_third" captions for speaker names or important info
- effects brightness/contrast/saturation should be between 0.5 and 2.0 (1.0 = no change)
- transition types: "crossfade", "fade_black", "cut"
- For each segment, pick an animation from: "zoom_in", "zoom_out", "ken_burns", "ken_burns_reverse", "pan_left", "pan_right", "pan_up", "pan_down", "drift_left", "drift_right", "drift_up", "drift_down", "slide_in_left", "slide_in_right", "fade_in_zoom", "focus_pull", "parallax", "glide", "cinematic_bars", "dramatic_zoom", "pulse", "sway", "float", "bounce_zoom", "diagonal_tlbr", "diagonal_bltr", "rotate_cw", "rotate_ccw", "tilt", "zoom_in_rotate", "zoom_out_rotate", "reveal_scale"
- Vary the animation per segment for visual interest
- effects brightness/contrast/saturation defaults should be 1.0 (no artificial lighting changes unless needed)`;

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
      intro_slide: parsed.intro_slide || {
        title: businessContext.businessName,
        subtitle: "Presents",
        duration: 4,
        style: "gradient",
        color: "#6d28d9",
      },
      outro_slide: parsed.outro_slide || {
        title: "Thank You!",
        subtitle: "Follow us for more",
        duration: 3,
        style: "minimal",
        color: "#6d28d9",
      },
      music_suggestion: parsed.music_suggestion || {
        mood: "uplifting",
        genre: "pop",
        tempo: "medium",
        description: "A cheerful background track",
        keywords: ["happy", "upbeat"],
      },
      effects: parsed.effects || {
        brightness: 1.0,
        contrast: 1.05,
        saturation: 1.1,
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
