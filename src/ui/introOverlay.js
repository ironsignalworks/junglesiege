// src/ui/introOverlay.js
import { resources } from "../assets/resources.js";
import { state } from "../core/state.js";

export function createIntroOverlay(config = {}) {
  const defaults = {
    imgKey: "kurtz.png",
    bgImageKey: "introkurtz.png",

    // pacing
    preDelay: 300,
    typeDelay: 22,
    doneHold: 500,

    // visual
    overlayAlpha: 0.45,
    panelPad: 14,
    textLineH: 30,
    maxLineWidthFrac: 0.60,

    // panel placement: mid-left
    layout: {
      panelWFrac: 0.54,
      panelHFrac: 0.32,
      panelXFrac: 0.06,
      panelYFrac: 0.34
    },

    // UI prompt drawn inside the panel (disabled now)
    ui: {
      inCardPrompt: "",     // keep off-card prompts
      promptAlign: "right",
      promptMargin: 12,
      promptSize: 14
    },

    // controls
    controls: {
      nextKeys: ["Enter", "NumpadEnter"],
      skipKeys: ["Escape"],
      blockSpaceAdvance: true
    },

    // theme
   // inside defaults
    theme: {
     panelFill: "rgba(20,16,12,0.90)",
     panelStroke: "#2b251a",
     textColor: "#d7c38f",
     titleColor: "#e6d7a8",
     fontFamily: "'Press Start 2P', monospace"
    }
  };

  const opts = deepMerge(defaults, config);

  // ------ state ------
  let active = false;
  let lines = [];
  let img = null;
  let bg = null;

  let startedAt = 0;
  let typedChars = 0;
  let lastTypeAt = 0;
  let lineIndex = 0;
  let finishedCardAt = 0;
  let keyHandlerBound = null;

  function loadImageByKey(key) {
    if (!key) return null;
    const im = resources.images?.[key];
    return im && (im.width || im instanceof HTMLCanvasElement || im instanceof HTMLImageElement) ? im : null;
  }

  function resetTyping(now) {
    typedChars = 0;
    lastTypeAt = now + opts.preDelay - opts.typeDelay;
    finishedCardAt = 0;
  }

  function attachInput() {
    if (keyHandlerBound) return;
    keyHandlerBound = (e) => {
      if (!active) return;

      if (opts.controls.blockSpaceAdvance && e.code === "Space") {
        e.preventDefault();
        return;
      }
      if (opts.controls.nextKeys.includes(e.key)) {
        e.preventDefault();
        const line = lines[lineIndex] || "";
        if (typedChars < line.length) {
          typedChars = line.length;
          finishedCardAt = performance.now?.() ?? Date.now();
          return;
        }
        if (lineIndex < lines.length - 1) {
          lineIndex++;
          resetTyping(performance.now?.() ?? Date.now());
        } else {
          active = false;
          detachInput();
        }
        return;
      }
      if (opts.controls.skipKeys.includes(e.key)) {
        e.preventDefault();
        active = false;
        detachInput();
      }
    };
    window.addEventListener("keydown", keyHandlerBound, { passive: false });
    window.addEventListener("pointerdown", onPointerAdvance, { passive: true });
    window.addEventListener("click", onPointerAdvance, { passive: true });
  }

  function detachInput() {
    if (!keyHandlerBound) return;
    window.removeEventListener("keydown", keyHandlerBound);
    keyHandlerBound = null;
    try { window.removeEventListener("pointerdown", onPointerAdvance); } catch {}
    try { window.removeEventListener("click", onPointerAdvance); } catch {}
  }

  function onPointerAdvance() {
    if (!active) return;
    const now = performance.now?.() ?? Date.now();
    const line = lines[lineIndex] || "";
    if (typedChars < line.length) {
      typedChars = line.length;
      finishedCardAt = now;
      return;
    }
    if (lineIndex < lines.length - 1) {
      lineIndex++;
      resetTyping(now);
    } else {
      active = false;
      detachInput();
    }
  }

  function drawRoundedRect(ctx, x, y, w, h, r = 10) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  // public API
  function start(startCfg = {}) {
    const sc = deepMerge(opts, startCfg);
    img = loadImageByKey(sc.imgKey || opts.imgKey);
    bg  = loadImageByKey(sc.bgImageKey || opts.bgImageKey);
    lines = Array.isArray(sc.lines) ? sc.lines.slice() : ["..."];

    lineIndex = 0;
    const now = performance.now?.() ?? Date.now();
    startedAt = now;
    lastTypeAt = now + sc.preDelay - sc.typeDelay;
    typedChars = 0;
    finishedCardAt = 0;

    active = true;
    attachInput();
  }

  function isActive() { return !!active; }
  function skip() { active = false; detachInput(); }
  function dispose() { detachInput(); active = false; }

  function updateAndRender(ctx, nowIn) {
    if (!active) return;
    const now = nowIn ?? (performance.now?.() ?? Date.now());
    const W = state.canvas?.width ?? ctx.canvas.width;
    const H = state.canvas?.height ?? ctx.canvas.height;

    // background
    if (bg) {
      const iw = bg.width, ih = bg.height;
      const s = Math.max(W / iw, H / ih);
      const w = Math.ceil(iw * s), h = Math.ceil(ih * s);
      const x = Math.floor((W - w) / 2), y = Math.floor((H - h) / 2);
      ctx.drawImage(bg, x, y, w, h);
    } else {
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, W, H);
    }
    // lighter dim
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0," + opts.overlayAlpha + ")";
    ctx.fillRect(0, 0, W, H);
    ctx.restore();

    // portrait right
    if (img) {
      const floatY = Math.sin(now / 480) * 6;
      const maxH = Math.floor(H * 0.80);
      const ratio = img.width / img.height;
      const h = maxH;
      const w = Math.round(h * ratio);
      const x = Math.floor(W - w * 0.75);
      const y = Math.floor(H * 0.18 - h * 0.1 + floatY);
      ctx.drawImage(img, x, y, w, h);
    }

    // panel mid-left
    const pad = opts.panelPad;
    const panelW = Math.floor(W * opts.layout.panelWFrac);
    const panelH = Math.floor(H * opts.layout.panelHFrac);
    const panelX = Math.floor(W * opts.layout.panelXFrac);
    const panelY = Math.floor(H * opts.layout.panelYFrac);

    ctx.save();
    drawRoundedRect(ctx, panelX, panelY, panelW, panelH, 12);
    ctx.fillStyle = opts.theme.panelFill;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = opts.theme.panelStroke;
    ctx.stroke();
    ctx.restore();

    // typewriter
    const line = lines[lineIndex] || "";
    if (now - lastTypeAt >= opts.typeDelay && typedChars < line.length) {
      typedChars++;
      lastTypeAt = now;
      if (typedChars === line.length) finishedCardAt = now;
    }

    ctx.save();
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillStyle = opts.theme.textColor;
    ctx.font = "18px " + opts.theme.fontFamily;

    const maxTextW = Math.floor(panelW * opts.maxLineWidthFrac);
    const textX = panelX + pad + 2;
    let textY = panelY + pad + 2;

    const visible = line.slice(0, typedChars);
    const words = visible.split(" ");
    let current = "";
    const linesOut = [];

    for (let i = 0; i < words.length; i++) {
      const test = (current ? current + " " : "") + words[i];
      if (ctx.measureText(test).width > maxTextW && current) {
        linesOut.push(current);
        current = words[i];
      } else {
        current = test;
      }
    }
    if (current) linesOut.push(current);

    // scale text down if it would overflow vertically
    const neededH = linesOut.length * opts.textLineH;
    if (neededH > panelH - pad * 2) {
      const scale = (panelH - pad * 2) / Math.max(1, neededH);
      ctx.save();
      ctx.translate(textX, textY);
      ctx.scale(scale, scale);
      let y = 0;
      for (const l of linesOut) { ctx.fillText(l, 0, y); y += opts.textLineH; }
      ctx.restore();
    } else {
      for (const l of linesOut) { ctx.fillText(l, textX, textY); textY += opts.textLineH; }
    }

    // caret
    if (typedChars < line.length) {
      if (((now / 300) | 0) % 2 === 0) {
        const cw = ctx.measureText(linesOut[linesOut.length - 1] || "").width;
        ctx.fillText("|", textX + cw + 6, textY - opts.textLineH);
      }
    }

    // no in-card prompt (kept off)
    // if (opts.ui.inCardPrompt) { ... }

    ctx.restore();

    // auto-advance after hold
    if (typedChars >= line.length && finishedCardAt > 0) {
      if (now - finishedCardAt >= opts.doneHold) {
        if (lineIndex < lines.length - 1) {
          lineIndex++;
          resetTyping(now);
        } else {
          active = false;
          detachInput();
        }
      }
    }
  }

  return { start, isActive, skip, dispose, updateAndRender };
}

function deepMerge(base, ext) {
  const b = base || {};
  const e = ext || {};
  const out = Array.isArray(b) ? b.slice() : { ...b };
  for (const k of Object.keys(e)) {
    const bv = b[k];
    const ev = e[k];
    if (bv && typeof bv === "object" && !Array.isArray(bv) &&
        ev && typeof ev === "object" && !Array.isArray(ev)) {
      out[k] = deepMerge(bv, ev);
    } else {
      out[k] = ev;
    }
  }
  return out;
}

export default createIntroOverlay;
