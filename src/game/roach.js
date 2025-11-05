// src/systems/roach.js
import { state } from "../core/state.js";
import { resources } from "./resources.js";

const ROACH_SCALE  = 1.5;     // Larger roach scale (was 1.0)
const ROACH_MARGIN = 30;      // Reduced margin
const BOX_W = 300;            // Smaller box (was 350)
const BOX_H = 55;             // Smaller height (was 65)

// Position roach comms: move down by ~15% from current placement
const PANEL_Y_FRACTION  = 0.63;  // was 0.48 – lowered by 0.15
const RIBBON_Y_FRACTION = 0.50;  // was 0.35 – lowered by 0.15

const EVENT_COOLDOWNS = {
  LOW_AMMO: 5000, LOW_HEALTH: 5000, ROUND_START: 800, ROUND_CLEAR: 1200,
  NAPALM_READY: 2500, INTEL_GAINED: 800, BOSS_INTRO: 1000, BOSS_DEFEATED: 1000, CRUNCH_TEASE: 4000,
};

const EVENT_LINES = {
  ROUND_START: ({ round }) => ({ text: `New canopy. Round ${round}. Don't blink.`, opts: {} }),
  ROUND_CLEAR: () => ({ text: "Quiet. Too quiet. Reload and breathe.", opts: {} }),
  LOW_HEALTH: () => ({ text: "You look hollow. Keep your guts inside, yeah?", opts: { color:"#ff9ea4" } }),
  LOW_AMMO:   () => ({ text: "Click's coming. Strip the dead—ammo's ammo.", opts: { color:"#ffd27f" } }),
  NAPALM_READY: () => ({ text: "I smell kerosene. Stand by for fire.", opts: { color:"#ffd27f" } }),
  INTEL_GAINED: ({ count = 1, total = 5 }) => ({ text: `Black box cracked. INTEL ${count}/${total}. The signal stinks.`, opts: { color:"#9cf" } }),
  BOSS_INTRO: ({ name = "the big one" }) => ({ text: `Heads up—${name}. Don't blink.`, opts: { priority:1 } }),
  BOSS_DEFEATED: ({ name = "Target" }) => ({ text: `${name} is quiet. Bag the scrap—move.`, opts: {} }),
  CRUNCH_TEASE: () => ({ text: "Lieutenant Crunch? Always survives the blast. Lucky or wrong.", opts: { color:"#ffa" } }),
};

export function initRoachComms(opts = {}) {
  state.roach = state.roach || {};
  const r = state.roach;
  r.muted = !!opts.muted;
  r.subtitleOnly = !!opts.subtitleOnly;
  r.queue = [];
  r.active = null; r.lastId = 0;
  r.typeSpeed = 22; r.holdDefault = 2000;
  r.box = { w: BOX_W, h: BOX_H };
  r.alert = { until: 0 };
  r.cooldowns = Object.create(null);
}

export function roachSay(text, opts = {}) {
  if (!state.roach) initRoachComms();
  const r = state.roach;
  const id = ++r.lastId;
  const item = {
    id, text: String(text),
    speed: opts.speed ?? r.typeSpeed,
    holdMs: opts.holdMs ?? r.holdDefault,
    color: opts.color ?? "#c7ffc7", // Use HUD green instead of red
    priority: opts.priority ?? 0,
    when: performance.now(),
  };
  r.queue.push(item);
  r.queue.sort((a,b)=> (b.priority - a.priority) || (a.when - b.when));
  return id;
}

export function roachEvent(name, data = {}) {
  if (!state.roach) initRoachComms();
  const r = state.roach, now = performance.now();
  const cdKey = `cd_${name}`, next = r.cooldowns[cdKey] || 0;
  if (now < next) return;
  r.cooldowns[cdKey] = now + (EVENT_COOLDOWNS[name] ?? 1200);

  const h = EVENT_LINES[name]; if (!h) return;
  const { text, opts } = h(data);
  roachSay(text, opts);
  r.alert.until = now + 700; // show incoming ribbon
}

export function updateAndRenderRoach(ctx, now) {
  const r = state.roach; if (!r || r.muted) return;
  // Hide comms during boss announcement/intro and story overlays
  if (state.bossAnnouncementShowing) return;

  // activate next queued line
  if (!r.active && r.queue.length) {
    const m = r.queue.shift();
    r.active = { ...m, typed: 0, startedAt: now, lastTick: now, doneAt: 0 };
  }

  const a = r.active;
  if (a) {
    if (a.typed < a.text.length && now - a.lastTick >= a.speed) {
      a.typed++; a.lastTick = now; if (a.typed === a.text.length) a.doneAt = now;
    } else if (a.typed >= a.text.length && now - a.doneAt >= a.holdMs) {
      state.roach.active = null;
    }
  }

  // Only draw panel when an active message exists
  if (a) drawHudStylePanel(ctx, now, a);
  drawHudStyleAlert(ctx, now);
}

/* HUD-consistent incoming ribbon */
function drawHudStyleAlert(ctx, now) {
  const r = state.roach; if (!r || now >= r.alert.until) return;

  const cw = state.canvas.width, ch = state.canvas.height;
  const w = Math.min(400, cw * 0.7);
  const h = 32;
  const x = (cw - w) / 2;
  const y = Math.floor(ch * RIBBON_Y_FRACTION) - Math.floor(h / 2);

  ctx.save();
  
  // HUD-style background
  ctx.fillStyle = "#1a1a1a";
  ctx.fillRect(x, y, w, h);
  
  // HUD-style border
  ctx.strokeStyle = "#ffc107";
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
  
  // HUD-style glow
  ctx.shadowColor = "rgba(255, 193, 7, 0.3)";
  ctx.shadowBlur = 8;
  ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
  ctx.shadowBlur = 0;

  ctx.font = "8px 'Press Start 2P', monospace";
  ctx.textAlign = "center"; 
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#ffc107";
  ctx.fillText("ROACH COMM INCOMING", x + w / 2, y + h / 2);
  ctx.restore();
}

/* HUD-consistent brass panel with larger roach */
function drawHudStylePanel(ctx, now, a) {
  const w = state.roach.box.w, h = state.roach.box.h;

  const scaledW = Math.round(w * ROACH_SCALE);
  const scaledH = Math.round(h * ROACH_SCALE);
  const panelX  = Math.max(0, state.canvas.width  - scaledW - ROACH_MARGIN);
  const panelY  = Math.max(0, Math.floor(state.canvas.height * PANEL_Y_FRACTION));

  ctx.save();
  ctx.translate(panelX, panelY);
  ctx.scale(ROACH_SCALE, ROACH_SCALE);

  const x = 0, y = 0;

  // HUD-style background
  ctx.fillStyle = "#1a1a1a";
  ctx.fillRect(x, y, w, h);

  // HUD-style border
  ctx.strokeStyle = "#ffc107";
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
  
  // HUD-style glow
  ctx.shadowColor = "rgba(255, 193, 7, 0.3)";
  ctx.shadowBlur = 8;
  ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
  ctx.shadowBlur = 0;

  // radio (left) - smaller to fit compact design
  const radioImg = resources.images["radio.png"];
  const rw = (radioImg?.width??1), rh = (radioImg?.height??1), rA = Math.max(0.1, rw/rh);
  const radioH = Math.round(h * 0.7);
  const radioW = Math.round(radioH * rA);
  const radioX = Math.round(x + 6);
  const radioY = Math.round(y + (h - radioH) / 2);
  if (radioImg instanceof HTMLImageElement || radioImg instanceof HTMLCanvasElement) {
    ctx.drawImage(radioImg, radioX, radioY, radioW, radioH);
  }

  // roach (right) - LARGER for more prominence
  const rimg = resources.images["roach.png"];
  const rw2 = (rimg?.width??1), rh2 = (rimg?.height??1), rA2 = Math.max(0.1, rw2/rh2);
  const bob = (Math.floor(now / 120) % 2 === 0) ? 1 : -1;
  const roH = Math.round(h * 1.2); // Larger roach (was 0.8)
  let   roW = Math.round(roH * rA2);
  const rx = x + w - roW - 6;
  const ry = y + (h - roH) / 2;
  if (rimg instanceof HTMLImageElement || rimg instanceof HTMLCanvasElement) {
    ctx.drawImage(rimg, rx, ry + bob, roW, roH);
  }

  // text area (HUD-style typography)
  const msg = a.text.slice(0, a.typed);
  const color = a.color || "#c7ffc7";

  // Compute inner bounds that avoid the images
  const padLeft  = radioX + radioW + 8;
  const padRight = rx - 6;
  const maxW = Math.max(50, padRight - padLeft);
  const topY = y + 8;
  const bottomY = y + h - 8;
  const maxH = Math.max(10, bottomY - topY);

  const basePx = 9; // Slightly smaller font for compact design
  const minPx  = 7;
  const lineGap = 2;

  // Try from base font downward until it fits both width & height
  let px = basePx, lines, lineH;
  while (true) {
    ({ lines, lineH } = wrapToFit(ctx, msg, maxW, px, lineGap));
    if ((lines.length * lineH) <= maxH || px <= minPx) break;
    px -= 1;
  }

  ctx.font = `${px}px 'Press Start 2P', monospace`;
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillStyle = color;

  let ty = topY;
  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], padLeft, ty);
    ty += lineH;
  }

  // HUD-style caret
  if (a.typed < a.text.length && Math.floor(now/300)%2===0) {
    const last = lines[lines.length - 1] || "";
    const tw = ctx.measureText(last).width;
    ctx.fillStyle = "#ffc107";
    ctx.fillText("█", padLeft + tw + 4, ty - lineH);
  }

  ctx.restore();
}

function wrapToFit(ctx, text, maxW, px, lineGap) {
  const lines = wrap(ctx, text, maxW, `${px}px 'Press Start 2P', monospace`);
  return { lines, lineH: px + lineGap };
}

function wrap(ctx, text, maxW, font = "9px 'Press Start 2P', monospace") {
  ctx.save();
  ctx.font = font;
  const words = String(text || "").split(/\s+/);
  const lines = [];
  let line = "";
  for (const w of words) {
    const t = line ? `${line} ${w}` : w;
    if (ctx.measureText(t).width > maxW && line) { lines.push(line); line = w; }
    else line = t;
  }
  if (line) lines.push(line);
  ctx.restore();
  return lines;
}
