import OpenAI from "openai";

const groqClient = new OpenAI({
  apiKey: process.env.GROQ_API_KEY || "",
  baseURL: "https://api.groq.com/openai/v1",
});

export const MODELS = {
  LLM: "llama-3.3-70b-versatile",
  VISION: "meta-llama/llama-4-scout-17b-16e-instruct",
  WHISPER: "whisper-large-v3-turbo",
  FAST: "llama-3.1-8b-instant",
} as const;

export default groqClient;
