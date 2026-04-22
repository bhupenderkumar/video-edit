import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createClient } from "@supabase/supabase-js";

const ANIMATION_LIST = [
  "zoom_in","zoom_out","ken_burns","ken_burns_reverse","pan_left","pan_right",
  "pan_up","pan_down","drift_left","drift_right","drift_up","drift_down",
  "slide_in_left","slide_in_right","slide_in_top","slide_in_bottom",
  "fade_in","fade_out","fade_in_zoom","focus_pull","parallax","glide",
  "cinematic_bars","dramatic_zoom","pulse","sway","float","bounce_zoom",
  "elastic_scale","diagonal_tlbr","diagonal_bltr","rotate_cw","rotate_ccw",
  "tilt","zoom_in_rotate","zoom_out_rotate","reveal_scale","spin_in",
  "shake","wipe_left","wipe_right","zoom_in_tl","zoom_in_tr","zoom_in_bl","zoom_in_br",
];

const COLOR_PRESETS = [
  "natural","warm","cool","vibrant","cinematic","vintage","bw","film",
  "matte","teal_orange","moody","golden","pastel","dramatic",
];

function getSupabase() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Supabase not configured");
  return createClient(url, key);
}

async function callLLM(messages: { role: string; content: string }[]): Promise<string> {
  const OpenAI = (await import("openai")).default;
  const groq = new OpenAI({
    apiKey: process.env.GROQ_API_KEY || "",
    baseURL: "https://api.groq.com/openai/v1",
  });

  const response = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: messages as any,
    response_format: { type: "json_object" },
    max_completion_tokens: 4096,
    temperature: 0.7,
  });

  return response.choices[0]?.message?.content || "{}";
}

async function getChatHistory(projectId: string) {
  const sb = getSupabase();
  const { data } = await sb
    .from("ai_chat_messages")
    .select("role, content, created_at")
    .eq("project_id", projectId)
    .order("created_at", { ascending: true })
    .limit(30);
  return data || [];
}

async function saveChatMessage(projectId: string, role: string, content: string, editPlanSnapshot?: any) {
  const sb = getSupabase();
  await sb.from("ai_chat_messages").insert({
    project_id: projectId,
    role,
    content,
    edit_plan_snapshot: editPlanSnapshot || null,
  });
}

export async function GET(req: NextRequest) {
  const projectId = req.nextUrl.searchParams.get("projectId");
  if (!projectId) return NextResponse.json({ error: "projectId required" }, { status: 400 });

  try {
    const history = await getChatHistory(projectId);
    return NextResponse.json({ messages: history });
  } catch (err) {
    console.error("[ai-chat] GET error:", err);
    return NextResponse.json({ messages: [] });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { projectId, message } = await req.json();
    if (!projectId || !message) {
      return NextResponse.json({ error: "projectId and message required" }, { status: 400 });
    }

    // Fetch project context
    const project = await db.getProject(projectId);
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const currentPlan = project.edit_plan ? JSON.parse(project.edit_plan) : null;
    if (!currentPlan) {
      return NextResponse.json({ error: "No edit plan exists yet. Wait for processing to complete." }, { status: 400 });
    }

    // Save user message
    await saveChatMessage(projectId, "user", message);

    // Fetch recent history for context
    const history = await getChatHistory(projectId);

    // Build LLM conversation
    const systemPrompt = `You are an AI video editor assistant. The user has a video project and wants to modify the edit plan through natural language commands.

CURRENT EDIT PLAN:
${JSON.stringify(currentPlan, null, 2)}

VIDEO DURATION: ${project.duration || "unknown"} seconds
PROJECT TITLE: ${project.title}

You can modify the edit plan based on user requests. Always respond with valid JSON in this format:
{
  "reply": "A friendly explanation of what you changed (1-3 sentences)",
  "updated_plan": { ... the full updated edit plan ... } OR null if no changes needed,
  "changes_summary": ["list of specific changes made"]
}

CAPABILITIES - you can:
1. Add/remove/reorder video segments (start/end times, reasons)
2. Change segment animations. Available: ${ANIMATION_LIST.join(", ")}
3. Add/edit/remove captions (start, end, text, style: subtitle_bottom|title_center|lower_third)
4. Change transitions (at, type: crossfade|fade_black|cut, duration)
5. Modify intro slide (title, subtitle, duration, style: gradient|minimal|bold|school, color)
6. Modify outro slide (same fields as intro)
7. Change color grade. Available: ${COLOR_PRESETS.join(", ")}
8. Adjust effects: brightness (0.5-1.5), contrast (0.5-1.5), saturation (0.2-2.0)
9. Change output format (aspect_ratio: 16:9|9:16|1:1, resolution)
10. Change music suggestion (mood, genre, tempo, description, keywords[])
11. Toggle audio adjustments (normalize, remove_silence)

RULES:
- If user says "make it warmer" → change color_grade to "warm"
- If user says "add zoom" → change segment animation to "zoom_in"
- If user says "change title" → update intro_slide.title
- If user says "remove intro" → set intro_slide to null
- If user says "add caption at 5s" → add caption with appropriate times
- If user says "make it brighter" → increase effects.brightness (max 1.5)
- If user says "use cinematic style" → change color_grade to "cinematic"
- If request is unclear, ask for clarification in the reply but still return null for updated_plan
- All segment timestamps must be between 0 and ${project.duration || 999}
- When updating plan, return the COMPLETE plan, not just changed fields
- Keep the response concise and helpful`;

    const llmMessages = [
      { role: "system", content: systemPrompt },
      ...history.slice(-20).map((m: any) => ({ role: m.role, content: m.content })),
    ];

    const llmResponse = await callLLM(llmMessages);
    let parsed;
    try {
      parsed = JSON.parse(llmResponse);
    } catch {
      parsed = { reply: "I understood your request but had trouble formatting the response. Could you try rephrasing?", updated_plan: null, changes_summary: [] };
    }

    const reply = parsed.reply || "Done!";
    const updatedPlan = parsed.updated_plan || null;
    const changesSummary = parsed.changes_summary || [];

    // If AI returned an updated plan, validate and save it
    if (updatedPlan && updatedPlan.segments && updatedPlan.segments.length > 0) {
      // Basic validation
      const validPlan = {
        segments: (updatedPlan.segments || []).filter(
          (s: any) => typeof s.start === "number" && typeof s.end === "number" && s.end > s.start
        ),
        transitions: updatedPlan.transitions || currentPlan.transitions || [],
        captions: updatedPlan.captions || currentPlan.captions || [],
        color_grade: updatedPlan.color_grade || currentPlan.color_grade || "natural",
        audio_adjustments: updatedPlan.audio_adjustments || currentPlan.audio_adjustments,
        output_format: updatedPlan.output_format || currentPlan.output_format,
        intro_slide: updatedPlan.intro_slide !== undefined ? updatedPlan.intro_slide : currentPlan.intro_slide,
        outro_slide: updatedPlan.outro_slide !== undefined ? updatedPlan.outro_slide : currentPlan.outro_slide,
        music_suggestion: updatedPlan.music_suggestion !== undefined ? updatedPlan.music_suggestion : currentPlan.music_suggestion,
        effects: updatedPlan.effects || currentPlan.effects,
      };

      if (validPlan.segments.length > 0) {
        await db.updateProject(projectId, { edit_plan: JSON.stringify(validPlan) });
      }
    }

    // Save assistant reply
    await saveChatMessage(projectId, "assistant", reply, updatedPlan);

    return NextResponse.json({
      reply,
      updated: !!updatedPlan,
      changes: changesSummary,
    });
  } catch (err: any) {
    console.error("[ai-chat] POST error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to process request" },
      { status: 500 }
    );
  }
}
