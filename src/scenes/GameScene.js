// src/scenes/GameScene.js
import { state, playSound } from "../core/state.js";
import { constants } from "../core/constants.js";
import { resources } from "../assets/resources.js";
import { updatePlayerBullets, updateEnemyBullets } from "../systems/projectiles.js";
import { nextRound, updateZombies } from "../systems/spawn.js";
import { isColliding } from "../systems/collisions.js";
import { drawTank } from "../render/tank.js";
import { drawZombies } from "../render/zombies.js";
import { initSlugs, spawnSlugFromKill, updateAndRenderSlugs } from "../systems/slug.js";
import { applyScreenEffects } from "../render/effects.js";
import { drawHUD, drawCombo, publishHUDHeightOnly } from "../render/hud.js";
import { drawBossHealthBar } from "../render/bossHud.js";
import { showEndScreen } from "../ui/screens.js";
import { Boss, bossDefinitions } from "../systems/boss.js";

import { startKurtzIntro, isKurtzIntroActive, updateAndRenderKurtzIntro } from "../ui/kurtzIntro.js";
import { triggerNextLoreBeat, updateAndRenderLore } from "../ui/lore.js";

import { initIntel, grantIntel, hasAllIntel } from "../systems/intel.js";

import {
  initNapalmState,
  resetNapalm,
  bumpBossHitStreak,
  triggerNapalmStrike,
  updateAndRenderNapalm,
  drawNapalmHUD,
  drawNapalmOverlay,
  registerNapalmKill
} from "../systems/napalm.js";

import {
  initRoachComms,
  roachEvent,
  updateAndRenderRoach
} from "../systems/roach.js";

// FX (kept; we also add a tiny local animator to guarantee specific frames)
import { initFx, spawnFxExplosion, updateAndRenderFx } from "../systems/fx.js";

// Story cards
import {
  renderStoryCards,
  isStoryCardActive,
  cardAfterKatanaJoe,
  cardBeforeDrSlime,
  cardBeforeDDNukes,
  cardAfterDDNukes_Reveal
} from "../story/storyCards.js";

/* ---- global knobs ---- */
const DROP_SCALE = (constants?.dropScale ?? 1.5);

// --- feature knobs ---
const ATOMIC_STREAK     = 12;
const MEATGRINDER_SCORE = 1000;
const FLAME_SPAWN_MS    = 55;

/* helpers */
function hasShieldActive() { return (state.shieldUntil || 0) > Date.now(); }
function bossLineForName(name) {
  const k = (name || "").toLowerCase();
  if (k.includes("kurtz")) return "you're an errand boy...";
  if (k.includes("katana") || k.includes("joe")) return "ready to slice!";
  if (k.includes("melissa")) return "i can teach you how to use this.";
  return "prepare yourself.";
}
function easeOutBack(u, s = 1.70158) { const t = u - 1; return 1 + (t*t*((s+1)*t+s)); }
function dampedPulse(tMs, amp = 0.06, decayMs = 1200, freqHz = 6) {
  const a = amp * Math.exp(-tMs / decayMs); return 1 + a * Math.sin(2 * Math.PI * freqHz * (tMs / 1000));
}
function tinyShake(tMs, mag = 1.2) {
  const x = Math.sin(tMs * 0.021) + Math.sin(tMs * 0.037) * 0.5;
  const y = Math.cos(tMs * 0.017) + Math.sin(tMs * 0.029) * 0.5;
  return { x: x * mag, y: y * (mag * 0.6) };
}

// name normalization
function _normName(s) { return String(s || "").toLowerCase().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ").trim(); }
function _hasAll(name, ...tokens) { const n = _normName(name); return tokens.every(t => n.includes(_normName(t))); }
function _hasAny(name, ...tokens) { const n = _normName(name); return tokens.some(t => n.includes(_normName(t))); }

/* ---------- Tiny local sprite animator (guarantees our specific frames show) ---------- */
function pushLocalAnim(opts) {
  // opts: {framesKeys:[], x,y,w,h, frameMs, lifeMs, additive?, shake?, center?, globalAlpha?}
  if (!state._localAnims) state._localAnims = [];
  const now = performance.now?.() ?? Date.now();
  state._localAnims.push({
    ...opts,
    start: now,
    lastFrame: now,
    idx: 0,
  });
}
function updateAndRenderLocalAnims(ctx, now) {
  if (!state._localAnims || !state._localAnims.length) return;
  for (let i = state._localAnims.length - 1; i >= 0; i--) {
    const a = state._localAnims[i];
    const t = now - a.start;
    if (a.lifeMs && t > a.lifeMs) { state._localAnims.splice(i, 1); continue; }

    if (a.frameMs && now - a.lastFrame >= a.frameMs) {
      a.lastFrame = now;
      a.idx = (a.idx + 1) % Math.max(1, a.framesKeys.length);
    }
    const key = a.framesKeys[a.idx] || a.framesKeys[0];
    const img = resources?.images?.[key];
    if (!img) continue;

    const w = a.w|0, h = a.h|0;
    const x = (a.center ? Math.round(a.x - w/2) : a.x|0);
    const y = (a.center ? Math.round(a.y - h/2) : a.y|0);

    ctx.save();
    if (a.additive) ctx.globalCompositeOperation = "lighter";
    if (Number.isFinite(a.globalAlpha)) ctx.globalAlpha = a.globalAlpha;
    ctx.drawImage(img, x, y, w, h);
    ctx.restore();
  }
}

/* backgrounds */
function drawLockedJungleBackground(ctx) {
  const key = state.currentBgName || "bg_jungle1.png";
  const img = resources.images[key];
  const cw = state.canvas.width, ch = state.canvas.height;
  if (img && (img.width || img instanceof HTMLCanvasElement)) {
    const iw = img.width, ih = img.height;
    const scale = Math.max(cw / iw, ch / ih);
    const w = Math.ceil(iw * scale);
    const h = Math.ceil(ih * scale);
    const x = Math.floor((cw - w) / 2);
    const y = Math.floor((ch - h) / 2);
    ctx.drawImage(img, x, y, w, h);
  } else {
    ctx.fillStyle = "#072b0a";
    ctx.fillRect(0, 0, cw, ch);
  }
}

function drawBossBackdrop(ctx) {
  let key = null;
  if (state.bossAnnouncementShowing) {
    const def = bossDefinitions[state.bossIndex] || {};
    key = def.backdrop;
  } else if (state.bossActive && state.boss && state.boss.backdrop) {
    key = state.boss.backdrop;
  }
  if (!key) return;
  const img = resources.images[key];
  if (!img) return;
  const cw = state.canvas.width, ch = state.canvas.height;
  const iw = img.width, ih = img.height;
  if (!iw || !ih) return;
  const scale = Math.max(cw / iw, ch / ih);
  const w = Math.ceil(iw * scale);
  const h = Math.ceil(ih * scale);
  const x = Math.floor((cw - w) / 2);
  const y = Math.floor((ch - h) / 2);
  ctx.drawImage(img, x, y, w, h);
}

/* boss intro card (lighter backdrop) */
function initBossIntro() {
  const def  = bossDefinitions[state.bossIndex] || {};
  const name = def.name || "BOSS";
  const img  = def.image ? resources.images[def.image] : null;
  state._bossIntro = {
    name,
    line: (def.quote && String(def.quote).trim()) ? def.quote : bossLineForName(name),
    img,
    startedAt: 0, typedChars: 0, lastType: 0,
    typeSpeed: 90, preDelay: 600, doneHold: 1800,
    heightScale: 1.0, sideCrop: 0.8, floatAmp: 8,
  };
}
function drawBossIntro(ctx, now) {
  const bi = state._bossIntro;
  if (!bi) return;

  if (!bi.startedAt) bi.startedAt = now;
  if (!bi.lastType)  bi.lastType  = now + bi.preDelay - bi.typeSpeed;
  if (!bi._hdr) {
    bi._hdr = {
      text: "", cw: 0, ch: 0, x: 0, y: 0,
      mask: document.createElement("canvas"),
      needsRaster: true, maskData: null,
      font: "900 22px monospace", fillStyle: "#ff3b3b",
      shadowColor: "rgba(255,60,60,0.6)", shadowBlur: 18,
    };
  }
  if (!bi.drips) bi.drips = [];

  const W = state.canvas.width, H = state.canvas.height;

  ctx.save();
  // Lighter dim so backdrop shows through better (was 0.78)
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.fillRect(0, 0, W, H);

  const header = "INCOMING  —  " + (bi.name || "BOSS").toUpperCase();
  const headerX = Math.floor(W * 0.50), headerY = 36;

  const t0 = bi.startedAt || now, t = now - t0;
  const enterDur = 500, enterN = Math.min(1, t / enterDur);
  const enterOff = (1 - easeOutBack(enterN)) * 24;
  const s = dampedPulse(t, 0.065, 1400, 5.5);
  const wob = Math.sin(t * 0.004) * 0.04;
  const shake = tinyShake(t, 0.9);
  const flashOn = (t % 600) < 110, flashAlpha = flashOn ? 0.35 : 0;

  ctx.save();
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.font = "900 34px monospace";
  ctx.shadowColor = "rgba(255,60,60,0.6)"; ctx.shadowBlur = 18;
  ctx.translate(headerX + shake.x, headerY + enterOff + shake.y);
  ctx.transform(1, wob, -wob, 1, 0, 0);
  ctx.scale(s, s);
  ctx.globalCompositeOperation = "lighter";
  ctx.fillStyle = `rgba(70, 255, 255, ${0.55 + flashAlpha})`; ctx.fillText(header, 1.6, 0);
  ctx.fillStyle = `rgba(255, 60, 60, ${0.7 + flashAlpha})`;  ctx.fillText(header, -1.6, 0);
  ctx.fillStyle = `rgba(255, 59, 59, 0.95)`;                  ctx.fillText(header, 0, 0);
  if (((t / 16) | 0) % 2 === 0) { ctx.globalAlpha = 0.92; ctx.fillText(header, 0, 0); }
  ctx.restore();

  const hdr = bi._hdr;
  if (hdr.text !== header || hdr.cw !== W || hdr.ch !== H) {
    hdr.text = header; hdr.cw = W; hdr.ch = H; hdr.needsRaster = true;
  }
  if (hdr.needsRaster) {
    const mctx = hdr.mask.getContext("2d");
    const headerWidth = ctx.measureText(header).width;
    hdr.mask.width = Math.max(1, Math.floor(headerWidth) + 24);
    hdr.mask.height = 48;
    mctx.clearRect(0, 0, hdr.mask.width, hdr.mask.height);
    mctx.save();
    mctx.textAlign = "center"; mctx.textBaseline = "middle";
    mctx.fillStyle = "#ffffff"; mctx.font = hdr.font;
    mctx.fillText(header, hdr.mask.width / 2, hdr.mask.height / 2);
    mctx.restore();

    const worldWidth = headerWidth;
    hdr.x = Math.round(headerX - worldWidth / 2) - 12;
    hdr.y = Math.round(headerY - hdr.mask.height / 2);

    const maskCtx = hdr.mask.getContext("2d", { willReadFrequently: true });
    hdr.maskData = maskCtx.getImageData(0, 0, hdr.mask.width, hdr.mask.height).data;
    hdr.needsRaster = false;
  }

  const floatY = Math.sin(now / 480) * bi.floatAmp;
  const portrait = bi.img;
  if (portrait instanceof HTMLImageElement || portrait instanceof HTMLCanvasElement) {
    const maxH = Math.floor(H * bi.heightScale);
    const ratio = (portrait.width / portrait.height) || 1;
    const h = maxH;
    const w = Math.round(h * ratio);
    const x = Math.floor(W - w * bi.sideCrop);
    const y = Math.floor(H * 0.18 - h * 0.1 + floatY);
    ctx.drawImage(portrait, x, y, w, h);
  }

  // typing body
  const leftPad = Math.floor(W * 0.32);
  const colWidth = Math.floor(W * 0.46);
  const midY = Math.floor(H * 0.50);

  if (now - bi.lastType >= bi.typeSpeed && bi.typedChars < bi.line.length) {
    bi.typedChars++; bi.lastType = now; if (bi.typedChars === bi.line.length) bi.doneAt = now;
  }

  const typed = bi.line.slice(0, bi.typedChars);
  ctx.textAlign = "left"; ctx.textBaseline = "middle";
  ctx.shadowColor = "rgba(255,60,60,0.6)"; ctx.shadowBlur = 18;
  ctx.fillStyle = "#ff3b3b"; ctx.font = "900 28px monospace";

  const lineH = 40;
  const words = typed.split(" ");
  let line = ""; let y = midY - lineH;
  for (let i = 0; i < words.length; i++) {
    const test = (line ? line + " " : "") + words[i];
    if (ctx.measureText(test).width > colWidth && line) {
      ctx.fillText(line, leftPad, y); line = words[i]; y += lineH;
    } else line = test;
  }
  if (line) ctx.fillText(line, leftPad, y);

  if (bi.typedChars < bi.line.length) {
    if (Math.floor(now / 400) % 2 === 0) {
      const caretX = leftPad + ctx.measureText(line).width + 12;
      ctx.fillText("▌", caretX, y);
    }
  }

  // simple header drips (unchanged)
  const spawnEveryMs = 36;
  if (!bi._lastDripSpawn) bi._lastDripSpawn = now;

  function sampleSpawnPoints(count) {
    const pts = [];
    const row = Math.floor(bi._hdr.mask.height / 2);
    const data = bi._hdr.maskData, w = bi._hdr.mask.width;
    for (let i = 0; i < count; i++) {
      for (let tries = 0; tries < 6; tries++) {
        const col = (Math.random() * w) | 0;
        const idx = ((row * w + col) << 2) + 3;
        if (data[idx] > 24) { pts.push({ x: bi._hdr.x + col, y: bi._hdr.y + row + 2 }); break; }
      }
    }
    return pts;
  }

  if (now - bi._lastDripSpawn >= spawnEveryMs) {
    bi._lastDripSpawn = now;
    const heat = Math.max(0, 1 - (now - bi.startedAt) / 2000);
    const toSpawn = 1 + ((Math.random() < 0.5 + 0.5 * heat) ? 1 : 0);
    const bases = sampleSpawnPoints(toSpawn);
    if (!bi.drips) bi.drips = [];
    for (const b of bases) {
      const speed = 0.5 + Math.random() * 1.4;
      const len   = 8 + Math.random() * (24 + 24 * heat);
      const w     = Math.random() < 0.2 ? 3 : 2;
      const life  = 450 + Math.random() * 700;
      const swayA = 4 + Math.random() * 10;
      const swayF = 0.0015 + Math.random() * 0.0025;
      bi.drips.push({ x0: b.x + (Math.random() * 6 - 3), y0: b.y + 6, t0: now, speed, len, w, life, swayA, swayF });
    }
    if (bi.drips.length > 220) bi.drips.splice(0, bi.drips.length - 220);
  }

  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, W, Math.max(0, bi._hdr.y + 220));
  ctx.clip();
  ctx.globalCompositeOperation = "lighter";
  for (let i = bi.drips.length - 1; i >= 0; i--) {
    const d = bi.drips[i];
    const t = now - d.t0;
    if (t > d.life) { bi.drips.splice(i, 1); continue; }
    const fall = t * d.speed;
    const headX = d.x0 + Math.sin((d.t0 + t) * d.swayF) * d.swayA;
    const headY = d.y0 + fall;
    const ageFade = 1 - t / d.life;
    const g = ctx.createLinearGradient(headX, headY - d.len, headX, headY + 1);
    g.addColorStop(0, `rgba(255,70,70,0)`);
    g.addColorStop(0.35, `rgba(255,70,70,${0.35 * ageFade})`);
    g.addColorStop(0.75, `rgba(255,30,30,${0.75 * ageFade})`);
    g.addColorStop(1, `rgba(255,20,20,${1.0 * ageFade})`);
    ctx.fillStyle = g;
    const x = Math.round(headX - d.w / 2);
    const y0 = Math.round(headY - d.len);
    const y1 = Math.round(headY);
    ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x + d.w, y0); ctx.lineTo(x + d.w, y1); ctx.lineTo(x, y1); ctx.closePath(); ctx.fill();
    ctx.shadowColor = "rgba(255,60,60,0.8)"; ctx.shadowBlur = 10;
    ctx.fillStyle = `rgba(255,80,80,${0.9 * ageFade})`;
    ctx.beginPath(); ctx.arc(headX, headY, d.w * 0.9, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();

  if (bi.typedChars >= bi.line.length && now - bi.doneAt >= bi.doneHold) startBossFight();
  ctx.restore();
}

/* ---------- Atomic switch + detonation ---------- */

/* spawns on ground line above HUD; modest size (visible before contact) */
function spawnAtomicSwitchNearPlayer() {
  const imgKey = "switch.png"; // matches resources.js
  const img = resources?.images?.[imgKey];

  const TARGET = 24;
  const MIN_SZ = 16;
  const MAX_SZ = 28;

  let w = TARGET, h = TARGET;
  if (img && img.width && img.height) {
    const r = img.width / img.height;
    if (r >= 1) { w = TARGET; h = Math.max(MIN_SZ, Math.min(MAX_SZ, Math.round(TARGET / r))); }
    else       { h = TARGET; w = Math.max(MIN_SZ, Math.min(MAX_SZ, Math.round(TARGET * r))); }
  }
  w = Math.max(MIN_SZ, Math.min(MAX_SZ, w));
  h = Math.max(MIN_SZ, Math.min(MAX_SZ, h));

  const hudH = (state.bottomBarHeight | 0) || 96;
  const groundY = state.canvas.height - hudH;
  const px = (state.tank.x || 0) + (state.tank.width || 64) / 2;
  const margin = 8;

  const x = Math.min(Math.max(Math.round(px - w / 2), margin), state.canvas.width - w - margin);
  const y = Math.max(0, Math.round(groundY - h - 2));

  if (!Array.isArray(state.powerups)) state.powerups = [];
  state.powerups = state.powerups.filter(p => p.kind !== "atomic_switch"); // only one

  state.powerups.push({ kind: "atomic_switch", x, y, width: w, height: h, imgKey, floatT: 0, spawnedAt: Date.now() });
}

/* Big ribbon text */
function drawArcadeRibbon(ctx, text) {
  const t = Date.now();
  const W = state.canvas.width;
  const yBase = 72 + Math.sin(t * 0.012) * 6;
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "900 40px monospace";
  const beat = (t % 500) < 120 ? 1 : 0;
  ctx.globalCompositeOperation = "lighter";
  ctx.shadowColor = "rgba(255,80,80,0.9)";
  ctx.shadowBlur = 20 + beat * 6;
  ctx.fillStyle = "rgba(80,255,255,0.75)";
  ctx.fillText(text, W / 2 + 2, yBase);
  ctx.fillStyle = "rgba(255,60,60,0.9)";
  ctx.fillText(text, W / 2 - 2, yBase);
  ctx.fillStyle = "#ffffff";
  ctx.fillText(text, W / 2, yBase);
  ctx.restore();
}

/* Full-screen meltdown (opaque), long ribbon notice, wipes world immediately */
function triggerAtomicExplosion() {
  const now = performance.now?.() ?? Date.now();

  // Ribbon persists well after (so it's obvious)
  state._atomicRibbonUntil = Date.now() + 4200;

  // strong flash + shake
  state.flashWhite  = Math.max(state.flashWhite || 0, 1.0);
  state.screenShake = Math.max(state.screenShake || 0, 38);

  // Build a grid of animated atomic tiles (opaque) ~2.6s
  const frames = ["atomic1.png","atomic2.png","atomic3.png","atomic4.png","atomic5.png"];
  const cell = 160;
  for (let y = 0; y < state.canvas.height; y += cell) {
    for (let x = 0; x < state.canvas.width; x += cell) {
      pushLocalAnim({
        framesKeys: frames,
        x: x + cell / 2,
        y: y + cell / 2,
        w: cell + 80,
        h: cell + 80,
        frameMs: 58,
        lifeMs: 2600,
        additive: true,
        center: true,
        globalAlpha: 1.0 // OPAQUE tiles (no placeholder vibe)
      });
    }
  }

  // wipe world immediately (gameplay effect)
  state.zombies.length = 0;
  state.enemyBullets.length = 0;
  state.bossProjectiles.length = 0;
  if (state.boss && state.boss.isAlive) state.boss.health = 0;

  // white overlay fade (kept a bit longer)
  state._atomicOverlay = { start: now, dur: 2600 };

  // boom
  try {
    const s = resources?.audio?.explosion || resources?.audio?.["explosion.mp3"];
    if (s && playSound) playSound(s);
  } catch {}
}

/* ---------- UI bits ---------- */
function drawMeatgrinderGlow(ctx, now) {
  if (!state.meatgrinderMode) return;
  const t = now || Date.now();
  const pad = 20;
  const x = state.tank.x - pad;
  const y = state.tank.y - pad;
  const w = state.tank.width + pad * 2;
  const h = state.tank.height + pad * 2;

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const cx = x + w / 2, cy = y + h / 2;
  const r = Math.max(w, h) * (0.48 + 0.03 * Math.sin(t * 0.008));
  const g = ctx.createRadialGradient(cx, cy, r * 0.12, cx, cy, r);
  g.addColorStop(0.0, "rgba(255, 90, 90, 0.35)");
  g.addColorStop(0.6, "rgba(255, 40, 40, 0.12)");
  g.addColorStop(1.0, "rgba(255, 0, 0, 0.0)");
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

/* Robust grinder frames resolver (resources.js uses grind1..5.png) */
function getGrinderFrames() {
  const has = k => !!resources?.images?.[k];
  const grind   = ["grind1.png","grind2.png","grind3.png","grind4.png","grind5.png"];
  return grind.filter(has);
}

/* --- Overlay Gate UI: draw a soft control strip and block Space --- */
function overlayGateActive() {
  return (typeof isKurtzIntroActive === "function" && isKurtzIntroActive())
      || (typeof isStoryCardActive === "function" && isStoryCardActive());
}

function drawOverlayGate(ctx) {
  const W = state.canvas.width, H = state.canvas.height;
  const text = "Next (Enter)   ·   Skip (Esc)";
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "900 22px monospace";
  ctx.globalCompositeOperation = "lighter";
  ctx.shadowColor = "rgba(255,80,80,0.7)";
  ctx.shadowBlur = 14;

  // pill
  const padX = 22, padY = 10;
  const tw = ctx.measureText(text).width;
  const bx = Math.round(W/2 - (tw/2 + padX));
  const by = Math.round(H - 80);
  const bw = Math.round(tw + padX*2);
  const bh = 40;

  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.fillRect(bx, by, bw, bh);

  ctx.fillStyle = "rgba(80,255,255,0.9)";
  ctx.fillText(text, W/2 + 2, by + bh/2);
  ctx.fillStyle = "rgba(255,60,60,0.95)";
  ctx.fillText(text, W/2 - 2, by + bh/2);
  ctx.fillStyle = "#ffffff";
  ctx.fillText(text, W/2, by + bh/2);

  ctx.restore();
}

/* Scene */
export class GameScene {
  enter() {
    state.gameStarted = true;

    state.canvas = document.getElementById("gameCanvas");
    state.ctx = state.canvas.getContext("2d");

    state.canvas.style.display = "block";
    const startScreen = document.getElementById("start-screen");
    if (startScreen) startScreen.style.display = "none";

    const baseHUD = Number.isFinite(constants?.bottomBarHeight) ? constants.bottomBarHeight : 96;
    state.bottomBarHeight = (baseHUD + 2) | 0;

    state.tank = { x: 200, y: 300, width: 126, height: 96 };
    state.health = 100;

    state.ammo = constants?.ammoInfinite ? Number.POSITIVE_INFINITY
              : Number.isFinite(constants?.startingAmmo) ? constants.startingAmmo
              : 50;

    state.score = 0;
    state.round = 1;
    state.zombies = [];
    state.bullets = [];
    state.enemyBullets = [];
    state.ammoDrops = [];
    state.medkitDrops = [];

    // Feature state
    state.killStreak = 0;
    state._spawnedAtomicForThisStreak = false;
    state.powerups = [];
    state.meatgrinderMode = false;
    state._lastFlameAt = 0;

    // ribbons/overlays
    state._atomicRibbonUntil = 0;
    state._atomicOverlay = null;
    state._localAnims = [];

    // overlay gate
    state._overlayCancelRequested = false;

    state.bossIndex = Number.isFinite(state.bossIndex) ? state.bossIndex : 0;

    const fallbackThreshold = 10;
    state.bossTriggerCount =
      (constants?.bossTriggerThresholds && Number.isFinite(constants.bossTriggerThresholds[state.bossIndex]))
        ? constants.bossTriggerThresholds[state.bossIndex]
        : fallbackThreshold;

    state.bossActive = false;
    state.bossDefeated = false;
    state.bossAnnouncementShowing = false;

    state.bossProjectiles = [];

    if (state.resourcesLoaded && resources.audio.bgm) {
      resources.audio.bgm.loop = true;
      resources.audio.bgm.volume = 0.5;
      resources.audio.bgm.play().catch(() => {});
    }

    initSlugs();
    initFx();
    state.scene = this;

    initNapalmState();
    this._onNapalmKey = (e) => {
      if ((e.key === "n" || e.key === "N") && state.napalm?.ready && !state.bossAnnouncementShowing && !isStoryCardActive()) {
        e.preventDefault();
        triggerNapalmStrike();
      }
    };
    window.addEventListener("keydown", this._onNapalmKey);

    // Overlay gate keys: block Space; allow Enter/Esc hints
    this._onOverlayKeys = (e) => {
      if (!overlayGateActive()) return;
      const k = e.key;
      // Block space to prevent accidental skips in overlay systems that use it
      if (k === " " || k === "Spacebar" || k === "Space") { e.preventDefault(); e.stopPropagation(); }
      // Esc to request cancel (module may or may not respect; we keep the UI consistent)
      if (k === "Escape" || k === "Esc") { e.preventDefault(); state._overlayCancelRequested = true; }
      // Enter is passed through intentionally (many overlays advance on Enter/Click)
    };
    window.addEventListener("keydown", this._onOverlayKeys, true);

    initRoachComms();
    roachEvent("ROUND_START", { round: state.round });

    initIntel();

    state.currentBgName = state.currentBgName || "bg_jungle1.png";

    if (!state._didColdOpenIntro) {
      state._didColdOpenIntro = true;
      startKurtzIntro({
        lines: [
          "TERMINAL: REDLINE UPLINK—FRAGMENTS SYNCED.",
          "SUBJECT: COL. KURTZ // STATUS: UNCONTAINED.",
          "HE WALKED OFF THE MAP—AND THE MAP GREW TEETH.",
          "FOLLOW THE REDLINE. FIND THE SOURCE. OR BECOME IT."
        ],
        bgImageKey: "introkurtz.png",
        portraitKey: "kurtz.png",
        holdAfterMs: 900
      });
    }

    nextRound();
  }

  exit() {
    if (this._onNapalmKey) window.removeEventListener("keydown", this._onNapalmKey);
    if (this._onOverlayKeys) window.removeEventListener("keydown", this._onOverlayKeys, true);
  }

  onPlayerHit(amount = 10, fromCollision = false) {
    if (hasShieldActive()) {
      try { playSound && resources?.audio?.fxPickup && playSound(resources.audio.fxPickup); } catch {}
      state.flashWhite = Math.max(state.flashWhite || 0, 0.15);
      state.screenShake = Math.max(state.screenShake || 0, fromCollision ? 8 : 6);
      return;
    }
    state.health = Math.max(0, (state.health || 0) - amount);
    try { playSound && resources?.audio?.fxHurt && playSound(resources.audio.fxHurt); } catch {}
    state.flashRed = Math.max(state.flashRed || 0, fromCollision ? 0.4 : 0.25);
    state.screenShake = Math.max(state.screenShake || 0, fromCollision ? 10 : 7);
    if (state.health <= 0) this.gameOver();

    state.killStreak = 0;
    state._spawnedAtomicForThisStreak = false;
  }

  update(now) {
    const ctx = state.ctx;

    try { ctx.setTransform(1, 0, 0, 1, 0, 0); } catch {}
    ctx.clearRect(0, 0, state.canvas.width, state.canvas.height);

    // overlays guard (we still draw a gate strip on top)
    if (isKurtzIntroActive && isKurtzIntroActive()) {
      updateAndRenderKurtzIntro(ctx, now);
      drawOverlayGate(ctx);
      return;
    }
    if (isStoryCardActive && isStoryCardActive()) {
      renderStoryCards(ctx, now);
      drawOverlayGate(ctx);
      return;
    }

    ctx.save();
    applyScreenEffects(ctx);

    // World
    drawLockedJungleBackground(ctx);

    // Publish HUD height
    publishHUDHeightOnly(ctx);
    const __hudH = (state.bottomBarHeight | 0) || 96;

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, state.canvas.width, state.canvas.height);
    ctx.clip();

    drawBossBackdrop(ctx);

    if (state.bossAnnouncementShowing) {
      drawBossIntro(ctx, now);
      ctx.restore(); ctx.restore();
      // Canvas HUD disabled; publish height for layout only
      publishHUDHeightOnly(ctx);
      updateAndRenderRoach(ctx, now);
      drawCombo(ctx);
      updateAndRenderLore(ctx, now);
      return;
    }

    // Input & movement (smooth keyboard like mouse)
    if (!state.inputLocked) {
      const maxSpeed = 14; // faster than before
      const smooth = 0.35; // smoothing factor for acceleration
      const dirX = (state.keyRight ? 1 : 0) - (state.keyLeft ? 1 : 0);
      state._keyVX = Number.isFinite(state._keyVX) ? state._keyVX : 0;
      const targetVX = dirX * maxSpeed;
      state._keyVX += (targetVX - state._keyVX) * smooth;
      state.tank.x += state._keyVX;
      // keep vertical anchored to bottom; ignore up/down for now
    }

    // Hook drag
    if ((state._dragUntil || 0) > 0 && state._dragVec) {
      state.tank.x += state._dragVec.x;
      state.tank.y += state._dragVec.y;
      state._dragUntil--;
      if (state._dragUntil <= 0) state._dragVec = null;
    }

    // Clamp to arena (pin just above HUD)
    state.tank.x = Math.max(0, Math.min(state.canvas.width - state.tank.width, state.tank.x));
    const __bottomLimit  = state.canvas.height - __hudH - state.tank.height;
    state.tank.y = __bottomLimit;
    state.tank.x = Math.round(state.tank.x);

    try { ctx.globalAlpha = 1; ctx.setTransform(1, 0, 0, 1, 0, 0); } catch {}

    // Shield
    if (hasShieldActive()) {
      const img = resources?.images?.["shield.png"];
      ctx.save(); ctx.globalAlpha = 0.7;
      if (img instanceof HTMLImageElement || img instanceof HTMLCanvasElement) {
        const w = state.tank.width * 1.10, h = state.tank.height * 1.10;
        const x = state.tank.x + state.tank.width * 0.5 - w * 0.5;
        const y = state.tank.y + state.tank.height * 0.5 - h * 0.5;
        ctx.drawImage(img, x, y, w, h);
      } else {
        ctx.strokeStyle = "rgba(143,232,143,0.9)";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.ellipse(state.tank.x + state.tank.width/2, state.tank.y + state.tank.height/2, state.tank.width*0.6, state.tank.height*0.6, 0, 0, Math.PI*2);
        ctx.stroke();
      }
      ctx.restore();
    }

    // Projectiles
    updatePlayerBullets(ctx);
    updateEnemyBullets(ctx, (eb, i) => {
      if (isColliding(eb, state.tank)) {
        if (hasShieldActive()) { try { playSound && resources?.audio?.fxPickup && playSound(resources.audio.fxPickup); } catch {} }
        state.enemyBullets.splice(i, 1);
        if (hasShieldActive()) {
          state.flashWhite = Math.max(state.flashWhite || 0, 0.15);
          state.screenShake = Math.max(state.screenShake || 0, 6);
        } else {
          state.health -= 8;
          state.flashRed = Math.max(state.flashRed || 0, 0.18);
          state.screenShake = Math.max(state.screenShake || 0, 7);
        }
        return true;
      }
      return false;
    });

    if ((state.health || 0) <= 25) roachEvent("LOW_HEALTH");
    if (Number.isFinite(state.ammo) && (state.ammo || 0) <= 10) roachEvent("LOW_AMMO");
    if (state.napalm?.ready) { if (!state._napalmAnnounced) { roachEvent("NAPALM_READY"); state._napalmAnnounced = true; } }
    else state._napalmAnnounced = false;

    // Enemies
    updateZombies(
      now,
      (damage, boom) => {
        this.onPlayerHit(damage, true);
        if (boom) { try { playSound && resources?.audio?.fxExplosion && playSound(resources.audio.fxExplosion); } catch {} }
      },
      (killedZombie) => {
        const zx = (killedZombie.x || 0) + (killedZombie.width  || 32) / 2;
        const zy = (killedZombie.y || 0) + (killedZombie.height || 32) / 2;
        spawnFxExplosion("flesh", { x: zx, y: zy, sizePx: 72, maxPx: 96, shake: 7, frameMs: 60 });

        spawnSlugFromKill(killedZombie);
        registerNapalmKill(performance.now?.() ?? Date.now());
        if (!state.bossActive && !state.bossDefeated) state.bossTriggerCount = Math.max(0, (state.bossTriggerCount || 0) - 1);
        state.score = (state.score || 0) + 10;

        // kill streak & atomic switch
        state.killStreak = (state.killStreak || 0) + 1;
        if (state.killStreak >= ATOMIC_STREAK && !state._spawnedAtomicForThisStreak) {
          state._spawnedAtomicForThisStreak = true;
          spawnAtomicSwitchNearPlayer();
        }
      },
      (bullet) => state.enemyBullets.push(bullet)
    );

    // Shield Meatgrinder: grind enemies on contact (expanded shield box) with grinder frames
    if (hasShieldActive()) {
      const pad = Math.max(6, Math.round(Math.max(state.tank.width, state.tank.height) * 0.12));
      const shieldBox = { x: state.tank.x - pad, y: state.tank.y - pad, width: state.tank.width + pad * 2, height: state.tank.height + pad * 2 };
      const grinderFrames = getGrinderFrames();

      for (let zi = state.zombies.length - 1; zi >= 0; zi--) {
        const z = state.zombies[zi];
        const zHit = { x: z.x, y: z.y, width: z.width || 32, height: z.height || 48 };
        if (isColliding(zHit, shieldBox)) {
          const zx = z.x + (z.width||32)/2, zy = z.y + (z.height||32)/2;

          // guaranteed grinder sprite animation (local)
          if (grinderFrames.length) {
            pushLocalAnim({
              framesKeys: grinderFrames,
              x: zx, y: zy,
              w: 96, h: 96,
              frameMs: 45,
              lifeMs: 450,
              center: true,
              additive: true,
              globalAlpha: 0.98
            });
          } else {
            spawnFxExplosion("flesh", { x: zx, y: zy, sizePx: 72, maxPx: 96, shake: 8, frameMs: 45 });
          }

          // treat like a proper kill
          state.zombies.splice(zi, 1);
          state.score = (state.score||0) + 10;
          state.killStreak = (state.killStreak || 0) + 1;
          spawnSlugFromKill(z);
          registerNapalmKill(performance.now?.() ?? Date.now());
          if (!state.bossActive && !state.bossDefeated) {
            state.bossTriggerCount = Math.max(0, (state.bossTriggerCount || 0) - 1);
          }
          if (state.killStreak >= ATOMIC_STREAK && !state._spawnedAtomicForThisStreak) {
            state._spawnedAtomicForThisStreak = true;
            spawnAtomicSwitchNearPlayer();
          }
        }
      }
    }

    drawZombies(ctx);
    updateAndRenderSlugs(ctx, now);
    updateAndRenderNapalm(ctx, now);

    // Powerups (atomic)
    for (let i = state.powerups.length - 1; i >= 0; i--) {
      const p = state.powerups[i];
      p.floatT = (p.floatT || 0) + 0.05;
      const bob = Math.sin(p.floatT) * 2;

      const img = resources.images[p.imgKey];
      const w = p.width, h = p.height;
      const x = p.x, y = p.y + bob;

      if (img) ctx.drawImage(img, x, y, w, h);
      else { ctx.fillStyle = "#ffeb3b"; ctx.fillRect(x, y, w, h); }

      const hitbox = { x, y, width: w, height: h };
      if (isColliding(hitbox, state.tank)) {
        if (p.kind === "atomic_switch") triggerAtomicExplosion();
        state.powerups.splice(i, 1);
      }
    }

    // Drops: ammo
    for (let i = state.ammoDrops.length - 1; i >= 0; i--) {
      const drop = state.ammoDrops[i];
      if (typeof drop.dy === "number" && drop.dy !== 0) drop.y += drop.dy;

      const key = drop.type || "ammo2.png";
      const ammoImg = resources.images[key] || resources.images["ammo2.png"] || resources.images["ammo.png"];

      const w = Math.round(drop.width  * DROP_SCALE);
      const h = Math.round(drop.height * DROP_SCALE);
      const x = Math.round(drop.x - (w - drop.width)  / 2);
      const y = Math.round(drop.y - (h - drop.height) / 2);

      if (ammoImg instanceof HTMLImageElement || ammoImg instanceof HTMLCanvasElement) ctx.drawImage(ammoImg, x, y, w, h);
      else { ctx.save(); ctx.fillStyle = "#ffc107"; ctx.beginPath(); ctx.arc(x + w/2, y + h/2, w/2, 0, Math.PI*2); ctx.fill(); ctx.restore(); }

      const hitbox = { x, y, width: w, height: h };
      if (!drop._isSpecialAmmoBay && isColliding(hitbox, state.tank)) {
        if (!constants.ammoInfinite) state.ammo = Math.min((state.ammo || 0) + 15, constants.maxAmmo ?? 150);
        try { playSound && resources?.audio?.fxShot && playSound(resources.audio.fxShot); } catch {}
        state.ammoDrops.splice(i, 1);
        state.flashWhite = Math.max(state.flashWhite || 0, 0.25);
        continue;
      }
      if (y > state.canvas.height) state.ammoDrops.splice(i, 1);
    }

    // Drops: medkits
    for (let i = state.medkitDrops.length - 1; i >= 0; i--) {
      const drop = state.medkitDrops[i];
      if (typeof drop.dy === "number") drop.y += drop.dy;

      const key = drop.type || "medkit.png";
      const medImg = resources.images[key] || resources.images["medkit.png"];

      const w = Math.round(drop.width  * DROP_SCALE);
      const h = Math.round(drop.height * DROP_SCALE);
      const x = Math.round(drop.x - (w - drop.width)  / 2);
      const y = Math.round(drop.y - (h - drop.height) / 2);

      if (medImg instanceof HTMLImageElement || medImg instanceof HTMLCanvasElement) ctx.drawImage(medImg, x, y, w, h);
      else { ctx.save(); ctx.fillStyle = "#fff"; ctx.fillRect(x, y, w, h); ctx.restore(); }

      const hitbox = { x, y, width: w, height: h };
      if (isColliding(hitbox, state.tank)) {
        state.health = Math.min(state.health + 25, 100);
        try { playSound && resources?.audio?.fxPickup && playSound(resources.audio.fxPickup); } catch {}
        state.medkitDrops.splice(i, 1);
        state.flashWhite = Math.max(state.flashWhite || 0, 0.2);
        continue;
      }
      if (y > state.canvas.height) state.medkitDrops.splice(i, 1);
    }

    // Boss
    if (state.bossActive && state.boss && state.boss.isAlive) {
      state.boss.update(state.tank, state.bossProjectiles, state.canvas, __hudH);
      state.boss.render(ctx);

      try { ctx.setTransform(1,0,0,1,0,0); } catch {}
      ctx.save();
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1.0;

      for (let j = 0; j < state.bullets.length; j++) {
        const b = state.bullets[j];
        const img = (b.type && resources.images?.[b.type]) || resources.images?.["ammo1.png"];
        const w = Math.max(b.width || 16, 12), h = Math.max(b.height || 16, 12);
        if (img) ctx.drawImage(img, b.x, b.y, w, h);
        else { ctx.fillStyle = "#ffff66"; ctx.fillRect(b.x|0, b.y|0, w, h); }
      }

      for (let j = 0; j < state.enemyBullets.length; j++) {
        const eb = state.enemyBullets[j];
        const img = (eb.type && resources.images?.[eb.type]) || resources.images?.["ammo1.png"];
        const w = Math.max(eb.width || 16, 12), h = Math.max(eb.height || 16, 12);
        if (img) ctx.drawImage(img, eb.x, eb.y, w, h);
        else { ctx.fillStyle = "#ff6b6b"; ctx.fillRect(eb.x|0, eb.y|0, w, h); }
      }

      ctx.restore();

      drawBossHealthBar(ctx);

      if (state.boss?.events?.length) {
        for (const evt of state.boss.events) {
          if (evt.type === "bossQuote") roachEvent("BOSS_QUOTE", { who: evt.who, text: evt.text });
          if (evt.type === "bossArmor")  state._bossArmor = evt.armor;
          if (evt.type === "finalChoice") roachEvent("FINAL_CHOICE", evt);
        }
        state.boss.events.length = 0;
      }

      // Player bullets vs boss
      for (let i = state.bullets.length - 1; i >= 0; i--) {
        const bullet = state.bullets[i];
        if (isColliding(bullet, state.boss)) {
          state.boss.health--;
          state.bullets.splice(i, 1);
          bumpBossHitStreak(performance.now());
          if (state.boss.health <= 0) break;
        }
      }

      // Boss defeated
      if (state.boss.health <= 0) {
        const def = bossDefinitions[state.bossIndex] || {};
        roachEvent("BOSS_DEFEATED", { name: def.name || "Target" });

        state.boss.isAlive = false;
        state.bossActive = false;
        state.bossDefeated = true;

        const name = def.name || "";
        if (_hasAny(name, "katana", "katana joe", "joe")) { cardAfterKatanaJoe().then(() => continueAfterBossDefeated(def)); return; }
        if (_hasAll(name, "dd", "nukes") || _hasAny(name, "dd nukes")) { cardAfterDDNukes_Reveal().then(() => continueAfterBossDefeated(def)); return; }

        continueAfterBossDefeated(def);
        return;
      }
    }

    // ==== Boss projectiles ====
    for (let i = state.bossProjectiles.length - 1; i >= 0; i--) {
      const bp = state.bossProjectiles[i];

      if (!bp._vnorm) {
        if (bp.vx == null && bp.dx != null) bp.vx = bp.dx;
        if (bp.vy == null && bp.dy != null) bp.vy = bp.dy;
        delete bp.dx; delete bp.dy;
        bp._vnorm = true;
      }

      const detonateTimerBomb = () => {
        const cx = bp.x + (bp.width  || 32) / 2;
        const cy = bp.y + (bp.height || 32) / 2;
        spawnFxExplosion("tnt", { x: cx, y: cy, sizePx: 96, maxPx: 128, shake: 12, frameMs: 60 });
        try { const s = resources?.audio?.fxExplosion || resources?.audio?.explosion; if (s && playSound) playSound(s); } catch {}
        const R = 90;
        const tx = state.tank.x + state.tank.width / 2;
        const ty = state.tank.y + state.tank.height / 2;
        if (Math.hypot(tx - cx, ty - cy) <= R && !hasShieldActive()) state.health -= 24;
        state.screenShake = Math.max(state.screenShake || 0, 14);
        state.bossProjectiles.splice(i, 1);
      };

      if (Number.isFinite(bp.ttl)) { bp.ttl -= 1; if (bp.ttl <= 0) { state.bossProjectiles.splice(i,1); continue; } }
      if (Number.isFinite(bp.gravity) && bp.gravity !== 0) bp.vy = (bp.vy || 0) + bp.gravity;

      switch (bp.kind) {
        case "timer_bomb": {
          bp.fuse = (bp.fuse ?? 90) - 1;
          bp.blink = (bp.fuse <= (bp.blinkStart ?? 45));
          if (bp.fuse <= 0) { detonateTimerBomb(); continue; }
          break;
        }
        case "shock_ring": {
          bp.radius = (bp.radius ?? 6) + (bp.dr ?? 5.5);
          const cx = bp.x, cy = bp.y,
                tx = state.tank.x + state.tank.width / 2,
                ty = state.tank.y + state.tank.height / 2,
                d  = Math.hypot(tx - cx, ty - cy);
          if (Math.abs(d - bp.radius) < 14 && !hasShieldActive()) state.health -= 12;
          if (bp.radius > (bp.maxRadius ?? 260)) { state.bossProjectiles.splice(i,1); continue; }
          break;
        }
        case "puddle": {
          if (isColliding(
            { x: bp.x - bp.radius, y: bp.y - bp.radius, width: (bp.radius || 0) * 2, height: (bp.radius || 0) * 2 },
            state.tank
          )) { if (!hasShieldActive()) state.health -= 0.5; }
          break;
        }
        default: break;
      }

      bp.x += bp.vx || 0; bp.y += bp.vy || 0;

      try { state.ctx.setTransform(1,0,0,1,0,0); } catch {}
      state.ctx.globalCompositeOperation = "source-over";
      state.ctx.globalAlpha = 1.0;

      let img = null;
      const tryKey = (k) => { const v = k ? resources.images[k] : null; return (v && (v.width || v.height || typeof v.getContext === "function")) ? v : null; };
      img = tryKey(bp.type) || (state.boss && tryKey(state.boss.projectileType)) || tryKey("ammo1.png");

      const drawShockRing = () => {
        const r = bp.radius || 6;
        state.ctx.save();
        state.ctx.globalAlpha = 0.85;
        state.ctx.lineWidth = 6;
        state.ctx.strokeStyle = "rgba(255, 90, 90, 0.9)";
        state.ctx.beginPath();
        state.ctx.arc(bp.x, bp.y, r, 0, Math.PI * 2);
        state.ctx.stroke();
        state.ctx.restore();
      };

      if (bp.kind === "shock_ring") {
        drawShockRing();
      } else if (bp.kind === "sweep") {
        state.ctx.save();
        const w = Math.round(Math.max(bp.width || 64, 24) * 1.5);
        const h = Math.round(Math.max(bp.height || 20, 12) * 1.5);
        if (img) state.ctx.drawImage(img, bp.x, bp.y, w, h);
        else { state.ctx.fillStyle = "#e91e63"; state.ctx.beginPath(); state.ctx.arc(bp.x + w/2, bp.y + h/2, w, 0, Math.PI*2); state.ctx.fill(); }
        state.ctx.restore();
      } else if (bp.kind === "trail") {
        state.ctx.save();
        const w = Math.round(Math.max(bp.width || 24, 18) * 1.5);
        const h = Math.round(Math.max(bp.height || 24, 12) * 1.5);
        if (img) state.ctx.drawImage(img, bp.x, bp.y, w, h);
        else { state.ctx.fillStyle = "#ffcc66"; state.ctx.fillRect(bp.x, bp.y, w, h); }
        state.ctx.restore();
      } else if (bp.kind === "puddle") {
        // drawn as AOE only
      } else if (bp.kind === "timer_bomb") {
        const timg = resources.images[bp.type] || resources.images["tnt.png"];
        const baseW = Math.max(bp.width || 36, 24);
        const baseH = Math.max(bp.height || 36, 24);
        const pulse = bp.blink ? (1 + 0.08 * Math.sin((Date.now() / 80) | 0)) : 1;
        const w = Math.round(baseW * 1.5 * pulse);
        const h = Math.round(baseH * 1.5 * pulse);
        const x = (bp.x - ((w - baseW) >> 1)) | 0;
        const y = (bp.y - ((h - baseH) >> 1)) | 0;

        state.ctx.save();
        state.ctx.globalAlpha = 1.0;
        if (timg && (timg.width || timg.height)) state.ctx.drawImage(timg, x, y, w, h);
        else { state.ctx.fillStyle = bp.blink ? "#ff3b3b" : "#ffcc66"; state.ctx.fillRect(x, y, w, h); }
        state.ctx.restore();
      } else {
        state.ctx.save();
        const w = Math.round(Math.max(bp.width || 32, 20) * 1.5);
        const h = Math.round(Math.max(bp.height || 32, 20) * 1.5);
        if (img) state.ctx.drawImage(img, bp.x, bp.y, w, h);
        else { state.ctx.fillStyle = "#ffcc66"; state.ctx.fillRect(bp.x, bp.y, w, h); }
        state.ctx.restore();
      }

      const isAOE = (bp.kind === "shock_ring" || bp.kind === "puddle");
      if (!isAOE && isColliding(bp, state.tank)) {
        if (bp.kind === "timer_bomb") { detonateTimerBomb(); continue; }
        if (hasShieldActive()) {
          try { playSound && resources?.audio?.fxPickup && playSound(resources.audio.fxPickup); } catch {}
          state.flashWhite = Math.max(state.flashWhite || 0, 0.15);
          state.screenShake = Math.max(state.screenShake || 0, 6);
        } else {
          state.health -= 16;
          state.screenShake = Math.max(state.screenShake || 0, 15);
          state.flashRed = Math.max(state.flashRed || 0, 0.5);
        }
        state.bossProjectiles.splice(i, 1);
        continue;
      }

      if (bp.x < -60 || bp.x > state.canvas.width + 60 || bp.y < -60 || bp.y > state.canvas.height + 60) {
        state.bossProjectiles.splice(i, 1);
      }
    }

    ctx.restore(); // clip
    ctx.restore(); // world

    // Foreground
    drawMeatgrinderGlow(ctx, now); // subtle glow only; no text/ribbon
    drawTank(ctx);
    // Canvas HUD disabled; publish height for layout only
    publishHUDHeightOnly(ctx);
    drawNapalmHUD(state.ctx);
    drawNapalmOverlay(state.ctx, now);

  // Atomic ribbon (centered)
  if ((state._atomicRibbonUntil || 0) > Date.now()) { drawArcadeRibbon(ctx, "ATOMIC SWITCH ENGAGED!"); }

    // Narrative overlays
    updateAndRenderLore(ctx, now);
    updateAndRenderRoach(ctx, now);
    drawCombo(ctx);

    // FX systems
    updateAndRenderFx(ctx, now);
    updateAndRenderLocalAnims(ctx, now);

    // Atomic white overlay fade
    if (state._atomicOverlay) {
      const t = (now - state._atomicOverlay.start);
      const a = Math.max(0, 1 - t / state._atomicOverlay.dur) * 0.7;
      if (a > 0) {
        ctx.save();
        ctx.fillStyle = `rgba(255,255,255,${a})`;
        ctx.fillRect(0, 0, state.canvas.width, state.canvas.height);
        ctx.restore();
      } else {
        state._atomicOverlay = null;
      }
    }

    // --- Meatgrinder Mode trigger (sprite only; no text) ---
    if (!state.meatgrinderMode && (state.score || 0) >= MEATGRINDER_SCORE) {
      state.meatgrinderMode = true;
      state.tankSpriteKey = "tank3.png"; // sprite switch only
      state.screenShake = Math.max(state.screenShake || 0, 8);
    }

    // Flamethrower plume using flame1..5 (guaranteed via local animator)
    if (state.meatgrinderMode) {
      const t = now || Date.now();
      if (t - (state._lastFlameAt || 0) >= FLAME_SPAWN_MS) {
        state._lastFlameAt = t;

        const tx = state.tank.x + state.tank.width/2;
        const ty = state.tank.y;

        pushLocalAnim({
          framesKeys: ["flame1.png","flame2.png","flame3.png","flame4.png","flame5.png"],
          x: tx, y: ty - 24,
          w: 104, h: 104,
          frameMs: 38,
          lifeMs: 400,
          additive: true,
          center: true,
          globalAlpha: 0.98
        });

        const range = 180;
        for (let zi = state.zombies.length - 1; zi >= 0; zi--) {
          const z = state.zombies[zi];
          const zx = z.x + (z.width||32)/2;
          const zy = z.y + (z.height||32)/2;
          const dy = (ty - 12) - zy;
          const dx = Math.abs(zx - tx);
          const dist = Math.hypot(dx, dy);
          const inCone = (dy > -6) && (dy < range) && (dx < (40 + (dy*0.6)));
          if (inCone && dist < range) {
            // small flesh pop for the burn
            spawnFxExplosion("flesh", { x: zx, y: zy, sizePx: 56, maxPx: 72, frameMs: 45 });
            state.zombies.splice(zi, 1);
            state.score = (state.score||0) + 5;
            state.killStreak = (state.killStreak||0) + 1;
          }
        }
      }
    }

    if (state.health <= 0) { showEndScreen("fail"); return; }

    // Round loop
    if (!state.spawningInProgress && state.zombies.length === 0 && !state.bossActive && !state.bossAnnouncementShowing) {
      roachEvent("ROUND_CLEAR");
      setTimeout(() => {
        state.killStreak = 0;
        state._spawnedAtomicForThisStreak = false;

        nextRound();
        roachEvent("ROUND_START", { round: state.round });
        if (!isKurtzIntroActive() && !isStoryCardActive()) {
          triggerNextLoreBeat(performance.now?.() ?? Date.now());
        }
      }, 600);
      state.spawningInProgress = true;
    }

    // Boss trigger
    if (!state.bossActive && !state.bossDefeated && state.bossIndex < bossDefinitions.length) {
      if (state.bossTriggerCount <= 0 && !state.bossAnnouncementShowing) showBossAnnouncement();
    }
  }

  render() {}

  gameOver() {
    state.gameStarted = false;
    resetNapalm();
    showEndScreen("fail");
  }
}

/* boss announcement */
function showBossAnnouncement() {
  const def = bossDefinitions[state.bossIndex] || {};
  const nameL = def.name || "";
  state._didPreCardForThisBoss = state._didPreCardForThisBoss || {};

  if (!state._didPreCardForThisBoss[state.bossIndex]) {
    if (_hasAny(nameL, "dr slime", "dr. slime", "slime")) {
      state._didPreCardForThisBoss[state.bossIndex] = true;
      cardBeforeDrSlime().then(() => showBossAnnouncement());
      return;
    }
    if (_hasAll(nameL, "dd", "nukes") || _hasAny(nameL, "dd nukes")) {
      state._didPreCardForThisBoss[state.bossIndex] = true;
      cardBeforeDDNukes().then(() => showBossAnnouncement());
      return;
    }
    state._didPreCardForThisBoss[state.bossIndex] = true;
  }

  state.bossAnnouncementShowing = true;
  state.bossActive = false;
  try { resources.audio?.bgm?.pause?.(); } catch {}

  roachEvent("BOSS_INTRO", { name: def.name || "the big one" });

  initBossIntro();

  if (state._bossIntroSafety) clearTimeout(state._bossIntroSafety);
  state._bossIntroSafety = setTimeout(() => {
    if (state.bossAnnouncementShowing) startBossFight();
  }, 7000);
}

function startBossFight() {
  if (typeof isStoryCardActive === "function" && isStoryCardActive()) { setTimeout(startBossFight, 16); return; }
  if (typeof isKurtzIntroActive === "function" && isKurtzIntroActive()) { setTimeout(startBossFight, 16); return; }

  if (state._bossIntroSafety) { clearTimeout(state._bossIntroSafety); state._bossIntroSafety = null; }

  state.bossAnnouncementShowing = false;
  state.bossActive = true;
  state.bossDefeated = false;

  try { resources.audio?.bgm?.play?.().catch(()=>{}); } catch {}

  if (!Array.isArray(state.bossProjectiles)) state.bossProjectiles = [];

  const def = bossDefinitions[state.bossIndex] || { name: "BOSS", image: null, width: 160, height: 200, maxHealth: 50 };

  const spawnX = Math.floor(state.canvas.width / 2 - (def.width || 160) / 2);
  const spawnY = 80;

  state.boss = new Boss(def, def.image ? resources.images[def.image] : null, spawnX, spawnY);

  if ((def.name || "").toLowerCase().includes("kurtz")) {
    startKurtzIntro({
      lines: [
        "TERMINAL: UPLINK//FRAGMENTS: RETRIEVED.",
        "SUBJECT: KURTZ, C. — STATUS: ROGUE.",
        "LAST KNOWN: REDLINE CORRIDOR. MAP ANOMALIES CONFIRMED.",
        "OBJECTIVE: TRACE REDLINE. LOCATE. TERMINATE//OR//PARLEY."
      ],
      bgImageKey: "introkurtz.png",
      imgKey: "kurtz.png",
      portraitKey: "kurtz.png",
      holdAfterMs: 900
    });
  }

  state.boss.backdrop = def.backdrop;

  state.screenShake = 16;
  state._bossIntro = null;
}

function continueAfterBossDefeated(def) {
  const intelByIndex = { 0: "CATALYST", 1: "STABILIZER", 4: "UPLINK", 7: "FORMULA" };
  const intelKey = intelByIndex[state.bossIndex];
  if (intelKey) grantIntel(intelKey);

  if (state.bossIndex === 8) state.nukesFled = true;
  if (hasAllIntel() && state.nukesFled) state.allowKurtzFinale = true;

  resetNapalm();

  state.bossIndex++;

  if (state.bossIndex < bossDefinitions.length) {
    const jungleList = (constants.bgImages || []).filter(k => k.startsWith("bg_jungle"));
    if (jungleList.length) state.currentBgName = jungleList[state.bossIndex % jungleList.length] || jungleList[0];

    state.bossTriggerCount =
      (constants?.bossTriggerThresholds && Number.isFinite(constants.bossTriggerThresholds[state.bossIndex]))
        ? constants.bossTriggerThresholds[state.bossIndex]
        : 10;

    nextRound();
    roachEvent("ROUND_START", { round: state.round });
    if (!isKurtzIntroActive() && !isStoryCardActive()) {
      triggerNextLoreBeat(performance.now?.() ?? Date.now());
    }
  } else {
    showEndScreen("victory");
  }
}

export default GameScene;
