// src/scenes/GameScene.js - Performance optimized
import { state, playSound, createBullet, createZombie, createDrop, updateMetrics } from "../core/state.js";
import { constants } from "./constants.js";
import { resources } from "./resources.js";
import { updatePlayerBullets, updateEnemyBullets } from "./projectiles.js";
import { nextRound, updateZombies } from "./spawn.js";
import { isColliding } from "./collisions.js";
import { drawTank } from "./tank.js";
import { drawZombies } from "./zombies.js";
import { initSlugs, spawnSlugFromKill, updateAndRenderSlugs } from "./slug.js";
import { applyScreenEffects } from "./effects.js";
import { drawHUD, drawCombo } from "./hud.js";
import { drawBossHealthBar } from "./bossHud.js";
import { showEndScreen } from "./screens.js";
import { Boss, bossDefinitions } from "./boss.js";
import { 
  notifyCombo, 
  notifyAtomicSwitch,
  clearAllNotifications 
} from "./gameNotifications.js";

// Performance optimization: Cache frequently used calculations
const PERFORMANCE_CACHE = {
  // SECTOR NAMES (no more Greek symbols)
  sectorCodes: {
    0: 'ALPHA',    // Alpha: Quarantine Canopy - Mallet Melissa
    1: 'BETA',     // Beta: Flesh Mills - TNTina  
    2: 'GAMMA',    // Gamma: Silt Delta - Katana Joe
    3: 'DELTA',    // Delta: Bone Yard - Chainsaw Carla
    4: 'EPSILON',  // Epsilon: Redline - General Slaughter
    5: 'REVISIT',  // Revisit (Lord Humungus) - Lord Humungus
    6: 'ESTUARY',  // Estuary Night - Ghost of Admiral Vex
    7: 'ALPHA LABS I',     // Alpha Labs (Return) - Dr. Slime
    8: 'ALPHA LABS II',     // Alpha Labs (Return) - Major DD Nukes (same sector)
    9: 'TERMINAL'  // Terminal - Colonel Kurtz
  },
  // Sector full names for reference
  sectorNames: {
    0: 'Alpha: Quarantine Canopy',
    1: 'Beta: Flesh Mills',
    2: 'Gamma: Silt Delta', 
    3: 'Delta: Bone Yard',
    4: 'Epsilon: Redline',
    5: 'Revisit',
    6: 'Estuary Night',
    7: 'Alpha Labs I',
    8: 'Alpha Labs II', // Same sector as Dr. Slime per narrative
    9: 'Terminal'
  },
  lastCanvasSize: { width: 0, height: 0 },
  hudHeight: 96
};

function getSectorCodeForBossIndex(i){
  return PERFORMANCE_CACHE.sectorCodes[i] || 'ALPHA';
}

function getSectorNameForBossIndex(i){
  return PERFORMANCE_CACHE.sectorNames[i] || 'Alpha: Quarantine Canopy';
}

function updateSectorFromBoss(){ 
  try { 
    state.sector = getSectorCodeForBossIndex(state.bossIndex|0); 
    state.sectorName = getSectorNameForBossIndex(state.bossIndex|0);
    console.log(`[GameScene] Updated sector to: ${state.sector} (${state.sectorName}) for bossIndex: ${state.bossIndex}`);
  } catch (e) {
    console.warn("[GameScene] Failed to update sector:", e);
  } 
}

// Overlay gate functions for intro/story systems
function overlayGateActive() {
  return (typeof isKurtzIntroActive === "function" && isKurtzIntroActive()) ||
         (typeof isStoryCardActive === "function" && isStoryCardActive());
}

function drawOverlayGate(ctx) {
  // Simple visual indicator that an overlay is active
  ctx.save();
  ctx.fillStyle = "rgba(0, 0, 0, 0.1)";
  ctx.fillRect(0, 0, state.canvas.width, 20);
  ctx.restore();
}

import { startKurtzIntro, isKurtzIntroActive, updateAndRenderKurtzIntro } from "./kurtzIntro.js";
import { triggerNextLoreBeat, updateAndRenderLore } from "./lore.js";

import { initIntel, grantIntel, hasAllIntel } from "./intel.js";

import {
  initNapalmState,
  resetNapalm,
  bumpBossHitStreak,
  triggerNapalmStrike,
  updateAndRenderNapalm,
  drawNapalmHUD,
  drawNapalmOverlay,
  registerNapalmKill
} from "./napalm.js";

import {
  initRoachComms,
  roachEvent,
  updateAndRenderRoach
} from "./roach.js";

// FX (kept; we also add a tiny local animator to guarantee specific frames)
import { initFx, spawnFxExplosion, updateAndRenderFx } from "./fx.js";

// Story cards
import {
  renderStoryCards,
  isStoryCardActive,
  cardAfterKatanaJoe,
  cardBeforeDrSlime,
  cardBeforeDDNukes,
  cardAfterDDNukes_Reveal
} from "./storyCards.js";

/* ---- Optimized global knobs with performance considerations ---- */
const DROP_SCALE = (constants?.dropScale ?? 1.5);

// --- feature knobs with performance modes ---
const getPerformanceSettings = () => {
  const mode = state.performanceMode || 'high';
  switch (mode) {
    case 'low':
      return {
        ATOMIC_STREAK: 15,
        MEATGRINDER_SCORE: 1500,
        FLAME_SPAWN_MS: 80,
        MAX_PARTICLES: 20,
        MAX_ANIMS: 10
      };
    case 'medium':
      return {
        ATOMIC_STREAK: 12,
        MEATGRINDER_SCORE: 1200,
        FLAME_SPAWN_MS: 65,
        MAX_PARTICLES: 40,
        MAX_ANIMS: 20
      };
    default: // high
      return {
        ATOMIC_STREAK: 12,
        MEATGRINDER_SCORE: 1000,
        FLAME_SPAWN_MS: 55,
        MAX_PARTICLES: 80,
        MAX_ANIMS: 40
      };
  }
};

// Get current performance settings
const settings = getPerformanceSettings();
const ATOMIC_STREAK = settings.ATOMIC_STREAK;
const MEATGRINDER_SCORE = settings.MEATGRINDER_SCORE;
const FLAME_SPAWN_MS = settings.FLAME_SPAWN_MS;

/* Optimized helper functions with memoization */
const memoCache = new Map();
function memoize(fn, keyFn) {
  return (...args) => {
    const key = keyFn ? keyFn(...args) : JSON.stringify(args);
    if (memoCache.has(key)) return memoCache.get(key);
    const result = fn(...args);
    memoCache.set(key, result);
    return result;
  };
}

const hasShieldActive = memoize(() => (state.shieldUntil || 0) > Date.now(), () => Math.floor(Date.now() / 100));

// name normalization
function _normName(s) { return String(s || "").toLowerCase().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ").trim(); }
function _hasAll(name, ...tokens) { const n = _normName(name); return tokens.every(t => n.includes(_normName(t))); }
function _hasAny(name, ...tokens) { const n = _normName(name); return tokens.some(t => n.includes(_normName(t))); }

/* ---------- Optimized local sprite animator with object pooling ---------- */
let animPool = [];
const maxAnimPoolSize = 50;

function pushLocalAnim(opts) {
  if (!state._localAnims) state._localAnims = [];
  
  // Limit animations based on performance mode
  const settings = getPerformanceSettings();
  if (state._localAnims.length >= settings.MAX_ANIMS) {
    // Remove oldest animation
    const oldest = state._localAnims.shift();
    if (animPool.length < maxAnimPoolSize) {
      animPool.push(oldest);
    }
  }
  
  const now = performance.now?.() ?? Date.now();
  
  // Reuse pooled animation object if available
  let anim = animPool.pop();
  if (!anim) {
    anim = {};
  }
  
  Object.assign(anim, opts, {
    start: now,
    lastFrame: now,
    idx: 0,
  });
  
  state._localAnims.push(anim);
}

function updateAndRenderLocalAnims(ctx, now) {
  if (!state._localAnims || !state._localAnims.length) return;
  
  // Performance optimization: batch similar operations
  ctx.save();
  
  for (let i = state._localAnims.length - 1; i >= 0; i--) {
    const a = state._localAnims[i];
    const t = now - a.start;
    
    if (a.lifeMs && t > a.lifeMs) { 
      // Return to pool
      if (animPool.length < maxAnimPoolSize) {
        animPool.push(state._localAnims[i]);
      }
      state._localAnims.splice(i, 1); 
      continue; 
    }

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

    // Batch context operations
    if (a.additive && ctx.globalCompositeOperation !== "lighter") {
      ctx.globalCompositeOperation = "lighter";
    } else if (!a.additive && ctx.globalCompositeOperation !== "source-over") {
      ctx.globalCompositeOperation = "source-over";
    }
    
    if (Number.isFinite(a.globalAlpha)) {
      ctx.globalAlpha = a.globalAlpha;
    }
    
    ctx.drawImage(img, x, y, w, h);
    
    // Track draw calls for performance monitoring
    state.metrics.drawCalls++;
  }
  
  ctx.restore();
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

/* boss intro card - REPOSITIONED HIGHER WITH 30% LARGER TEXT */
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
    heightScale: 0.8, sideCrop: 0.7, floatAmp: 6, // Reduced sizes for mid-screen
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
      font: "900 26px 'Press Start 2P', monospace", fillStyle: "#ff3b3b",
      shadowColor: "rgba(255,60,60,0.6)", shadowBlur: 15,
    };
  }
  if (!bi.drips) bi.drips = [];

  const W = state.canvas.width, H = state.canvas.height;

  ctx.save();
  // Semi-transparent overlay
  ctx.fillStyle = "rgba(0,0,0,0.7)";
  ctx.fillRect(0, 0, W, H);

  const t0 = bi.startedAt || now, t = now - t0;
  const enterDur = 500, enterN = Math.min(1, t / enterDur);
  const enterOff = (1 - easeOutBack(enterN)) * 20;
  const s = dampedPulse(t, 0.055, 1400, 5.5);
  const wob = Math.sin(t * 0.004) * 0.03;
  const shake = tinyShake(t, 0.7);
  const flashOn = (t % 600) < 110, flashAlpha = flashOn ? 0.3 : 0;

  // Check if quote is complete and should start melting
  const quoteComplete = bi.typedChars >= bi.line.length && bi.doneAt;
  const meltStartTime = quoteComplete ? (bi.doneAt + bi.doneHold - 800) : 0; // Start melting 800ms before transition
  const shouldMelt = quoteComplete && now >= meltStartTime;
  const meltProgress = shouldMelt ? Math.min(1, (now - meltStartTime) / 800) : 0; // 800ms melt duration

  // LEFT-ALIGNED TEXT POSITIONING
  const textStartX = Math.floor(W * 0.05); // 5% from left edge
  const textMaxWidth = Math.floor(W * 0.55); // 55% width for text area
  const incomingY = Math.floor(H * 0.25); // Higher positioning
  const bossNameY = Math.floor(H * 0.35); // Name below "INCOMING BOSS"
  const quoteY = Math.floor(H * 0.50); // Quote as separate paragraph

  // CONSISTENT 2-PLAYER FONT SIZE FOR ALL BOSSES
  const headerFontSize = 36; // Fixed size for "INCOMING BOSS"
  const nameFontSize = 44;   // Fixed size for boss names
  const quoteFontSize = 28;  // Fixed size for quotes

  // Draw "INCOMING BOSS" header - LEFT ALIGNED
  ctx.save();
  ctx.textAlign = "left"; 
  ctx.textBaseline = "top";
  ctx.font = `900 ${headerFontSize}px 'Press Start 2P', monospace`; // CONSISTENT 2-PLAYER FONT
  ctx.shadowColor = "rgba(255,60,60,0.6)"; 
  ctx.shadowBlur = 15;
  ctx.translate(textStartX + shake.x, incomingY + enterOff + shake.y);
  ctx.scale(s, s);
  ctx.globalCompositeOperation = "lighter";
  
  const header = "INCOMING BOSS";
  // Multi-layer effect for glow
  ctx.fillStyle = `rgba(70, 255, 255, ${0.55 + flashAlpha})`;
  ctx.fillText(header, 1.4, 0);
  ctx.fillStyle = `rgba(255, 60, 60, ${0.7 + flashAlpha})`;
  ctx.fillText(header, -1.4, 0);
  ctx.fillStyle = `rgba(255, 59, 59, 0.95)`;
  ctx.fillText(header, 0, 0);
  if (((t / 16) | 0) % 2 === 0) { 
    ctx.globalAlpha = 0.88; 
    ctx.fillText(header, 0, 0); 
  }
  ctx.restore();

  // Boss name - LEFT ALIGNED, CONSISTENT SIZE
  const bossName = (bi.name || "BOSS").toUpperCase().replace(/\.$/, "");
  ctx.save();
  ctx.textAlign = "left"; 
  ctx.textBaseline = "top";
  ctx.font = `900 ${nameFontSize}px 'Press Start 2P', monospace`; // CONSISTENT 2-PLAYER FONT & SIZE
  ctx.shadowColor = "rgba(255,60,60,0.6)"; 
  ctx.shadowBlur = 18;
  ctx.translate(textStartX + shake.x, bossNameY + shake.y);
  ctx.scale(s, s);
  ctx.globalCompositeOperation = "lighter";
  
  // Multi-layer effect for boss name
  ctx.fillStyle = `rgba(70, 255, 255, ${0.65 + flashAlpha})`;
  ctx.fillText(bossName, 1.6, 0);
  ctx.fillStyle = `rgba(255, 60, 60, ${0.8 + flashAlpha})`;
  ctx.fillText(bossName, -1.6, 0);
  ctx.fillStyle = `rgba(255, 59, 59, 0.98)`;
  ctx.fillText(bossName, 0, 0);
  
  if (((t / 16) | 0) % 2 === 0) { 
    ctx.globalAlpha = 0.90; 
    ctx.fillText(bossName, 0, 0);
  }
  ctx.restore();

  // Update header mask for drip effects
  const fullHeader = header + " " + bossName;
  const hdr = bi._hdr;
  if (hdr.text !== fullHeader || hdr.cw !== W || hdr.ch !== H) {
    hdr.text = fullHeader; hdr.cw = W; hdr.ch = H; hdr.needsRaster = true;
  }
  if (hdr.needsRaster) {
    const mctx = hdr.mask.getContext("2d");
    ctx.font = `900 ${nameFontSize}px 'Press Start 2P', monospace`;
    const headerWidth = ctx.measureText(bossName).width;
    hdr.mask.width = Math.max(1, Math.floor(headerWidth) + 40);
    hdr.mask.height = 50;
    mctx.clearRect(0, 0, hdr.mask.width, hdr.mask.height);
    mctx.save();
    mctx.textAlign = "left"; 
    mctx.textBaseline = "top";
    mctx.fillStyle = "#ffffff"; 
    mctx.font = `900 ${nameFontSize}px 'Press Start 2P', monospace`;
    mctx.fillText(bossName, 10, 10);
    mctx.restore();

    hdr.x = Math.round(textStartX) - 10;
    hdr.y = Math.round(bossNameY - 10);

    const maskCtx = hdr.mask.getContext("2d", { willReadFrequently: true });
    hdr.maskData = maskCtx.getImageData(0, 0, hdr.mask.width, hdr.mask.height).data;
    hdr.needsRaster = false;
  }

  // BOSS PORTRAIT - 30% BIGGER AND MOVED 20% FURTHER TO THE RIGHT
  const floatY = Math.sin(now / 480) * bi.floatAmp;
  const portrait = bi.img;
  if (portrait instanceof HTMLImageElement || portrait instanceof HTMLCanvasElement) {
    const maxH = Math.floor(H * 1.56); // INCREASED from 1.2 to 1.56 (30% bigger: 1.2 * 1.3 = 1.56)
    const ratio = (portrait.width / portrait.height) || 1;
    const h = maxH;
    const w = Math.round(h * ratio);
    // MOVED 20% FURTHER TO THE RIGHT: from 65% to 78% (65% + 13% = 78%)
    const x = Math.floor(W * 0.78 - w * 0.5); // MOVED 20% FURTHER RIGHT
    const y = Math.floor(H * 0.15 - h * 0.1 + floatY); // Adjusted for bigger size
    ctx.drawImage(portrait, x, y, w, h);
  }

  // BOSS QUOTE - LEFT ALIGNED WITH INCOMING TEXT, PARAGRAPH BELOW + MELT DOWN EFFECT
  if (now - bi.lastType >= bi.typeSpeed && bi.typedChars < bi.line.length) {
    bi.typedChars++; bi.lastType = now; if (bi.typedChars === bi.line.length) bi.doneAt = now;
  }

  const typed = bi.line.slice(0, bi.typedChars);
  ctx.save();
  ctx.textAlign = "left"; // LEFT ALIGNED WITH INCOMING TEXT
  ctx.textBaseline = "top";
  ctx.shadowColor = "rgba(255,60,60,0.8)"; 
  ctx.shadowBlur = 20;
  ctx.fillStyle = "#ff3b3b"; 
  ctx.font = `900 ${quoteFontSize}px 'Press Start 2P', monospace`; // CONSISTENT 2-PLAYER FONT

  // Word wrap for left-aligned text
  const quoteWords = typed.split(" ");
  const lines = [];
  let line = "";
  
  for (let i = 0; i < quoteWords.length; i++) {
    const test = (line ? line + " " : "") + quoteWords[i];
    if (ctx.measureText(test).width > textMaxWidth && line) {
      lines.push(line);
      line = quoteWords[i];
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);

  const lineH = 32; // Line height for quote
  
  // MELT DOWN EFFECT: Draw each line with distortion based on melt progress
  for (let i = 0; i < lines.length; i++) {
    const lineY = quoteY + i * lineH;
    const lineMeltOffset = meltProgress * (i + 1) * 8; // Each line melts more than the previous
    
    if (shouldMelt && meltProgress > 0) {
      // MELT DOWN EFFECT
      const chars = lines[i].split('');
      let charX = textStartX;
      
      for (let c = 0; c < chars.length; c++) {
        const char = chars[c];
        const charWidth = ctx.measureText(char).width;
        
        // Calculate melt distortion for each character
        const charMeltProgress = Math.min(1, Math.max(0, (meltProgress * 1.5) - (c * 0.02))); // Progressive melt
        const meltY = lineY + lineMeltOffset + Math.sin((now * 0.01) + (c * 0.5)) * charMeltProgress * 20;
        const meltAlpha = 1 - (charMeltProgress * 0.7);
        const meltScale = 1 + (charMeltProgress * 0.3);
        
        ctx.save();
        ctx.globalAlpha = meltAlpha;
        ctx.translate(charX + charWidth / 2, meltY);
        ctx.scale(1, meltScale);
        
        // Add drip effect colors
        if (charMeltProgress > 0.3) {
          ctx.fillStyle = `rgba(255, ${Math.floor(60 - charMeltProgress * 30)}, ${Math.floor(60 - charMeltProgress * 30)}, ${meltAlpha})`;
        }
        
        ctx.fillText(char, -charWidth / 2, 0);
        ctx.restore();
        
        charX += charWidth;
      }
    } else {
      // Normal rendering when not melting
      ctx.fillText(lines[i], textStartX, lineY);
    }
  }

  // Blinking cursor (don't show during melt)
  if (bi.typedChars < bi.line.length && !shouldMelt) {
    if (Math.floor(now / 400) % 2 === 0) {
      const lastLine = lines[lines.length - 1] || "";
      const lastLineY = quoteY + (lines.length - 1) * lineH;
      const caretX = textStartX + ctx.measureText(lastLine).width + 10;
      ctx.fillText("▌", caretX, lastLineY);
    }
  }
  ctx.restore();

  // Enhanced drip effects during melt down
  const spawnEveryMs = shouldMelt ? 20 : 50; // More frequent drips during melt
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
    const meltMultiplier = shouldMelt ? (2 + meltProgress * 3) : 1; // More drips during melt
    const toSpawn = Math.random() < (0.6 * meltMultiplier) ? Math.floor(1 + meltProgress * 2) : 0;
    const bases = sampleSpawnPoints(toSpawn);
    if (!bi.drips) bi.drips = [];
    for (const b of bases) {
      const speed = (0.3 + Math.random() * 1.0) * (1 + meltProgress);
      const len   = (4 + Math.random() * (12 + 12 * heat)) * (1 + meltProgress * 0.5);
      const w     = 1 + (shouldMelt ? meltProgress : 0);
      const life  = (300 + Math.random() * 500) * (1 + meltProgress);
      const swayA = (2 + Math.random() * 6) * (1 + meltProgress * 0.5);
      const swayF = 0.001 + Math.random() * 0.0015;
      bi.drips.push({ x0: b.x + (Math.random() * 3 - 1.5), y0: b.y + 3, t0: now, speed, len, w, life, swayA, swayF });
    }
    if (bi.drips.length > 150) bi.drips = bi.drips.slice(-150); // More drips allowed during melt
  }

  // Render enhanced drip effects
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
    
    // Enhanced drip colors during melt
    const meltIntensity = shouldMelt ? (0.5 + meltProgress * 0.5) : 0.25;
    const g = ctx.createLinearGradient(headX, headY - d.len, headX, headY + 1);
    g.addColorStop(0, `rgba(255,70,70,0)`);
    g.addColorStop(0.35, `rgba(255,70,70,${meltIntensity * ageFade})`);
    g.addColorStop(0.75, `rgba(255,30,30,${(0.55 + meltProgress * 0.3) * ageFade})`);
    g.addColorStop(1, `rgba(255,20,20,${(0.8 + meltProgress * 0.2) * ageFade})`);
    
    ctx.fillStyle = g;
    const x = Math.round(headX - d.w / 2);
    const y0 = Math.round(headY - d.len);
    const y1 = Math.round(headY);
    ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x + d.w, y0); ctx.lineTo(x + d.w, y1); ctx.lineTo(x, y1); ctx.closePath(); ctx.fill();
    ctx.shadowColor = "rgba(255,60,60,0.6)"; ctx.shadowBlur = 6;
    ctx.fillStyle = `rgba(255,80,80,${(0.7 + meltProgress * 0.3) * ageFade})`;
    ctx.beginPath(); ctx.arc(headX, headY, d.w * 0.7, 0, Math.PI * 2); ctx.fill();
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

/* Big ribbon text - REPOSITIONED TO TOP SCREEN FOR ATOMIC WARNING */
function drawArcadeRibbon(ctx, text) {
  const t = Date.now();
  const W = state.canvas.width;
  const H = state.canvas.height;
  // REPOSITIONED: Move to TOP SCREEN for critical warnings (15% down from top)
  const yBase = Math.floor(H * 0.15) + Math.sin(t * 0.012) * 3; // TOP positioning for warnings
  
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  
  // OLD-SCHOOL RETRO FONT STYLING
  ctx.font = "900 28px 'Press Start 2P', monospace"; // Consistent with military font
  
  // OLD-SCHOOL CRT GLOW EFFECT
  const beat = (t % 800) < 200 ? 1 : 0; // Slower flash
  ctx.globalCompositeOperation = "lighter";
  
  // Multiple shadow layers for old-school glow
  ctx.shadowColor = "rgba(255, 204, 0, 0.8)";
  ctx.shadowBlur = 15 + beat * 8;
  
  // Background glow layer
  ctx.fillStyle = "rgba(255, 204, 0, 0.3)";
  ctx.fillText(text, W / 2, yBase);
  
  // Main shadow layers (old-school CRT style)
  ctx.shadowColor = "rgba(0, 0, 0, 0.9)";
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 3;
  ctx.shadowOffsetY = 3;
  ctx.fillStyle = "#000";
  ctx.fillText(text, W / 2, yBase);
  
  // Reset shadow
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
  
  // Bright outline glow
  ctx.shadowColor = "rgba(255, 204, 0, 0.9)";
  ctx.shadowBlur = 12 + beat * 4;
  ctx.fillStyle = "rgba(255, 204, 0, 0.8)";
  ctx.fillText(text, W / 2 + 1.5, yBase);
  
  // Contrasting inner glow
  ctx.fillStyle = "rgba(255, 68, 68, 0.7)";
  ctx.fillText(text, W / 2 - 1.5, yBase);
  
  // Main bright text
  ctx.fillStyle = "#ffffff";
  ctx.shadowColor = "rgba(255, 255, 255, 0.8)";
  ctx.shadowBlur = 6;
  ctx.fillText(text, W / 2, yBase);
  
  // Add scanline effect for old-school feel
  if (beat) {
    ctx.globalCompositeOperation = "multiply";
    ctx.fillStyle = "rgba(255, 255, 255, 0.95)";
    ctx.fillText(text, W / 2, yBase);
  }
  
  ctx.restore();
}

/* Full-screen meltdown (opaque), long ribbon notice, wipes world immediately */
function triggerAtomicExplosion() {
  const now = performance.now?.() ?? Date.now();

  // Visual notification via new system
  notifyAtomicSwitch();

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

/* Scene */
export class GameScene {
  constructor() {
    // Pre-bind frequently called methods for better performance
    this.onPlayerHit = this.onPlayerHit.bind(this);
    this.update = this.update.bind(this);
    this.render = this.render.bind(this);
    
    // Performance tracking
    this.lastUpdateTime = 0;
    this.frameSkipCount = 0;
  }

  enter() {
    console.log("GameScene.enter() - Initializing game");
    
    // FORCE START AT ROUND 1
    state.round = 1;
    console.log("[GameScene] Forced round to 1");
    
    // Initialize sector based on current boss index (should be 0 for start)
    state.bossIndex = Number.isFinite(state.bossIndex) ? state.bossIndex : 0;
    try { updateSectorFromBoss(); } catch (e) {} 
    
    state.gameStarted = true;

    state.canvas = document.getElementById("gameCanvas");
    if (!state.canvas) {
      // Create canvas if it doesn't exist
      state.canvas = document.createElement("canvas");
      state.canvas.id = "gameCanvas";
      const stage = document.getElementById("stage");
      if (stage) {
        stage.appendChild(state.canvas);
      } else {
        document.body.appendChild(state.canvas);
      }
    }
    state.ctx = state.canvas.getContext("2d");

    // Ensure canvas is visible and active
    state.canvas.style.display = "block";
    state.canvas.classList.add("active");
    console.log("[GameScene] Canvas display set to:", state.canvas.style.display);
    console.log("[GameScene] Canvas classList:", state.canvas.classList.toString());
    
    // Hide start screen if it exists
    const startScreen = document.getElementById("start-screen");
    if (startScreen) {
      startScreen.style.display = "none";
    }

    const baseHUD = Number.isFinite(constants?.bottomBarHeight) ? constants.bottomBarHeight : 96;
    PERFORMANCE_CACHE.hudHeight = (baseHUD + 2) | 0;
    state.bottomBarHeight = PERFORMANCE_CACHE.hudHeight;

    // Initialize player state (centered at bottom above HUD)
    (function initTankCentered() {
      const cw = state.canvas?.width || 800;
      const ch = state.canvas?.height || 600;
      const hudH = (state.bottomBarHeight | 0) || 96;
      const width = 126, height = 96;
      const x = Math.round(cw / 2 - width / 2);
      const y = Math.round(ch - hudH - height);
      state.tank = { x, y, width, height };
    })();
    state.health = 100;

    // FIXED: Properly initialize ammo based on constants
    if (constants?.ammoInfinite) {
      state.ammo = Number.POSITIVE_INFINITY;
      console.log("[GameScene] Set infinite ammo");
    } else {
      state.ammo = Number.isFinite(constants?.startingAmmo) ? constants.startingAmmo : 50;
      console.log("[GameScene] Set finite ammo:", state.ammo);
    }

    state.score = 0;
    // DON'T INCREMENT ROUND HERE - Keep at 1
    
    // Use efficient array clearing
    state.zombies.length = 0;
    state.bullets.length = 0;
    state.enemyBullets.length = 0;
    state.ammoDrops.length = 0;
    state.medkitDrops.length = 0;

    // Feature state
    state.killStreak = 0;
    state._spawnedAtomicForThisStreak = false;
    state.powerups = [];
    state.meatgrinderMode = false; state.meatgrinderUntil = 0;
    state._lastFlameAt = 0;

    // ribbons/overlays
    state._atomicRibbonUntil = 0;
    state._atomicOverlay = null;
    state._localAnims = [];

    // overlay gate
    state._overlayCancelRequested = false;

    // CRITICAL: Ensure input is not locked
    state.inputLocked = false;
    console.log("[GameScene] Input unlocked, inputLocked:", state.inputLocked);
    
    // Initialize input state to prevent undefined values
    state.keyLeft = false;
    state.keyRight = false;
    state.keyUp = false;
    state.keyDown = false;
    console.log("[GameScene] Input state initialized");

    // BOSS INITIALIZATION - Start fresh
    state.bossIndex = 0; // Always start with first boss (Mallet Melissa)
    state.bossTriggerCount = 8; // Fixed trigger count
    state.bossActive = false;
    state.bossDefeated = false;
    state.bossAnnouncementShowing = false;
    state.bossProjectiles = [];
    
    console.log("Boss system initialized - bossIndex:", state.bossIndex, "triggerCount:", state.bossTriggerCount);
    console.log("Game state initialized:", {
      round: state.round,
      sector: state.sector,
      bossIndex: state.bossIndex,
      health: state.health,
      ammo: state.ammo,
      score: state.score
    });

    // Optimized audio handling
    if (state.resourcesLoaded && resources.audio.bgm) {
      const bgm = resources.audio.bgm;
      bgm.loop = true;
      bgm.volume = 0.5;
      bgm.play().catch(() => {});
    }

    initSlugs();
    initFx();
    state.scene = this;

    initNapalmState();
    
    // Input systems are attached from main.js; avoid duplicating or overriding here
    // (Removed debug key listener that could cause conflicting states)
    
    // Optimized event handlers with better performance
    this._onNapalmKey = (e) => {
      if ((e.key === "n" || e.key === "N") && state.napalm?.ready && !state.bossAnnouncementShowing && !isStoryCardActive()) {
        e.preventDefault();
        triggerNapalmStrike();
      }
    };
    window.addEventListener("keydown", this._onNapalmKey, { passive: false });

    // Overlay gate keys: block Space; allow Enter/Esc hints
    this._onOverlayKeys = (e) => {
      if (!overlayGateActive()) return;
      const k = e.key;
      // Block space to prevent accidental skips in overlay systems that use it
      if (k === " " || k === "Spacebar" || k === "Space") { 
        e.preventDefault(); 
        e.stopPropagation(); 
      }
      // Esc to request cancel (module may or may not respect; we keep the UI consistent)
      if (k === "Escape" || k === "Esc") { 
        e.preventDefault(); 
        state._overlayCancelRequested = true; 
      }
      // Enter is passed through intentionally (many overlays advance on Enter/Click)
    };
    window.addEventListener("keydown", this._onOverlayKeys, { passive: false, capture: true });

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

    // Start first round
    nextRound();
    console.log("GameScene initialization complete - Final state:", {
      round: state.round,
      sector: state.sector,
      bossIndex: state.bossIndex
    });
  }

  exit() {
    // Clean up event listeners
    if (this._onNapalmKey) window.removeEventListener("keydown", this._onNapalmKey);
    if (this._onOverlayKeys) window.removeEventListener("keydown", this._onOverlayKeys, true);
    
    // Clean up debug listener
    if (this._debugKeyListener) {
      document.removeEventListener('keydown', this._debugKeyListener);
      document.removeEventListener('keyup', this._debugKeyListener);
    }
    
    // Clear animation pool
    animPool.length = 0;
    memoCache.clear();
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

  update(now, deltaTime = 16) {
    // Freeze simulation while on end screen to prevent stale timers/sounds from leaking.
    if (!state.gameStarted || state.__ended) return;

    // Performance monitoring
    const frameStartTime = performance.now();
    
    // REMOVE frame skipping - it was preventing tank movement
    // Skip frame if we're running too slow (performance optimization)
    // if (state.performanceMode === 'low' && deltaTime > 33) { // More than 30ms
    //   this.frameSkipCount++;
    //   if (this.frameSkipCount < 2) return; // Skip up to 2 frames
    //   this.frameSkipCount = 0;
    // }
    
    // Update performance metrics
    updateMetrics();
    
    const ctx = state.ctx;

    try { ctx.setTransform(1, 0, 0, 1, 0, 0); } catch {}
    ctx.clearRect(0, 0, state.canvas.width, state.canvas.height);

    // overlays guard (no top gate strip)
    if (isKurtzIntroActive && isKurtzIntroActive()) {
      updateAndRenderKurtzIntro(ctx, now);
      return;
    }
    if (isStoryCardActive && isStoryCardActive()) {
      renderStoryCards(ctx, now);
      return;
    }

    ctx.save();
    applyScreenEffects(ctx);

    // World
    drawLockedJungleBackground(ctx);

    // Draw HUD (handles both canvas and DOM HUD systems)
    drawHUD(ctx);
    const __hudH = (state.bottomBarHeight | 0) || 96;

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, state.canvas.width, state.canvas.height);
    ctx.clip();

    drawBossBackdrop(ctx);

    if (state.bossAnnouncementShowing) {
      drawBossIntro(ctx, now);
      ctx.restore(); ctx.restore();
      // Draw HUD for boss announcement screen
      drawHUD(ctx);
      updateAndRenderRoach(ctx, now);
      drawCombo(ctx);
      updateAndRenderLore(ctx, now);
      return;
    }

    // Movement: allow left/right; lock Y to ground above HUD
    (function moveTankHorizontal() {
      const t = state.tank;
      const c = state.canvas;
      if (!t || !c) return;
      const speed = 5;
      if (state.keyLeft)  t.x -= speed;
      if (state.keyRight) t.x += speed;
      // No forward/backward movement
      const hudH = (state.bottomBarHeight | 0) || 96;
      t.y = Math.round(c.height - hudH - t.height);
      // Clamp X within arena
      t.x = Math.max(0, Math.min(c.width - t.width, t.x));
      t.x = Math.round(t.x);
    })();
    
    // Debug input state periodically
    if (!state._lastInputDebug || now - state._lastInputDebug > 1000) {
      state._lastInputDebug = now;
      console.log("[GameScene] Input state debug:", {
        keyLeft: state.keyLeft,
        keyRight: state.keyRight,
        keyUp: state.keyUp,
        keyDown: state.keyDown,
        gameStarted: state.gameStarted,
        inputLocked: state.inputLocked,
        tankPosition: { x: state.tank.x, y: state.tank.y }
      });
    }

    // Hook drag
    if ((state._dragUntil || 0) > 0 && state._dragVec) {
      state.tank.x += state._dragVec.x;
      state.tank.y += state._dragVec.y;
      state._dragUntil--;
      if (state._dragUntil <= 0) state._dragVec = null;
    }

    // After drag hooks: keep Y locked to ground and clamp X
    (function relockAfterHooks() {
      const t = state.tank;
      const c = state.canvas;
      if (!t || !c) return;
      const hudH = (state.bottomBarHeight | 0) || 96;
      t.y = Math.round(c.height - hudH - t.height);
      t.x = Math.max(0, Math.min(c.width - t.width, t.x));
      t.x = Math.round(t.x);
    })();

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

    // Removed duplicate low health and low ammo notifications since the roach system already handles these events properly

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
        
        // SIMPLIFIED: Only decrease boss trigger if no boss is active
        if (!state.bossActive && !state.bossAnnouncementShowing) {
          state.bossTriggerCount = Math.max(0, (state.bossTriggerCount || 0) - 1);
          console.log("Boss trigger countdown:", state.bossTriggerCount);
        }
        
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
          registerNapalmKill(performance.now?.() ?? Date.now);
          
          // SIMPLIFIED: Only decrease boss trigger if no boss is active
          if (!state.bossActive && !state.bossAnnouncementShowing) {
            state.bossTriggerCount = Math.max(0, (state.bossTriggerCount || 0) - 1);
            console.log("Boss trigger countdown (shield kill):", state.bossTriggerCount);
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

    // Boss logic
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

      // Player bullets vs boss
      for (let i = state.bullets.length - 1; i >= 0; i--) {
        const bullet = state.bullets[i];
        if (isColliding(bullet, state.boss)) {
          state.boss.health--;
          state.bullets.splice(i, 1);
          bumpBossHitStreak(performance.now());
          try { if (!state._lastBossHitSfx || performance.now() - state._lastBossHitSfx > 140) { if (resources.audio?.fxBossHit) playSound(resources.audio.fxBossHit); state._lastBossHitSfx = performance.now(); } } catch {}
          console.log("Boss hit! Health:", state.boss.health);
          if (state.boss.health <= 0) break;
        }
      }

      // Boss defeated
      if (state.boss.health <= 0) {
        const def = bossDefinitions[state.bossIndex] || {};
        console.log("Boss defeated:", def.name);
        roachEvent("BOSS_DEFEATED", { name: def.name || "Target" });

        state.boss.isAlive = false;
        state.bossActive = false;
        state.bossDefeated = true;

        try { if (resources.audio?.fxBossDeath) playSound(resources.audio.fxBossDeath); } catch {}
        // Continue to next boss
        continueAfterBossDefeated(def);
        return;
      }
    }

    // Boss projectiles (keep existing code)
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

      try { ctx.setTransform(1,0,0,1,0,0); } catch {}
      ctx.save();
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1.0;

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
        const w = Math.round(Math.max(bp.width || 128, 48) * 1.0); // DOUBLED for sweep projectiles (was 64/24, now 128/48)
        const h = Math.round(Math.max(bp.height || 40, 24) * 1.0); // DOUBLED for sweep projectiles (was 20/12, now 40/24)
        if (img) { const cx = bp.x + w/2, cy = bp.y + h/2; state.ctx.save(); state.ctx.translate(cx, cy); bp.spin = Number.isFinite(bp.spin) ? bp.spin : 0.12; bp.rot = (bp.rot||0) + bp.spin; state.ctx.rotate(bp.rot||0); state.ctx.drawImage(img, -w/2, -h/2, w, h); state.ctx.restore(); }
        else { state.ctx.fillStyle = "#e91e63"; state.ctx.beginPath(); state.arc(bp.x + w/2, bp.y + h/2, w, 0, Math.PI*2); state.ctx.fill(); }
        state.ctx.restore();
      } else if (bp.kind === "trail") {
        state.ctx.save();
        const w = Math.round(Math.max(bp.width || 48, 36) * 1.0); // DOUBLED for trail projectiles (was 24/18, now 48/36)
        const h = Math.round(Math.max(bp.height || 48, 24) * 1.0); // DOUBLED for trail projectiles (was 24/12, now 48/24)
        if (img) { const cx = bp.x + w/2, cy = bp.y + h/2; state.ctx.save(); state.ctx.translate(cx, cy); bp.spin = Number.isFinite(bp.spin) ? bp.spin : 0.12; bp.rot = (bp.rot||0) + bp.spin; state.ctx.rotate(bp.rot||0); state.ctx.drawImage(img, -w/2, -h/2, w, h); state.ctx.restore(); }
        else { state.ctx.fillStyle = "#ffcc66"; state.ctx.fillRect(bp.x, bp.y, w, h); }
        state.ctx.restore();
      } else if (bp.kind === "puddle") {
        // drawn as AOE only
      } else if (bp.kind === "timer_bomb") {
        const timg = resources.images[bp.type] || resources.images["tnt.png"];
        const baseW = Math.max(bp.width || 72, 48); // DOUBLED base size (was 36/24, now 72/48)
        const baseH = Math.max(bp.height || 72, 48); // DOUBLED base size (was 36/24, now 72/48)
        const pulse = bp.blink ? (1 + 0.08 * Math.sin((Date.now() / 80) | 0)) : 1;
        const w = Math.round(baseW * 1.0 * pulse); // Removed extra 1.5x scaling since we already doubled
        const h = Math.round(baseH * 1.0 * pulse); // Removed extra 1.5x scaling since we already doubled
        const x = (bp.x - ((w - baseW) >> 1)) | 0;
        const y = (bp.y - ((h - baseH) >> 1)) | 0;

        state.ctx.save();
        state.ctx.globalAlpha = 1.0;
        if (timg && (timg.width || timg.height)) { const cx = x + w/2, cy = y + h/2; state.ctx.save(); state.ctx.translate(cx, cy); bp.spin = Number.isFinite(bp.spin) ? bp.spin : 0.12; bp.rot = (bp.rot||0) + bp.spin; state.ctx.rotate(bp.rot||0); state.ctx.drawImage(timg, -w/2, -h/2, w, h); state.ctx.restore(); }
        else { state.ctx.fillStyle = bp.blink ? "#ff3b3b" : "#ffcc66"; state.ctx.fillRect(x, y, w, h); }
        state.ctx.restore();
      } else {
        state.ctx.save();
        const w = Math.round(Math.max(bp.width || 64, 40) * 1.0); // INCREASED minimum size for bigger projectiles (was 32/20, now 64/40)
        const h = Math.round(Math.max(bp.height || 64, 40) * 1.0); // INCREASED minimum size for bigger projectiles (was 32/20, now 64/40)
        if (img) { const cx = bp.x + w/2, cy = bp.y + h/2; state.ctx.save(); state.ctx.translate(cx, cy); bp.spin = Number.isFinite(bp.spin) ? bp.spin : 0.12; bp.rot = (bp.rot||0) + bp.spin; state.ctx.rotate(bp.rot||0); state.ctx.drawImage(img, -w/2, -h/2, w, h); state.ctx.restore(); }
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
    // Draw HUD to update player stats
    drawHUD(ctx);
    drawNapalmHUD(state.ctx);
    drawNapalmOverlay(state.ctx, now);

    // BOSS HP BAR - RENDER AFTER HUD TO ENSURE VISIBILITY
    if (state.bossActive && state.boss && state.boss.isAlive) {
      drawBossHealthBar(ctx);
    }

    // Atomic ribbon (centered)
    if ((state._atomicRibbonUntil || 0) > Date.now()) { 
      drawArcadeRibbon(ctx, "ATOMIC SWITCH ENGAGED!"); 
    }

    // Narrative overlays
    updateAndRenderLore(ctx, now);
    updateAndRenderRoach(ctx, now);
    drawCombo(ctx);

    // FX systems
    updateAndRenderFx(ctx, now);
    updateAndRenderLocalAnims(ctx, now);

    // Atomic white overlay fade
    if ( state._atomicOverlay) {
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

    // Meatgrinder Mode expiry (10s window)
    if (state.meatgrinderMode && Number.isFinite(state.meatgrinderUntil) && (Date.now() > state.meatgrinderUntil)) {
      state.meatgrinderMode = false; state.meatgrinderUntil = 0;
      state.meatgrinderUntil = 0;
      state.tankSpriteKey = "tank.png";
    }

    // Flamethrower plume
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
            spawnFxExplosion("flesh", { x: zx, y: zy, sizePx: 56, maxPx: 72, frameMs: 45 });
            state.zombies.splice(zi, 1);
            state.score = (state.score||0) + 5;
            state.killStreak = (state.killStreak||0) + 1;
          }
        }
      }
    }

    if (state.health <= 0) {
      try {
        showEndScreen("fail");
      } catch (e) {
        console.error("[GameScene] showEndScreen failed in update() - falling back:", e);
        try {
          const fallback = document.createElement('div');
          fallback.id = 'end-screen';
          fallback.className = 'screen-container-4x3';
          fallback.style.cssText = 'position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);width:min(100vw,calc(100vh*4/3));height:calc(min(100vw,calc(100vh*4/3))*3/4);display:flex;align-items:center;justify-content:center;text-align:center;background:#000;border:6px solid #ff6b6b;box-shadow:inset 3px 3px 0 #ff9f9f,inset -3px -3px 0 #3d0d0d;z-index:20000;';
          fallback.innerHTML = `
            <div style="color:#ff4d4d;font-weight:900;font-size:clamp(2rem,6vw,4rem);text-shadow:0 0 15px #ff4d4d">MISSION FAILED</div>
            <button id="restart-button" style="margin-top:1rem;font-family:inherit;padding:1em 1.5em;cursor:pointer;background:#daa520;border:3px solid #ffc107;color:#000;border-radius:10px">RESTART</button>
          `;
          document.body.appendChild(fallback);
          const btn = fallback.querySelector('#restart-button');
          if (btn) btn.onclick = () => {
            try { if (typeof window.restartGame === 'function') return void window.restartGame(); } catch {}
            location.reload();
          };
        } catch (e2) {
          console.error("[GameScene] Fallback end screen also failed:", e2);
        }
      }
      return;
    }

    // SIMPLIFIED Round loop
    if (!state.spawningInProgress && state.zombies.length === 0 && !state.bossActive && !state.bossAnnouncementShowing) {
      console.log("Round clear, starting next round");
      roachEvent("ROUND_CLEAR");
      setTimeout(() => {
        state.killStreak = 0;
        state._spawnedAtomicForThisStreak = false;
        nextRound();
        roachEvent("ROUND_START", { round: state.round });
        if (!isKurtzIntroActive() && !isStoryCardActive()) {
          triggerNextLoreBeat(performance.now?.() ?? Date.now);
        }
      }, 600);
      state.spawningInProgress = true;
    }

    // SIMPLIFIED Boss trigger
    if (!state.bossActive && !state.bossDefeated && !state.bossAnnouncementShowing && state.bossIndex < bossDefinitions.length) {
      if (state.bossTriggerCount <= 0) {
        console.log("Triggering boss", state.bossIndex, bossDefinitions[state.bossIndex]?.name);
        showBossAnnouncement();
      }
      // Watchdog for final boss (Kurtz) to avoid stalls/blank screens
      if (state.bossIndex === bossDefinitions.length - 1) {
        state._finalBossWatchdog = state._finalBossWatchdog || Date.now();
        if ((Date.now() - state._finalBossWatchdog) > 1500) {
          try { showBossAnnouncement(); } catch {}
          state._finalBossWatchdog = Date.now();
        }
      } else {
        state._finalBossWatchdog = 0;
      }
    }
  }

  render() { 
    const ctx = state && state.ctx; 
    if (!ctx) return; 
    
    try { 
      applyScreenEffects(ctx); 
    } catch (e) {} 
    
    try { 
      drawHUD(ctx); 
    } catch (e) {} 

    // Meatgrinder badge (10s buff indicator) with pause on intros/cards
    try {
      const overlaying = !!state.bossAnnouncementShowing || (isKurtzIntroActive && isKurtzIntroActive()) || (isStoryCardActive && isStoryCardActive());
      if (overlaying) {
        if (state.meatgrinderMode && !state._mgPausedAt) state._mgPausedAt = Date.now();
      } else if (state.meatgrinderMode && state._mgPausedAt) {
        const delta = Date.now() - state._mgPausedAt;
        state.meatgrinderUntil = (state.meatgrinderUntil || 0) + delta;
        state._mgPausedAt = 0;
      }

      if (!overlaying && state.meatgrinderMode && Number.isFinite(state.meatgrinderUntil)) {
        const remainingMs = Math.max(0, state.meatgrinderUntil - Date.now());
        const secs = Math.ceil(remainingMs / 1000);
        const label = `MEATGRINDER ${secs}s`;
        const padX = 12, padY = 8;
        ctx.save();
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.font = "12px 'Press Start 2P', monospace";
        const tw = ctx.measureText(label).width;
        const bw = Math.max(160, Math.ceil(tw) + padX * 2);
        const bh = 26;
        const x = 14;
        const y = (state.canvas.height | 0) - (state.bottomBarHeight || 96) - bh - 10;
        // steel panel
        const grd = ctx.createLinearGradient(0, y, 0, y + bh);
        grd.addColorStop(0, '#2a2a2a');
        grd.addColorStop(1, '#1f1f1f');
        ctx.fillStyle = grd;
        ctx.fillRect(x, y, bw, bh);
        ctx.strokeStyle = '#232323';
        ctx.lineWidth = 2;
        ctx.strokeRect(x + 1, y + 1, bw - 2, bh - 2);
        // text with slight glow
        ctx.shadowColor = 'rgba(255, 193, 7, 0.35)';
        ctx.shadowBlur = 6;
        ctx.fillStyle = '#ffc107';
        ctx.fillText(label, x + padX, y + (bh - 14) / 2);
        ctx.restore();
      }
    } catch {}

    // Lightweight DOM HUD sync (responsive and up-to-date)
    try {
      const now = performance.now?.() ?? Date.now();
      state.__lastHudSync = state.__lastHudSync || 0;
      if (now - state.__lastHudSync >= 100) { // throttle ~10fps
        const hpEl = document.getElementById('hud-health-value');
        const hpFill = document.getElementById('hud-hp-fill');
        const ammoEl = document.getElementById('hud-ammo-value');
        const scoreEl = document.getElementById('hud-score');
        const roundEl = document.getElementById('hud-round');
        const sectorEl = document.getElementById('hud-sector');

        if (hpEl) hpEl.textContent = String(Math.max(0, Math.floor(state.health ?? 0)));
        if (hpFill) hpFill.style.width = `${Math.max(0, Math.min(100, state.health ?? 0))}%`;
        if (ammoEl) ammoEl.textContent = (state.ammo === Infinity ? '∞' : String(state.ammo ?? 0));
        if (scoreEl) scoreEl.textContent = String(state.score ?? 0).padStart(6, '0');
        if (roundEl) roundEl.textContent = String(state.round ?? 1).toString().padStart(2, '0');
        if (sectorEl) sectorEl.textContent = String(state.sector ?? 'ALPHA');

        // Do not toggle any separate DOM boss HUD; use only the canvas boss bar

        state.__lastHudSync = now;
      }
    } catch {}
  }

  gameOver() {
    if (state.__ended) return; state.__ended = true;
    state.gameStarted = false; try { window.dispatchEvent(new Event("end-screen-open")); } catch {}
    resetNapalm();
    try {
      showEndScreen("fail");
    } catch (e) {
      console.error("[GameScene] showEndScreen failed in gameOver() - falling back:", e);
      try {
        const fallback = document.createElement('div');
        fallback.id = 'end-screen';
        fallback.className = 'screen-container-4x3';
        fallback.style.cssText = 'position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);width:min(100vw,calc(100vh*4/3));height:calc(min(100vw,calc(100vh*4/3))*3/4);display:flex;align-items:center;justify-content:center;text-align:center;background:#000;border:6px solid #ff6b6b;box-shadow:inset 3px 3px 0 #ff9f9f,inset -3px -3px 0 #3d0d0d;z-index:20000;';
        fallback.innerHTML = `
          <div style="color:#ff4d4d;font-weight:900;font-size:clamp(2rem,6vw,4rem);text-shadow:0 0 15px #ff4d4d">MISSION FAILED</div>
          <button id="restart-button" style="margin-top:1rem;font-family:inherit;padding:1em 1.5em;cursor:pointer;background:#daa520;border:3px solid #ffc107;color:#000;border-radius:10px">RESTART</button>
        `;
        document.body.appendChild(fallback);
        const btn = fallback.querySelector('#restart-button');
        if (btn) btn.onclick = () => {
          try { if (typeof window.restartGame === 'function') return void window.restartGame(); } catch {}
          location.reload();
        };
      } catch (e2) {
        console.error("[GameScene] Fallback end screen also failed:", e2);
      }
    }
    
    // Clean up resources
    animPool.length = 0;
    memoCache.clear();
  }
}

/* boss announcement */
function showBossAnnouncement() {
  try { updateSectorFromBoss(); } catch (e) {} const def = bossDefinitions[state.bossIndex] || {};
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
  // REMOVED: notifyBossIntro(def.name || "UNKNOWN BOSS"); - This created duplicate banners
  // The canvas-based boss intro (drawBossIntro) is the proper boss announcement system

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
  // Guard against regressions: never go backwards in boss order
  if (!Number.isFinite(state.__maxBossIndexReached)) state.__maxBossIndexReached = 0;
  if (state.bossIndex < state.__maxBossIndexReached) {
    console.warn('[GameScene] bossIndex regression detected; correcting', { current: state.bossIndex, max: state.__maxBossIndexReached });
    state.bossIndex = state.__maxBossIndexReached;
  }

  try { resources.audio?.bgm?.play?.().catch(()=>{}); } catch {}

  if (!Array.isArray(state.bossProjectiles)) state.bossProjectiles = [];

  const def = bossDefinitions[state.bossIndex] || { name: "BOSS", image: null, width: 160, height: 200, maxHealth: 50 };

  const spawnX = Math.floor(state.canvas.width / 2 - (def.width || 160) / 2);
  const spawnY = 80;

  state.boss = new Boss(def, def.image ? resources.images[def.image] : null, spawnX, spawnY);

  if (def.name && def.name.toLowerCase().includes("kurtz")) {
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
  console.log("Continue after boss defeated:", def.name, "Current bossIndex:", state.bossIndex);
  
  // Grant intel based on narrative_auto.json mapping
  const intelByIndex = { 
    0: "99FZ3 Catalyst Chip",           // Mallet Melissa - Alpha
    1: "Stabilizer Module",              // TNTina - Beta  
    2: "Cold-Iron Darts Blueprint (on reaching streak).", // Katana Joe - Gamma
    3: "Uplink Auth Rod (flavor).",      // Chainsaw Carla - Delta
    4: "Redline Uplink Codes",          // General Slaughter - Epsilon
    5: "Ichor-X Sample Vial (flavor).", // Lord Humungus - Revisit
    6: "Black-Box Fragment (flavor).",  // Ghost of Admiral Vex - Estuary Night
    7: "Truth File"                     // Dr. Slime - Alpha Labs (Return)
  };
  
  const intelKey = intelByIndex[state.bossIndex];
  if (intelKey) {
    console.log("Granting intel:", intelKey);
    grantIntel(intelKey);
  }

  // Special flags based on narrative
  if (state.bossIndex === 8) state.nukesFled = true; // DD Nukes fled
  if (hasAllIntel() && state.nukesFled) state.allowKurtzFinale = true;

  resetNapalm();

  // ADVANCE TO NEXT BOSS
  state.bossIndex++;
  console.log("Advanced to bossIndex:", state.bossIndex);

  // Track max progression to avoid accidental loops
  if (!Number.isFinite(state.__maxBossIndexReached) || state.bossIndex > state.__maxBossIndexReached) {
    state.__maxBossIndexReached = state.bossIndex;
  }

  try { updateSectorFromBoss(); } catch (e) {} 
  
  if (state.bossIndex < bossDefinitions.length) {
    // Continue with next boss
    const jungleList = (constants.bgImages || []).filter(k => k.startsWith("bg_jungle"));
    if (jungleList.length) {
      state.currentBgName = jungleList[state.bossIndex % jungleList.length] || jungleList[0];
    }

    // SIMPLIFIED: Fixed boss trigger count
    state.bossTriggerCount = 8; // Fixed trigger for all bosses
    // If the next boss is the final (Kurtz), trigger immediately so the arena isn't empty
    if (state.bossIndex === bossDefinitions.length - 1) {
      state.bossTriggerCount = 0;
    }
    console.log("Set boss trigger count to:", state.bossTriggerCount);

    // Reset boss flags
    state.bossActive = false;
    state.bossDefeated = false;
    state.bossAnnouncementShowing = false;

    nextRound();
    roachEvent("ROUND_START", { round: state.round });
    if (!isKurtzIntroActive() && !isStoryCardActive()) {
      triggerNextLoreBeat(performance.now?.() ?? Date.now);
    }
  } else {
    // All bosses defeated
    console.log("All bosses defeated, showing victory screen");
    showEndScreen("victory");
  }
}

// Helper functions that were missing
function bossLineForName(name) {
  const k = (name || "").toLowerCase();
  if (k.includes("kurtz")) return "you're an errand boy...";
  if (k.includes("katana") || k.includes("joe")) return "ready to slice!";
  if (k.includes("melissa")) return "i can teach you how to use this.";
  return "prepare yourself.";
}

function easeOutBack(u, s = 1.70158) { 
  const t = u - 1; 
  return 1 + (t*t*((s+1)*t+s)); 
}

function dampedPulse(tMs, amp = 0.06, decayMs = 1200, freqHz = 6) {
  const a = amp * Math.exp(-tMs / decayMs); 
  return 1 + a * Math.sin(2 * Math.PI * freqHz * (tMs / 1000));
}

function tinyShake(tMs, mag = 1.2) {
  const x = Math.sin(tMs * 0.021) + Math.sin(tMs * 0.037) * 0.5;
  const y = Math.cos(tMs * 0.017) + Math.sin(tMs * 0.029) * 0.5;
  return { x: x * mag, y: y * (mag * 0.6) };
}

// Add debug functions for testing tank movement
window.debugTankMovement = function() {
  console.log("=== TANK MOVEMENT DEBUG ===");
  console.log("Tank position:", { x: state.tank.x, y: state.tank.y });
  console.log("Input state:", {
    keyLeft: state.keyLeft,
    keyRight: state.keyRight,
    keyUp: state.keyUp,
    keyDown: state.keyDown
  });
  console.log("Canvas size:", { width: state.canvas.width, height: state.canvas.height });
  console.log("Game started:", state.gameStarted);
  console.log("Canvas focus:", document.activeElement === state.canvas);
  console.log("Document has focus:", document.hasFocus());
};

window.testTankMovement = function() {
  console.log("Testing tank movement...");
  const oldX = state.tank.x;
  const oldY = state.tank.y;
  state.tank.x += 10;
  state.tank.y += 10;
  console.log("Tank moved from", {x: oldX, y: oldY}, "to", {x: state.tank.x, y: state.tank.y});
};

window.forceMovement = function(direction) {
  console.log("Forcing movement:", direction);
  switch(direction) {
    case 'left':
      state.keyLeft = true;
      setTimeout(() => { state.keyLeft = false; console.log("Left movement stopped"); }, 1000);
      break;
    case 'right':
      state.keyRight = true;
      setTimeout(() => { state.keyRight = false; console.log("Right movement stopped"); }, 1000);
      break;
    case 'up':
      state.keyUp = true;
      setTimeout(() => { state.keyUp = false; console.log("Up movement stopped"); }, 1000);
      break;
    case 'down':
      state.keyDown = true;
      setTimeout(() => { state.keyDown = false; console.log("Down movement stopped"); }, 1000);
      break;
  }
};

// Add manual input testing
window.testInputDirectly = function() {
  console.log("Testing keyboard input directly...");
  
  // Test if keyboard listeners are attached
  console.log("Current key states:", {
    keyLeft: state.keyLeft,
    keyRight: state.keyRight,
    keyUp: state.keyUp,
    keyDown: state.keyDown
  });
  
  // Simulate key events
  const keyEvent = new KeyboardEvent('keydown', { key: 'a' });
  document.dispatchEvent(keyEvent);
  console.log("After simulating 'a' key:", state.keyLeft);
  
  const keyUpEvent = new KeyboardEvent('keyup', { key: 'a' });
  document.dispatchEvent(keyUpEvent);
  console.log("After releasing 'a' key:", state.keyLeft);
};

// Focus canvas for input
window.focusCanvas = function() {
  if (state.canvas) {
    state.canvas.focus();
    console.log("Canvas focused");
  } else {
    console.log("No canvas found");
  }
};






