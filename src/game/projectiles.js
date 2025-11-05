// src/systems/projectiles.js
import { state, playSound } from "../core/state.js";
import { resources } from "./resources.js";
import { constants } from "./constants.js";

/* ------------------ knobs ------------------ */
// Visual scale applied to boss-owned projectiles.
// Override via constants.bossProjectileScale if you want a different value.
const BOSS_PROJ_SCALE = Number.isFinite(constants?.bossProjectileScale)
  ? constants.bossProjectileScale
  : 8.4;

/* ------------------ helpers ------------------ */

function isCanvasCtx(x) {
  return !!x && typeof x.drawImage === "function" && typeof x.save === "function";
}

function clampForwardAngle(rad, halfFanDeg = 90) {
  const half = Math.max(0, Math.min(90, Number.isFinite(halfFanDeg) ? halfFanDeg : 90)) * Math.PI / 180;
  let a = rad;
  if (a < -Math.PI) a += 2 * Math.PI;
  if (a >  Math.PI) a -= 2 * Math.PI;
  if (a < -half) a = -half;
  if (a >  half)  a =  half;
  const EPS = 1e-4;
  if (Math.abs(Math.cos(a)) < EPS) a = (a >= 0 ? 1 : -1) * (half || 0);
  if (Math.cos(a) <= 0) a = (a >= 0 ? 1 : -1) * (half || 0);
  return a;
}

function drawSpriteOrRect(ctx, img, x, y, w, h, fallbackFill = "yellow") {
  if (img instanceof HTMLImageElement || img instanceof HTMLCanvasElement) {
    ctx.drawImage(img, x | 0, y | 0, w | 0, h | 0);
  } else {
    ctx.save();
    ctx.fillStyle = fallbackFill;
    ctx.fillRect(x | 0, y | 0, w | 0, h | 0);
    ctx.restore();
  }
}

function lockBulletKinematics(b) {
  if (b._lockedKinematics) return;
  const halfFan = Number.isFinite(constants?.playerAimHalfAngleDeg) ? constants.playerAimHalfAngleDeg : 90;

  let angle, speed;
  if (Number.isFinite(b.angle) && Number.isFinite(b.speed)) {
    angle = b.angle; speed = b.speed;
  } else if (Number.isFinite(b.dx) || Number.isFinite(b.dy)) {
    const dx = Number.isFinite(b.dx) ? b.dx : 0;
    const dy = Number.isFinite(b.dy) ? b.dy : 0;
    speed = Math.hypot(dx, dy) || (Number.isFinite(constants?.playerBulletSpeed) ? constants.playerBulletSpeed :
             Number.isFinite(constants?.bulletSpeed) ? constants.bulletSpeed : 12);
    angle = Math.atan2(dy, dx);
  } else {
    speed = Number.isFinite(constants?.playerBulletSpeed) ? constants.playerBulletSpeed :
            Number.isFinite(constants?.bulletSpeed)       ? constants.bulletSpeed       : 12;
    angle = 0;
  }

  angle = clampForwardAngle(angle, halfFan);

  b.angle = angle;
  b.speed = speed;
  b.dx = 0; b.dy = 0;
  b._lockedKinematics = true;
}

/* --------------- player bullets --------------- */

export function firePlayerBullet() {
  if (!state.gameStarted || !state.tank || !state.canvas) return;
  if (!constants.ammoInfinite && (state.ammo ?? 0) <= 0) return;

  const x1 = state.tank.x + state.tank.width / 2;
  const y1 = state.tank.y + state.tank.height / 2;

  const px = Number.isFinite(state.pointerX) ? state.pointerX : x1;
  const py = Number.isFinite(state.pointerY) ? state.pointerY : (y1 - 50);

  const rawAng = Math.atan2(py - y1, px - x1);
  const halfFan = Number.isFinite(constants?.playerAimHalfAngleDeg) ? constants.playerAimHalfAngleDeg : 90;
  const angle = clampForwardAngle(rawAng, halfFan);

  const speed =
    Number.isFinite(constants?.playerBulletSpeed) ? constants.playerBulletSpeed :
    Number.isFinite(constants?.bulletSpeed)       ? constants.bulletSpeed       : 12;

  const w = 27, h = 27;

  const b = {
    x: x1 - w / 2,
    y: y1 - h / 2,
    width: w,
    height: h,
    angle,
    speed,
    type: "ammo1.png",
  };
  b._lockedKinematics = true;
  state.bullets.push(b);

  if (!constants.ammoInfinite) {
    const cap = Number.isFinite(constants.maxAmmo) ? constants.maxAmmo : 9999;
    state.ammo = Math.max(0, Math.min((state.ammo || 0) - 1, cap));
  }

  try { playSound?.(resources.audio?.fxShot); } catch {}
}

export function updatePlayerBullets(ctx) {
  ctx = isCanvasCtx(ctx) ? ctx : state.ctx;
  if (!isCanvasCtx(ctx)) return;

  const canvas = state.canvas;
  if (!canvas) return;

  try { ctx.setTransform(1, 0, 0, 1, 0, 0); } catch {}

  for (let i = state.bullets.length - 1; i >= 0; i--) {
    const b = state.bullets[i];

    lockBulletKinematics(b);

    const vx = Math.cos(b.angle) * b.speed;
    const vy = Math.sin(b.angle) * b.speed;

    b.x += vx;
    b.y += vy;

    const img = (b.type && resources.images?.[b.type]) || resources.images?.["ammo1.png"];
    const bw=Math.max(b.width||16,12), bh=Math.max(b.height||16,12);
    drawSpriteOrRect(ctx, img, b.x, b.y, bw, bh, "yellow");

    if (
      b.y < -b.height || b.y > canvas.height + b.height ||
      b.x < -b.width  || b.x > canvas.width  + b.width
    ) {
      state.bullets.splice(i, 1);
    }
  }
}

/* --------------- enemy (incl. boss) bullets --------------- */

function normalizeEnemyKinematics(eb) {
  const defaultSpeed = Number.isFinite(constants?.enemyBulletSpeed) ? constants.enemyBulletSpeed : 6;

  if (Number.isFinite(eb.vx) || Number.isFinite(eb.vy)) {
    const vx = Number.isFinite(eb.vx) ? eb.vx : 0;
    const vy = Number.isFinite(eb.vy) ? eb.vy : 0;
    const speed = Math.hypot(vx, vy);
    const angle = speed ? Math.atan2(vy, vx) : 0;
    eb.speed = Number.isFinite(eb.speed) ? eb.speed : speed;
    eb.angle = Number.isFinite(eb.angle) ? eb.angle : angle;
    return;
  }

  if (Number.isFinite(eb.dx) || Number.isFinite(eb.dy)) {
    const dx = Number.isFinite(eb.dx) ? eb.dx : 0;
    const dy = Number.isFinite(eb.dy) ? eb.dy : 0;
    const speed = Math.hypot(dx, dy) || defaultSpeed;
    const angle = Math.atan2(dy, dx);
    eb.speed = speed;
    eb.angle = angle;
    eb.vx = Math.cos(angle) * speed;
    eb.vy = Math.sin(angle) * speed;
    eb.dx = 0; eb.dy = 0;
    return;
  }

  if (state.tank) {
    const cx = (eb.x || 0) + (eb.width ? eb.width / 2 : 0);
    const cy = (eb.y || 0) + (eb.height ? eb.height / 2 : 0);
    const tx = state.tank.x + state.tank.width / 2;
    const ty = state.tank.y + state.tank.height / 2;
    const ang = Math.atan2(ty - cy, tx - cx);
    eb.speed = defaultSpeed;
    eb.angle = ang;
    eb.vx = Math.cos(ang) * defaultSpeed;
    eb.vy = Math.sin(ang) * defaultSpeed;
  } else {
    eb.speed = defaultSpeed;
    eb.angle = 0;
    eb.vx = defaultSpeed; eb.vy = 0;
  }
}

// Heuristic: treat a projectile as "boss" if any of these flags are set.
// (Keeps zombies bullets unchanged while letting boss ones scale up.)
function isBossOwned(eb) {
  return !!(eb.isBoss || eb.fromBoss || eb.owner === "boss");
}

export function updateEnemyBullets(ctx, onHitTank) {
  if (!isCanvasCtx(ctx)) {
    onHitTank = typeof arguments[1] === "function" ? arguments[1] : onHitTank;
    ctx = state.ctx;
  }
  if (!isCanvasCtx(ctx)) return;

  const canvas = state.canvas;
  if (!canvas) return;

  const hitFn = typeof onHitTank === "function" ? onHitTank : () => false;

  try { ctx.setTransform(1, 0, 0, 1, 0, 0); } catch {}

  for (let i = state.enemyBullets.length - 1; i >= 0; i--) {
    const eb = state.enemyBullets[i];

    if (!eb._enemyKinematicsLocked) {
      normalizeEnemyKinematics(eb);
      eb._enemyKinematicsLocked = true;
    }

    let vx = Number.isFinite(eb.vx) ? eb.vx : Math.cos(eb.angle || 0) * (eb.speed || 0);
    let vy = Number.isFinite(eb.vy) ? eb.vy : Math.sin(eb.angle || 0) * (eb.speed || 0);

    if (Number.isFinite(eb.gravity) && eb.gravity !== 0) {
      vy += eb.gravity;
      eb.vy = vy;
    }

    eb.x += vx;
    eb.y += vy;

    const img = (eb.type && resources.images?.[eb.type]) || resources.images?.["ammo.png"];

    // --- draw + collide with scale for boss-owned projectiles ---
    const baseW = (eb.width || 20);
    const baseH = (eb.height || 20);
    const scale = isBossOwned(eb) ? BOSS_PROJ_SCALE : 1.0;

    const w = Math.round(baseW * scale);
    const h = Math.round(baseH * scale);

    // Center the scaled sprite on the old top-left so the trail feels consistent
    const drawX = Math.round(eb.x - (w - baseW) / 2);
    const drawY = Math.round(eb.y - (h - baseH) / 2);

    drawSpriteOrRect(ctx, img, drawX, drawY, w, h, "#ffc107");

    // Use the SCALED hitbox for collision callback
    const hitbox = { ...eb, x: drawX, y: drawY, width: w, height: h };
    if (hitFn(hitbox, i)) continue;

    // Bounds using drawn rect
    if (
      drawX < -40 || drawX > canvas.width + 40 ||
      drawY < -40 || drawY > canvas.height + 40
    ) {
      state.enemyBullets.splice(i, 1);
    } else if (Number.isFinite(eb.ttl)) {
      eb.ttl--;
      if (eb.ttl <= 0) state.enemyBullets.splice(i, 1);
    }
  }
}
