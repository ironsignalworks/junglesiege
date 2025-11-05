// src/ui/banners.js
import { state } from "../core/state.js";
import {
  BANNER_IN_MS, BANNER_OUT_MS, BANNER_SHOW_MS, BANNER_STACK_GRADIENT
} from "./constants.js";

export function pushBanner({ type = "ribbon", text = "" }) {
  state._bannerRow = ((state._bannerRow || 0) + 1) % 3; // cycle 0..2
  state.bannerQueue.push({ type, text, t0: 0, _row: state._bannerRow });
}

// Set to 1 if you want *no stacking*, 2 for stylish stack (with gradient).
const MAX_STACK = 2;

const isImgOrCanvas = (v) =>
  v instanceof HTMLImageElement || v instanceof HTMLCanvasElement;

function drawBanner(ctx, W, H, item, i, stackedCount) {
  const now = performance.now();
  if (!item.t0) item.t0 = now;
  const t = now - item.t0;

  const inDone = Math.min(1, t / BANNER_IN_MS);
  const outStart = BANNER_IN_MS + BANNER_SHOW_MS;
  const outProg = t > outStart ? Math.min(1, (t - outStart) / BANNER_OUT_MS) : 0;
  const lifeOver = t >= (BANNER_IN_MS + BANNER_SHOW_MS + BANNER_OUT_MS);

  // vertical placement: distribute across rows (different heights) and stack offset per row
  const row = Number.isFinite(item._row) ? item._row : 0; // 0,1,2
  const baseFrac = [0.14, 0.28, 0.42][row] || 0.14;
  const yBase = Math.floor(H * baseFrac) + (i * 52);
const alpha = Math.max(0, 0.75 * (1 - outProg)); // slightly dimmer
const _stackDim = Math.max(0.55, 1 - (i * 0.25)); // dim back banners

  // zoom-in, then settle, then zoom-out
  const scale = (1 - outProg) * (0.85 + 0.15 * inDone);

  const padX = 24, padY = 12;
  const textPx = 28;

  ctx.save();
  ctx.globalAlpha = alpha;

  // Optional soft gradient behind the stack
  if (BANNER_STACK_GRADIENT && stackedCount > 1 && i === 0) {
    const g = ctx.createLinearGradient(0, 0, 0, yBase + 100);
    g.addColorStop(0, "rgba(0,0,0,0.6)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, yBase + 100);
  }

  ctx.translate(W * 0.5, yBase);
  ctx.scale(scale, scale);

  // panel sizing
  const text = item.text || "";
  ctx.font = `bold ${textPx}px monospace`;
  const tw = ctx.measureText(text).width;
  const bw = Math.min(W - 40, tw + padX * 2);
  const bh = textPx + padY * 2;

  // panel
  ctx.fillStyle = item.type === "warning" ? "rgba(210,30,30,0.92)" : "rgba(20,20,20,0.92)";
  ctx.strokeStyle = item.type === "warning" ? "#ffccaa" : "#66ccff";
  ctx.lineWidth = 4;
  if (Path2D && CanvasRenderingContext2D.prototype.roundRect) {
    ctx.beginPath();
    ctx.roundRect(-bw/2, -bh/2, bw, bh, 14);
    ctx.fill();
    ctx.stroke();
  } else {
    // fallback
    ctx.fillRect(-bw/2, -bh/2, bw, bh);
    ctx.strokeRect(-bw/2, -bh/2, bw, bh);
  }

  // text
  ctx.fillStyle = "#fff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, 0, 2);

  ctx.restore();

  return lifeOver;
}

export function renderBanners(ctx, W, H) {
  // Suppress banners during boss announcement/intro to avoid obstruction
  try { if (state.bossAnnouncementShowing) return; } catch {}
  // only show first, or allow a light stack
  const active = [];
  if (state.bannerActive) active.push(state.bannerActive);

  // top up from queue
  while (active.length < MAX_STACK && state.bannerQueue.length) {
    const next = state.bannerQueue.shift();
    active.push(next);
  }

  // draw each and keep survivors
  const survivors = [];
  for (let i = 0; i < active.length; i++) {
    const item = active[i];
    const lifeOver = drawBanner(ctx, W, H, item, i, active.length);
    if (!lifeOver) survivors.push(item);
  }

  state.bannerActive = survivors[0] || null;

  // push any extras back to front of queue to render next frame
  for (let i = 1; i < survivors.length; i++) {
    state.bannerQueue.unshift(survivors[i]);
  }
}
