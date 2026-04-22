// ── 45+ Canvas Video Animations ────────────────────────────────────────────
// Each animation returns a transform to apply before drawImage.
// progress: 0→1 within the segment.  w,h = canvas size.

export interface AnimTransform {
  sx: number;   // source x offset (crop)
  sy: number;   // source y offset (crop)
  sw: number;   // source width (crop)
  sh: number;   // source height (crop)
  dx: number;   // dest x on canvas
  dy: number;   // dest y on canvas
  dw: number;   // dest width on canvas
  dh: number;   // dest height on canvas
  rotation: number;   // radians
  opacity: number;    // 0-1
}

// Easing functions
function easeInOut(t: number): number { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }
function easeOut(t: number): number { return 1 - Math.pow(1 - t, 3); }
function easeIn(t: number): number { return t * t * t; }
function linear(t: number): number { return t; }
function bounce(t: number): number {
  if (t < 1 / 2.75) return 7.5625 * t * t;
  if (t < 2 / 2.75) return 7.5625 * (t -= 1.5 / 2.75) * t + 0.75;
  if (t < 2.5 / 2.75) return 7.5625 * (t -= 2.25 / 2.75) * t + 0.9375;
  return 7.5625 * (t -= 2.625 / 2.75) * t + 0.984375;
}
function elastic(t: number): number {
  if (t === 0 || t === 1) return t;
  return Math.pow(2, -10 * t) * Math.sin((t - 0.075) * (2 * Math.PI) / 0.3) + 1;
}

// Identity (no animation)
function identity(vw: number, vh: number, w: number, h: number): AnimTransform {
  const scale = Math.min(w / vw, h / vh);
  const dw = vw * scale, dh = vh * scale;
  return { sx: 0, sy: 0, sw: vw, sh: vh, dx: (w - dw) / 2, dy: (h - dh) / 2, dw, dh, rotation: 0, opacity: 1 };
}

// ── Animation Definitions ──────────────────────────────────────────────────

type AnimFn = (progress: number, vw: number, vh: number, w: number, h: number) => AnimTransform;

// 1. Zoom In (slow zoom toward center)
const zoomIn: AnimFn = (p, vw, vh, w, h) => {
  const z = 1 + easeInOut(p) * 0.25;
  const scale = Math.min(w / vw, h / vh) * z;
  const dw = vw * scale, dh = vh * scale;
  return { sx: 0, sy: 0, sw: vw, sh: vh, dx: (w - dw) / 2, dy: (h - dh) / 2, dw, dh, rotation: 0, opacity: 1 };
};

// 2. Zoom Out
const zoomOut: AnimFn = (p, vw, vh, w, h) => {
  const z = 1.25 - easeInOut(p) * 0.25;
  const scale = Math.min(w / vw, h / vh) * z;
  const dw = vw * scale, dh = vh * scale;
  return { sx: 0, sy: 0, sw: vw, sh: vh, dx: (w - dw) / 2, dy: (h - dh) / 2, dw, dh, rotation: 0, opacity: 1 };
};

// 3. Ken Burns (zoom in + pan right)
const kenBurns: AnimFn = (p, vw, vh, w, h) => {
  const z = 1 + easeInOut(p) * 0.2;
  const panX = easeInOut(p) * 0.1 * w;
  const scale = Math.min(w / vw, h / vh) * z;
  const dw = vw * scale, dh = vh * scale;
  return { sx: 0, sy: 0, sw: vw, sh: vh, dx: (w - dw) / 2 - panX, dy: (h - dh) / 2, dw, dh, rotation: 0, opacity: 1 };
};

// 4. Ken Burns Reverse (zoom out + pan left)
const kenBurnsReverse: AnimFn = (p, vw, vh, w, h) => {
  const z = 1.2 - easeInOut(p) * 0.2;
  const panX = easeInOut(p) * 0.1 * w;
  const scale = Math.min(w / vw, h / vh) * z;
  const dw = vw * scale, dh = vh * scale;
  return { sx: 0, sy: 0, sw: vw, sh: vh, dx: (w - dw) / 2 + panX, dy: (h - dh) / 2, dw, dh, rotation: 0, opacity: 1 };
};

// 5. Pan Left
const panLeft: AnimFn = (p, vw, vh, w, h) => {
  const z = 1.15;
  const scale = Math.min(w / vw, h / vh) * z;
  const dw = vw * scale, dh = vh * scale;
  const maxPan = dw - w;
  return { sx: 0, sy: 0, sw: vw, sh: vh, dx: -easeInOut(p) * maxPan, dy: (h - dh) / 2, dw, dh, rotation: 0, opacity: 1 };
};

// 6. Pan Right
const panRight: AnimFn = (p, vw, vh, w, h) => {
  const z = 1.15;
  const scale = Math.min(w / vw, h / vh) * z;
  const dw = vw * scale, dh = vh * scale;
  const maxPan = dw - w;
  return { sx: 0, sy: 0, sw: vw, sh: vh, dx: -(1 - easeInOut(p)) * maxPan, dy: (h - dh) / 2, dw, dh, rotation: 0, opacity: 1 };
};

// 7. Pan Up
const panUp: AnimFn = (p, vw, vh, w, h) => {
  const z = 1.15;
  const scale = Math.min(w / vw, h / vh) * z;
  const dw = vw * scale, dh = vh * scale;
  const maxPan = dh - h;
  return { sx: 0, sy: 0, sw: vw, sh: vh, dx: (w - dw) / 2, dy: -easeInOut(p) * maxPan, dw, dh, rotation: 0, opacity: 1 };
};

// 8. Pan Down
const panDown: AnimFn = (p, vw, vh, w, h) => {
  const z = 1.15;
  const scale = Math.min(w / vw, h / vh) * z;
  const dw = vw * scale, dh = vh * scale;
  const maxPan = dh - h;
  return { sx: 0, sy: 0, sw: vw, sh: vh, dx: (w - dw) / 2, dy: -(1 - easeInOut(p)) * maxPan, dw, dh, rotation: 0, opacity: 1 };
};

// 9. Slide In Left
const slideInLeft: AnimFn = (p, vw, vh, w, h) => {
  const t = identity(vw, vh, w, h);
  const offset = (1 - easeOut(Math.min(1, p * 3))) * w;
  return { ...t, dx: t.dx - offset, opacity: Math.min(1, p * 4) };
};

// 10. Slide In Right
const slideInRight: AnimFn = (p, vw, vh, w, h) => {
  const t = identity(vw, vh, w, h);
  const offset = (1 - easeOut(Math.min(1, p * 3))) * w;
  return { ...t, dx: t.dx + offset, opacity: Math.min(1, p * 4) };
};

// 11. Slide In Top
const slideInTop: AnimFn = (p, vw, vh, w, h) => {
  const t = identity(vw, vh, w, h);
  const offset = (1 - easeOut(Math.min(1, p * 3))) * h;
  return { ...t, dy: t.dy - offset, opacity: Math.min(1, p * 4) };
};

// 12. Slide In Bottom
const slideInBottom: AnimFn = (p, vw, vh, w, h) => {
  const t = identity(vw, vh, w, h);
  const offset = (1 - easeOut(Math.min(1, p * 3))) * h;
  return { ...t, dy: t.dy + offset, opacity: Math.min(1, p * 4) };
};

// 13. Rotate Clockwise (subtle)
const rotateCW: AnimFn = (p, vw, vh, w, h) => {
  const t = identity(vw, vh, w, h);
  return { ...t, rotation: easeInOut(p) * 0.03 };
};

// 14. Rotate Counter-Clockwise
const rotateCCW: AnimFn = (p, vw, vh, w, h) => {
  const t = identity(vw, vh, w, h);
  return { ...t, rotation: -easeInOut(p) * 0.03 };
};

// 15. Tilt (rotate back and forth)
const tilt: AnimFn = (p, vw, vh, w, h) => {
  const t = identity(vw, vh, w, h);
  return { ...t, rotation: Math.sin(p * Math.PI * 2) * 0.02 };
};

// 16. Zoom In + Rotate
const zoomInRotate: AnimFn = (p, vw, vh, w, h) => {
  const z = 1 + easeInOut(p) * 0.2;
  const scale = Math.min(w / vw, h / vh) * z;
  const dw = vw * scale, dh = vh * scale;
  return { sx: 0, sy: 0, sw: vw, sh: vh, dx: (w - dw) / 2, dy: (h - dh) / 2, dw, dh, rotation: easeInOut(p) * 0.02, opacity: 1 };
};

// 17. Zoom Out + Rotate
const zoomOutRotate: AnimFn = (p, vw, vh, w, h) => {
  const z = 1.2 - easeInOut(p) * 0.2;
  const scale = Math.min(w / vw, h / vh) * z;
  const dw = vw * scale, dh = vh * scale;
  return { sx: 0, sy: 0, sw: vw, sh: vh, dx: (w - dw) / 2, dy: (h - dh) / 2, dw, dh, rotation: -easeInOut(p) * 0.02, opacity: 1 };
};

// 18. Bounce Zoom
const bounceZoom: AnimFn = (p, vw, vh, w, h) => {
  const z = 1 + bounce(Math.min(1, p * 2)) * 0.15;
  const scale = Math.min(w / vw, h / vh) * z;
  const dw = vw * scale, dh = vh * scale;
  return { sx: 0, sy: 0, sw: vw, sh: vh, dx: (w - dw) / 2, dy: (h - dh) / 2, dw, dh, rotation: 0, opacity: 1 };
};

// 19. Elastic Scale
const elasticScale: AnimFn = (p, vw, vh, w, h) => {
  const z = p < 0.15 ? elastic(p / 0.15) * 0.1 + 1 : 1.1;
  const scale = Math.min(w / vw, h / vh) * z;
  const dw = vw * scale, dh = vh * scale;
  return { sx: 0, sy: 0, sw: vw, sh: vh, dx: (w - dw) / 2, dy: (h - dh) / 2, dw, dh, rotation: 0, opacity: 1 };
};

// 20. Pulse (breathe)
const pulse: AnimFn = (p, vw, vh, w, h) => {
  const z = 1 + Math.sin(p * Math.PI * 4) * 0.03;
  const scale = Math.min(w / vw, h / vh) * z;
  const dw = vw * scale, dh = vh * scale;
  return { sx: 0, sy: 0, sw: vw, sh: vh, dx: (w - dw) / 2, dy: (h - dh) / 2, dw, dh, rotation: 0, opacity: 1 };
};

// 21. Drift Left (constant pan)
const driftLeft: AnimFn = (p, vw, vh, w, h) => {
  const z = 1.1;
  const scale = Math.min(w / vw, h / vh) * z;
  const dw = vw * scale, dh = vh * scale;
  return { sx: 0, sy: 0, sw: vw, sh: vh, dx: (w - dw) / 2 - linear(p) * w * 0.08, dy: (h - dh) / 2, dw, dh, rotation: 0, opacity: 1 };
};

// 22. Drift Right
const driftRight: AnimFn = (p, vw, vh, w, h) => {
  const z = 1.1;
  const scale = Math.min(w / vw, h / vh) * z;
  const dw = vw * scale, dh = vh * scale;
  return { sx: 0, sy: 0, sw: vw, sh: vh, dx: (w - dw) / 2 + linear(p) * w * 0.08, dy: (h - dh) / 2, dw, dh, rotation: 0, opacity: 1 };
};

// 23. Drift Up
const driftUp: AnimFn = (p, vw, vh, w, h) => {
  const z = 1.1;
  const scale = Math.min(w / vw, h / vh) * z;
  const dw = vw * scale, dh = vh * scale;
  return { sx: 0, sy: 0, sw: vw, sh: vh, dx: (w - dw) / 2, dy: (h - dh) / 2 - linear(p) * h * 0.08, dw, dh, rotation: 0, opacity: 1 };
};

// 24. Drift Down
const driftDown: AnimFn = (p, vw, vh, w, h) => {
  const z = 1.1;
  const scale = Math.min(w / vw, h / vh) * z;
  const dw = vw * scale, dh = vh * scale;
  return { sx: 0, sy: 0, sw: vw, sh: vh, dx: (w - dw) / 2, dy: (h - dh) / 2 + linear(p) * h * 0.08, dw, dh, rotation: 0, opacity: 1 };
};

// 25. Diagonal Pan (top-left to bottom-right)
const diagonalTLBR: AnimFn = (p, vw, vh, w, h) => {
  const z = 1.2;
  const scale = Math.min(w / vw, h / vh) * z;
  const dw = vw * scale, dh = vh * scale;
  const ep = easeInOut(p);
  return { sx: 0, sy: 0, sw: vw, sh: vh, dx: -ep * (dw - w), dy: -ep * (dh - h), dw, dh, rotation: 0, opacity: 1 };
};

// 26. Diagonal Pan (bottom-left to top-right)
const diagonalBLTR: AnimFn = (p, vw, vh, w, h) => {
  const z = 1.2;
  const scale = Math.min(w / vw, h / vh) * z;
  const dw = vw * scale, dh = vh * scale;
  const ep = easeInOut(p);
  return { sx: 0, sy: 0, sw: vw, sh: vh, dx: -ep * (dw - w), dy: -(1 - ep) * (dh - h), dw, dh, rotation: 0, opacity: 1 };
};

// 27. Shake (subtle vibration)
const shake: AnimFn = (p, vw, vh, w, h) => {
  const t = identity(vw, vh, w, h);
  const intensity = Math.max(0, 1 - p * 2) * 4;
  return { ...t, dx: t.dx + Math.sin(p * 60) * intensity, dy: t.dy + Math.cos(p * 50) * intensity };
};

// 28. Focus Pull (zoom to center then back)
const focusPull: AnimFn = (p, vw, vh, w, h) => {
  const z = 1 + Math.sin(p * Math.PI) * 0.15;
  const scale = Math.min(w / vw, h / vh) * z;
  const dw = vw * scale, dh = vh * scale;
  return { sx: 0, sy: 0, sw: vw, sh: vh, dx: (w - dw) / 2, dy: (h - dh) / 2, dw, dh, rotation: 0, opacity: 1 };
};

// 29. Zoom In Top-Left
const zoomInTL: AnimFn = (p, vw, vh, w, h) => {
  const z = 1 + easeInOut(p) * 0.3;
  const scale = Math.min(w / vw, h / vh) * z;
  const dw = vw * scale, dh = vh * scale;
  return { sx: 0, sy: 0, sw: vw, sh: vh, dx: 0, dy: 0, dw, dh, rotation: 0, opacity: 1 };
};

// 30. Zoom In Top-Right
const zoomInTR: AnimFn = (p, vw, vh, w, h) => {
  const z = 1 + easeInOut(p) * 0.3;
  const scale = Math.min(w / vw, h / vh) * z;
  const dw = vw * scale, dh = vh * scale;
  return { sx: 0, sy: 0, sw: vw, sh: vh, dx: w - dw, dy: 0, dw, dh, rotation: 0, opacity: 1 };
};

// 31. Zoom In Bottom-Left
const zoomInBL: AnimFn = (p, vw, vh, w, h) => {
  const z = 1 + easeInOut(p) * 0.3;
  const scale = Math.min(w / vw, h / vh) * z;
  const dw = vw * scale, dh = vh * scale;
  return { sx: 0, sy: 0, sw: vw, sh: vh, dx: 0, dy: h - dh, dw, dh, rotation: 0, opacity: 1 };
};

// 32. Zoom In Bottom-Right
const zoomInBR: AnimFn = (p, vw, vh, w, h) => {
  const z = 1 + easeInOut(p) * 0.3;
  const scale = Math.min(w / vw, h / vh) * z;
  const dw = vw * scale, dh = vh * scale;
  return { sx: 0, sy: 0, sw: vw, sh: vh, dx: w - dw, dy: h - dh, dw, dh, rotation: 0, opacity: 1 };
};

// 33. Fade In
const fadeIn: AnimFn = (p, vw, vh, w, h) => {
  const t = identity(vw, vh, w, h);
  return { ...t, opacity: easeIn(Math.min(1, p * 3)) };
};

// 34. Fade Out
const fadeOut: AnimFn = (p, vw, vh, w, h) => {
  const t = identity(vw, vh, w, h);
  return { ...t, opacity: 1 - easeOut(Math.max(0, (p - 0.7) / 0.3)) };
};

// 35. Fade In + Zoom
const fadeInZoom: AnimFn = (p, vw, vh, w, h) => {
  const z = 0.85 + easeOut(Math.min(1, p * 2.5)) * 0.15;
  const scale = Math.min(w / vw, h / vh) * z;
  const dw = vw * scale, dh = vh * scale;
  return { sx: 0, sy: 0, sw: vw, sh: vh, dx: (w - dw) / 2, dy: (h - dh) / 2, dw, dh, rotation: 0, opacity: easeIn(Math.min(1, p * 3)) };
};

// 36. Spin In (full rotation entrance)
const spinIn: AnimFn = (p, vw, vh, w, h) => {
  const ep = easeOut(Math.min(1, p * 2.5));
  const z = 0.5 + ep * 0.5;
  const scale = Math.min(w / vw, h / vh) * z;
  const dw = vw * scale, dh = vh * scale;
  return { sx: 0, sy: 0, sw: vw, sh: vh, dx: (w - dw) / 2, dy: (h - dh) / 2, dw, dh, rotation: (1 - ep) * Math.PI * 2, opacity: Math.min(1, p * 4) };
};

// 37. Sway (gentle left-right oscillation)
const sway: AnimFn = (p, vw, vh, w, h) => {
  const z = 1.05;
  const scale = Math.min(w / vw, h / vh) * z;
  const dw = vw * scale, dh = vh * scale;
  return { sx: 0, sy: 0, sw: vw, sh: vh, dx: (w - dw) / 2 + Math.sin(p * Math.PI * 3) * w * 0.03, dy: (h - dh) / 2, dw, dh, rotation: Math.sin(p * Math.PI * 3) * 0.01, opacity: 1 };
};

// 38. Float (vertical bobbing)
const float: AnimFn = (p, vw, vh, w, h) => {
  const z = 1.05;
  const scale = Math.min(w / vw, h / vh) * z;
  const dw = vw * scale, dh = vh * scale;
  return { sx: 0, sy: 0, sw: vw, sh: vh, dx: (w - dw) / 2, dy: (h - dh) / 2 + Math.sin(p * Math.PI * 4) * h * 0.015, dw, dh, rotation: 0, opacity: 1 };
};

// 39. Wipe Left (reveal from right to left)
const wipeLeft: AnimFn = (p, vw, vh, w, h) => {
  const t = identity(vw, vh, w, h);
  const reveal = easeInOut(Math.min(1, p * 2));
  return { ...t, sw: vw * reveal, dw: t.dw * reveal };
};

// 40. Wipe Right (reveal from left to right)
const wipeRight: AnimFn = (p, vw, vh, w, h) => {
  const t = identity(vw, vh, w, h);
  const reveal = easeInOut(Math.min(1, p * 2));
  return { ...t, sx: vw * (1 - reveal), sw: vw * reveal, dx: t.dx + t.dw * (1 - reveal), dw: t.dw * reveal };
};

// 41. Cinematic Bars (zoom with letterbox)
const cinematicBars: AnimFn = (p, vw, vh, w, h) => {
  const z = 1 + easeInOut(p) * 0.1;
  const scale = Math.min(w / vw, h / vh) * z;
  const dw = vw * scale, dh = vh * scale;
  return { sx: 0, sy: 0, sw: vw, sh: vh, dx: (w - dw) / 2, dy: (h - dh) / 2, dw, dh, rotation: 0, opacity: 1 };
};

// 42. Glide (smooth diagonal movement)
const glide: AnimFn = (p, vw, vh, w, h) => {
  const z = 1.12;
  const scale = Math.min(w / vw, h / vh) * z;
  const dw = vw * scale, dh = vh * scale;
  const ep = easeInOut(p);
  return { sx: 0, sy: 0, sw: vw, sh: vh, dx: (w - dw) / 2 - ep * w * 0.05, dy: (h - dh) / 2 - ep * h * 0.03, dw, dh, rotation: 0, opacity: 1 };
};

// 43. Parallax (subtle depth movement)
const parallax: AnimFn = (p, vw, vh, w, h) => {
  const z = 1.15;
  const scale = Math.min(w / vw, h / vh) * z;
  const dw = vw * scale, dh = vh * scale;
  const ep = easeInOut(p);
  return { sx: 0, sy: 0, sw: vw, sh: vh, dx: (w - dw) / 2 + Math.sin(ep * Math.PI) * w * 0.04, dy: (h - dh) / 2 - ep * h * 0.04, dw, dh, rotation: 0, opacity: 1 };
};

// 44. Dramatic Zoom (fast zoom in last 30%)
const dramaticZoom: AnimFn = (p, vw, vh, w, h) => {
  const z = p > 0.7 ? 1 + easeIn((p - 0.7) / 0.3) * 0.4 : 1;
  const scale = Math.min(w / vw, h / vh) * z;
  const dw = vw * scale, dh = vh * scale;
  return { sx: 0, sy: 0, sw: vw, sh: vh, dx: (w - dw) / 2, dy: (h - dh) / 2, dw, dh, rotation: 0, opacity: 1 };
};

// 45. Reveal Scale (start small center, expand to fill)
const revealScale: AnimFn = (p, vw, vh, w, h) => {
  const ep = easeOut(Math.min(1, p * 2));
  const z = 0.3 + ep * 0.7;
  const scale = Math.min(w / vw, h / vh) * z;
  const dw = vw * scale, dh = vh * scale;
  return { sx: 0, sy: 0, sw: vw, sh: vh, dx: (w - dw) / 2, dy: (h - dh) / 2, dw, dh, rotation: 0, opacity: Math.min(1, p * 5) };
};

// ── Registry ───────────────────────────────────────────────────────────────

export const ANIMATIONS: Record<string, AnimFn> = {
  "none":              (p, vw, vh, w, h) => identity(vw, vh, w, h),
  "zoom_in":           zoomIn,
  "zoom_out":          zoomOut,
  "ken_burns":         kenBurns,
  "ken_burns_reverse": kenBurnsReverse,
  "pan_left":          panLeft,
  "pan_right":         panRight,
  "pan_up":            panUp,
  "pan_down":          panDown,
  "slide_in_left":     slideInLeft,
  "slide_in_right":    slideInRight,
  "slide_in_top":      slideInTop,
  "slide_in_bottom":   slideInBottom,
  "rotate_cw":         rotateCW,
  "rotate_ccw":        rotateCCW,
  "tilt":              tilt,
  "zoom_in_rotate":    zoomInRotate,
  "zoom_out_rotate":   zoomOutRotate,
  "bounce_zoom":       bounceZoom,
  "elastic_scale":     elasticScale,
  "pulse":             pulse,
  "drift_left":        driftLeft,
  "drift_right":       driftRight,
  "drift_up":          driftUp,
  "drift_down":        driftDown,
  "diagonal_tlbr":     diagonalTLBR,
  "diagonal_bltr":     diagonalBLTR,
  "shake":             shake,
  "focus_pull":        focusPull,
  "zoom_in_tl":        zoomInTL,
  "zoom_in_tr":        zoomInTR,
  "zoom_in_bl":        zoomInBL,
  "zoom_in_br":        zoomInBR,
  "fade_in":           fadeIn,
  "fade_out":          fadeOut,
  "fade_in_zoom":      fadeInZoom,
  "spin_in":           spinIn,
  "sway":              sway,
  "float":             float,
  "wipe_left":         wipeLeft,
  "wipe_right":        wipeRight,
  "cinematic_bars":    cinematicBars,
  "glide":             glide,
  "parallax":          parallax,
  "dramatic_zoom":     dramaticZoom,
  "reveal_scale":      revealScale,
};

export const ANIMATION_NAMES = Object.keys(ANIMATIONS).filter(k => k !== "none");

// Returns a list of animations that cycle through all available ones, auto-assigned to segments
export function autoAssignAnimations(segmentCount: number): string[] {
  const pool = [...ANIMATION_NAMES];
  const result: string[] = [];
  for (let i = 0; i < segmentCount; i++) {
    result.push(pool[i % pool.length]);
  }
  return result;
}

// Get animation function by name, fallback to identity
export function getAnimation(name: string): AnimFn {
  return ANIMATIONS[name] || ANIMATIONS["none"];
}

// Apply transform to canvas context + draw video frame
export function applyAnimTransform(
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  transform: AnimTransform,
  w: number,
  h: number
) {
  ctx.save();
  ctx.globalAlpha = transform.opacity;

  if (transform.rotation !== 0) {
    const cx = w / 2;
    const cy = h / 2;
    ctx.translate(cx, cy);
    ctx.rotate(transform.rotation);
    ctx.translate(-cx, -cy);
  }

  ctx.drawImage(
    video,
    transform.sx, transform.sy, transform.sw, transform.sh,
    transform.dx, transform.dy, transform.dw, transform.dh
  );

  ctx.restore();
}

// ── Color Correction ───────────────────────────────────────────────────────

export interface ColorCorrection {
  temperature: number;     // -100 to 100 (negative=cool, positive=warm)
  tint: number;            // -100 to 100 (negative=green, positive=magenta)
  exposure: number;        // -2 to 2
  highlights: number;      // -100 to 100
  shadows: number;         // -100 to 100
  vibrance: number;        // -100 to 100
}

export const COLOR_PRESETS: Record<string, { label: string; filter: string; correction: Partial<ColorCorrection> }> = {
  natural:    { label: "Natural",    filter: "none",                                                    correction: {} },
  warm:       { label: "Warm",       filter: "sepia(0.08) saturate(1.1) brightness(1.02)",              correction: { temperature: 20 } },
  cool:       { label: "Cool",       filter: "hue-rotate(5deg) saturate(0.95) brightness(1.02)",        correction: { temperature: -15 } },
  vibrant:    { label: "Vibrant",    filter: "saturate(1.3) contrast(1.05)",                            correction: { vibrance: 30 } },
  cinematic:  { label: "Cinematic",  filter: "contrast(1.1) saturate(0.9) brightness(0.97)",            correction: { temperature: 5, shadows: -10 } },
  vintage:    { label: "Vintage",    filter: "sepia(0.2) contrast(1.05) brightness(0.97) saturate(0.9)", correction: { temperature: 15, vibrance: -20 } },
  bw:         { label: "B&W",        filter: "grayscale(1) contrast(1.15)",                             correction: {} },
  film:       { label: "Film",       filter: "sepia(0.06) contrast(1.08) saturate(0.95) brightness(0.98)", correction: { temperature: 8, highlights: -5 } },
  matte:      { label: "Matte",      filter: "contrast(0.92) brightness(1.05) saturate(0.9)",           correction: { shadows: 15 } },
  teal_orange:{ label: "Teal & Orange", filter: "hue-rotate(-5deg) saturate(1.2) contrast(1.08)",      correction: { temperature: 10, tint: -5 } },
  moody:      { label: "Moody",      filter: "contrast(1.15) brightness(0.9) saturate(0.85)",           correction: { temperature: -5, shadows: -15 } },
  golden:     { label: "Golden Hour", filter: "sepia(0.12) saturate(1.15) brightness(1.05) hue-rotate(-3deg)", correction: { temperature: 25 } },
  pastel:     { label: "Pastel",     filter: "contrast(0.88) brightness(1.1) saturate(0.75)",           correction: { vibrance: -25, highlights: 10 } },
  dramatic:   { label: "Dramatic",   filter: "contrast(1.2) saturate(1.1) brightness(0.92)",            correction: { shadows: -20, highlights: -10 } },
};

// Build CSS filter string from brightness/contrast/saturation + color grade
export function buildFilter(brightness: number, contrast: number, saturation: number, grade: string): string {
  const gradeFilter = COLOR_PRESETS[grade]?.filter || "none";
  const effectsFilter = `brightness(${brightness}) contrast(${contrast}) saturate(${saturation})`;
  return gradeFilter === "none" ? effectsFilter : `${gradeFilter} ${effectsFilter}`;
}
