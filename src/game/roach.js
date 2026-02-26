// src/systems/roach.js
import { state } from "../core/state.js";
import { resources } from "./resources.js";

const ROACH_SCALE = 1.5;
const ROACH_MARGIN = 30;
const BOX_W = 300;
const BOX_H = 55;

// Keep Roach panel near HUD so it feels part of the same shell.
const PANEL_Y_FRACTION = 0.63;
const RIBBON_Y_FRACTION = 0.5;
const PANEL_BOTTOM_GAP = 12;

const ROACH_UI = {
  panelBg: "#2d3528",
  panelBorder: "#4b5320",
  panelGlow: "rgba(75, 83, 32, 0.35)",
  textMain: "#49fb35",
  textWarn: "#cfb53b",
};

const EVENT_COOLDOWNS = {
  LOW_AMMO: 5000,
  LOW_HEALTH: 5000,
  ROUND_START: 800,
  ROUND_CLEAR: 1200,
  NAPALM_READY: 2500,
  INTEL_GAINED: 800,
  BOSS_INTRO: 1000,
  BOSS_DEFEATED: 1000,
  CRUNCH_TEASE: 4000,
};

const EVENT_LINES = {
  ROUND_START: ({ round }) => ({ text: `New canopy. Round ${round}. Don't blink.`, opts: {} }),
  ROUND_CLEAR: () => ({ text: "Quiet. Too quiet. Reload and breathe.", opts: {} }),
  LOW_HEALTH: () => ({ text: "You look hollow. Keep your guts inside, yeah?", opts: { color: "#ff9ea4" } }),
  LOW_AMMO: () => ({ text: "Click's coming. Strip the dead; ammo is ammo.", opts: { color: "#ffd27f" } }),
  NAPALM_READY: () => ({ text: "I smell kerosene. Stand by for fire.", opts: { color: "#ffd27f" } }),
  INTEL_GAINED: ({ count = 1, total = 5 }) => ({
    text: `Black box cracked. INTEL ${count}/${total}. The signal stinks.`,
    opts: { color: "#9cf" },
  }),
  BOSS_INTRO: ({ name = "the big one" }) => ({ text: `Heads up - ${name}. Don't blink.`, opts: { priority: 1 } }),
  BOSS_DEFEATED: ({ name = "Target" }) => ({ text: `${name} is quiet. Bag the scrap - move.`, opts: {} }),
  CRUNCH_TEASE: () => ({ text: "Lieutenant Crunch? Always survives the blast. Lucky or wrong.", opts: { color: "#ffa" } }),
};

export function initRoachComms(opts = {}) {
  state.roach = state.roach || {};
  const r = state.roach;
  r.muted = !!opts.muted;
  r.subtitleOnly = !!opts.subtitleOnly;
  r.queue = [];
  r.active = null;
  r.lastId = 0;
  r.typeSpeed = 14;
  r.holdDefault = 1300;
  r.box = { w: BOX_W, h: BOX_H };
  r.alert = { until: 0 };
  r.cooldowns = Object.create(null);
}

export function roachSay(text, opts = {}) {
  if (!state.roach) initRoachComms();
  const r = state.roach;
  const id = ++r.lastId;
  const item = {
    id,
    text: String(text),
    speed: opts.speed ?? r.typeSpeed,
    holdMs: opts.holdMs ?? r.holdDefault,
    color: opts.color ?? ROACH_UI.textMain,
    priority: opts.priority ?? 0,
    when: performance.now(),
  };
  if (opts.immediate) {
    r.active = null;
  }
  r.queue.push(item);
  r.queue.sort((a, b) => (b.priority - a.priority) || (a.when - b.when));
  return id;
}

export function roachEvent(name, data = {}) {
  if (!state.roach) initRoachComms();
  const r = state.roach;
  const now = performance.now();
  const cdKey = `cd_${name}`;
  const next = r.cooldowns[cdKey] || 0;
  if (now < next) return;
  r.cooldowns[cdKey] = now + (EVENT_COOLDOWNS[name] ?? 1200);

  const h = EVENT_LINES[name];
  if (!h) return;
  const { text, opts = {} } = h(data);
  roachSay(text, {
    speed: 0,                  // show full line instantly
    holdMs: 1000,              // short hold so next event is timely
    priority: Math.max(1, opts.priority ?? 0),
    immediate: true,           // preempt stale chatter
    ...opts
  });
  r.alert.until = now + 700;
}

export function updateAndRenderRoach(ctx, now) {
  const r = state.roach;
  if (!r || r.muted) return;
  if (state.bossAnnouncementShowing) return;

  if (!r.active && r.queue.length) {
    const m = r.queue.shift();
    const instant = (m.speed ?? r.typeSpeed) <= 0;
    r.active = {
      ...m,
      typed: instant ? m.text.length : 0,
      startedAt: now,
      lastTick: now,
      doneAt: instant ? now : 0
    };
  }

  const a = r.active;
  if (a) {
    if (a.typed < a.text.length && now - a.lastTick >= a.speed) {
      a.typed++;
      a.lastTick = now;
      if (a.typed === a.text.length) a.doneAt = now;
    } else if (a.typed >= a.text.length && now - a.doneAt >= a.holdMs) {
      state.roach.active = null;
    }
  }

  if (a) drawHudStylePanel(ctx, now, a);
  drawHudStyleAlert(ctx, now);
}

function drawHudStyleAlert(ctx, now) {
  const r = state.roach;
  if (!r || now >= r.alert.until) return;

  const cw = state.canvas.width;
  const ch = state.canvas.height;
  const w = Math.min(400, cw * 0.7);
  const h = 32;
  const x = (cw - w) / 2;
  const y = Math.floor(ch * RIBBON_Y_FRACTION) - Math.floor(h / 2);

  ctx.save();
  ctx.fillStyle = ROACH_UI.panelBg;
  ctx.fillRect(x, y, w, h);

  ctx.strokeStyle = ROACH_UI.panelBorder;
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);

  ctx.shadowColor = ROACH_UI.panelGlow;
  ctx.shadowBlur = 8;
  ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
  ctx.shadowBlur = 0;

  ctx.font = "8px 'Press Start 2P', monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = ROACH_UI.textWarn;
  ctx.fillText("ROACH COMM INCOMING", x + w / 2, y + h / 2);
  ctx.restore();
}

function drawHudStylePanel(ctx, now, a) {
  const w = state.roach.box.w;
  const h = state.roach.box.h;

  const scaledW = Math.round(w * ROACH_SCALE);
  const scaledH = Math.round(h * ROACH_SCALE);
  const panelX = Math.max(0, state.canvas.width - scaledW - ROACH_MARGIN);

  const hudH = (state.bottomBarHeight | 0) || 96;
  const panelYByHud = state.canvas.height - hudH - scaledH - PANEL_BOTTOM_GAP;
  const panelYByFrac = Math.floor(state.canvas.height * PANEL_Y_FRACTION);
  const panelY = Math.max(0, Math.min(panelYByHud, panelYByFrac));

  ctx.save();
  ctx.translate(panelX, panelY);
  ctx.scale(ROACH_SCALE, ROACH_SCALE);

  const x = 0;
  const y = 0;

  ctx.fillStyle = ROACH_UI.panelBg;
  ctx.fillRect(x, y, w, h);

  ctx.strokeStyle = ROACH_UI.panelBorder;
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);

  ctx.shadowColor = ROACH_UI.panelGlow;
  ctx.shadowBlur = 8;
  ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
  ctx.shadowBlur = 0;

  const radioImg = resources.images["radio.png"];
  const rw = radioImg?.width ?? 1;
  const rh = radioImg?.height ?? 1;
  const rA = Math.max(0.1, rw / rh);
  const radioH = Math.round(h * 0.7);
  const radioW = Math.round(radioH * rA);
  const radioX = Math.round(x + 6);
  const radioY = Math.round(y + (h - radioH) / 2);
  if (radioImg instanceof HTMLImageElement || radioImg instanceof HTMLCanvasElement) {
    ctx.drawImage(radioImg, radioX, radioY, radioW, radioH);
  }

  const rimg = resources.images["roach.png"];
  const rw2 = rimg?.width ?? 1;
  const rh2 = rimg?.height ?? 1;
  const rA2 = Math.max(0.1, rw2 / rh2);
  const bob = Math.floor(now / 120) % 2 === 0 ? 1 : -1;
  const roH = Math.round(h * 1.2);
  const roW = Math.round(roH * rA2);
  const rx = x + w - roW - 6;
  const ry = y + (h - roH) / 2;
  if (rimg instanceof HTMLImageElement || rimg instanceof HTMLCanvasElement) {
    ctx.drawImage(rimg, rx, ry + bob, roW, roH);
  }

  const msg = a.text.slice(0, a.typed);
  const color = a.color || ROACH_UI.textMain;

  const padLeft = radioX + radioW + 8;
  const padRight = rx - 6;
  const maxW = Math.max(50, padRight - padLeft);
  const topY = y + 8;
  const bottomY = y + h - 8;
  const maxH = Math.max(10, bottomY - topY);

  const basePx = 9;
  const minPx = 7;
  const lineGap = 2;

  let px = basePx;
  let lines;
  let lineH;
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

  if (a.typed < a.text.length && Math.floor(now / 300) % 2 === 0) {
    const last = lines[lines.length - 1] || "";
    const tw = ctx.measureText(last).width;
    ctx.fillStyle = ROACH_UI.textWarn;
    ctx.fillText("|", padLeft + tw + 4, ty - lineH);
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
    if (ctx.measureText(t).width > maxW && line) {
      lines.push(line);
      line = w;
    } else {
      line = t;
    }
  }
  if (line) lines.push(line);
  ctx.restore();
  return lines;
}
