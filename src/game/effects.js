import { state } from "../core/state.js";
export function applyScreenEffects(ctx) {
  const s = state;
  if (s.screenShake > 0) {
    let dx = (Math.random() - 0.5) * s.screenShake;
    let dy = (Math.random() - 0.5) * s.screenShake;
    ctx.translate(dx, dy);
    s.screenShake *= 0.85; if (s.screenShake < 0.5) s.screenShake = 0;
  }
  if (s.flashWhite > 0) {
    ctx.save(); ctx.globalAlpha = s.flashWhite; ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, state.canvas.width, state.canvas.height); ctx.restore();
    s.flashWhite *= 0.8; if (s.flashWhite < 0.05) s.flashWhite = 0;
  }
  if (s.flashRed > 0) {
    ctx.save(); ctx.globalAlpha = s.flashRed; ctx.fillStyle = "#f33";
    ctx.fillRect(0, 0, state.canvas.width, state.canvas.height); ctx.restore();
    s.flashRed *= 0.7; if (s.flashRed < 0.05) s.flashRed = 0;
  }
}
