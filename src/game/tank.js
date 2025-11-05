// src/render/tank.js
import { state } from "../core/state.js";
import { resources } from "./resources.js";

/* =============================
   Tank rendering + sizing utils
   ============================= */

/** Live HUD height (published by HUD); fall back sanely. */
function hudHeight() {
  const h1 = state?.bottomBarHeight;          // primary (HUD publishes this)
  const h2 = state?.constantsBottomBarHeight; // legacy cache if present
  const h3 = state?.constants?.bottomBarHeight;
  return Number.isFinite(h1) ? h1 :
         Number.isFinite(h2) ? h2 :
         Number.isFinite(h3) ? h3 : 96;
}

/** Ground Y for a given sprite height (keeps feet on top of HUD). */
function groundYFor(height) {
  const ch = state.canvas?.height ?? 600;
  return ch - hudHeight() - height;
}

/** Global size knob. Prefer `state.tankScale`, then constants, else 1.0. */
function tankScale() {
  if (Number.isFinite(state?.tankScale)) return state.tankScale;
  if (Number.isFinite(state?.constants?.tankScale)) return state.constants.tankScale;
  return 1.0;
}

/** Ensure tank exists and has sane, clamped dimensions/position. */
function sanitizeTank() {
  const t = state.tank;
  if (!t) return;

  const s = tankScale();
  const BASE_W = 84, BASE_H = 64; // original size before scaling

  // default / corrected dims
  if (!Number.isFinite(t.width)  || t.width  <= 0) t.width  = Math.round(BASE_W * s);
  if (!Number.isFinite(t.height) || t.height <= 0) t.height = Math.round(BASE_H * s);

  // default X if missing (quarter screen)
  if (!Number.isFinite(t.x)) t.x = Math.floor((state.canvas?.width ?? 800) * 0.25);

  // snap to ground if missing/invalid Y
  const gy = groundYFor(t.height);
  if (!Number.isFinite(t.y)) t.y = gy;

  // clamp X; do not fight scene's Y except to keep above HUD
  const cw = state.canvas?.width ?? 800;
  t.x = Math.max(0, Math.min(cw - t.width, t.x));
  if (t.y > gy) t.y = gy;

  // integer snap (avoid thin seams on HiDPI)
  t.x = Math.round(t.x);
  t.y = Math.round(t.y);
}

/* =============================
   Draw
   ============================= */

export function drawTank(ctx) {
  if (!ctx || !state?.tank) return;

  sanitizeTank();
  const t = state.tank;

  try { ctx.globalAlpha = 1; ctx.setTransform(1, 0, 0, 1, 0, 0); } catch {}

  // choose sprite (tank3.png is set by GameScene when meatgrinder mode is active)
  const key = state.tankSpriteKey || "tank.png";
  const img = resources.images[key] || resources.images["tank.png"];
  const drawable = img instanceof HTMLImageElement || img instanceof HTMLCanvasElement;

  // cosmetic: soft neon glow only (no text/badges) when Meatgrinder mode is active
  const powered = !!state.meatgrinderMode;

  if (drawable) {
    // Remove shadow/glow ellipse under tank when meatgrinder is active (clean silhouette)

    // draw tank sprite
    ctx.drawImage(img, t.x | 0, t.y | 0, t.width, t.height);

    // (intentionally no text or badge in powered mode)
  } else {
    // fallback block if texture missing
    ctx.save();
    ctx.fillStyle = "#FF00FF";
    ctx.fillRect(t.x | 0, t.y | 0, t.width, t.height);
    ctx.fillStyle = "#000";
    ctx.fillRect(
      (t.x + t.width * 0.40) | 0,
      (t.y - t.height * 0.15) | 0,
      (t.width * 0.20) | 0,
      (t.height * 0.20) | 0
    );
    ctx.restore();
  }
}

export default drawTank;
