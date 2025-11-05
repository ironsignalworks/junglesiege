// src/ui/lore.js
import { state } from "../core/state.js";

/**
 * Small story drip ticker that shows one line for a few seconds
 * (e.g., when each round starts).
 */

const LORE = {
  queue: [],
  active: null,
  start: 0,
  dur: 4200,       // show for ~4.2s
  fade: 360,       // fade-in/out
};

export function initKurtzLore(beats = []) {
  LORE.queue = beats.slice(0);
}

export function queueLoreBeat(text) {
  if (text) LORE.queue.push(String(text));
}

export function triggerNextLoreBeat(now) {
  if (!LORE.queue.length) return;
  LORE.active = LORE.queue.shift();
  LORE.start = now || (performance.now?.() ?? Date.now());
}

export function updateAndRenderLore(ctx, now) {
  if (!LORE.active) return;
  const t = now - LORE.start;
  const { dur, fade } = LORE;

  // Lifetime
  if (t > dur) { LORE.active = null; return; }

  // Fade-in/out alpha
  let a = 1;
  if (t < fade) a = t / fade;
  else if (t > dur - fade) a = Math.max(0, (dur - t) / fade);

  // REPOSITIONED: Draw in lower third area (75% down instead of top)
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = a;

  const cw = state.canvas.width | 0;
  const ch = state.canvas.height | 0;
  const y = Math.floor(ch * 0.75); // MOVED TO LOWER THIRD
  const padX = 16, padY = 8; // Smaller padding

  // measure
  ctx.font = "bold 18px monospace"; // Smaller font
  const w = Math.ceil(ctx.measureText(LORE.active).width);
  const boxW = w + padX * 2;
  const boxH = 36; // Smaller box

  // panel
  ctx.fillStyle = "rgba(8, 10, 8, 0.85)";
  ctx.fillRect(Math.floor((cw - boxW) / 2), y - Math.floor(boxH / 2), boxW, boxH);
  ctx.strokeStyle = "rgba(90, 160, 120, 0.9)";
  ctx.lineWidth = 2;
  ctx.strokeRect(Math.floor((cw - boxW) / 2) + 1, y - Math.floor(boxH / 2) + 1, boxW - 2, boxH - 2);

  // text
  ctx.fillStyle = "#c8ffac";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(LORE.active, cw / 2, y);

  ctx.restore();
}
