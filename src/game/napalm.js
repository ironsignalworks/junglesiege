// src/systems/napalm.js
import { state, playSound } from "../core/state.js";
import { resources } from "./resources.js";
import { constants } from "./constants.js"; // ✅ new: for safe bottom bar

/* ---------- config ---------- */
const NAPALM_KILLS_REQUIRED = 4;
const NAPALM_STREAK_WINDOW_MS = 2000;
const READY_BANNER_MS = 700;

// Bomber sizing (clamped) and altitude
const BOMBER_MAX_CANVAS_FRAC = 0.22;
const BOMBER_SCALE_HARD_MAX  = 0.50;
const BOMBER_ALTITUDE_Y      = 8;

// Napalm canister size and arming
const NAPALM_SCALE = 0.15;     // ~35% of native (smaller than 50%)
const BOMB_ARM_FALL_PX = 28;   // must fall this many px before it can explode
const BOMB_ARM_MS      = 120;  // or this long (whichever later)
const BOMB_FUSE_GROUND_OFFSET = 2;

// ✅ safe bottom bar height anywhere napalm needs it
function bottomBarHeight() {
  const v = constants?.bottomBarHeight;
  return Number.isFinite(v) ? v : 96;
}

export function initNapalmState() {
  state.napalm = {
    ready: false,
    unlock: { count: 0, expires: 0, windowMs: NAPALM_STREAK_WINDOW_MS, needed: NAPALM_KILLS_REQUIRED },
    bomber: null,
    bombs: [],
    explosions: [],
    autoArmAt: 0,
    cooldownUntil: 0,
    cfg: {
      direction: "rtl",
      flipSpriteWhenRTL: true,
      bomberSpeed: 4.2,
      dropsPerRun: 5,           // three canisters per pass
      dropSpacingPx: 180,
      bombGravity: 0.18,
      bombVyStart: 1.2,
      explodeRadius: 110,
      explosionFrameMs: 80,
      cooldownMs: 4000,
    }
  };
}

export function resetNapalm() {
  if (!state.napalm) return;
  state.napalm.ready = false;
  state.napalm.unlock = { count: 0, expires: 0, windowMs: NAPALM_STREAK_WINDOW_MS, needed: NAPALM_KILLS_REQUIRED };
  state.napalm.bomber = null;
  state.napalm.bombs.length = 0;
  state.napalm.explosions.length = 0;
  state.napalm.autoArmAt = 0;
  state.napalm.cooldownUntil = 0;
}

/* ----- unlock from streaks (compat with older calls) ---- */
export function registerNapalmKill(now = (performance?.now?.() ?? Date.now())) {
  const u = state.napalm.unlock;
  if (now > (u.expires || 0)) u.count = 0;
  u.count++; u.expires = now + (u.windowMs || NAPALM_STREAK_WINDOW_MS);
  if (u.count >= (u.needed || NAPALM_KILLS_REQUIRED)) {
    state.napalm.ready = true;
    state.napalm.autoArmAt = now + READY_BANNER_MS;
    u.count = 0; u.expires = 0;
  }
}
export function bumpBossHitStreak(now = (performance?.now?.() ?? Date.now())) {
  return registerNapalmKill(now);
}

/* ----- small HUD badge (bottom-left) when ready ----- */
export function drawNapalmHUD(ctx) {
  const n = state.napalm;
  if (!n || !n.ready || n.bomber) return; // only show when armed & idle
  const bottom = bottomBarHeight(); // ✅
  const x = 12;
  const y = state.canvas.height - bottom + 22;

  ctx.save();
  ctx.font = "bold 14px VT323, monospace";
  // outline for readability
  ctx.lineWidth = 3;
  ctx.strokeStyle = "rgba(0,0,0,0.9)";
  // removed on-screen napalm prompt
  ctx.restore();
}

export function triggerNapalmStrike() {
  const s = state.napalm; if (!s) initNapalmState();
  const now = (performance?.now?.() ?? Date.now());
  if (s.bomber || !s.ready || now < (s.cooldownUntil || 0)) return;

  const img  = resources.images["bomber.png"] || resources.images["bomber"];
  const natW = (img?.width)  || 96;
  const natH = (img?.height) || 48;

  const targetW = Math.min(state.canvas.width * BOMBER_MAX_CANVAS_FRAC, natW * BOMBER_SCALE_HARD_MAX);
  const scl     = Math.max(0.1, Math.min(targetW / natW, BOMBER_SCALE_HARD_MAX));
  const w       = Math.round(natW * scl);
  const h       = Math.round(natH * scl);

  const rtl  = s.cfg.direction === "rtl";
  const sign = rtl ? -1 : 1;
  const vx   = sign * (s.cfg.bomberSpeed || 3.2);

  const cw = state.canvas.width;
  const xStart = rtl ? (cw + w + 30) : (-w - 30);

  s.bomber = {
    x: xStart, y: BOMBER_ALTITUDE_Y, w, h, vx, img, sign,
    flip: rtl && s.cfg.flipSpriteWhenRTL,
    dropsLeft: s.cfg.dropsPerRun || 3,
    nextDropX: xStart + sign * (s.cfg.dropSpacingPx || 180)
  };

  s.ready = false;
  s.autoArmAt = 0;
  s.cooldownUntil = now + (s.cfg.cooldownMs || 5000);
}

export function updateAndRenderNapalm(ctx, now) {
  const s = state.napalm; if (!s) return;

  // auto-fire after banner delay
  if (s.ready && !s.bomber && s.autoArmAt && now >= s.autoArmAt && now >= (s.cooldownUntil || 0)) {
    triggerNapalmStrike();
  }

  // bomber flight + timed drops
  const b = s.bomber;
  if (b) {
    b.x += b.vx;
    const crossed = (b.sign > 0 && b.x >= b.nextDropX) || (b.sign < 0 && b.x <= b.nextDropX);
    if (b.dropsLeft > 0 && crossed) {
      spawnBomb(b.x + b.w * 0.5, b.y + b.h * 0.70, now);
      b.dropsLeft--;
      b.nextDropX += b.sign * (s.cfg.dropSpacingPx || 180);
    }
    if ((b.sign < 0 && b.x + b.w < -40) || (b.sign > 0 && b.x > state.canvas.width + 40)) {
      s.bomber = null;
    }
  }

  // bombs: draw at 35%, arm after small fall/time, explode on contact
  for (let i = s.bombs.length - 1; i >= 0; i--) {
    const d = s.bombs[i];

    // physics
    d.vy = (d.vy ?? s.cfg.bombVyStart) + s.cfg.bombGravity;
    d.y += d.vy;

    // draw canister
    const nap = resources.images["napalm.png"];
    let napW = 18, napH = 18, napX = d.x - napW/2, napY = d.y - napH/2;
    if (nap instanceof HTMLImageElement || nap instanceof HTMLCanvasElement) {
      napW = Math.max(4, Math.floor(nap.width  * NAPALM_SCALE));
      napH = Math.max(4, Math.floor(nap.height * NAPALM_SCALE));
      napX = d.x - napW / 2; napY = d.y - napH / 2;
      ctx.drawImage(nap, napX, napY, napW, napH);
    } else {
      ctx.save(); ctx.fillStyle = "#ff9800";
      ctx.beginPath(); ctx.arc(d.x, d.y, 6, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    }

    // arm after falling enough or time elapsed
    if (!d.armed && (d.y >= d.armMinY || now >= d.armAt)) d.armed = true;

    // explode on contact (only when armed)
    if (d.armed) {
      // zombies
      if (Array.isArray(state.zombies)) {
        let hit = false;
        for (let zi = state.zombies.length - 1; zi >= 0; zi--) {
          const z = state.zombies[zi];
          if (rectsIntersect(napX, napY, napW, napH, z.x, z.y, z.width, z.height)) {
            spawnExplosion(d.x, d.y, now);
            s.bombs.splice(i, 1);
            // decrement boss trigger when napalm killed a zombie
            if (!state.bossActive && !state.bossDefeated) {
              state.bossTriggerCount = Math.max(0, (state.bossTriggerCount || 0) - 1);
            }
            hit = true;
            break;
          }
        }
        if (hit) continue;
      }

      // SLUGS (mini-enemies)
      if (Array.isArray(state.slugs)) {
        let hitSlug = false;
        for (let si = state.slugs.length - 1; si >= 0; si--) {
          const sl = state.slugs[si];
          const sx = sl.x ?? sl.pos?.x ?? sl?.rect?.x ?? 0;
          const sy = sl.y ?? sl.pos?.y ?? sl?.rect?.y ?? 0;
          const sw = sl.width  ?? sl.w ?? sl?.rect?.width  ?? 16;
          const sh = sl.height ?? sl.h ?? sl?.rect?.height ?? 16;
          if (rectsIntersect(napX, napY, napW, napH, sx, sy, sw, sh)) {
            spawnExplosion(d.x, d.y, now);
            s.bombs.splice(i, 1);
            hitSlug = true;
            break;
          }
        }
        if (hitSlug) continue;
      }

      // boss
      const boss = state.bossActive && state.boss?.isAlive ? state.boss : null;
      if (boss && rectsIntersect(napX, napY, napW, napH, boss.x, boss.y, boss.width, boss.height)) {
        spawnExplosion(d.x, d.y, now);
        s.bombs.splice(i, 1);
        continue;
      }
    }

    // ground explode
    const groundY = state.canvas.height - bottomBarHeight() - 10; // ✅
    if (s.bombs[i] && d.y >= groundY) {
      spawnExplosion(d.x, groundY - BOMB_FUSE_GROUND_OFFSET, now);
      s.bombs.splice(i, 1);
    }
  }

  // explosions (radius damage + xp frames)
  for (let i = s.explosions.length - 1; i >= 0; i--) {
    const e = s.explosions[i];
    if (!e.started) { e.started = now; e.last = now; }
    if (now - e.last >= (s.cfg.explosionFrameMs || 80)) { e.frame++; e.last = now; }

    const frameKey = e.frame === 0 ? "xp1.png" : e.frame === 1 ? "xp2.png" : "xp3.png";
    const img = resources.images[frameKey];
    const radius = s.cfg.explodeRadius || 110;

    if (!e.didDamage && e.frame <= 1) {
      e.didDamage = true;

      // zombies in radius
      if (Array.isArray(state.zombies)) {
        for (let zi = state.zombies.length - 1; zi >= 0; zi--) {
          const z = state.zombies[zi];
          if (dist2(e.x, e.y, z.x + z.width / 2, z.y + z.height / 2) <= radius * radius) {
            state.zombies.splice(zi, 1);
            state.score += 10;
            // decrement boss trigger for each zombie killed by napalm blast
            if (!state.bossActive && !state.bossDefeated) {
              state.bossTriggerCount = Math.max(0, (state.bossTriggerCount || 0) - 1);
            }
          }
        }
      }

      // SLUGS in radius
      if (Array.isArray(state.slugs)) {
        for (let si = state.slugs.length - 1; si >= 0; si--) {
          const sl = state.slugs[si];
          const sx = sl.x ?? sl.pos?.x ?? sl?.rect?.x ?? 0;
          const sy = sl.y ?? sl.pos?.y ?? sl?.rect?.y ?? 0;
          const sw = sl.width  ?? sl.w ?? sl?.rect?.width  ?? 16;
          const sh = sl.height ?? sl.h ?? sl?.rect?.height ?? 16;
          if (dist2(e.x, e.y, sx + sw/2, sy + sh/2) <= radius * radius) {
            state.slugs.splice(si, 1);
          }
        }
      }

      // boss in radius
      if (state.bossActive && state.boss?.isAlive) {
        const bx = state.boss.x + state.boss.width / 2;
        const by = state.boss.y + state.boss.height / 2;
        if (dist2(e.x, e.y, bx, by) <= (radius + 30) * (radius + 30)) {
          state.boss.health = Math.max(0, state.boss.health - 20);
        }
      }

      try { playSound && resources?.audio?.fxExplosion && playSound(resources.audio.fxExplosion); } catch {}
      state.screenShake = Math.max(state.screenShake || 0, 12);
      state.flashWhite  = Math.max(state.flashWhite  || 0, 0.2);
    }

    if (img instanceof HTMLImageElement || img instanceof HTMLCanvasElement) {
      ctx.drawImage(img, e.x - img.width / 2, e.y - img.height / 2);
    } else {
      ctx.save();
      ctx.fillStyle = "rgba(255,140,0,0.85)";
      ctx.beginPath(); ctx.arc(e.x, e.y, radius, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }

    if (e.frame > 2) s.explosions.splice(i, 1);
  }
}

/* overlay (bomber sprite + “incoming” banner) */
export function drawNapalmOverlay(ctx, now) {
  const s = state.napalm; if (!s) return;

  if (s.ready && !s.bomber && s.autoArmAt && now >= s.autoArmAt && now >= (s.cooldownUntil || 0)) {
    triggerNapalmStrike();
  }

  if (s.bomber) drawBomber(ctx, s.bomber);

  if (s.ready && !s.bomber) {
    const cw = state.canvas.width, ch = state.canvas.height;
    const bottomH = bottomBarHeight(); // ✅
    const t = (typeof now === "number" ? now : (performance?.now?.() ?? Date.now()));
    const pulse = 0.94 + 0.06 * Math.sin(t * 0.009);
    const glowA = 0.55 + 0.25 * Math.sin(t * 0.018);

    const w = Math.min(640, cw * 0.86), h = 78;
    const x = (cw - w) / 2;
    const y = Math.max(24, (ch - bottomH) * 0.40 - h / 2);

    ctx.save();
    ctx.globalAlpha = 0.95;
    ctx.fillStyle   = "rgba(20,16,0,0.85)";
    ctx.fillRect(x, y, w, h);

    ctx.lineWidth   = 3;
    ctx.strokeStyle = "#8A6A00";
    ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);

    ctx.globalAlpha = glowA;
    ctx.shadowColor = "#FFD54A";
    ctx.shadowBlur  = 18;
    ctx.strokeStyle = "#FFD54A";
    ctx.strokeRect(x + 2, y + 2, w - 4, h - 4);

    ctx.globalAlpha = 1;
    ctx.shadowColor = "transparent";
    ctx.textAlign   = "center";
    ctx.textBaseline= "middle";

    ctx.save();
    ctx.translate(x + w / 2, y + h / 2);
    ctx.scale(pulse, pulse);
    ctx.font       = "bold 42px VT323, monospace";
    ctx.lineWidth  = 6;
    ctx.strokeStyle= "#3A2A00";
    ctx.strokeText("NAPALM INCOMING", 0, 0);
    ctx.fillStyle  = "#FFCC00";
    ctx.fillText("NAPALM INCOMING", 0, 0);
    ctx.restore();

    ctx.restore();
  }
}

/* helpers */
function drawBomber(ctx, b) {
  const img =
    b.img ||
    resources.images["bomber.png"] ||
    resources.images["bomber"] ||
    state.assets?.bomber;
  if (!img) return;

  const targetW = Math.min(state.canvas.width * BOMBER_MAX_CANVAS_FRAC, img.width * BOMBER_SCALE_HARD_MAX);
  const scl     = Math.max(0.1, Math.min(targetW / img.width, BOMBER_SCALE_HARD_MAX));

  ctx.save();
  ctx.translate(b.x, b.y);
  if (b.flip) { ctx.scale(-scl, scl); ctx.drawImage(img, -img.width, 0); }
  else        { ctx.scale(scl,  scl); ctx.drawImage(img, 0, 0); }
  ctx.restore();
}

function spawnBomb(x, y, now) {
  state.napalm.bombs.push({
    x, y,
    vy: state.napalm.cfg.bombVyStart,
    armMinY: y + BOMB_ARM_FALL_PX,
    armAt: now + BOMB_ARM_MS,
    armed: false
  });
}

function spawnExplosion(x, y, now) {
  state.napalm.explosions.push({ x, y, frame: 0, started: now, last: now, didDamage: false });
}

function rectsIntersect(ax, ay, aw, ah, bx, by, bw, bh) {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}
function dist2(x1, y1, x2, y2) { const dx = x1 - x2, dy = y1 - y2; return dx*dx + dy*dy; }

export default {};
