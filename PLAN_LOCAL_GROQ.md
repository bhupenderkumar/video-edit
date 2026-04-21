# AI Video Editing Platform — LOCAL-FIRST + Groq API Plan (V2)

## Goal: Run & Test Everything on Your M2 Mac — $0/month

This version replaces ALL paid services with either **Groq free tier** or **local tools** so you can fully build, test, and validate the product before spending a single rupee.

---

## 1. What's Changed from V1

| Component | V1 (Cloud) | V2 (Local + Groq) | Cost |
|---|---|---|---|
| **LLM (Edit Decisions)** | OpenAI GPT-4.1 ($$$) | Groq Llama 3.3 70B (free tier) | **$0** |
| **Speech-to-Text** | OpenAI Whisper API ($$$) | Groq Whisper Large V3 Turbo (free tier) | **$0** |
| **Video Scene Analysis** | TwelveLabs ($$$) | Groq Llama 4 Scout Vision (free tier) | **$0** |
| **Video Processing** | Cloud GPU workers | FFmpeg on your M2 Mac (local) | **$0** |
| **Image Enhancement** | Replicate API ($$$) | Sharp + FFmpeg locally | **$0** |
| **Database** | Supabase (cloud) | SQLite (local file) | **$0** |
| **File Storage** | AWS S3 / Cloudflare R2 | Local filesystem (`./uploads/`) | **$0** |
| **Job Queue** | Redis + BullMQ | BullMQ + local Redis OR in-memory queue | **$0** |
| **Auth** | Clerk (cloud) | NextAuth.js with local credentials | **$0** |
| **Web App** | Vercel (cloud) | `npm run dev` on localhost | **$0** |

**Total monthly cost: $0** (only Groq free API key needed — no credit card required)

---

## 2. Groq Free Tier — What You Get (No Credit Card)

### Models Available for Free

| Model | Purpose in Our App | Free Rate Limit |
|---|---|---|
| **Llama 3.3 70B** (`llama-3.3-70b-versatile`) | Generate edit decisions, understand business context, create captions | 30 RPM, 1K RPD, 12K TPM |
| **Llama 4 Scout** (`meta-llama/llama-4-scout-17b-16e-instruct`) | Analyze video frames (vision) — understand scenes, objects, emotions | 30 RPM, 1K RPD, 30K TPM |
| **Whisper Large V3 Turbo** (`whisper-large-v3-turbo`) | Transcribe audio from videos | 20 RPM, 2K RPD, 7.2K audio-sec/hour |
| **Llama 3.1 8B** (`llama-3.1-8b-instant`) | Fast, lightweight tasks (caption formatting, metadata extraction) | 30 RPM, 14.4K RPD, 6K TPM |

### What This Means for Testing
- **Whisper free limit**: 7,200 audio seconds/hour = **2 hours of video transcription per hour** — more than enough for testing
- **Vision limit**: 1,000 requests/day = analyze ~1,000 frames/day = ~8-10 videos/day (extracting ~100 frames each)
- **LLM limit**: 1,000 requests/day = generate ~1,000 edit plans/day — way more than you need for testing

---

## 3. Local Architecture (Everything on M2 Mac)

```
┌─────────────────────────────────────────────────────────────┐
│                    YOUR M2 MAC (localhost)                   │
│                                                             │
│  ┌────────────────────────────────────────────────────┐     │
│  │           NEXT.JS APP (localhost:3000)              │     │
│  │  ┌──────────┐ ┌──────────┐ ┌────────────────────┐ │     │
│  │  │ Dashboard │ │ Upload   │ │ Business Profile   │ │     │
│  │  │ UI       │ │ Page     │ │ Setup              │ │     │
│  │  └──────────┘ └──────────┘ └────────────────────┘ │     │
│  │                                                    │     │
│  │  ┌──────────────────────────────────────────────┐  │     │
│  │  │        API ROUTES (Next.js /api/*)            │  │     │
│  │  │  /api/upload    → Save file to ./uploads/    │  │     │
│  │  │  /api/process   → Start AI pipeline          │  │     │
│  │  │  /api/projects  → CRUD projects (SQLite)     │  │     │
│  │  │  /api/download  → Serve final video          │  │     │
│  │  └──────────────────────────────────────────────┘  │     │
│  └────────────────────────────────────────────────────┘     │
│                           │                                  │
│                           ▼                                  │
│  ┌────────────────────────────────────────────────────┐     │
│  │           AI PROCESSING PIPELINE (local)           │     │
│  │                                                    │     │
│  │  Step 1: FFmpeg (local binary)                     │     │
│  │  ├─ Extract audio → ./tmp/{id}/audio.wav           │     │
│  │  ├─ Extract frames → ./tmp/{id}/frame_001.jpg ...  │     │
│  │  └─ Get metadata (duration, resolution, fps)       │     │
│  │                                                    │     │
│  │  Step 2: Groq Whisper API ──── (free, remote) ─────│──┐  │
│  │  └─ audio.wav → full transcript with timestamps    │  │  │
│  │                                                    │  │  │
│  │  Step 3: Groq Llama 4 Scout API (free, remote) ────│──┤  │
│  │  └─ frames → scene descriptions per frame          │  │  │
│  │                                                    │  │  │
│  │  Step 4: Groq Llama 3.3 70B API (free, remote) ────│──┤  │
│  │  └─ transcript + scenes + business context          │  │  │
│  │     → Edit Decision List (JSON)                    │  │  │
│  │                                                    │  │  │
│  │  Step 5: FFmpeg (local binary)                     │  │  │
│  │  ├─ Execute cuts, transitions, captions            │  │  │
│  │  ├─ Apply color adjustments                        │  │  │
│  │  ├─ Normalize audio                                │  │  │
│  │  └─ Render final video → ./output/{id}/final.mp4   │  │  │
│  └────────────────────────────────────────────────────┘  │  │
│                                                          │  │
│  ┌────────────────────────────────────────────────────┐  │  │
│  │              STORAGE (local filesystem)            │  │  │
│  │  ./uploads/    → Raw uploaded videos               │  │  │
│  │  ./tmp/        → Processing temp files             │  │  │
│  │  ./output/     → Final rendered videos             │  │  │
│  │  ./data/       → SQLite database                   │  │  │
│  └────────────────────────────────────────────────────┘  │  │
│                                                          │  │
└──────────────────────────────────────────────────────────┘  │
                                                              │
                    ┌─────────────────────┐                   │
                    │   GROQ CLOUD (free) │◄──────────────────┘
                    │   api.groq.com      │
                    │   - Whisper STT     │
                    │   - Llama 4 Vision  │
                    │   - Llama 3.3 LLM   │
                    └─────────────────────┘
```

---

## 4. Tech Stack (All Free, All Local-Compatible)

### Core App
| Component | Technology | Why |
|---|---|---|
| **Framework** | Next.js 15 (App Router) | Full-stack, runs locally with `npm run dev` |
| **Language** | TypeScript | Type safety |
| **Styling** | Tailwind CSS + shadcn/ui | Fast UI development |
| **Database** | SQLite via better-sqlite3 (or Drizzle ORM) | Zero config, single file, no server needed |
| **File Upload** | Multer (local disk) | Simple, no cloud needed |
| **Video Processing** | FFmpeg (brew install ffmpeg) | Already works great on M2 |
| **Image Processing** | Sharp | Runs natively on M2, very fast |

### AI Layer (All Groq Free Tier)
| Task | Groq Model | API |
|---|---|---|
| **Transcription** | `whisper-large-v3-turbo` | `POST /openai/v1/audio/transcriptions` |
| **Frame Analysis** | `meta-llama/llama-4-scout-17b-16e-instruct` | `POST /openai/v1/chat/completions` (with image) |
| **Edit Planning** | `llama-3.3-70b-versatile` | `POST /openai/v1/chat/completions` |
| **Quick Tasks** | `llama-3.1-8b-instant` | `POST /openai/v1/chat/completions` |

### Key Point: Groq Uses OpenAI-Compatible API
```typescript
// You can use the OpenAI SDK — just change the base URL!
import OpenAI from 'openai';

const groq = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: 'https://api.groq.com/openai/v1',
});

// Works exactly like OpenAI
const response = await groq.chat.completions.create({
  model: 'llama-3.3-70b-versatile',
  messages: [{ role: 'user', content: 'Generate edit plan...' }],
});
```

This means **when you're ready to scale**, you can switch to OpenAI/Anthropic by just changing the `baseURL` and `model` — zero code changes.

---

## 5. The Complete AI Pipeline (How Each Step Works Locally)

### Step 1: Ingest — FFmpeg on M2 (Local, $0)

```bash
# Extract audio for transcription (runs on your M2)
ffmpeg -i uploads/video.mp4 -vn -acodec pcm_s16le -ar 16000 -ac 1 tmp/audio.wav

# Extract keyframes — 1 frame every 3 seconds (runs on your M2)
ffmpeg -i uploads/video.mp4 -vf "fps=1/3" -q:v 2 tmp/frame_%04d.jpg

# Get video metadata
ffprobe -v quiet -print_format json -show_format -show_streams uploads/video.mp4
```

**M2 Performance**: A 5-minute 1080p video processes in ~10-15 seconds. M2 is fast.

### Step 2: Transcribe — Groq Whisper (Free API)

```typescript
// Send audio to Groq Whisper — FREE
const transcription = await groq.audio.transcriptions.create({
  file: fs.createReadStream('tmp/audio.wav'),
  model: 'whisper-large-v3-turbo',
  response_format: 'verbose_json',  // gives word-level timestamps!
  timestamp_granularities: ['word', 'segment'],
});

// Returns:
// { text: "Welcome to our bakery...", segments: [
//   { start: 0.0, end: 2.5, text: "Welcome to our bakery" },
//   { start: 2.5, end: 5.1, text: "we've been baking for 20 years" },
// ]}
```

**Limit**: 7,200 audio seconds/hour free. A 5-min video = 300 seconds. So you can process ~24 videos per hour free.

### Step 3: Analyze Frames — Groq Llama 4 Scout Vision (Free API)

```typescript
// Analyze each extracted frame — FREE
const frames = fs.readdirSync('tmp/').filter(f => f.startsWith('frame_'));

for (const frame of frames) {
  const base64 = fs.readFileSync(`tmp/${frame}`).toString('base64');
  
  const analysis = await groq.chat.completions.create({
    model: 'meta-llama/llama-4-scout-17b-16e-instruct',
    messages: [{
      role: 'user',
      content: [
        { type: 'text', text: 'Describe this video frame. What objects, people, actions, emotions, and setting do you see? Rate visual quality 1-10.' },
        { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64}` } }
      ]
    }],
    response_format: { type: 'json_object' },
    max_completion_tokens: 512,
  });
}

// Returns per frame:
// { objects: ["bread", "oven"], people: 1, action: "kneading dough",
//   emotion: "focused", setting: "kitchen", quality: 8 }
```

**Limit**: 1,000 requests/day free. For a 5-min video with frames every 3 sec = ~100 frames. So ~10 videos/day.

**Optimization**: Sample smarter — skip similar frames, analyze every 5th frame for long videos.

### Step 4: AI Edit Plan — Groq Llama 3.3 70B (Free API)

```typescript
const editPlan = await groq.chat.completions.create({
  model: 'llama-3.3-70b-versatile',
  messages: [{
    role: 'system',
    content: `You are a professional video editor for small businesses.
    Generate an Edit Decision List (EDL) as JSON.
    The business context: ${businessProfile}
    Target platform: ${targetPlatform}
    Target duration: ${targetDuration} seconds`
  }, {
    role: 'user',  
    content: `Here is the full transcript with timestamps:
    ${JSON.stringify(transcript.segments)}
    
    Here is the scene analysis per frame:
    ${JSON.stringify(frameAnalysis)}
    
    Generate the edit plan with:
    - segments: array of {start, end, reason} to keep
    - transitions: array of {at, type, duration}
    - captions: array of {start, end, text, style}
    - color_grade: string (warm/cool/vibrant/cinematic)
    - audio_adjustments: {normalize: bool, remove_silence: bool, background_music_mood: string}
    - output_format: {aspect_ratio, resolution}`
  }],
  response_format: { type: 'json_object' },
  max_completion_tokens: 4096,
});
```

**Returns something like:**
```json
{
  "segments": [
    { "start": 5.0, "end": 12.0, "reason": "Great product close-up of fresh bread" },
    { "start": 25.0, "end": 35.0, "reason": "Owner's passionate story — emotional hook" },
    { "start": 70.0, "end": 78.0, "reason": "Happy customer reaction — social proof" }
  ],
  "transitions": [
    { "at": 12.0, "type": "crossfade", "duration": 0.5 },
    { "at": 35.0, "type": "fade_black", "duration": 0.3 }
  ],
  "captions": [
    { "start": 25.0, "end": 35.0, "text": "20 years of baking with love", "style": "subtitle_bottom" },
    { "start": 0.0, "end": 3.0, "text": "🍞 Smith's Artisan Bakery", "style": "title_center" }
  ],
  "color_grade": "warm_golden",
  "audio_adjustments": {
    "normalize": true,
    "remove_silence": true,
    "background_music_mood": "upbeat_acoustic"
  },
  "output_format": {
    "aspect_ratio": "9:16",
    "resolution": "1080x1920"
  }
}
```

### Step 5: Execute Edits — FFmpeg on M2 (Local, $0)

```typescript
// Build FFmpeg command from edit plan
function buildFFmpegCommand(editPlan: EditPlan, inputPath: string, outputPath: string): string {
  const segments = editPlan.segments;
  const filterChain: string[] = [];
  
  // Trim segments
  segments.forEach((seg, i) => {
    filterChain.push(`[0:v]trim=${seg.start}:${seg.end},setpts=PTS-STARTPTS[v${i}]`);
    filterChain.push(`[0:a]atrim=${seg.start}:${seg.end},asetpts=PTS-STARTPTS[a${i}]`);
  });
  
  // Concat segments
  const videoInputs = segments.map((_, i) => `[v${i}]`).join('');
  const audioInputs = segments.map((_, i) => `[a${i}]`).join('');
  filterChain.push(`${videoInputs}concat=n=${segments.length}:v=1:a=0[vconcat]`);
  filterChain.push(`${audioInputs}concat=n=${segments.length}:v=0:a=1[aconcat]`);
  
  // Add captions
  let lastVideo = 'vconcat';
  editPlan.captions.forEach((cap, i) => {
    const next = `vcap${i}`;
    filterChain.push(
      `[${lastVideo}]drawtext=text='${cap.text}':fontsize=36:fontcolor=white:x=(w-tw)/2:y=h-100:enable='between(t,${cap.start},${cap.end})'[${next}]`
    );
    lastVideo = next;
  });
  
  // Audio normalization
  if (editPlan.audio_adjustments.normalize) {
    filterChain.push(`[aconcat]loudnorm=I=-16:LRA=11:TP=-1.5[afinal]`);
  }
  
  return `ffmpeg -i ${inputPath} -filter_complex "${filterChain.join(';')}" -map "[${lastVideo}]" -map "[afinal]" -c:v libx264 -preset medium -crf 23 -c:a aac -b:a 128k ${outputPath}`;
}
```

**M2 Performance**: Rendering a 30-second 1080p final video takes ~15-30 seconds.

### Step 6: Photo Enhancement (Local, $0)

```typescript
import sharp from 'sharp';

async function enhancePhoto(inputPath: string, outputPath: string) {
  await sharp(inputPath)
    .resize(2048, 2048, { fit: 'inside', withoutEnlargement: false })  // Upscale
    .sharpen({ sigma: 1.5 })                                           // Sharpen
    .normalise()                                                        // Auto color correction
    .modulate({ brightness: 1.05, saturation: 1.15 })                 // Vibrance boost
    .jpeg({ quality: 95 })                                              // High quality output
    .toFile(outputPath);
}

// For AI-powered enhancement description:
// Send photo to Groq Vision → get suggestions → apply with Sharp
```

---

## 6. Project Structure

```
video-edit/
├── src/
│   ├── app/                          # Next.js App Router
│   │   ├── page.tsx                  # Landing / Dashboard
│   │   ├── layout.tsx                # Root layout
│   │   ├── upload/
│   │   │   └── page.tsx              # Upload page
│   │   ├── projects/
│   │   │   ├── page.tsx              # All projects list
│   │   │   └── [id]/
│   │   │       └── page.tsx          # Single project view (preview, download)
│   │   ├── profile/
│   │   │   └── page.tsx              # Business profile setup
│   │   ├── photos/
│   │   │   └── page.tsx              # Photo enhancement tool
│   │   └── api/
│   │       ├── upload/
│   │       │   └── route.ts          # Handle video upload
│   │       ├── process/
│   │       │   └── route.ts          # Start AI processing pipeline
│   │       ├── projects/
│   │       │   └── route.ts          # CRUD projects
│   │       ├── profile/
│   │       │   └── route.ts          # Business profile CRUD
│   │       ├── photos/
│   │       │   └── route.ts          # Photo enhancement
│   │       ├── status/
│   │       │   └── [id]/
│   │       │       └── route.ts      # Check processing status
│   │       └── download/
│   │           └── [id]/
│   │               └── route.ts      # Serve final video
│   ├── lib/
│   │   ├── ai/
│   │   │   ├── groq-client.ts        # Groq API client (OpenAI-compatible)
│   │   │   ├── transcribe.ts         # Whisper transcription
│   │   │   ├── analyze-frames.ts     # Vision frame analysis
│   │   │   ├── generate-edit-plan.ts # LLM edit plan generation
│   │   │   └── enhance-photo.ts      # Photo enhancement logic
│   │   ├── video/
│   │   │   ├── ffmpeg.ts             # FFmpeg wrapper (extract, render)
│   │   │   ├── editor.ts             # Edit plan → FFmpeg command builder
│   │   │   └── metadata.ts           # Video metadata extraction
│   │   ├── db/
│   │   │   ├── schema.ts             # SQLite schema (Drizzle)
│   │   │   ├── index.ts              # Database connection
│   │   │   └── migrations/           # DB migrations
│   │   ├── queue/
│   │   │   └── processor.ts          # Job queue (in-memory for local)
│   │   └── utils/
│   │       ├── file-helpers.ts        # File path helpers
│   │       └── format-helpers.ts      # Time/format utilities
│   └── components/
│       ├── ui/                       # shadcn/ui components
│       ├── upload-dropzone.tsx       # Drag & drop upload
│       ├── video-player.tsx          # Video preview
│       ├── project-card.tsx          # Project list item
│       ├── processing-status.tsx     # Real-time status indicator
│       ├── business-profile-form.tsx # Business context form
│       └── photo-enhancer.tsx        # Photo upload & enhance UI
├── uploads/                          # Raw uploaded videos (gitignored)
├── tmp/                              # Processing temp files (gitignored)
├── output/                           # Final rendered videos (gitignored)
├── data/                             # SQLite database file (gitignored)
├── public/                           # Static assets
├── .env.local                        # GROQ_API_KEY goes here
├── package.json
├── tsconfig.json
├── tailwind.config.ts
├── drizzle.config.ts
└── next.config.ts
```

---

## 7. Database Schema (SQLite — Zero Config)

```sql
-- Business Profile
CREATE TABLE business_profiles (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  business_name TEXT NOT NULL,
  industry TEXT,                    -- "bakery", "gym", "salon", etc.
  brand_description TEXT,           -- "We are a family-owned bakery..."
  target_audience TEXT,             -- "Young professionals, health-conscious"
  brand_tone TEXT,                  -- "warm", "professional", "fun"
  preferred_platforms TEXT,         -- JSON array: ["instagram_reels", "youtube_shorts"]
  logo_path TEXT,                   -- Path to uploaded logo
  brand_colors TEXT,                -- JSON: {"primary": "#FF6B35", "secondary": "#004E89"}
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Video Projects
CREATE TABLE projects (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  profile_id TEXT REFERENCES business_profiles(id),
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'uploaded',  -- uploaded | processing | analyzing | editing | rendering | completed | failed
  original_path TEXT NOT NULL,              -- Path to uploaded video
  output_path TEXT,                          -- Path to final rendered video
  target_platform TEXT,                      -- "instagram_reels" | "youtube_shorts" | "youtube" | "tiktok"
  target_duration INTEGER,                   -- Target duration in seconds
  
  -- AI Analysis Results (stored as JSON)
  transcript TEXT,                  -- Full Whisper transcript JSON
  frame_analysis TEXT,              -- Frame-by-frame analysis JSON
  edit_plan TEXT,                   -- Generated edit plan JSON
  
  -- Metadata
  duration REAL,                    -- Original video duration
  resolution TEXT,                  -- "1920x1080"
  file_size INTEGER,                -- In bytes
  
  -- Processing info
  processing_started_at DATETIME,
  processing_completed_at DATETIME,
  error_message TEXT,
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Photo Enhancement Jobs
CREATE TABLE photo_jobs (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  profile_id TEXT REFERENCES business_profiles(id),
  original_path TEXT NOT NULL,
  enhanced_path TEXT,
  enhancement_type TEXT,            -- "auto" | "upscale" | "color_correct" | "background_remove"
  ai_suggestions TEXT,              -- JSON from Groq Vision analysis
  status TEXT DEFAULT 'pending',    -- pending | processing | completed | failed
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

---

## 8. Prerequisites to Run Locally on M2

### One-Time Setup (5 minutes)

```bash
# 1. Install FFmpeg (if not already installed)
brew install ffmpeg

# 2. Verify FFmpeg works
ffmpeg -version
ffprobe -version

# 3. Get free Groq API key
# Go to https://console.groq.com → Sign up (free, no credit card) → Create API Key

# 4. Node.js (you likely have this)
node --version  # Need 18+
```

### Project Setup

```bash
cd video-edit

# Install dependencies
npm install

# Set up environment
cp .env.example .env.local
# Edit .env.local and add your GROQ_API_KEY

# Start dev server
npm run dev
# → Opens at http://localhost:3000
```

### .env.local

```env
# Only ONE key needed — free from console.groq.com
GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxxxxxx

# Local paths (auto-created)
UPLOAD_DIR=./uploads
OUTPUT_DIR=./output
TEMP_DIR=./tmp
DATA_DIR=./data

# Optional: when ready to scale
# OPENAI_API_KEY=sk-xxx          # Uncomment to switch to OpenAI
# DATABASE_URL=postgresql://...   # Uncomment to switch to Postgres
# S3_BUCKET=...                   # Uncomment to switch to S3
```

---

## 9. Rate Limit Strategy (Working Within Free Tier)

### Smart Frame Sampling

Instead of analyzing every frame (wastes API calls), we use intelligent sampling:

```typescript
// Strategy: Extract frames smartly based on scene changes
async function extractSmartFrames(videoPath: string): Promise<string[]> {
  // 1. Use FFmpeg scene detection to find actual scene changes
  // This runs locally — no API calls
  const scenes = await detectSceneChanges(videoPath); // FFmpeg select filter
  
  // 2. Also sample at regular intervals (every 5 seconds)
  const regularFrames = await extractRegularFrames(videoPath, 5);
  
  // 3. Merge and deduplicate — typically gives 20-40 frames for a 5-min video
  // Instead of 100 frames at every 3 seconds
  return mergeFrames(scenes, regularFrames);
}

// This reduces Groq Vision calls from ~100 to ~20-40 per video
// Meaning: 25-50 videos/day instead of 10 on the free tier
```

### Request Batching

```typescript
// Batch multiple frame descriptions into one request where possible
// Llama 4 Scout supports up to 5 images per request!
async function analyzeFrameBatch(frames: string[]): Promise<FrameAnalysis[]> {
  const batches = chunk(frames, 5);  // Groups of 5
  
  for (const batch of batches) {
    const content = [
      { type: 'text', text: 'Analyze these video frames. For each, describe objects, actions, emotions, and rate quality 1-10. Return JSON array.' },
      ...batch.map(f => ({
        type: 'image_url',
        image_url: { url: `data:image/jpeg;base64,${f}` }
      }))
    ];
    // One API call for 5 frames instead of 5 calls!
  }
}
```

### Rate Limit Throttling

```typescript
// Built-in rate limiter to stay within free tier
const rateLimiter = {
  whisper: new RateLimiter({ maxRequests: 18, perMinute: true }),  // 20 RPM limit, use 18 for safety
  vision: new RateLimiter({ maxRequests: 25, perMinute: true }),   // 30 RPM limit
  llm: new RateLimiter({ maxRequests: 25, perMinute: true }),      // 30 RPM limit
};
```

---

## 10. Scaling Path — From Local to Production

When you've validated the concept and are ready to scale:

### Phase 1: Local Testing (You are here) — $0/month
- Everything local + Groq free tier
- Test with your own videos
- Validate AI editing quality

### Phase 2: Soft Launch — $20-50/month
- Keep using Groq (upgrade to Developer plan: $0, just higher limits)
- Move database to Supabase free tier
- Move file storage to Cloudflare R2 (10GB free)
- Deploy frontend to Vercel (free tier)
- Run FFmpeg on a $5/month VPS (Hetzner)

### Phase 3: Growth — $100-300/month
- Switch LLM to OpenAI GPT-4.1 (better quality) — **1 line code change**
- Add TwelveLabs for richer video understanding — **1 module swap**
- Move to larger server for FFmpeg processing
- Add Redis for proper job queuing

### Code Change to Switch from Groq → OpenAI

```typescript
// groq-client.ts — ONE FILE controls everything

// TODAY (Groq free):
const client = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: 'https://api.groq.com/openai/v1',
});
const LLM_MODEL = 'llama-3.3-70b-versatile';
const VISION_MODEL = 'meta-llama/llama-4-scout-17b-16e-instruct';
const WHISPER_MODEL = 'whisper-large-v3-turbo';

// FUTURE (OpenAI paid):
// const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
// const LLM_MODEL = 'gpt-4.1';
// const VISION_MODEL = 'gpt-4.1';
// const WHISPER_MODEL = 'whisper-1';
```

**That's it.** Same code works with both providers because Groq uses OpenAI-compatible API format.

---

## 11. M2 Mac Performance Expectations

| Task | Duration (5-min 1080p video) | Resource Used |
|---|---|---|
| Upload file to local disk | ~instant | Disk |
| FFmpeg: Extract audio | 2-3 seconds | CPU |
| FFmpeg: Extract 40 frames | 3-5 seconds | CPU |
| Groq: Whisper transcription | 3-8 seconds | API (network) |
| Groq: Analyze 40 frames (8 batches of 5) | 15-25 seconds | API (network) |
| Groq: Generate edit plan | 3-5 seconds | API (network) |
| FFmpeg: Render final 30-sec video | 15-30 seconds | CPU |
| **Total** | **~45-75 seconds** | |

Your M2 Mac is more than capable. The bottleneck is network (API calls), not compute.

---

## 12. What's NOT Possible Locally (and alternatives)

| Feature | Why Not Local | Alternative for Testing |
|---|---|---|
| **GPU video upscaling** (Real-ESRGAN) | Needs CUDA GPU | Use FFmpeg's `scale` + `unsharp` filters (decent quality) |
| **Background music generation** | Needs specialized AI | Use royalty-free music files (include a small library) |
| **Direct social media publishing** | Needs platform API keys + OAuth | Export as file, user uploads manually |
| **Multi-user auth** | Overkill for testing | Skip auth entirely for local testing |
| **Video stabilization (AI-level)** | Needs GPU | Use FFmpeg `vidstab` plugin (CPU-based, good enough) |

---

## 13. Summary

| Question | Answer |
|---|---|
| **Can I build this on my M2?** | Yes, fully |
| **Do I need to pay anything?** | No. Groq free tier + local FFmpeg = $0 |
| **How many videos can I test/day?** | 10-50 videos/day on Groq free tier |
| **How fast is processing?** | ~45-75 seconds for a 5-minute video |
| **Can I switch to paid APIs later?** | Yes, 1-line code change (Groq → OpenAI) |
| **What do I need installed?** | Node.js 18+, FFmpeg, Groq API key (free) |
| **What's the only external dependency?** | Groq API (free, no credit card, OpenAI-compatible) |

---

## Next Step

Ready to build? The plan is:

1. Scaffold the Next.js project with all the file structure above
2. Set up Groq client + FFmpeg wrapper
3. Build the upload → process → download pipeline
4. Create the UI (dashboard, upload, preview)
5. Test with real videos on your M2

Say the word and I'll start building.
