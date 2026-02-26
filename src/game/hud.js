// src/render/hud.js
import { state } from "../core/state.js";
import { constants } from "./constants.js";
import { 
  FRAME_PALETTES, 
  drawOrnateFrame, 
  drawOrnateProgressBar, 
  drawCornerOrnaments,
  drawBorderNotches,
  drawMetallicTexture,
  drawPulsingGlow
} from "./decorativeFrames.js";

/* Palette - Enhanced for better 3D beveling */
const GOLD_M = "#c89a2b";
const GOLD_D = "#8f6c1b";
const PANEL  = "#17120c";
const INSET  = "#1b1510";
const LBL    = "#d7c38f";
const VAL    = "#ffffff";
const HP_BG  = "#412022";
const HP_FG  = "#b54646";
const PIP_ON  = "#d4b35c";
const PIP_OFF = "#2b251a";

// Enhanced bevel colors
const BEVEL_LIGHT = "#ffffff";
const BEVEL_HIGHLIGHT = "#e8e8e8";
const BEVEL_FACE = "#b8b8b8";
const BEVEL_SHADOW = "#6a6a6a";
const BEVEL_DARK = "#2a2a2a";
const BEVEL_BLACK = "#000000";

const I = Math.round;

// HUD text
constants.hudLabelSize = 12; // labels smaller
constants.hudValueSize = 22; // values smaller to prevent overflow

// Kill ribbon / combo banner
constants.comboMaxPx = 48;   // lower cap
constants.comboMinPx = 20;   // floor

/* ---------------- Typography ---------------- */
const LABEL_SIZE_DEFAULT = 12;
const VALUE_SIZE_DEFAULT = 22;
const LABEL_MIN_PX = 9;
const VALUE_MIN_PX = 12;

function hudLabelSize() {
  const v = constants?.hudLabelSize;
  return Number.isFinite(v) ? v : LABEL_SIZE_DEFAULT;
}
function hudValueSize() {
  const v = constants?.hudValueSize;
  return Number.isFinite(v) ? v : VALUE_SIZE_DEFAULT;
}

/* Fit a string in maxWidth by downscaling pixel size if needed */
function fitPx(ctx, text, family, basePx, maxWidth, minPx) {
  let px = basePx;
  ctx.font = `bold ${px}px '${family}', monospace`;
  let w = ctx.measureText(text).width;
  if (w <= maxWidth) return px;
  const scale = maxWidth / Math.max(1, w);
  px = Math.max(minPx, Math.floor(basePx * scale));
  return px;
}

function resetText(ctx) {
  ctx.shadowBlur = 0;
  ctx.shadowColor = "transparent";
  ctx.globalAlpha = 1;
}

/* ---------------- Enhanced RPG-Style Ornate Drawing Functions ---------------- */

// Enhanced bezel with deeper 3D effect and ornate elements
function drawEnhancedOrnateBezel(ctx, x, y, w, h, style = 'raised') {
  x = I(x); y = I(y); w = I(w); h = I(h);
  
  // Use ornate frame system
  const palette = style === 'raised' ? FRAME_PALETTES.gold : FRAME_PALETTES.bronze;
  
  drawOrnateFrame(ctx, x, y, w, h, {
    palette,
    borderWidth: 5,
    cornerSize: 10,
    notchSize: 3,
    notchSpacing: 20,
    includeTexture: true,
    textureIntensity: 0.04,
    glowIntensity: 0.3
  });
  
  // Add pulsing glow for active elements
  if (style === 'raised') {
    drawPulsingGlow(ctx, x, y, w, h, palette.bright, 0.2, Date.now());
  }
}

/* ---------------- Original Bezel (keeping for compatibility) ---------------- */
function drawBezel(ctx, x, y, w, h) {
  drawEnhancedOrnateBezel(ctx, x, y, w, h, 'raised');
}

/* ---------------- Layout helpers ---------------- */
function splitWidthsHealthDominant(cw, pad, gap, rightSafe, {
  healthRatio = 0.58,
  minHealth = 400,
  minAmmo = 280,
  minScore = 280,
} = {}) {
  const usable = cw - (pad * 2) - (gap * 2) - rightSafe;
  let wHealth = Math.max(minHealth, Math.round(usable * healthRatio));
  if (wHealth > usable - (minAmmo + minScore)) {
    wHealth = Math.max(minHealth, usable - (minAmmo + minScore));
  }
  let rem = usable - wHealth;
  let half = Math.floor(rem / 2);
  let wAmmo = Math.max(minAmmo, half);
  let wScore = Math.max(minScore, rem - wAmmo);

  if (wScore < minScore) {
    const need = minScore - wScore;
    const give = Math.min(need, wAmmo - minAmmo);
    wAmmo -= give;
    wScore += give;
  }
  const shortfall = Math.max(0, minAmmo + minScore - rem);
  if (shortfall > 0) {
    const take = Math.min(shortfall, wHealth - minHealth);
    wHealth -= take;
    rem = usable - wHealth;
    half = Math.floor(rem / 2);
    wAmmo = Math.max(minAmmo, half);
    wScore = rem - wAmmo;
  }
  const parity = usable - wHealth;
  wAmmo = Math.floor(parity / 2);
  wScore = parity - wAmmo;

  return [wHealth, wAmmo, wScore];
}

/* ---------------- HUD height publish ---------------- */
export function publishHUDHeightOnly(ctx) {
  try { ctx.setTransform(1, 0, 0, 1, 0, 0); } catch {}
  const ch = state.canvas.height | 0;

  const base = Number.isFinite(constants?.bottomBarHeight)
    ? constants.bottomBarHeight
    : (state.bottomBarHeight || 96);

  // Modest height (we reduced text sizes)
  const scale = Number.isFinite(constants?.hudScale) ? constants.hudScale : 0.74;
  const targetPx = Number.isFinite(constants?.hudHeightPx)
    ? constants.hudHeightPx
    : Math.round(base * scale);

  const H   = Math.max(70, targetPx);
  const lip = 2;

  state.bottomBarHeight = (H + lip) | 0;
  return { body: H, lip, total: state.bottomBarHeight, topY: ch - (H + lip) };
}

/* ---------------- Enhanced RPG-Style Drawing ---------------- */
export function drawHUD(ctx) {
  // Disabled in favor of DOM frame HUD (`#screen-hud`). Keep height publish only.
  if (constants && constants.showCanvasHUD === false) {
    publishHUDHeightOnly(ctx);
    return;
  }
  // Neutralize previous transforms so font sizes are consistent.
  try { ctx.setTransform(1, 0, 0, 1, 0, 0); } catch {}

  if (constants && constants.showCanvasHUD === false) return;

  const { body: H, lip } = publishHUDHeightOnly(ctx);

  const cw = state.canvas.width | 0;
  const ch = state.canvas.height | 0;
  const Y  = ch - H;

  // Enhanced base strip with metallic texture
  const bgGradient = ctx.createLinearGradient(0, Y, 0, Y + H);
  bgGradient.addColorStop(0, "rgba(20,20,20,0.95)");
  bgGradient.addColorStop(0.5, "rgba(14,14,14,0.92)");
  bgGradient.addColorStop(1, "rgba(10,10,10,0.95)");
  ctx.fillStyle = bgGradient;
  ctx.fillRect(0, Y, cw, H + 1);
  
  // Add metallic texture to background
  drawMetallicTexture(ctx, 0, Y, cw, H, 0.02);
  
  ctx.fillStyle = "#0b0b0b";
  ctx.fillRect(0, Y - lip, cw, lip);

  // layout
  const pad = 12, gap = 16, RIGHT_SAFE = 0;
  const PH  = H - pad * 2;

  const [Whealth, Wammo, Wscore] = splitWidthsHealthDominant(cw, pad, gap, RIGHT_SAFE, {
    healthRatio: 0.56,
    minHealth: 380,
    minAmmo: 280,
    minScore: 280,
  });

  const Xhealth = pad;
  const Xammo   = Xhealth + Whealth + gap;
  const Xscore  = Xammo   + Wammo   + gap;
  const Py      = Y + pad;

  // Draw ornate bezels with enhanced styling
  drawEnhancedOrnateBezel(ctx, Xhealth, Py, Whealth, PH, 'raised');
  drawEnhancedOrnateBezel(ctx, Xammo,   Py, Wammo,   PH, 'raised');
  drawEnhancedOrnateBezel(ctx, Xscore,  Py, Wscore,  PH, 'raised');

  /* ---- HEALTH SECTION WITH ENHANCED RPG STYLING ---- */
  clipInner(ctx, Xhealth, Py, Whealth, PH);
  {
    // Add decorative background pattern
    const healthBgGradient = ctx.createLinearGradient(Xhealth, Py, Xhealth + Whealth, Py + PH);
    healthBgGradient.addColorStop(0, 'rgba(69, 39, 160, 0.1)');
    healthBgGradient.addColorStop(1, 'rgba(38, 166, 154, 0.1)');
    ctx.fillStyle = healthBgGradient;
    ctx.fillRect(Xhealth + 8, Py + 8, Whealth - 16, PH - 16);

    // label with enhanced styling
    const labelMaxW = Whealth - 28;
    const lblPx = fitPx(ctx, "HEALTH", "Press Start 2P", hudLabelSize(), labelMaxW, LABEL_MIN_PX);
    resetText(ctx);
    ctx.fillStyle = GOLD_M;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.font = `bold ${lblPx}px 'Press Start 2P', monospace`;
    
    // Add text glow effect
    ctx.shadowColor = GOLD_M;
    ctx.shadowBlur = 8;
    ctx.fillText("HEALTH", Xhealth + 14, Py + 6);
    resetText(ctx);

    // value (right aligned) with enhanced glow
    const hp = Math.max(0, Math.min(100, Math.round(state.health || 0)));
    const hpStr = hp + "%";
    const valMaxW = Whealth - 40;
    const valPx = fitPx(ctx, hpStr, "Press Start 2P", hudValueSize(), valMaxW, VALUE_MIN_PX);
    resetText(ctx);
    ctx.fillStyle = VAL;
    ctx.textAlign = "right";
    ctx.textBaseline = "alphabetic";
    ctx.font = `bold ${valPx}px 'Press Start 2P', monospace`;
    
    // Enhanced text glow
    ctx.shadowColor = "#00ff88";
    ctx.shadowBlur = 12;
    ctx.fillText(hpStr, Xhealth + Whealth - 18, Py + 30);
    resetText(ctx);

    // Enhanced ornate health bar
    const barX = Xhealth + 14;
    const barW = Whealth - 28;
    const barH = Math.max(16, Math.floor(PH * 0.36));
    const barY = Py + PH - 12 - barH;
    
    drawOrnateProgressBar(ctx, barX, barY, barW, barH, hp / 100, {
      palette: FRAME_PALETTES.steel,
      fillPalette: hp > 50 ? FRAME_PALETTES.copper : FRAME_PALETTES.gold,
      borderWidth: 3,
      includeNotches: true
    });
  }
  unclip(ctx);

  /* ---- AMMO SECTION WITH ENHANCED RPG STYLING ---- */
  clipInner(ctx, Xammo, Py, Wammo, PH);
  {
    // Add decorative background pattern
    const ammoBgGradient = ctx.createLinearGradient(Xammo, Py, Xammo + Wammo, Py + PH);
    ammoBgGradient.addColorStop(0, 'rgba(255, 193, 7, 0.1)');
    ammoBgGradient.addColorStop(1, 'rgba(255, 87, 34, 0.1)');
    ctx.fillStyle = ammoBgGradient;
    ctx.fillRect(Xammo + 8, Py + 8, Wammo - 16, PH - 16);

    const labelMaxW = Wammo - 28;
    const lblPx = fitPx(ctx, "AMMO", "Press Start 2P", hudLabelSize(), labelMaxW, LABEL_MIN_PX);
    resetText(ctx);
    ctx.fillStyle = GOLD_M;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.font = `bold ${lblPx}px 'Press Start 2P', monospace`;
    
    // Add text glow effect
    ctx.shadowColor = GOLD_M;
    ctx.shadowBlur = 8;
    ctx.fillText("AMMO", Xammo + 14, Py + 6);
    resetText(ctx);

    const ammoStr = String(state.ammo | 0);
    const valMaxW = Wammo - 40;
    const valPx = fitPx(ctx, ammoStr, "Press Start 2P", hudValueSize(), valMaxW, VALUE_MIN_PX);
    resetText(ctx);
    ctx.fillStyle = VAL;
    ctx.textAlign = "right";
    ctx.textBaseline = "alphabetic";
    ctx.font = `bold ${valPx}px 'Press Start 2P', monospace`;
    
    // Enhanced text glow
    ctx.shadowColor = "#ffaa00";
    ctx.shadowBlur = 12;
    ctx.fillText(ammoStr, Xammo + Wammo - 18, Py + 30);
    resetText(ctx);

    // Enhanced ornate pips
    const maxPips = 5;
    const ammoPerPip = (constants && (constants.ammoPerPip | 0)) || 25;
    const filled = Math.max(0, Math.min(maxPips, Math.ceil((state.ammo || 0) / ammoPerPip)));

    const pipW = 28, pipH = 20, pipGap = 10;
    const totalPipsW = pipW * maxPips + pipGap * (maxPips - 1);
    const pipsX = Xammo + Math.floor((Wammo - totalPipsW) / 2);
    const pipsY = Py + Math.floor(PH * 0.62) - Math.floor(pipH / 2);

    for (let i = 0; i < maxPips; i++) {
      const px = pipsX + i * (pipW + pipGap);
      const filled_pip = i < filled;
      
      // Draw ornate pip frame
      drawOrnateFrame(ctx, px, pipsY, pipW, pipH, {
        palette: filled_pip ? FRAME_PALETTES.gold : FRAME_PALETTES.bronze,
        borderWidth: 2,
        cornerSize: 4,
        notchSize: 1,
        notchSpacing: 8,
        includeTexture: true,
        textureIntensity: 0.05,
        glowIntensity: filled_pip ? 0.4 : 0
      });
      
      // Inner fill
      const innerGradient = ctx.createLinearGradient(px + 4, pipsY + 4, px + pipW - 4, pipsY + pipH - 4);
      if (filled_pip) {
        innerGradient.addColorStop(0, PIP_ON);
        innerGradient.addColorStop(1, "#cc8800");
      } else {
        innerGradient.addColorStop(0, PIP_OFF);
        innerGradient.addColorStop(1, "#1a1510");
      }
      ctx.fillStyle = innerGradient;
      ctx.fillRect(px + 4, pipsY + 4, pipW - 8, pipH - 8);
      
      // Add glow for filled pips
      if (filled_pip) {
        drawPulsingGlow(ctx, px, pipsY, pipW, pipH, "#ffc107", 0.3, Date.now() + i * 200);
      }
    }
  }
  unclip(ctx);

  /* ---- SCORE SECTION WITH ENHANCED RPG STYLING ---- */
  clipInner(ctx, Xscore, Py, Wscore, PH);
  {
    // Add decorative background pattern
    const scoreBgGradient = ctx.createLinearGradient(Xscore, Py, Xscore + Wscore, Py + PH);
    scoreBgGradient.addColorStop(0, 'rgba(76, 175, 80, 0.1)');
    scoreBgGradient.addColorStop(1, 'rgba(27, 94, 32, 0.1)');
    ctx.fillStyle = scoreBgGradient;
    ctx.fillRect(Xscore + 8, Py + 8, Wscore - 16, PH - 16);

    const labelMaxW = Wscore - 28;
    const lblPx = fitPx(ctx, "SCORE", "Press Start 2P", hudLabelSize(), labelMaxW, LABEL_MIN_PX);
    resetText(ctx);
    ctx.fillStyle = GOLD_M;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.font = `bold ${lblPx}px 'Press Start 2P', monospace`;
    
    // Add text glow effect
    ctx.shadowColor = GOLD_M;
    ctx.shadowBlur = 8;
    ctx.fillText("SCORE", Xscore + 14, Py + 6);
    resetText(ctx);

    const scoreStr = String(state.score || 0).padStart(6, "0");
    const valMaxW = Wscore - 32;
    const valPx = fitPx(ctx, scoreStr, "Press Start 2P", hudValueSize(), valMaxW, VALUE_MIN_PX);
    resetText(ctx);
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.font = `bold ${valPx}px 'Press Start 2P', monospace`;
    
    // Enhanced text with multiple glow layers
    ctx.lineWidth = 3;
    ctx.strokeStyle = "rgba(0,0,0,0.75)";
    ctx.strokeText(scoreStr, Xscore + 16, Py + 46);
    
    ctx.shadowColor = "#00ff88";
    ctx.shadowBlur = 15;
    ctx.fillStyle = VAL;
    ctx.fillText(scoreStr, Xscore + 16, Py + 46);
    resetText(ctx);
  }
  unclip(ctx);
}

/* ---------------- Enhanced Combo banner with ornate styling ---------------- */
export function drawCombo(ctx) {
  if (!state.comboDisplay || (state.comboTimer || 0) <= 0) return;
  try { ctx.setTransform(1, 0, 0, 1, 0, 0); } catch {}
  state.comboTimer--;

  const cw = state.canvas.width | 0;
  const ch = state.canvas.height | 0;

  const px = Math.max(16, Math.min(30, Math.floor(cw * 0.03), Math.floor(ch * 0.045)));
  const text = String(state.comboDisplay);

  ctx.save();
  ctx.font = `900 ${px}px 'Press Start 2P', monospace`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const tw = Math.ceil(ctx.measureText(text).width);
  const boxW = Math.max(260, Math.min(Math.floor(cw * 0.78), tw + 44));
  const boxH = Math.max(42, Math.floor(px * 1.95));
  const boxX = Math.floor((cw - boxW) / 2);
  const boxY = Math.floor(ch * 0.46 - boxH / 2);

  // Unified military panel style.
  const g = ctx.createLinearGradient(0, boxY, 0, boxY + boxH);
  g.addColorStop(0, "rgba(45,53,40,0.96)");
  g.addColorStop(1, "rgba(28,34,25,0.96)");
  ctx.fillStyle = g;
  ctx.fillRect(boxX, boxY, boxW, boxH);

  ctx.strokeStyle = "#4b5320";
  ctx.lineWidth = 3;
  ctx.strokeRect(boxX + 1, boxY + 1, boxW - 2, boxH - 2);
  ctx.strokeStyle = "#cfb53b";
  ctx.lineWidth = 1.5;
  ctx.strokeRect(boxX + 5, boxY + 5, boxW - 10, boxH - 10);

  const pulse = ((Date.now() / 220) | 0) % 2 === 0 ? 0.85 : 0.55;
  ctx.shadowColor = `rgba(73,251,53,${pulse})`;
  ctx.shadowBlur = 12;
  ctx.fillStyle = "#49fb35";
  ctx.fillText(text, Math.floor(cw / 2), Math.floor(boxY + boxH / 2));
  ctx.restore();
}

// Helper functions for clipping
function clipInner(ctx, x, y, w, h) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x + 8, y + 8, w - 16, h - 16);
  ctx.clip();
}

function unclip(ctx) {
  ctx.restore();
}

export const groundHeight = 44;
