"use client";

import { useState, useRef } from "react";
import {
  ImagePlus,
  Upload,
  Loader2,
  Download,
  Sparkles,
  X,
  ArrowRight,
} from "lucide-react";
import { cn, formatFileSize } from "@/lib/utils";

const enhancementTypes = [
  { id: "auto", label: "Auto Enhance", desc: "Upscale + Sharpen + Color correct" },
  { id: "upscale", label: "Upscale 2x", desc: "Double the resolution" },
  { id: "color_correct", label: "Color Correct", desc: "Fix colors and exposure" },
  { id: "sharpen", label: "Sharpen", desc: "Increase image sharpness" },
];

type EnhancedResult = {
  id: string;
  original: { width: number; height: number };
  enhanced: { width: number; height: number; path: string; dataUrl?: string };
  enhancement_type: string;
};

export default function PhotosPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [enhancementType, setEnhancementType] = useState("auto");
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<EnhancedResult | null>(null);
  const [error, setError] = useState("");

  function handleFileSelect(selectedFile: File) {
    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedTypes.includes(selectedFile.type)) {
      setError("Supported formats: JPEG, PNG, WebP");
      return;
    }
    setError("");
    setFile(selectedFile);
    setResult(null);

    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target?.result as string);
    reader.readAsDataURL(selectedFile);
  }

  async function handleEnhance() {
    if (!file) return;
    setProcessing(true);
    setError("");
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("photo", file);
      formData.append("enhancement_type", enhancementType);

      const res = await fetch("/api/photos", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Enhancement failed");
      }

      const data = await res.json();
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Enhancement failed");
    } finally {
      setProcessing(false);
    }
  }

  function reset() {
    setFile(null);
    setPreview(null);
    setResult(null);
    setError("");
  }

  return (
    <div>
      <div className="mb-6 lg:mb-8">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Photo Enhancement</h1>
        <p className="mt-1 text-sm text-muted-foreground sm:text-base">
          Upscale, sharpen, and color-correct your business photos.
        </p>
      </div>

      <div className="mx-auto max-w-4xl">
        {!result ? (
          <div className="space-y-6">
            {/* Upload Area */}
            <div
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                "relative cursor-pointer rounded-xl border-2 border-dashed p-8 text-center transition-all",
                file
                  ? "border-success/50 bg-success/5"
                  : "border-border hover:border-primary/50 hover:bg-secondary/30"
              )}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) =>
                  e.target.files?.[0] && handleFileSelect(e.target.files[0])
                }
              />

              {preview ? (
                <div className="flex flex-col items-center">
                  <img
                    src={preview}
                    alt="Preview"
                    className="max-h-64 rounded-lg object-contain"
                  />
                  <p className="mt-3 text-sm text-muted-foreground">
                    {file?.name} • {file && formatFileSize(file.size)}
                  </p>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      reset();
                    }}
                    className="mt-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                    Remove
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-center py-8">
                  <ImagePlus className="h-12 w-12 text-muted-foreground/50" />
                  <p className="mt-4 text-lg font-medium">
                    Drop your photo here
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    JPEG, PNG, WebP
                  </p>
                </div>
              )}
            </div>

            {/* Enhancement Type */}
            {file && (
              <>
                <div>
                  <label className="mb-3 block text-sm font-medium">
                    Enhancement Type
                  </label>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
                    {enhancementTypes.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => setEnhancementType(t.id)}
                        className={cn(
                          "rounded-lg border p-4 text-left transition-all",
                          enhancementType === t.id
                            ? "border-primary bg-primary/10"
                            : "border-border hover:border-primary/30"
                        )}
                      >
                        <p className="text-sm font-medium">{t.label}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {t.desc}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>

                {error && (
                  <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
                    {error}
                  </div>
                )}

                <button
                  onClick={handleEnhance}
                  disabled={processing}
                  className="w-full rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-all hover:bg-primary/90 active:scale-[0.98] disabled:opacity-50"
                >
                  {processing ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Enhancing...
                    </span>
                  ) : (
                    <span className="flex items-center justify-center gap-2">
                      <Sparkles className="h-4 w-4" />
                      Enhance Photo
                    </span>
                  )}
                </button>
              </>
            )}
          </div>
        ) : (
          /* Result View */
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              {/* Original */}
              <div className="rounded-xl border border-border bg-card p-4">
                <p className="mb-3 text-sm font-medium text-muted-foreground">
                  Original ({result.original.width}×{result.original.height})
                </p>
                {preview && (
                  <img
                    src={preview}
                    alt="Original"
                    className="w-full rounded-lg object-contain"
                  />
                )}
              </div>

              {/* Enhanced */}
              <div className="rounded-xl border border-primary/30 bg-card p-4">
                <p className="mb-3 text-sm font-medium text-primary">
                  Enhanced ({result.enhanced.width}×{result.enhanced.height})
                </p>
                <img
                  src={result.enhanced.dataUrl || result.enhanced.path}
                  alt="Enhanced"
                  className="w-full rounded-lg object-contain"
                />
              </div>
            </div>

            <div className="flex gap-3">
              <a
                href={result.enhanced.dataUrl || result.enhanced.path}
                download={`enhanced_${result.id}.jpg`}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
              >
                <Download className="h-4 w-4" />
                Download Enhanced
              </a>
              <button
                onClick={reset}
                className="rounded-lg border border-border px-6 py-3 text-sm font-medium transition-colors hover:bg-secondary"
              >
                Enhance Another
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
