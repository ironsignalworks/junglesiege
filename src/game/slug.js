// src/systems/slug.js
import { state, playSound } from "../core/state.js";
import { resources } from "./resources.js";
import { isColliding } from "./collisions.js";
import { spawnFxExplosion } from "./fx.js";

/** one-time init per run */
export function initSlugs() {
  if (!Array.isArray(state.slugs)) state.slugs = [];
}

/** call from spawn.js when a zombie dies (we filter for zombie4 here too) */
export function spawnSlugFromKill(z) {
  if (!z) return;

  // Accept a few common ways zombie4 might be tagged
  const key = (z.spriteKey || z.image || z.imgKey || z.type || "").toString().toLowerCase();
  const isZ4 =
    key === "zombie4" || key === "4" || key.includes("zombie4.png") || key === "type4";
  if (!isZ4) return;

  // Size
  const SLUG_W = 60;
  const SLUG_H = 60;

  const zx = z.x || 0, zy = z.y || 0, zw = z.width || 32, zh = z.height || 32;
  const spawnX = zx + zw * 0.5 - SLUG_W * 0.5;
  const spawnY = zy + zh * 0.7 - SLUG_H * 0.5;

  state.slugs.push({
    x: spawnX,
    y: spawnY,
    width: SLUG_W,
    height: SLUG_H,
    w: SLUG_W,
    h: SLUG_H,
    speed: 2.6,
    hp: 3,
    wobble: Math.random() * Math.PI * 2,
    wobbleAmp: 7.5,
  });
}

/** update + render slugs, handle damage and collisions */
export function updateAndRenderSlugs(ctx, now) {
  if (!Array.isArray(state.slugs) || state.slugs.length === 0) return;
  const img = resources.images["slug.png"];
  const player = state.tank;
  if (!player) return;

  for (let i = state.slugs.length - 1; i >= 0; i--) {
    const s = state.slugs[i];

    // movement toward player with wobble
    const cx = s.x + s.width / 2, cy = s.y + s.height / 2;
    const tx = player.x + player.width / 2, ty = player.y + player.height / 2;
    const dx = tx - cx, dy = ty - cy;
    const d = Math.hypot(dx, dy) || 1;
    const ux = dx / d,  uy = dy / d;

    s.wobble += 0.085;
    const wobX = Math.cos(s.wobble * 0.6) * 0.7;
    const wobY = Math.sin(s.wobble * 0.8) * 0.5;

    s.x += ux * s.speed + wobX;
    s.y += uy * s.speed + wobY;

    // draw
    if (img instanceof HTMLImageElement || img instanceof HTMLCanvasElement) {
      const wobLift = Math.sin(now / 180) * (s.wobbleAmp * 0.08);
      ctx.drawImage(img, Math.round(s.x), Math.round(s.y + wobLift), s.width, s.height);
    } else {
      ctx.save();
      ctx.fillStyle = "#7bd37b";
      ctx.fillRect(Math.round(s.x), Math.round(s.y), s.width, s.height);
      ctx.restore();
    }

    // bullets damage slugs
    for (let bi = state.bullets.length - 1; bi >= 0; bi--) {
      if (isColliding(state.bullets[bi], s)) {
        state.bullets.splice(bi, 1);
        s.hp -= 1;
        if (s.hp <= 0) {
          // Flesh explosion on death (BIGGER)
          const ex = s.x + (s.width || 16) / 2;
          const ey = s.y + (s.height || 16) / 2;
          // use explicit pixel sizing so its consistently bigger
          spawnFxExplosion("flesh", { x: ex, y: ey, sizePx: 56, shake: 6, frameMs: 60 });

        // remove slug and award
          state.slugs.splice(i, 1);
          state.score = (state.score || 0) + 5;
          state.flashWhite = Math.max(state.flashWhite || 0, 0.12);
        }
        break;
      }
    }

    // collide with player
    if (isColliding(s, player)) {
      const shieldActive = (state.shieldUntil || 0) > Date.now();

      if (shieldActive) {
        // Shield pops the slug instantly + bigger explosion
        const ex = s.x + (s.width || 16) / 2;
        const ey = s.y + (s.height || 16) / 2;
        spawnFxExplosion("flesh", { x: ex, y: ey, sizePx: 56, shake: 7, frameMs: 60 });

        state.slugs.splice(i, 1);
        try {
          const snd = resources?.audio?.fxPickup || resources?.audio?.fxExplosion;
          if (snd && playSound) playSound(snd);
        } catch {}
        state.flashWhite = Math.max(state.flashWhite || 0, 0.18);
        state.screenShake = Math.max(state.screenShake || 0, 6);
        continue;
      }

      // damage player and knock slug back
      state.health = Math.max(0, (state.health || 0) - 4);
      state.flashRed = Math.max(state.flashRed || 0, 0.18);
      state.screenShake = Math.max(state.screenShake || 0, 6);
      s.x -= ux * 8; s.y -= uy * 8;

      if (state.health <= 0 && state.scene?.gameOver) {
        try { state.scene.gameOver(); } catch {}
        return;
      }
    }

    // purge offscreen
    if (s.x < -80 || s.x > state.canvas.width + 80 || s.y < -80 || s.y > state.canvas.height + 80) {
      state.slugs.splice(i, 1);
    }
  }
}
