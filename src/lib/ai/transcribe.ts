import fs from "fs";
import { execSync } from "child_process";
import path from "path";

const IS_VERCEL = !!process.env.VERCEL;

export interface TranscriptSegment {
  start: number;
  end: number;
  text: string;
}

export interface TranscriptionResult {
  text: string;
  segments: TranscriptSegment[];
  duration: number;
}

async function transcribeWithGroq(audioPath: string): Promise<TranscriptionResult> {
  const OpenAI = (await import("openai")).default;
  const groq = new OpenAI({
    apiKey: process.env.GROQ_API_KEY || "",
    baseURL: "https://api.groq.com/openai/v1",
  });

  console.log("[transcribe] Using Groq Whisper API...");
  const audioFile = fs.createReadStream(audioPath);

  const response = await groq.audio.transcriptions.create({
    file: audioFile,
    model: "whisper-large-v3-turbo",
    response_format: "verbose_json",
    timestamp_granularities: ["segment"],
  });

  const result = response as unknown as {
    text: string;
    segments?: Array<{ start: number; end: number; text: string }>;
    duration?: number;
  };

  console.log(`[transcribe] Groq done — ${result.segments?.length || 0} segments`);
  return {
    text: result.text || "",
    segments: result.segments?.map((s) => ({ start: s.start, end: s.end, text: s.text.trim() })) || [],
    duration: result.duration || 0,
  };
}

async function transcribeWithLocalWhisper(audioPath: string): Promise<TranscriptionResult> {
  console.log("[transcribe] Running local Whisper model...");

  const cmd = `python3 -c "
import whisper, json, sys
model = whisper.load_model('base')
result = model.transcribe('${audioPath.replace(/'/g, "\\'")}', language='en')
out = {
    'text': result.get('text', ''),
    'segments': [{'start': s['start'], 'end': s['end'], 'text': s['text'].strip()} for s in result.get('segments', [])],
    'duration': result.get('segments', [{}])[-1].get('end', 0) if result.get('segments') else 0
}
print(json.dumps(out))
"`;

  const output = execSync(cmd, {
    encoding: "utf-8",
    timeout: 300_000,
    maxBuffer: 10 * 1024 * 1024,
  });

  const lines = output.trim().split("\n");
  const jsonLine = lines.reverse().find((l) => l.startsWith("{"));
  if (!jsonLine) throw new Error("No JSON output from whisper");

  const result = JSON.parse(jsonLine);
  console.log(`[transcribe] Done — ${result.segments?.length || 0} segments, ${result.duration?.toFixed(1)}s`);
  return {
    text: result.text || "",
    segments: result.segments || [],
    duration: result.duration || 0,
  };
}

export async function transcribeAudio(
  audioPath: string
): Promise<TranscriptionResult> {
  try {
    if (IS_VERCEL) {
      return await transcribeWithGroq(audioPath);
    }
    return await transcribeWithLocalWhisper(audioPath);
  } catch (err) {
    console.error("[transcribe] Failed:", err);
    return { text: "", segments: [], duration: 0 };
  }
}
