# Video Edit Platform — Architectural Improvement Plan

> **Author:** Software Architect  
> **Date:** April 22, 2026  
> **Version:** 1.0  
> **Target Market:** Schools, educational institutions, event videography  
> **Stack:** Next.js 16 (App Router) · Groq AI · FFmpeg · Supabase · SQLite · Canvas Renderer

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Current Architecture Assessment](#2-current-architecture-assessment)
3. [Target Architecture Vision](#3-target-architecture-vision)
4. [Phase 1 — Intro/Outro Slide Engine](#phase-1--introoutro-slide-engine-week-1)
5. [Phase 2 — Effects & Transitions Engine](#phase-2--effects--transitions-engine-week-2)
6. [Phase 3 — AI-Powered Music Suggestion](#phase-3--ai-powered-music-suggestion-week-3)
7. [Phase 4 — Audio Control System](#phase-4--audio-control-system-week-4)
8. [Phase 5 — Photo Integration & Slideshow](#phase-5--photo-integration--slideshow-week-5)
9. [Phase 6 — Export & Download Pipeline](#phase-6--export--download-pipeline-week-6)
10. [Phase 7 — School-Specific Features](#phase-7--school-specific-features-week-7-8)
11. [Database Schema Changes](#database-schema-changes)
12. [API Design](#api-design)
13. [Security & Legal Compliance](#security--legal-compliance)
14. [Performance Optimization](#performance-optimization)
15. [Deployment Strategy](#deployment-strategy)
16. [Risk Matrix](#risk-matrix)

---

## 1. Executive Summary

This plan transforms the current video editing MVP into a **school/event-focused video production platform**. Key capabilities to add:

| Capability | Status | Priority |
|---|---|---|
| Intro/outro slide generation (school themes) | Partial — 4 styles exist | P0 |
| In-between transition effects | Partial — 3 types exist | P0 |
| AI song suggestion (Hindi + contextual) | Planned — mood field exists | P0 |
| Background music upload & mixing | Partial — 6 tracks + upload | P1 |
| Video voice suppression/replacement | Not started | P1 |
| Photo slideshow interleaving | Not started | P1 |
| Contrast/brightness/saturation controls | Done — canvas-based | P2 |
| School-specific templates & branding | Partial — "school" style exists | P1 |
| Batch event video processing | Not started | P2 |
| Export with all effects baked in | Partial — FFmpeg WASM | P0 |

### What Already Works

- Full pipeline: upload → transcribe → analyze → edit plan → render
- Canvas-based preview with 45+ animations, color presets, transitions
- Intro/outro slides with 4 styles (gradient, minimal, bold, school)
- 6 royalty-free tracks + custom audio upload
- Brightness/contrast/saturation sliders
- AI chat editor for modifying edit plans
- Vercel + local dual-mode deployment

### What Needs Improvement

- Music suggestions are static (not AI-driven per video)
- No Hindi song context awareness
- No voice suppression / audio ducking
- No photo-to-video slideshow integration
- Export doesn't bake in effects/music/slides
- School templates limited to single "school" style
- No batch processing for event albums

---

## 2. Current Architecture Assessment

### 2.1 System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     FRONTEND (Next.js App Router)           │
│  ┌──────────┐  ┌──────────┐  ┌───────────┐  ┌───────────┐  │
│  │ Dashboard │  │  Upload  │  │  Project   │  │  Profile  │  │
│  │  page.tsx │  │ page.tsx │  │ [id]/page  │  │  page.tsx │  │
│  └──────────┘  └──────────┘  └─────┬──────┘  └───────────┘  │
│                                     │                        │
│  ┌──────────────────────────────────┴────────────────────┐   │
│  │         EditedVideoPlayer.tsx (Canvas Engine)         │   │
│  │  • Timeline mapping  • Animation transforms           │   │
│  │  • Slide rendering   • Caption drawing                │   │
│  │  • Color grading     • FFmpeg WASM export             │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │         AIChatEditor.tsx (Plan Modifier)              │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                              │
                    ┌─────────┴──────────┐
                    │    API LAYER        │
                    │  /api/upload        │
                    │  /api/process       │
                    │  /api/projects      │
                    │  /api/ai-chat       │
                    │  /api/video/[id]    │
                    │  /api/download/[id] │
                    │  /api/photos        │
                    │  /api/profile       │
                    │  /api/status/[id]   │
                    └─────────┬──────────┘
                              │
          ┌───────────────────┼───────────────────┐
          │                   │                   │
  ┌───────┴──────┐   ┌───────┴──────┐   ┌───────┴──────┐
  │   AI LAYER   │   │   STORAGE    │   │   MEDIA      │
  │  Groq LLM    │   │  SQLite      │   │  FFmpeg      │
  │  Whisper     │   │  Supabase    │   │  Sharp       │
  │  Vision      │   │  Local FS    │   │  Canvas      │
  │  Ollama      │   │              │   │  WASM        │
  └──────────────┘   └──────────────┘   └──────────────┘
```

### 2.2 Strengths

| Area | Detail |
|---|---|
| **Dual-mode data layer** | SQLite local / Supabase cloud — clean abstraction |
| **AI pipeline** | Groq-powered transcription + vision + planning with fallbacks |
| **Canvas renderer** | 45+ animations, real-time preview, color grading |
| **Resilience** | Every AI step has fallback (empty transcript, heuristic analysis, rule-based plan) |
| **Type safety** | Consistent TypeScript interfaces across edit plan lifecycle |

### 2.3 Weaknesses & Gaps

| Area | Issue | Impact |
|---|---|---|
| **Music intelligence** | `music_suggestion` field exists but only returns static text | Users get generic suggestions |
| **Audio processing** | No voice suppression, no audio ducking, no mixing | Cannot create professional output |
| **Export fidelity** | FFmpeg WASM export doesn't apply intro slides, effects, or background music | Downloaded video ≠ preview |
| **Photo integration** | Photo upload exists but isolated from video pipeline | Can't create slideshows |
| **School templates** | Only 1 "school" style for intro slides | Limited for diverse schools |
| **Batch operations** | No multi-video or album processing | Event videography is multi-clip |
| **State management** | Heavy component state in EditedVideoPlayer (~40 useState) | Hard to extend |
| **Error UX** | Silent failures in many paths | Users don't know what went wrong |

### 2.4 Technical Debt

1. **`EditedVideoPlayer.tsx`** — 850+ lines, monolithic component with render logic, playback, export, and UI
2. **`processor.ts`** — Vercel pipeline skips rendering entirely; no audio mixing
3. **`generate-edit-plan.ts`** — Prompt doesn't include music library awareness
4. **No testing** — Zero unit/integration tests
5. **`ffmpeg.ts`** — `eval()` on line 31 for FPS parsing (security risk)
6. **`globals.css`** — 200+ lines of manual dark theme vars that could use CSS layers

---

## 3. Target Architecture Vision

### 3.1 Target System Diagram

```
┌──────────────────────────────────────────────────────────────────────┐
│                        FRONTEND (Next.js App Router)                │
│  ┌────────┐  ┌────────┐  ┌──────────┐  ┌────────┐  ┌───────────┐   │
│  │Dashboard│  │ Upload │  │ Project  │  │Profile │  │  Album    │   │
│  │        │  │+ Photos│  │  Detail  │  │+ School│  │  Manager  │   │
│  └────────┘  └────────┘  └────┬─────┘  └────────┘  └───────────┘   │
│                               │                                     │
│  ┌────────────────────────────┴──────────────────────────────────┐   │
│  │              COMPOSITION ENGINE (Refactored)                  │   │
│  │  ┌────────────┐ ┌──────────┐ ┌──────────┐ ┌───────────────┐  │   │
│  │  │ TimelineCtx│ │EffectsCtx│ │ AudioCtx │ │ ExportEngine  │  │   │
│  │  │ • segments │ │ • color  │ │ • voice  │ │ • WASM FFmpeg │  │   │
│  │  │ • slides   │ │ • presets│ │ • music  │ │ • bake slides │  │   │
│  │  │ • photos   │ │ • anim   │ │ • ducking│ │ • mix audio   │  │   │
│  │  └────────────┘ └──────────┘ └──────────┘ └───────────────┘  │   │
│  └───────────────────────────────────────────────────────────────┘   │
│  ┌────────────────────────────────────────────────────────────┐      │
│  │               AI Chat + Music Advisor                     │      │
│  └────────────────────────────────────────────────────────────┘      │
└──────────────────────────────────────────────────────────────────────┘
                               │
                     ┌─────────┴──────────┐
                     │    API LAYER        │
                     │  + /api/music-suggest│  ← NEW
                     │  + /api/album        │  ← NEW
                     │  + /api/templates    │  ← NEW
                     │  + /api/audio-mix    │  ← NEW
                     └─────────┬──────────┘
                               │
           ┌───────────────────┼───────────────────┐
           │                   │                   │
   ┌───────┴──────┐   ┌───────┴──────┐   ┌───────┴──────────┐
   │   AI LAYER   │   │   STORAGE    │   │   MEDIA LAYER    │
   │  Groq LLM    │   │  SQLite      │   │  FFmpeg CLI      │
   │  Whisper     │   │  Supabase    │   │  FFmpeg WASM     │
   │  Vision      │   │  Local FS    │   │  Sharp           │
   │  + Music AI  │   │  + templates │   │  + Web Audio API │
   │  + Hindi ctx │   │  + albums    │   │  + Audio mixing  │
   └──────────────┘   └──────────────┘   └──────────────────┘
```

---

## Phase 1 — Intro/Outro Slide Engine (Week 1)

### Current State
- 4 slide styles exist: `gradient`, `minimal`, `bold`, `school`
- Rendered on canvas in `drawSlide()` function
- AI generates `intro_slide` and `outro_slide` in edit plan

### Improvements

#### 1.1 New School-Themed Slide Templates

Add 6 new education-specific slide styles:

| Style Key | Description | Use Case |
|---|---|---|
| `school_chalkboard` | Green chalkboard with chalk text, duster marks | Traditional schools |
| `school_modern` | Clean white/blue with geometric shapes | Modern schools |
| `school_festive` | Colorful bunting, confetti, celebration | Annual days, functions |
| `school_sports` | Dynamic angles, energetic colors | Sports day |
| `school_graduation` | Cap, gown, gold accents | Graduation ceremony |
| `school_cultural` | Rangoli patterns, traditional motifs | Cultural programs |

#### 1.2 Implementation Plan

**File: `src/lib/slides.ts`** (NEW)
```
Purpose: Extracted slide rendering engine
- drawSlide() moved from EditedVideoPlayer
- Each style as a separate render function
- Template registry pattern for extensibility
- Support for logo upload (school emblem)
- Animated text with typewriter/fade effects
- Date/event name dynamic substitution
```

**File: `src/lib/ai/generate-edit-plan.ts`** (MODIFY)
```
- Update LLM prompt to include school-specific style options
- Add event_type field to IntroSlide interface
- Add logo_url field for school branding
- Style auto-selection based on industry="education" + transcript content
```

**Schema: IntroSlide (EXTENDED)**
```typescript
interface IntroSlide {
  title: string;
  subtitle: string;
  duration: number;
  style: "gradient" | "minimal" | "bold" | "school" | 
         "school_chalkboard" | "school_modern" | "school_festive" | 
         "school_sports" | "school_graduation" | "school_cultural";
  color: string;
  // NEW fields:
  event_name?: string;      // "Annual Day 2026"
  event_date?: string;      // "April 22, 2026"
  logo_url?: string;        // School emblem
  school_name?: string;     // Override title with school name
  tagline?: string;         // "Nurturing Future Leaders"
  animation?: "typewriter" | "fade_up" | "scale_in" | "slide_left";
}
```

#### 1.3 Slide Editor UI

Add to project detail page:
- Template picker with live preview thumbnails
- Text editing for title/subtitle/tagline
- Color picker for primary/secondary
- Logo upload (stored as base64 or uploaded to storage)
- Duration slider (2-8 seconds)
- Preview button to re-render slide on canvas

---

## Phase 2 — Effects & Transitions Engine (Week 2)

### Current State
- 45+ canvas animations (pan, zoom, ken burns, etc.)
- 3 transition types: `crossfade`, `fade_black`, `cut`
- Color presets: natural, warm, cool, vintage, dramatic, cinematic, bw, vivid
- Brightness/contrast/saturation sliders

### Improvements

#### 2.1 New Transition Types

| Transition | Description |
|---|---|
| `wipe_left` | Horizontal wipe from right to left |
| `wipe_right` | Horizontal wipe from left to right |
| `wipe_up` | Vertical wipe upward |
| `wipe_down` | Vertical wipe downward |
| `zoom_blur` | Zoom into blur, then resolve |
| `spin` | Rotational transition |
| `flash` | Already exists in drawTransition — expose to UI |
| `dissolve` | Pixel dissolve effect |
| `slide_push` | Push current frame off screen |
| `circle_reveal` | Circular reveal from center |
| `heart_wipe` | Heart-shaped reveal (for school celebrations) |

#### 2.2 Per-Segment Effect Overrides

Currently effects are global. Allow per-segment:

```typescript
interface EditSegment {
  start: number;
  end: number;
  reason: string;
  animation?: string;
  // NEW:
  effects?: {
    brightness?: number;
    contrast?: number;
    saturation?: number;
    color_grade?: string;
    speed?: number;        // 0.5x to 2.0x
    vignette?: boolean;
    blur?: number;         // 0-10
  };
  transition_in?: {
    type: string;
    duration: number;
  };
}
```

#### 2.3 Speed Ramping

For dramatic moments (detected by AI):
- Slow motion on key moments (speech climax, celebration)
- Speed up for monotonous sections
- AI identifies moments via transcript + emotion analysis

#### 2.4 New Color Presets for Schools

| Preset | Description |
|---|---|
| `school_warm` | Warm nostalgic tones |
| `school_vibrant` | High saturation, vivid colors |
| `school_classic` | Slight sepia, soft contrast |
| `golden_hour` | Warm golden tones for outdoor events |
| `stage_lights` | High contrast for stage performances |
| `documentary` | Slightly desaturated, professional |

#### 2.5 Implementation

**File: `src/lib/transitions.ts`** (NEW)
```
- Extract transition rendering from EditedVideoPlayer
- Each transition as a pluggable function
- Registry pattern matching animations.ts architecture
- Canvas-based transition rendering between frames
```

**File: `src/lib/animations.ts`** (MODIFY)
```
- Add speed ramp support to AnimTransform
- Add vignette and blur to buildFilter
- Add school-specific color presets
```

---

## Phase 3 — AI-Powered Music Suggestion (Week 3)

### Current State
- `MusicSuggestion` interface has mood/genre/tempo/description/keywords
- 6 hardcoded royalty-free Pixabay tracks
- AI generates a static suggestion in edit plan
- No Hindi song awareness

### Improvements

#### 3.1 AI Music Advisor API

**New endpoint: `POST /api/music-suggest`**

```typescript
// Request
{
  projectId: string;
  language: "hindi" | "english" | "regional";
  mood_override?: string;
  genre_override?: string;
}

// Response
{
  suggestions: MusicSuggestionResult[];
  reasoning: string;
}

interface MusicSuggestionResult {
  title: string;
  artist: string;
  language: string;
  mood: string;
  genre: string;
  tempo: string;
  why: string;              // AI explanation of why this fits
  search_query: string;     // YouTube/Spotify search query
  royalty_free_alt?: {       // Royalty-free alternative
    track_id: string;
    name: string;
    url: string;
  };
}
```

#### 3.2 AI Prompt Strategy

The AI will analyze:
1. **Transcript content** — speech topic, emotional arcs, key phrases
2. **Frame analysis** — visual mood, setting (indoor/outdoor/stage)
3. **Business context** — school/industry, tone, audience
4. **Event type** — inferred from content (annual day, sports, farewell, etc.)

Prompt addition for Hindi context:
```
Based on the video content, suggest 5 Hindi songs that would work as background music.
Consider:
- The emotional arc of the video (celebration, farewell, achievement, fun)
- Whether instrumental versions would work better
- Popular school event songs (like "Yeh Dosti", "Lakdi Ki Kaathi" for fun, 
  "Kal Ho Na Ho" for emotional, "Chak De India" for sports)
- Bollywood songs that are commonly used in school events
- The energy level should match the video pace

For each suggestion, provide:
- Song name and artist
- Why it fits this video
- A YouTube search query to find it
- Mood classification
```

#### 3.3 Royalty-Free Track Library Expansion

Expand from 6 to 20+ tracks, categorized:

| Category | Tracks |
|---|---|
| **Celebration** | Festive, Party, Dance |
| **Emotional** | Piano, Strings, Acoustic |
| **Energetic** | Upbeat, Rock, Electronic |
| **Traditional Indian** | Sitar, Tabla, Flute instrumentals |
| **Children/Fun** | Playful, Quirky, Cartoon |
| **Graduation** | Orchestral, Triumphant |
| **Documentary** | Ambient, Minimal, Thoughtful |

Source: Pixabay, Free Music Archive, ccMixter (all CC-licensed)

#### 3.4 User Music Upload Flow

```
User uploads → validate format → store in uploads/music/ →
register in project → audio player preview → apply to timeline
```

Supported formats: MP3, WAV, AAC, OGG, FLAC

#### 3.5 Important: Legal Compliance for Music

**We will NOT auto-download copyrighted songs.** Instead:

1. AI suggests songs with search queries
2. User uploads their own licensed/purchased audio files  
3. We provide royalty-free alternatives for every suggestion
4. Clear disclaimer in UI about copyright responsibility
5. Metadata stripping on upload (no watermark detection)

---

## Phase 4 — Audio Control System (Week 4)

### Current State
- Original volume slider + mute button
- Background music volume slider
- No audio processing (ducking, suppression, mixing)

### Improvements

#### 4.1 Voice Suppression / Audio Ducking

**New: `src/lib/audio/processor.ts`**

```typescript
interface AudioSettings {
  // Voice control
  voice_mode: "original" | "suppress" | "enhance" | "remove";
  voice_volume: number;       // 0-1
  
  // Background music
  music_enabled: boolean;
  music_volume: number;       // 0-1
  music_fade_in: number;      // seconds
  music_fade_out: number;     // seconds
  
  // Auto-ducking (lower music during speech)
  auto_duck: boolean;
  duck_threshold: number;     // dB level to trigger ducking
  duck_ratio: number;         // how much to reduce music (0.1 = 10%)
  
  // Noise reduction
  noise_reduction: boolean;
  noise_reduction_level: number; // 0-1
}
```

#### 4.2 Audio Modes for School Videos

| Mode | Voice | Music | Use Case |
|---|---|---|---|
| **Original** | Full volume | Off | Raw video |
| **Music Only** | Suppressed | Full | Dance performances, montages |
| **Voice + BG Music** | Full | Low (auto-duck) | Speeches, announcements |
| **Cinematic** | Enhanced | Medium (ducking) | Event highlight reels |
| **Music Video** | Removed | Full | Photo slideshows |

#### 4.3 Implementation Approach

**Client-side (Preview):**
- Web Audio API for real-time preview
- `AudioContext` with `GainNode` for volume
- `BiquadFilterNode` for basic voice isolation
- Real-time auto-ducking via `AnalyserNode`

**Server-side (Export):**
- FFmpeg `amix` filter for audio mixing
- FFmpeg `volume` filter for per-track levels
- FFmpeg `afade` for fade in/out
- FFmpeg `anlmdn` for noise reduction
- FFmpeg `highpass`/`lowpass` for voice suppression approximation

#### 4.4 Audio Timeline Visualization

Add to UI:
- Waveform visualization for original audio
- Music track waveform overlay
- Draggable music start point
- Visual ducking indicator

---

## Phase 5 — Photo Integration & Slideshow (Week 5)

### Current State
- Photo upload exists at `/photos` page
- Sharp-based enhancement (auto, upscale, color correct, sharpen)
- No connection to video pipeline

### Improvements

#### 5.1 Photo-in-Video Integration

Allow users to:
1. Upload photos alongside video
2. Insert photos as slideshow segments between video clips
3. Apply Ken Burns / pan animations to photos
4. Add captions to photo segments
5. Create pure photo slideshows with music

#### 5.2 Timeline Model Extension

```typescript
interface TimelineItem {
  type: "video_segment" | "photo" | "title_card";
  start: number;           // timeline position
  duration: number;
  // Video segment
  video_start?: number;
  video_end?: number;
  // Photo
  photo_url?: string;
  photo_animation?: string; // ken_burns, zoom_in, etc.
  photo_fit?: "cover" | "contain" | "fill";
  // Title card
  slide?: IntroSlide;
  // Shared
  animation?: string;
  transition_in?: string;
  caption?: string;
}
```

#### 5.3 Photo Upload Integration in Project Page

Add to project detail:
- "Add Photos" button
- Drag-and-drop reorder in timeline
- Photo duration control (3-10 seconds each)
- Photo enhancement toggle (auto-enhance using Sharp)
- Bulk upload (multiple photos at once)

#### 5.4 AI Photo Arrangement

AI can analyze photos and suggest:
- Optimal order based on visual flow
- Which photos to include/exclude (quality filter)
- Where in the video timeline to insert them
- What animations suit each photo

---

## Phase 6 — Export & Download Pipeline (Week 6)

### Current State
- FFmpeg WASM export in browser (segments only — no slides, effects, music)
- Server-side FFmpeg rendering (local only, no music mixing)
- Vercel: no rendering at all (plan only)

### Problems
The export is the **most critical gap**: what users see in preview ≠ what they download.

### Improvements

#### 6.1 Full-Fidelity Browser Export

Rewrite the `handleExport()` function to:

```
1. Render intro slide as video frames (canvas → frame sequence)
2. Concatenate video segments with trim
3. Render outro slide as frames
4. Apply color grading filter
5. Mix original audio + background music
6. Apply audio ducking
7. Concatenate all parts
8. Export as MP4
```

#### 6.2 Server-Side Full Render (Local)

Enhance `renderEditedVideo()` in `ffmpeg.ts`:

```
1. Generate intro/outro as overlay images with FFmpeg drawtext
2. Apply per-segment color filters
3. Mix audio tracks with volume curves
4. Apply fade in/out on music
5. Add watermark option (school logo)
6. Encode at target resolution/aspect ratio
```

#### 6.3 Export Quality Options

| Quality | Resolution | Bitrate | File Size (1 min) |
|---|---|---|---|
| **Draft** | 720p | 2 Mbps | ~15 MB |
| **Standard** | 1080p | 5 Mbps | ~38 MB |
| **High** | 1080p | 8 Mbps | ~60 MB |
| **4K** | 2160p | 15 Mbps | ~113 MB |

#### 6.4 Export Progress UX

```
┌──────────────────────────────────────────────┐
│  Exporting Your Video                        │
│                                              │
│  [████████████░░░░░░░░░░░░] 48%              │
│                                              │
│  ✓ Rendering intro slide...                  │
│  ✓ Processing segment 1/4...                 │
│  → Processing segment 2/4...                 │
│  ○ Processing segment 3/4...                 │
│  ○ Rendering outro slide...                  │
│  ○ Mixing audio tracks...                    │
│  ○ Final encoding...                         │
│                                              │
│  Estimated: ~2 minutes remaining             │
└──────────────────────────────────────────────┘
```

---

## Phase 7 — School-Specific Features (Week 7-8)

### 7.1 School Profile Enhancement

Extend business profile for education:

```typescript
interface SchoolProfile extends ProfileRow {
  school_name: string;
  school_motto: string;
  school_logo_url: string;
  school_colors: { primary: string; secondary: string; accent: string };
  school_type: "primary" | "secondary" | "higher_secondary" | "university";
  established_year: number;
  board: "CBSE" | "ICSE" | "State" | "IB" | "Other";
}
```

### 7.2 Event Templates

Pre-built templates for common school events:

| Event | Intro Style | Music Mood | Color Grade | Effects |
|---|---|---|---|---|
| **Annual Day** | `school_festive` | Celebratory | Vibrant | Confetti overlay |
| **Sports Day** | `school_sports` | Energetic | High contrast | Speed ramps |
| **Farewell** | `school_graduation` | Emotional | Warm | Slow fade transitions |
| **Republic Day** | Custom tricolor | Patriotic | Natural | Flag overlay |
| **Teacher's Day** | `school_modern` | Warm | Soft | Gentle transitions |
| **Science Fair** | `school_modern` | Curious | Cool | Zoom effects |
| **Cultural Program** | `school_cultural` | Traditional | Golden | Rangoli transitions |
| **Parent-Teacher Meet** | `school_modern` | Professional | Natural | Minimal effects |

### 7.3 Album / Batch Processing

For events with multiple videos:

```typescript
interface Album {
  id: string;
  name: string;          // "Annual Day 2026"
  school_profile_id: string;
  event_type: string;
  event_date: string;
  projects: string[];    // ordered project IDs
  shared_intro: IntroSlide;
  shared_outro: IntroSlide;
  shared_music: string;  // track ID
  shared_color_grade: string;
  status: "draft" | "processing" | "completed";
}
```

Features:
- Upload multiple videos at once
- Shared intro/outro across all clips
- Consistent color grading
- Combined download (zip or merged)
- Individual clip download

### 7.4 AI Event Detection

When a school uploads a video, AI should auto-detect:
- Event type from transcript/visuals (speech, dance, sports)
- Suggest appropriate template
- Identify speakers (for lower-third captions)
- Find highlight moments (applause, cheering, scoring)

---

## Database Schema Changes

### New Tables

```sql
-- Music tracks library
CREATE TABLE music_tracks (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  artist TEXT DEFAULT '',
  mood TEXT NOT NULL,
  genre TEXT NOT NULL,
  tempo TEXT NOT NULL,
  language TEXT DEFAULT 'instrumental',
  url TEXT NOT NULL,
  duration REAL,
  license TEXT DEFAULT 'CC0',
  category TEXT DEFAULT 'general',
  created_at TEXT DEFAULT (datetime('now'))
);

-- Albums for batch processing
CREATE TABLE albums (
  id TEXT PRIMARY KEY,
  profile_id TEXT REFERENCES business_profiles(id),
  name TEXT NOT NULL,
  event_type TEXT DEFAULT 'general',
  event_date TEXT,
  shared_config TEXT,         -- JSON: intro, outro, music, color grade
  status TEXT DEFAULT 'draft',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Album-project association
CREATE TABLE album_projects (
  album_id TEXT REFERENCES albums(id) ON DELETE CASCADE,
  project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
  sort_order INTEGER DEFAULT 0,
  PRIMARY KEY (album_id, project_id)
);

-- Project photos
CREATE TABLE project_photos (
  id TEXT PRIMARY KEY,
  project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  duration REAL DEFAULT 5,
  animation TEXT DEFAULT 'ken_burns',
  caption TEXT,
  enhanced BOOLEAN DEFAULT FALSE,
  created_at TEXT DEFAULT (datetime('now'))
);

-- AI music suggestions log
CREATE TABLE music_suggestions (
  id TEXT PRIMARY KEY,
  project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
  suggestions TEXT NOT NULL,   -- JSON array of MusicSuggestionResult
  reasoning TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
```

### Altered Tables

```sql
-- business_profiles additions
ALTER TABLE business_profiles ADD COLUMN school_name TEXT;
ALTER TABLE business_profiles ADD COLUMN school_motto TEXT;
ALTER TABLE business_profiles ADD COLUMN school_logo_url TEXT;
ALTER TABLE business_profiles ADD COLUMN school_colors TEXT;  -- JSON
ALTER TABLE business_profiles ADD COLUMN school_type TEXT;
ALTER TABLE business_profiles ADD COLUMN established_year INTEGER;

-- projects additions
ALTER TABLE projects ADD COLUMN album_id TEXT REFERENCES albums(id);
ALTER TABLE projects ADD COLUMN event_type TEXT;
ALTER TABLE projects ADD COLUMN audio_settings TEXT;           -- JSON AudioSettings
ALTER TABLE projects ADD COLUMN music_track_id TEXT;
ALTER TABLE projects ADD COLUMN custom_music_path TEXT;
```

---

## API Design

### New Endpoints

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/music-suggest` | AI music suggestion based on project content |
| `GET` | `/api/music-tracks` | List royalty-free music library |
| `POST` | `/api/music-tracks/upload` | Upload custom music track |
| `POST` | `/api/albums` | Create album |
| `GET` | `/api/albums` | List albums |
| `GET` | `/api/albums/[id]` | Get album with projects |
| `PUT` | `/api/albums/[id]` | Update album config |
| `POST` | `/api/albums/[id]/process` | Process all album projects |
| `POST` | `/api/projects/[id]/photos` | Add photos to project |
| `DELETE` | `/api/projects/[id]/photos/[photoId]` | Remove photo |
| `PUT` | `/api/projects/[id]/photos/reorder` | Reorder photos |
| `PUT` | `/api/projects/[id]/audio` | Update audio settings |
| `GET` | `/api/templates` | List event templates |
| `POST` | `/api/templates/apply` | Apply template to project |

### Modified Endpoints

| Method | Path | Change |
|---|---|---|
| `POST` | `/api/upload` | Accept photos alongside video |
| `POST` | `/api/process` | Support audio settings, music track |
| `PUT` | `/api/profile` | Accept school-specific fields |

---

## Security & Legal Compliance

### 13.1 Copyright Compliance

| Concern | Mitigation |
|---|---|
| Copyrighted music | AI suggests only; users must upload their own licensed files |
| Music metadata | Strip metadata on upload to prevent watermark false positives |
| Terms of Service | Add clear ToS about copyright responsibility |
| DMCA | Implement takedown request handling |

### 13.2 Security Fixes

| Issue | Location | Fix |
|---|---|---|
| `eval()` for FPS parsing | `ffmpeg.ts:31` | Replace with safe fraction parser |
| No input sanitization on FFmpeg commands | `ffmpeg.ts` | Validate all paths, escape shell args |
| File path traversal risk | `upload/route.ts` | Validate upload paths strictly |
| No rate limiting | All API routes | Add rate limiting middleware |
| No auth | All routes | Add authentication (Phase 9+) |

### 13.3 Data Privacy

- Student video content: add data retention policy
- COPPA compliance for school content with minors
- Option to process locally only (no cloud upload)
- Data deletion API for GDPR/compliance

---

## Performance Optimization

### 14.1 Frontend

| Optimization | Detail |
|---|---|
| **Split EditedVideoPlayer** | Extract into 5 focused components (~150 lines each) |
| **OffscreenCanvas** | Move rendering to Web Worker for 60fps |
| **Lazy load FFmpeg WASM** | Only load on export, not on page load |
| **Virtual timeline** | For 50+ segment projects, virtualize segment list |
| **Debounce effect sliders** | Reduce re-renders during drag |

### 14.2 Backend

| Optimization | Detail |
|---|---|
| **Queue system** | Replace `after()` with proper job queue (BullMQ or similar) |
| **Streaming transcription** | Stream Whisper results for real-time progress |
| **Frame extraction optimization** | Extract only I-frames, not every N seconds |
| **Parallel AI calls** | Run transcription + frame extraction in parallel |
| **Cache music library** | Cache track metadata, don't re-fetch |

### 14.3 Export

| Optimization | Detail |
|---|---|
| **Chunked export** | Process segments in chunks to avoid memory overflow |
| **SharedArrayBuffer** | Enable for FFmpeg WASM performance (requires COOP/COEP headers) |
| **WebCodecs API** | Use for encoding where available (Chrome 94+) |
| **Background export** | Export in Service Worker to keep UI responsive |

---

## Deployment Strategy

### 15.1 Local Development
```
npm run dev → full pipeline with FFmpeg CLI + SQLite + Ollama
```

### 15.2 Vercel Production
```
Vercel Functions → AI analysis + plan generation only
Client-side → canvas preview + WASM export
Supabase → storage + database
```

### 15.3 Self-Hosted Production (Recommended for Schools)
```
Docker → Next.js + FFmpeg + SQLite
All processing server-side
No cloud dependency
Lower cost for high-volume usage
```

### 15.4 Environment Variables (New)

```env
# Existing
GROQ_API_KEY=
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# New
MUSIC_STORAGE_DIR=./uploads/music
PHOTO_STORAGE_DIR=./uploads/photos
TEMPLATE_DIR=./data/templates
MAX_UPLOAD_SIZE_MB=500
ENABLE_AUDIO_PROCESSING=true
DEFAULT_LANGUAGE=hindi
SCHOOL_MODE=true
```

---

## Risk Matrix

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| FFmpeg WASM export fails on large videos | High | High | Chunked processing, fallback to server render |
| AI music suggestions are irrelevant | Medium | Medium | Human override, feedback loop, curated library |
| Browser memory overflow with photos + video | Medium | High | Lazy loading, thumbnail previews, streaming |
| Groq rate limits during batch processing | High | Medium | Queue with exponential backoff, local Ollama fallback |
| Copyright complaints from song suggestions | Low | High | Clear disclaimer, no auto-download, user responsibility |
| COPPA violations with student content | Low | Critical | Data retention policy, parental consent flow, local-only mode |
| Complex state management collapse | Medium | Medium | Extract to context providers, consider Zustand |
| Export quality ≠ preview quality | High | High | Progressive enhancement — match capabilities |

---

## Implementation Priority Matrix

```
         HIGH IMPACT
              │
    ┌─────────┼──────────┐
    │ P0      │ P0       │
    │ Export   │ Music    │
    │ Fidelity│ AI       │
    │         │ System   │
    │─────────┼──────────│
    │ P1      │ P2       │
    │ Audio   │ Album    │
    │ Controls│ Batch    │
    │ + Photos│ System   │
    └─────────┼──────────┘
              │
  LOW EFFORT ─┼─ HIGH EFFORT
              │
         LOW IMPACT
```

### Recommended Build Order

1. **Fix export pipeline** — users can't download what they see (P0, Week 1)
2. **Expand school slide templates** — quick wins for target market (P0, Week 1)
3. **AI music suggestion API** — core differentiator (P0, Week 2-3)
4. **Audio ducking & voice control** — essential for school event videos (P1, Week 3-4)
5. **Photo slideshow integration** — high-value for schools (P1, Week 4-5)
6. **New transitions & effects** — visual polish (P1, Week 5-6)
7. **School profile & templates** — market-specific features (P1, Week 6-7)
8. **Album batch processing** — power feature for repeat customers (P2, Week 7-8)
9. **Performance & refactoring** — maintainability (P2, ongoing)

---

## File Change Summary

| Action | File | Scope |
|---|---|---|
| **NEW** | `src/lib/slides.ts` | Extracted slide rendering engine |
| **NEW** | `src/lib/transitions.ts` | Extracted transition engine |
| **NEW** | `src/lib/audio/processor.ts` | Audio mixing & ducking |
| **NEW** | `src/lib/audio/web-audio.ts` | Client-side Web Audio API |
| **NEW** | `src/lib/templates.ts` | Event template definitions |
| **NEW** | `src/app/api/music-suggest/route.ts` | AI music suggestion endpoint |
| **NEW** | `src/app/api/music-tracks/route.ts` | Music library CRUD |
| **NEW** | `src/app/api/albums/route.ts` | Album management |
| **NEW** | `src/app/api/albums/[id]/route.ts` | Album detail |
| **NEW** | `src/app/api/projects/[id]/photos/route.ts` | Photo management |
| **NEW** | `src/app/api/projects/[id]/audio/route.ts` | Audio settings |
| **NEW** | `src/app/api/templates/route.ts` | Template listing |
| **NEW** | `src/app/albums/page.tsx` | Album management page |
| **NEW** | `src/components/SlideEditor.tsx` | Intro/outro slide editor |
| **NEW** | `src/components/AudioMixer.tsx` | Audio control panel |
| **NEW** | `src/components/PhotoTimeline.tsx` | Photo slideshow editor |
| **NEW** | `src/components/MusicAdvisor.tsx` | AI music suggestion UI |
| **NEW** | `src/components/ExportDialog.tsx` | Full-fidelity export UI |
| **MODIFY** | `src/components/EditedVideoPlayer.tsx` | Refactor into smaller parts |
| **MODIFY** | `src/lib/ai/generate-edit-plan.ts` | Enhanced prompts, school context |
| **MODIFY** | `src/lib/video/ffmpeg.ts` | Audio mixing, photo support, security fix |
| **MODIFY** | `src/lib/animations.ts` | New presets, speed ramp |
| **MODIFY** | `src/lib/db/index.ts` | New tables, schema migration |
| **MODIFY** | `src/lib/queue/processor.ts` | Photo + audio pipeline |
| **MODIFY** | `src/app/upload/page.tsx` | Photo upload, event type selection |
| **MODIFY** | `src/app/profile/page.tsx` | School-specific fields |
| **MODIFY** | `src/app/projects/[id]/page.tsx` | New panels integration |

---

*End of Plan — Total estimated new/modified files: 30+*
