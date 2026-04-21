"use client";

import { useEffect, useState } from "react";
import {
  User,
  Save,
  Loader2,
  CheckCircle2,
  Building2,
  Target,
  Megaphone,
} from "lucide-react";
import { cn } from "@/lib/utils";

const industries = [
  "Restaurant / Cafe",
  "Bakery",
  "Fitness / Gym",
  "Salon / Beauty",
  "Retail Store",
  "Photography",
  "Real Estate",
  "Education / Coaching",
  "Healthcare / Clinic",
  "eCommerce",
  "Agency / Consulting",
  "Other",
];

const tones = [
  { id: "professional", label: "Professional", desc: "Clean, corporate, trustworthy" },
  { id: "warm", label: "Warm & Friendly", desc: "Inviting, personal, approachable" },
  { id: "fun", label: "Fun & Energetic", desc: "Upbeat, colorful, exciting" },
  { id: "luxury", label: "Luxury & Premium", desc: "Elegant, minimal, high-end" },
  { id: "casual", label: "Casual & Relatable", desc: "Authentic, down-to-earth" },
  { id: "bold", label: "Bold & Edgy", desc: "Daring, unconventional, attention-grabbing" },
];

export default function ProfilePage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [businessName, setBusinessName] = useState("");
  const [industry, setIndustry] = useState("");
  const [brandDescription, setBrandDescription] = useState("");
  const [targetAudience, setTargetAudience] = useState("");
  const [brandTone, setBrandTone] = useState("professional");

  useEffect(() => {
    fetchProfile();
  }, []);

  async function fetchProfile() {
    try {
      const res = await fetch("/api/profile");
      const data = await res.json();
      if (data.profile) {
        setBusinessName(data.profile.business_name || "");
        setIndustry(data.profile.industry || "");
        setBrandDescription(data.profile.brand_description || "");
        setTargetAudience(data.profile.target_audience || "");
        setBrandTone(data.profile.brand_tone || "professional");
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    try {
      await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          business_name: businessName,
          industry,
          brand_description: brandDescription,
          target_audience: targetAudience,
          brand_tone: brandTone,
        }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Brand Profile</h1>
        <p className="mt-1 text-muted-foreground">
          Tell AI about your business so it creates edits that match your brand.
        </p>
      </div>

      <div className="mx-auto max-w-2xl space-y-8">
        {/* Business Info */}
        <section className="rounded-xl border border-border bg-card p-6">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Building2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Business Info</h2>
              <p className="text-sm text-muted-foreground">
                Basic info about your business
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium">
                Business Name
              </label>
              <input
                type="text"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder="Smith's Bakery"
                className="w-full rounded-lg border border-border bg-secondary/50 px-4 py-2.5 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium">
                Industry
              </label>
              <select
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                className="w-full rounded-lg border border-border bg-secondary/50 px-4 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="">Select your industry</option>
                {industries.map((ind) => (
                  <option key={ind} value={ind.toLowerCase()}>
                    {ind}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium">
                Brand Description
              </label>
              <textarea
                value={brandDescription}
                onChange={(e) => setBrandDescription(e.target.value)}
                placeholder="We are a family-owned bakery specializing in artisan bread and pastries. We've been baking with love for 20 years..."
                rows={3}
                className="w-full resize-none rounded-lg border border-border bg-secondary/50 px-4 py-2.5 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                This helps AI understand your brand story for captions and editing style
              </p>
            </div>
          </div>
        </section>

        {/* Target Audience */}
        <section className="rounded-xl border border-border bg-card p-6">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Target className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Target Audience</h2>
              <p className="text-sm text-muted-foreground">
                Who are your videos for?
              </p>
            </div>
          </div>

          <textarea
            value={targetAudience}
            onChange={(e) => setTargetAudience(e.target.value)}
            placeholder="Young professionals aged 25-40, health-conscious, local community members..."
            rows={2}
            className="w-full resize-none rounded-lg border border-border bg-secondary/50 px-4 py-2.5 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </section>

        {/* Brand Tone */}
        <section className="rounded-xl border border-border bg-card p-6">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Megaphone className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Brand Tone</h2>
              <p className="text-sm text-muted-foreground">
                How should your videos feel?
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {tones.map((tone) => (
              <button
                key={tone.id}
                onClick={() => setBrandTone(tone.id)}
                className={cn(
                  "rounded-lg border p-4 text-left transition-all",
                  brandTone === tone.id
                    ? "border-primary bg-primary/10"
                    : "border-border hover:border-primary/30"
                )}
              >
                <p className="text-sm font-medium">{tone.label}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {tone.desc}
                </p>
              </button>
            ))}
          </div>
        </section>

        {/* Save */}
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-all hover:bg-primary/90 active:scale-[0.98] disabled:opacity-50"
        >
          {saving ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Saving...
            </span>
          ) : saved ? (
            <span className="flex items-center justify-center gap-2">
              <CheckCircle2 className="h-4 w-4" />
              Saved!
            </span>
          ) : (
            <span className="flex items-center justify-center gap-2">
              <Save className="h-4 w-4" />
              Save Profile
            </span>
          )}
        </button>
      </div>
    </div>
  );
}
