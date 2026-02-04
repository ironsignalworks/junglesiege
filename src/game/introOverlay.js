// src/ui/introOverlay.js
import { resources } from "./resources.js";
import { state } from "../core/state.js";
import { drawBeveledWindow, addGlowEffect } from "./beveledUI.js";

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
    panelPad: 16, // Reduced padding for smaller card
    textLineH: 40, // Larger line height for bigger font
    maxLineWidthFrac: 0.65, // Slightly wider text for compact card

    // panel placement: smaller, more compact card
    layout: {
      panelWFrac: 0.50, // Smaller width (was 0.60)
      panelHFrac: 0.32, // Smaller height (was 0.38)
      panelXFrac: 0.04, // Slightly closer to edge
      panelYFrac: 0.34  // Slightly lower
    },

    // UI prompt - DISABLED (no gate text at bottom)
    ui: {
      showGate: false,       // No gate text
      gateText: "",
      gateAlign: "right",
      gateMargin: 8,
      gateSize: 8
    },

    // controls
    controls: {
      nextKeys: ["Enter", "NumpadEnter"],
      skipKeys: ["Escape"],
      blockSpaceAdvance: true
    },

    // ENHANCED HUD-STYLE THEME (matching enhanced beveled aesthetic)
    theme: {
      panelFill: "rgba(0, 0, 0, 0.85)",        // Match HUD background
      panelStroke: "#ffc107",                   // Match HUD yellow border
      textColor: "#c7ffc7",                     // Match HUD green text
      titleColor: "#ffc107",                    // Match HUD yellow highlights
      gateColor: "#666666",                     // Subdued gray for gate text
      fontFamily: "'Press Start 2P', monospace", // Match HUD font
      shadowColor: "rgba(255, 193, 7, 0.4)",   // Yellow glow like HUD
      shadowBlur: 12
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
  let buttonRect = null; // last computed continue button rect in canvas coords

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
    try { state.overlayActive = true; } catch {}
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
    try { state.overlayActive = false; } catch {}
  }

  function onPointerAdvance(ev) {
    if (!active) return;
    // Require clicking the explicit continue button area
    try {
      if (buttonRect && ev && ev.clientX != null && ev.clientY != null && state?.canvas) {
        const r = state.canvas.getBoundingClientRect();
        const x = (ev.clientX - r.left) * (state.canvas.width / Math.max(1, r.width));
        const y = (ev.clientY - r.top)  * (state.canvas.height / Math.max(1, r.height));
        const inside = x >= buttonRect.x && x <= buttonRect.x + buttonRect.w && y >= buttonRect.y && y <= buttonRect.y + buttonRect.h;
        if (!inside) return; // ignore clicks outside the button
      }
    } catch {}
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

  // ENHANCED HUD-STYLE 3D BEVELED PANEL USING UNIFIED SYSTEM
  function drawStoryPanel(ctx, x, y, w, h) {
    ctx.save();
    
    // Use the unified beveled window system for maximum consistency
    drawBeveledWindow(ctx, x, y, w, h);
    
    // Add enhanced glow effect
    addGlowEffect(ctx, x, y, w, h, '#ffc107', 0.3);
    
    ctx.restore();
  }

  // Draw blinking gate text inside the card at bottom
  function drawInCardGateText(ctx, panelX, panelY, panelW, panelH, now) {
    const blinkCycle = Math.floor(now / 600) % 2; // Blink every 600ms
    if (blinkCycle === 0) return; // Hide during blink
    
    ctx.save();
    // Draw a chunky HUD-style 'CONTINUE' button inside the panel
    const btnW = Math.min(180, Math.max(120, Math.floor(panelW * 0.35)));
    const btnH = 28;
    const btnX = panelX + panelW - btnW - 14;
    const btnY = panelY + panelH - btnH - 12;
    buttonRect = { x: btnX, y: btnY, w: btnW, h: btnH };

    // Button plate
    ctx.fillStyle = "#171717";
    ctx.fillRect(btnX, btnY, btnW, btnH);
    ctx.strokeStyle = "#ffc107";
    ctx.lineWidth = 2;
    ctx.strokeRect(btnX + 1, btnY + 1, btnW - 2, btnH - 2);

    // Bevel
    ctx.fillStyle = "rgba(255,255,255,0.06)";
    ctx.fillRect(btnX, btnY, btnW, 2);
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(btnX, btnY + btnH - 2, btnW, 2);

    // Text
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "12px 'Press Start 2P', monospace";
    ctx.fillStyle = "#000";
    ctx.fillText("CONTINUE", btnX + btnW / 2 + 1, btnY + btnH / 2 + 1);
    ctx.fillStyle = "#ffc107";
    ctx.fillText("CONTINUE", btnX + btnW / 2, btnY + btnH / 2);
    ctx.restore();
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

    // PORTRAIT: 50% BIGGER AND MORE CENTERED (like boss intro)
    if (img) {
      const floatY = Math.sin(now / 480) * 6;
      const maxH = Math.floor(H * 1.0); // BIGGER scaling (was 0.80)
      const ratio = img.width / img.height;
      const h = maxH;
      const w = Math.round(h * ratio);
      // MORE CENTERED: Position at center-right instead of far right
      const x = Math.floor(W * 0.68 - w * 0.5); // CENTERED positioning
      const y = Math.floor(H * 0.15 - h * 0.1 + floatY); // Higher positioning
      ctx.drawImage(img, x, y, w, h);
    }

    // SMALLER HUD-STYLE PANEL (left side) using unified system
    const pad = opts.panelPad;
    const panelW = Math.floor(W * opts.layout.panelWFrac);
    const panelH = Math.floor(H * opts.layout.panelHFrac);
    const panelX = Math.floor(W * opts.layout.panelXFrac);
    const panelY = Math.floor(H * opts.layout.panelYFrac);

    drawStoryPanel(ctx, panelX, panelY, panelW, panelH);

    // ENHANCED HUD-STYLE TYPEWRITER TEXT
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
    ctx.font = "18px " + opts.theme.fontFamily; // Bigger type for intro cards
    
    // Enhanced text shadow for better contrast
    ctx.shadowColor = "rgba(199, 255, 199, 0.6)";
    ctx.shadowBlur = 5;

    const maxTextW = Math.floor(panelW * opts.maxLineWidthFrac);
    const textX = panelX + pad + 6; // Less padding for compact card
    let textY = panelY + pad + 6;

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

    // Reserve space for blinking gate text at bottom
    const gateReserve = 16; // Reserve space for gate text
    const neededH = linesOut.length * opts.textLineH;
    const availableH = panelH - pad * 2 - 12 - gateReserve; // Account for gate space
    
    if (neededH > availableH) {
      const scale = availableH / Math.max(1, neededH);
      ctx.save();
      ctx.translate(textX, textY);
      ctx.scale(scale, scale);
      let y = 0;
      for (const l of linesOut) { ctx.fillText(l, 0, y); y += opts.textLineH; }
      ctx.restore();
    } else {
      for (const l of linesOut) { ctx.fillText(l, textX, textY); textY += opts.textLineH; }
    }

    // Enhanced HUD-style caret with stronger glow
    if (typedChars > 0 && typedChars < line.length) {
      if (((now / 300) | 0) % 2 === 0) {
        const cw = ctx.measureText(linesOut[linesOut.length - 1] || "").width;
        ctx.fillStyle = opts.theme.titleColor; // Yellow caret like HUD
        ctx.shadowColor = opts.theme.shadowColor;
        ctx.shadowBlur = 8;
        ctx.fillText("?", textX + cw + 6, textY - opts.textLineH); // Block cursor for retro feel
      }
    }

    ctx.restore();

    // Draw blinking gate text inside the card
    drawInCardGateText(ctx, panelX, panelY, panelW, panelH, now);

    // Remove auto-advance; require Enter key or clicking the CONTINUE button
  }

  return { start, isActive, skip, dispose, updateAndRender };
}

function deepMerge(base, ext) {
  const b = base || {};
  const e = ext || {};
  const out = Array.isArray(b) ? b.slice() : b.slice ? b.slice() : { ...b };
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

