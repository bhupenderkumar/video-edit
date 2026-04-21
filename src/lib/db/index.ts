import path from "path";
import fs from "fs";

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

// ── In-Memory Store (Vercel-compatible) ─────────────────────────────────────

const profiles = new Map<string, ProfileRow>();
const projects = new Map<string, ProjectRow>();
const photoJobs = new Map<string, { id: string; original_path: string; enhanced_path: string | null; enhancement_type: string; status: string }>();

// Seed default profile
profiles.set("default", {
  id: "default",
  business_name: "My Business",
  industry: "general",
  brand_description: "We are a small business passionate about what we do.",
  target_audience: "Local customers",
  brand_tone: "professional",
  preferred_platforms: '["instagram_reels"]',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
});

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
      CREATE TABLE IF NOT EXISTS photo_jobs (
        id TEXT PRIMARY KEY, original_path TEXT NOT NULL, enhanced_path TEXT,
        enhancement_type TEXT DEFAULT 'auto', ai_suggestions TEXT,
        status TEXT DEFAULT 'pending', created_at TEXT DEFAULT (datetime('now'))
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
  getProfile(id: string = "default"): ProfileRow | undefined {
    if (!IS_VERCEL) {
      return getSqliteDb().prepare("SELECT * FROM business_profiles WHERE id = ?").get(id) as ProfileRow | undefined;
    }
    return profiles.get(id);
  },

  updateProfile(id: string, data: Partial<ProfileRow>) {
    if (!IS_VERCEL) {
      getSqliteDb().prepare(
        `UPDATE business_profiles SET business_name=?, industry=?, brand_description=?, target_audience=?, brand_tone=?, preferred_platforms=?, updated_at=datetime('now') WHERE id=?`
      ).run(data.business_name || "My Business", data.industry || "", data.brand_description || "", data.target_audience || "", data.brand_tone || "professional", data.preferred_platforms || '["instagram_reels"]', id);
      return getSqliteDb().prepare("SELECT * FROM business_profiles WHERE id = ?").get(id) as ProfileRow;
    }
    const existing = profiles.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...data, updated_at: new Date().toISOString() };
    profiles.set(id, updated);
    return updated;
  },

  // Projects
  createProject(project: Omit<ProjectRow, "created_at" | "updated_at" | "transcript" | "frame_analysis" | "edit_plan" | "duration" | "resolution" | "processing_started_at" | "processing_completed_at" | "error_message">) {
    const now = new Date().toISOString();
    if (!IS_VERCEL) {
      getSqliteDb().prepare(
        `INSERT INTO projects (id, profile_id, title, status, original_path, target_platform, target_duration, file_size) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(project.id, project.profile_id, project.title, project.status, project.original_path, project.target_platform, project.target_duration, project.file_size);
      return;
    }
    const full: ProjectRow = {
      ...project,
      transcript: null, frame_analysis: null, edit_plan: null,
      duration: null, resolution: null,
      processing_started_at: null, processing_completed_at: null, error_message: null,
      created_at: now, updated_at: now,
    };
    projects.set(project.id, full);
  },

  getProject(id: string): ProjectRow | undefined {
    if (!IS_VERCEL) {
      return getSqliteDb().prepare("SELECT * FROM projects WHERE id = ?").get(id) as ProjectRow | undefined;
    }
    return projects.get(id);
  },

  listProjects(): ProjectRow[] {
    if (!IS_VERCEL) {
      return getSqliteDb().prepare(
        "SELECT id, title, status, target_platform, target_duration, duration, resolution, file_size, output_path, error_message, created_at, updated_at FROM projects ORDER BY created_at DESC"
      ).all() as ProjectRow[];
    }
    return Array.from(projects.values()).sort((a, b) => b.created_at.localeCompare(a.created_at));
  },

  updateProject(id: string, data: Partial<ProjectRow>) {
    if (!IS_VERCEL) {
      const sets = Object.entries(data).map(([k]) => `${k} = ?`).join(", ");
      const vals = Object.values(data);
      getSqliteDb().prepare(`UPDATE projects SET ${sets}, updated_at = datetime('now') WHERE id = ?`).run(...vals, id);
      return;
    }
    const existing = projects.get(id);
    if (!existing) return;
    projects.set(id, { ...existing, ...data, updated_at: new Date().toISOString() });
  },

  deleteProject(id: string) {
    if (!IS_VERCEL) {
      getSqliteDb().prepare("DELETE FROM projects WHERE id = ?").run(id);
      return;
    }
    projects.delete(id);
  },
};

// Legacy support — keep getDb for backward compat with processor
export function getDb() {
  if (IS_VERCEL) {
    throw new Error("SQLite not available on Vercel — use db.* methods instead");
  }
  return getSqliteDb();
}
