import path from "path";
import fs from "fs";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

const IS_VERCEL = !!process.env.VERCEL;

// ── Types ───────────────────────────────────────────────────────────────────

export type ProjectRow = {
  id: string;
  profile_id: string | null;
  title: string;
  status: string;
  original_path: string;
  output_path: string | null;
  target_platform: string;
  target_duration: number;
  transcript: string | null;
  frame_analysis: string | null;
  edit_plan: string | null;
  duration: number | null;
  resolution: string | null;
  file_size: number | null;
  processing_started_at: string | null;
  processing_completed_at: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
};

export type ProfileRow = {
  id: string;
  business_name: string;
  industry: string;
  brand_description: string;
  target_audience: string;
  brand_tone: string;
  preferred_platforms: string;
  created_at: string;
  updated_at: string;
};

// ── Supabase client (Vercel) ────────────────────────────────────────────────

let _supabase: SupabaseClient | null = null;

function getSupabase(): SupabaseClient {
  if (!_supabase) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
    if (!url || !key) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_ANON_KEY) are required on Vercel");
    _supabase = createClient(url, key);
  }
  return _supabase;
}

// ── SQLite (local only) ─────────────────────────────────────────────────────

let _sqliteDb: any = null;

function getSqliteDb() {
  if (!_sqliteDb) {
    const Database = require("better-sqlite3");
    const DATA_DIR = process.env.DATA_DIR || "./data";
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const dbPath = path.join(DATA_DIR, "videoedit.db");
    _sqliteDb = new Database(dbPath);
    _sqliteDb.pragma("journal_mode = WAL");
    _sqliteDb.pragma("foreign_keys = ON");
    _sqliteDb.exec(`
      CREATE TABLE IF NOT EXISTS business_profiles (
        id TEXT PRIMARY KEY, business_name TEXT NOT NULL, industry TEXT DEFAULT '',
        brand_description TEXT DEFAULT '', target_audience TEXT DEFAULT '',
        brand_tone TEXT DEFAULT 'professional', preferred_platforms TEXT DEFAULT '["instagram_reels"]',
        created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now'))
      );
      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY, profile_id TEXT REFERENCES business_profiles(id),
        title TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'uploaded',
        original_path TEXT NOT NULL, output_path TEXT,
        target_platform TEXT DEFAULT 'instagram_reels', target_duration INTEGER DEFAULT 30,
        transcript TEXT, frame_analysis TEXT, edit_plan TEXT,
        duration REAL, resolution TEXT, file_size INTEGER,
        processing_started_at TEXT, processing_completed_at TEXT, error_message TEXT,
        created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now'))
      );
    `);
    const count = _sqliteDb.prepare("SELECT COUNT(*) as cnt FROM business_profiles").get() as { cnt: number };
    if (count.cnt === 0) {
      _sqliteDb.prepare(
        "INSERT INTO business_profiles (id, business_name, industry, brand_description, target_audience, brand_tone) VALUES (?, ?, ?, ?, ?, ?)"
      ).run("default", "My Business", "general", "We are a small business passionate about what we do.", "Local customers", "professional");
    }
  }
  return _sqliteDb;
}

// ── Unified DB Interface ────────────────────────────────────────────────────

export const db = {
  // Profile
  async getProfile(id: string = "default"): Promise<ProfileRow | undefined> {
    if (IS_VERCEL) {
      const { data } = await getSupabase().from("business_profiles").select("*").eq("id", id).single();
      return data ?? undefined;
    }
    return getSqliteDb().prepare("SELECT * FROM business_profiles WHERE id = ?").get(id) as ProfileRow | undefined;
  },

  async updateProfile(id: string, data: Partial<ProfileRow>): Promise<ProfileRow | undefined> {
    if (IS_VERCEL) {
      const { data: updated } = await getSupabase()
        .from("business_profiles")
        .update({ ...data, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select()
        .single();
      return updated ?? undefined;
    }
    getSqliteDb().prepare(
      `UPDATE business_profiles SET business_name=?, industry=?, brand_description=?, target_audience=?, brand_tone=?, preferred_platforms=?, updated_at=datetime('now') WHERE id=?`
    ).run(data.business_name || "My Business", data.industry || "", data.brand_description || "", data.target_audience || "", data.brand_tone || "professional", data.preferred_platforms || '["instagram_reels"]', id);
    return getSqliteDb().prepare("SELECT * FROM business_profiles WHERE id = ?").get(id) as ProfileRow;
  },

  // Projects
  async createProject(project: Omit<ProjectRow, "created_at" | "updated_at" | "transcript" | "frame_analysis" | "edit_plan" | "duration" | "resolution" | "processing_started_at" | "processing_completed_at" | "error_message">) {
    if (IS_VERCEL) {
      await getSupabase().from("projects").insert({
        id: project.id,
        profile_id: project.profile_id,
        title: project.title,
        status: project.status,
        original_path: project.original_path,
        target_platform: project.target_platform,
        target_duration: project.target_duration,
        file_size: project.file_size,
      });
      return;
    }
    getSqliteDb().prepare(
      `INSERT INTO projects (id, profile_id, title, status, original_path, target_platform, target_duration, file_size) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(project.id, project.profile_id, project.title, project.status, project.original_path, project.target_platform, project.target_duration, project.file_size);
  },

  async getProject(id: string): Promise<ProjectRow | undefined> {
    if (IS_VERCEL) {
      const { data } = await getSupabase().from("projects").select("*").eq("id", id).single();
      return data ?? undefined;
    }
    return getSqliteDb().prepare("SELECT * FROM projects WHERE id = ?").get(id) as ProjectRow | undefined;
  },

  async listProjects(): Promise<ProjectRow[]> {
    if (IS_VERCEL) {
      const { data } = await getSupabase()
        .from("projects")
        .select("id, title, status, target_platform, target_duration, duration, resolution, file_size, output_path, error_message, created_at, updated_at")
        .order("created_at", { ascending: false });
      return (data ?? []) as ProjectRow[];
    }
    return getSqliteDb().prepare(
      "SELECT id, title, status, target_platform, target_duration, duration, resolution, file_size, output_path, error_message, created_at, updated_at FROM projects ORDER BY created_at DESC"
    ).all() as ProjectRow[];
  },

  async updateProject(id: string, data: Partial<ProjectRow>) {
    if (IS_VERCEL) {
      await getSupabase()
        .from("projects")
        .update({ ...data, updated_at: new Date().toISOString() })
        .eq("id", id);
      return;
    }
    const sets = Object.entries(data).map(([k]) => `${k} = ?`).join(", ");
    const vals = Object.values(data);
    getSqliteDb().prepare(`UPDATE projects SET ${sets}, updated_at = datetime('now') WHERE id = ?`).run(...vals, id);
  },

  async deleteProject(id: string) {
    if (IS_VERCEL) {
      await getSupabase().from("projects").delete().eq("id", id);
      return;
    }
    getSqliteDb().prepare("DELETE FROM projects WHERE id = ?").run(id);
  },
};

// Legacy support
export function getDb() {
  if (IS_VERCEL) {
    throw new Error("SQLite not available on Vercel — use db.* methods instead");
  }
  return getSqliteDb();
}
