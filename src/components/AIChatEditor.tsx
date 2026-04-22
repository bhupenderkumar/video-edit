"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  MessageSquare, Send, Loader2, Sparkles, X, ChevronDown,
  Wand2, Palette, Type, Music2, Scissors, Zap, RotateCcw,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  created_at?: string;
}

interface Props {
  projectId: string;
  onPlanUpdated: () => void;
}

const QUICK_ACTIONS = [
  { icon: Palette, label: "Make it warmer", prompt: "Make the color grading warmer" },
  { icon: Palette, label: "Cinematic look", prompt: "Apply cinematic color grading with letterbox bars" },
  { icon: Zap, label: "Add zoom effects", prompt: "Add zoom in animations to all segments" },
  { icon: Zap, label: "Ken Burns effect", prompt: "Apply Ken Burns effect to all segments for a smooth documentary feel" },
  { icon: Type, label: "Change intro title", prompt: "Change the intro title to " },
  { icon: Type, label: "Add caption", prompt: "Add a caption saying '' at the 5 second mark" },
  { icon: Scissors, label: "Remove intro", prompt: "Remove the intro slide" },
  { icon: Music2, label: "Upbeat music", prompt: "Suggest upbeat, energetic background music" },
  { icon: Wand2, label: "Brighter video", prompt: "Make the video slightly brighter and more vibrant" },
  { icon: Palette, label: "Vintage style", prompt: "Apply vintage color grading for a retro feel" },
  { icon: Zap, label: "Smooth pan", prompt: "Use smooth pan left and pan right animations on alternating segments" },
  { icon: RotateCcw, label: "Reset to natural", prompt: "Reset color grading to natural with default brightness and contrast" },
];

export default function AIChatEditor({ projectId, onPlanUpdated }: Props) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load chat history
  useEffect(() => {
    if (!open || historyLoaded) return;
    (async () => {
      try {
        const res = await fetch(`/api/ai-chat?projectId=${projectId}`);
        if (res.ok) {
          const data = await res.json();
          if (data.messages?.length) setMessages(data.messages);
        }
      } catch { /* ignore */ }
      setHistoryLoaded(true);
    })();
  }, [open, projectId, historyLoaded]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus();
  }, [open]);

  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    setMessages(prev => [...prev, { role: "user", content: trimmed }]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/ai-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, message: trimmed }),
      });

      if (!res.ok) {
        const err = await res.json();
        setMessages(prev => [...prev, { role: "assistant", content: err.error || "Something went wrong. Please try again." }]);
        return;
      }

      const data = await res.json();
      setMessages(prev => [...prev, { role: "assistant", content: data.reply }]);

      if (data.updated) {
        onPlanUpdated();
      }
    } catch {
      setMessages(prev => [...prev, { role: "assistant", content: "Network error. Please try again." }]);
    } finally {
      setLoading(false);
    }
  }, [loading, projectId, onPlanUpdated]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    sendMessage(input);
  }

  function handleQuickAction(prompt: string) {
    if (prompt.endsWith(" ")) {
      setInput(prompt);
      inputRef.current?.focus();
    } else {
      sendMessage(prompt);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-medium text-primary-foreground shadow-lg shadow-primary/25 transition-all hover:bg-primary/90 hover:shadow-xl hover:shadow-primary/30"
      >
        <Sparkles className="h-4 w-4" />
        AI Editor
        {messages.length > 0 && (
          <span className="ml-1 flex h-5 w-5 items-center justify-center rounded-full bg-white/20 text-[10px]">
            {messages.filter(m => m.role === "assistant").length}
          </span>
        )}
      </button>
    );
  }

  return (
    <div className="fixed bottom-0 right-0 z-50 flex h-[min(600px,85vh)] w-full flex-col border-l border-t border-border bg-background shadow-2xl sm:bottom-6 sm:right-6 sm:h-[min(600px,80vh)] sm:w-[420px] sm:rounded-2xl sm:border">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
            <Sparkles className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-semibold">AI Video Editor</h3>
            <p className="text-[10px] text-muted-foreground">Describe changes in plain English</p>
          </div>
        </div>
        <button onClick={() => setOpen(false)} className="rounded-lg p-1.5 hover:bg-secondary">
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.length === 0 && !loading && (
          <div className="space-y-4">
            <div className="rounded-xl bg-primary/5 p-4">
              <p className="text-sm font-medium text-primary">Welcome! Tell me how to edit your video.</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Try things like &quot;make it warmer&quot;, &quot;add zoom effects&quot;, &quot;change the intro title&quot;, or &quot;apply cinematic color grading&quot;.
              </p>
            </div>
            <div>
              <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Quick Actions</p>
              <div className="flex flex-wrap gap-1.5">
                {QUICK_ACTIONS.map((action) => (
                  <button
                    key={action.label}
                    onClick={() => handleQuickAction(action.prompt)}
                    className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2.5 py-1 text-[11px] font-medium transition-colors hover:bg-secondary hover:border-primary/30"
                  >
                    <action.icon className="h-3 w-3 text-muted-foreground" />
                    {action.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}>
            <div
              className={cn(
                "max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm",
                msg.role === "user"
                  ? "rounded-br-md bg-primary text-primary-foreground"
                  : "rounded-bl-md bg-secondary text-foreground"
              )}
            >
              {msg.content}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="flex items-center gap-2 rounded-2xl rounded-bl-md bg-secondary px-3.5 py-2.5 text-sm text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Thinking...
            </div>
          </div>
        )}
      </div>

      {/* Quick actions when there are messages */}
      {messages.length > 0 && (
        <div className="border-t border-border px-3 pt-2">
          <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
            {QUICK_ACTIONS.slice(0, 6).map((action) => (
              <button
                key={action.label}
                onClick={() => handleQuickAction(action.prompt)}
                disabled={loading}
                className="inline-flex shrink-0 items-center gap-1 rounded-full border border-border px-2 py-1 text-[10px] font-medium transition-colors hover:bg-secondary disabled:opacity-50"
              >
                <action.icon className="h-2.5 w-2.5" />
                {action.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <form onSubmit={handleSubmit} className="border-t border-border p-3">
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="e.g. Make it more cinematic..."
            disabled={loading}
            className="flex-1 rounded-xl border border-border bg-secondary/50 px-3.5 py-2.5 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!input.trim() || loading}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </div>
      </form>
    </div>
  );
}
