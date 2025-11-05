import { state } from "../core/state.js";
import { resources } from "./resources.js";
import { drawBeveledPanel, drawBeveledProgressBar, addGlowEffect } from "./beveledUI.js";

function wrapLines(ctx, text, maxWidth) {
  const words = String(text || "").split(/\s+/);
  const lines = [];
  let line = "";
  for (let i = 0; i < words.length; i++) {
    const t = line ? line + " " + words[i] : words[i];
    if (ctx.measureText(t).width > maxWidth && line) {
      lines.push(line);
      line = words[i];
    } else {
      line = t;
    }
  }
  if (line) lines.push(line);
  return lines;
}

export function drawBossHealthBar(ctx) {
  const boss = state.boss;
  if (!(boss && boss.isAlive)) return;

  const cw = state.canvas.width;
  const ch = state.canvas.height;
  
  // POSITION BOSS HP BAR FURTHER DOWN FROM TOP BAR
  const bw = Math.floor(cw * 0.8);
  const bh = 28; // Slightly taller for better beveling
  const bx = Math.floor((cw - bw) / 2);
  const by = 120; // MOVED FURTHER DOWN (was 50, now 120)

  ctx.save();
  ctx.globalAlpha = 1;

  // ENHANCED BEVELED BACKGROUND PANEL FOR BOSS NAME AND HEALTH
  const panelPadding = 16;
  const panelX = bx - panelPadding;
  const panelY = by - 55; // Space for boss name
  const panelW = bw + (panelPadding * 2);
  const panelH = bh + 55 + panelPadding;
  
  // Draw dark beveled panel background with enhanced depth
  drawBeveledPanel(ctx, panelX, panelY, panelW, panelH, 'dark', 'raised', 4);
  
  // Add outer glow for dramatic effect
  addGlowEffect(ctx, panelX, panelY, panelW, panelH, '#ffc107', 0.3);

  // Boss name wrapped ABOVE the bar with consistent 2-player font
  const padX = 24; // More padding inside beveled panel
  const nameMaxW = bw - padX * 2;
  ctx.font = "bold 14px 'Press Start 2P', monospace";
  ctx.fillStyle = "#fff";
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";

  const lines = wrapLines(ctx, boss.name || "BOSS", nameMaxW);
  const lineH = 18; // Better line height for readability
  // draw from bottom up so last line sits just above the bar
  let nameBottom = by - 10; // Adjusted for panel padding
  for (let i = lines.length - 1; i >= 0; i--) {
    // Enhanced text shadow for better contrast
    ctx.fillStyle = "#000";
    ctx.fillText(lines[i], bx + padX + 2, nameBottom + 2);
    ctx.fillStyle = "#000";
    ctx.fillText(lines[i], bx + padX + 1, nameBottom + 1);
    // Main text with slight glow
    ctx.shadowColor = "rgba(255, 255, 255, 0.6)";
    ctx.shadowBlur = 4;
    ctx.fillStyle = "#fff";
    ctx.fillText(lines[i], bx + padX, nameBottom);
    ctx.shadowBlur = 0;
    nameBottom -= lineH;
  }

  // Enhanced beveled health bar using unified system
  const pct = Math.max(0, Math.min(1, boss.health / boss.maxHealth));
  drawBeveledProgressBar(ctx, bx, by, bw, bh, pct, 'health');
  
  // Add outer glow for the health bar specifically
  addGlowEffect(ctx, bx, by, bw, bh, '#ffffff', 0.6);

  // HP text display with enhanced beveled background
  const hpText = `${Math.ceil(boss.health)}/${boss.maxHealth}`;
  ctx.font = "10px 'Press Start 2P', monospace";
  ctx.textAlign = "right";
  ctx.textBaseline = "bottom";
  
  // Position HP text in bottom-right of health bar with enhanced beveled background
  const hpX = bx + bw - 16;
  const hpY = by + bh - 8;
  
  // Calculate text background size
  const hpTextWidth = ctx.measureText(hpText).width + 12;
  const hpTextHeight = 16;
  const hpBgX = hpX - hpTextWidth + 6;
  const hpBgY = hpY - hpTextHeight + 4;
  
  // Draw small beveled background for HP text with enhanced depth
  drawBeveledPanel(ctx, hpBgX, hpBgY, hpTextWidth, hpTextHeight, 'standard', 'recessed', 2);
  
  // Draw HP text with enhanced shadow and glow
  ctx.fillStyle = "#000";
  ctx.fillText(hpText, hpX + 2, hpY + 2);
  ctx.fillStyle = "#000";
  ctx.fillText(hpText, hpX + 1, hpY + 1);
  ctx.shadowColor = "rgba(255, 255, 255, 0.8)";
  ctx.shadowBlur = 3;
  ctx.fillStyle = "#fff";
  ctx.fillText(hpText, hpX, hpY);

  ctx.restore();
}
