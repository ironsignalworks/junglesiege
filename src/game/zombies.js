import { resources } from "./resources.js";
import { state } from "../core/state.js";

/**
 * Draw zombies with preserved image aspect ratio.
 * - Uses z.width as the controlling width.
 * - Computes height from the image's natural ratio.
 * - Anchors sprite feet on the original bottom (so they don't float).
 * - Falls back to rects if image missing.
 */
export function drawZombies(ctx) {
  for (const z of state.zombies) {
    const key = `${z.type}.png`;
    const img = resources.images[key];
    if (img && img.width && img.height) {
      const iw = img.width, ih = img.height;
      const ratio = iw / ih || 1;
      const drawW = Math.max(8, Math.round((z.width || iw)));
      const drawH = Math.max(8, Math.round(drawW / ratio));
      // anchor feet: keep the bottom aligned to z.y + z.height if present
      const anchorBottom = (typeof z.height === "number") ? (z.y + z.height) : (z.y + drawH);
      const drawX = Math.round(z.x);
      const drawY = Math.round(anchorBottom - drawH);
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(img, drawX, drawY, drawW, drawH);
    } else {
      ctx.fillStyle = z.type === "zombie4" ? "#006600"
                   : z.type === "zombie3" ? "#009900"
                   : z.type === "zombie2" ? "#8B0000" : "#F44336";
      ctx.fillRect(Math.round(z.x), Math.round(z.y), z.width || 32, z.height || 48);
    }
  }
}
