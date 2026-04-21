import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const profile = await db.getProfile("default");
    return NextResponse.json({ profile: profile || null });
  } catch (err) {
    console.error("Profile fetch error:", err);
    return NextResponse.json(
      { error: "Failed to fetch profile" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      business_name,
      industry,
      brand_description,
      target_audience,
      brand_tone,
      preferred_platforms,
    } = body;

    const profile = await db.updateProfile("default", {
      business_name: business_name || "My Business",
      industry: industry || "",
      brand_description: brand_description || "",
      target_audience: target_audience || "",
      brand_tone: brand_tone || "professional",
      preferred_platforms: JSON.stringify(preferred_platforms || ["instagram_reels"]),
    });

    return NextResponse.json({ profile, message: "Profile updated" });
  } catch (err) {
    console.error("Profile update error:", err);
    return NextResponse.json(
      { error: "Failed to update profile" },
      { status: 500 }
    );
  }
}
