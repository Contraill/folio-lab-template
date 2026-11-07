/** A small line chart of one metric over the rounds; enough to see a run learn, without a chart library. */
import type { Palette } from './types.ts';

export function chart(ctx: CanvasRenderingContext2D, w: number, h: number, points: { step: number; value: number }[], maxStep: number, marks: number[], p: Palette) {
  ctx.clearRect(0, 0, w, h);
  ctx.strokeStyle = p.mute; ctx.globalAlpha = 0.35; ctx.lineWidth = 1;
  for (const m of marks) { const x = (m / maxStep) * w; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
  ctx.globalAlpha = 1;
  if (points.length < 2) return;
  const values = points.map((q) => q.value);
  const lo = Math.min(...values), hi = Math.max(...values), span = hi - lo || 1;
  ctx.strokeStyle = p.signal; ctx.lineWidth = 2; ctx.beginPath();
  points.forEach((q, i) => { const x = (q.step / maxStep) * w, y = h - 4 - ((q.value - lo) / span) * (h - 8); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); });
  ctx.stroke();
}

/** Sizes a canvas to its box at the display's pixel density and returns its CSS size. */
export function fit(canvas: HTMLCanvasElement) {
  const dpr = Math.min(devicePixelRatio || 1, 2), { width, height } = canvas.getBoundingClientRect();
  if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) { canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr); }
  const ctx = canvas.getContext('2d')!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, w: width, h: height };
}
