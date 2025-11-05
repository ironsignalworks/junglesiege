import { resources } from "./resources.js";
import { constants } from "./constants.js";
import { state } from "../core/state.js";

export function drawBackground(ctx) {
  const bgIndex = Math.max(0, Math.min(state.round - 1, constants.bgImages.length - 1));
  const name = constants.bgImages[bgIndex];
  const bg = resources.images[name];
  if (bg) {
    ctx.drawImage(bg, 0, 0, state.canvas.width, state.canvas.height);
  } else {
    const g = ctx.createLinearGradient(0, 0, 0, state.canvas.height);
    g.addColorStop(0, '#87CEEB'); g.addColorStop(1, '#228B22');
    ctx.fillStyle = g; ctx.fillRect(0, 0, state.canvas.width, state.canvas.height);
  }
}
