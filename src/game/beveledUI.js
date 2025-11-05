// src/ui/beveledUI.js
// Unified beveled UI drawing utilities for consistent Wolfenstein/Diablo aesthetic

/* Enhanced Color Palettes for Different UI Styles */
export const BEVEL_COLORS = {
  // Standard light panels (HUD elements)
  standard: {
    light: "#ffffff",
    highlight: "#e8e8e8", 
    face: "#b8b8b8",
    shadow: "#6a6a6a",
    dark: "#2a2a2a",
    darkest: "#000000"
  },
  
  // Dark panels (story cards, modals)
  dark: {
    light: "#666666",
    highlight: "#505050",
    face: "#3a3a3a", 
    shadow: "#252525",
    dark: "#1a1a1a",
    darkest: "#0d0d0d"
  },
  
  // HUD panels (bright yellow accents)
  hud: {
    light: "#ffeb3b",
    highlight: "#ffc107",
    face: "#ff9800",
    shadow: "#f57c00", 
    dark: "#e65100",
    darkest: "#bf360c"
  },
  
  // Health/danger elements
  health: {
    light: "#ff6b6b",
    highlight: "#ff5252",
    face: "#e53e3e",
    shadow: "#c62828",
    dark: "#8b1a1a", 
    darkest: "#4a0e0e"
  }
};

/**
 * Draw a 3D beveled panel with enhanced depth
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {number} x - X position
 * @param {number} y - Y position  
 * @param {number} w - Width
 * @param {number} h - Height
 * @param {string} style - Color style ('standard', 'dark', 'hud', 'health')
 * @param {string} bevelType - Bevel type ('raised', 'recessed')
 * @param {number} depth - Border depth (1-4)
 */
export function drawBeveledPanel(ctx, x, y, w, h, style = 'standard', bevelType = 'raised', depth = 3) {
  x = Math.round(x);
  y = Math.round(y); 
  w = Math.round(w);
  h = Math.round(h);
  
  const colors = BEVEL_COLORS[style] || BEVEL_COLORS.standard;
  
  ctx.save();
  
  // Draw main panel background with gradient
  const gradient = ctx.createLinearGradient(x, y, x + w, y + h);
  gradient.addColorStop(0, colors.face);
  gradient.addColorStop(1, colors.shadow);
  ctx.fillStyle = gradient;
  ctx.fillRect(x, y, w, h);
  
  // Draw 3D borders based on bevel type
  const isRaised = bevelType === 'raised';
  const borderWidth = Math.max(1, depth);
  
  // Outer borders
  ctx.lineWidth = borderWidth;
  
  // Top and left borders
  ctx.strokeStyle = isRaised ? colors.light : colors.dark;
  ctx.beginPath();
  ctx.moveTo(x, y + h);
  ctx.lineTo(x, y);
  ctx.lineTo(x + w, y);
  ctx.stroke();
  
  // Bottom and right borders  
  ctx.strokeStyle = isRaised ? colors.dark : colors.light;
  ctx.beginPath();
  ctx.moveTo(x + w, y);
  ctx.lineTo(x + w, y + h);
  ctx.lineTo(x, y + h);
  ctx.stroke();
  
  // Inner highlight/shadow borders
  if (depth > 1) {
    ctx.lineWidth = Math.max(1, depth - 1);
    
    // Inner highlight
    ctx.strokeStyle = isRaised ? colors.highlight : colors.darkest;
    ctx.beginPath();
    ctx.moveTo(x + borderWidth, y + h - borderWidth);
    ctx.lineTo(x + borderWidth, y + borderWidth);
    ctx.lineTo(x + w - borderWidth, y + borderWidth);
    ctx.stroke();
    
    // Inner shadow
    ctx.strokeStyle = isRaised ? colors.shadow : colors.highlight;
    ctx.beginPath();
    ctx.moveTo(x + w - borderWidth, y + borderWidth);
    ctx.lineTo(x + w - borderWidth, y + h - borderWidth);
    ctx.lineTo(x + borderWidth, y + h - borderWidth);
    ctx.stroke();
  }
  
  // Deepest borders for maximum depth
  if (depth > 2) {
    ctx.lineWidth = 1;
    
    const innerOffset = borderWidth + 1;
    
    ctx.strokeStyle = isRaised ? colors.darkest : colors.face;
    ctx.beginPath();
    ctx.moveTo(x + w - innerOffset, y + innerOffset);
    ctx.lineTo(x + w - innerOffset, y + h - innerOffset);
    ctx.lineTo(x + innerOffset, y + h - innerOffset);
    ctx.stroke();
    
    ctx.strokeStyle = isRaised ? colors.face : colors.darkest;
    ctx.beginPath();
    ctx.moveTo(x + innerOffset, y + h - innerOffset);
    ctx.lineTo(x + innerOffset, y + innerOffset);
    ctx.lineTo(x + w - innerOffset, y + innerOffset);
    ctx.stroke();
  }
  
  ctx.restore();
}

/**
 * Draw a 3D beveled button
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {number} x - X position
 * @param {number} y - Y position
 * @param {number} w - Width
 * @param {number} h - Height
 * @param {string} text - Button text
 * @param {boolean} pressed - Whether button appears pressed
 * @param {string} style - Color style
 */
export function drawBeveledButton(ctx, x, y, w, h, text, pressed = false, style = 'hud') {
  const bevelType = pressed ? 'recessed' : 'raised';
  const textOffset = pressed ? 2 : 0;
  
  // Draw button panel
  drawBeveledPanel(ctx, x, y, w, h, style, bevelType, 3);
  
  // Draw button text
  ctx.save();
  ctx.font = "bold 12px 'Press Start 2P', monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  
  // Text shadow
  ctx.fillStyle = "#000";
  ctx.fillText(text, x + w/2 + textOffset + 1, y + h/2 + textOffset + 1);
  
  // Main text
  ctx.fillStyle = style === 'dark' ? "#c7ffc7" : "#000";
  ctx.fillText(text, x + w/2 + textOffset, y + h/2 + textOffset);
  
  ctx.restore();
}

/**
 * Draw a 3D beveled progress bar
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {number} x - X position
 * @param {number} y - Y position
 * @param {number} w - Width
 * @param {number} h - Height
 * @param {number} progress - Progress value (0.0 to 1.0)
 * @param {string} fillStyle - Fill color style ('health', 'hud', etc.)
 */
export function drawBeveledProgressBar(ctx, x, y, w, h, progress, fillStyle = 'health') {
  // Draw recessed background
  drawBeveledPanel(ctx, x, y, w, h, 'dark', 'recessed', 2);
  
  // Draw progress fill if there's any progress
  if (progress > 0) {
    const fillWidth = Math.floor((w - 6) * Math.max(0, Math.min(1, progress)));
    const fillX = x + 3;
    const fillY = y + 3;
    const fillH = h - 6;
    
    if (fillWidth > 4) { // Only draw if wide enough for borders
      drawBeveledPanel(ctx, fillX, fillY, fillWidth, fillH, fillStyle, 'raised', 2);
    }
  }
}

/**
 * Draw a 3D beveled window/dialog frame
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {number} x - X position
 * @param {number} y - Y position
 * @param {number} w - Width
 * @param {number} h - Height
 * @param {string} title - Window title (optional)
 */
export function drawBeveledWindow(ctx, x, y, w, h, title = '') {
  // Main window panel
  drawBeveledPanel(ctx, x, y, w, h, 'dark', 'raised', 4);
  
  // Title bar if title provided
  if (title) {
    const titleBarHeight = 32;
    drawBeveledPanel(ctx, x + 4, y + 4, w - 8, titleBarHeight, 'hud', 'raised', 2);
    
    // Title text
    ctx.save();
    ctx.font = "bold 10px 'Press Start 2P', monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#000";
    ctx.fillText(title, x + w/2 + 1, y + 4 + titleBarHeight/2 + 1);
    ctx.fillStyle = "#000";
    ctx.fillText(title, x + w/2, y + 4 + titleBarHeight/2);
    ctx.restore();
  }
}

/**
 * Apply enhanced glow effect for HUD elements
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {number} x - X position
 * @param {number} y - Y position
 * @param {number} w - Width
 * @param {number} h - Height
 * @param {string} color - Glow color
 * @param {number} intensity - Glow intensity
 */
export function addGlowEffect(ctx, x, y, w, h, color = '#ffc107', intensity = 0.4) {
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = 12;
  ctx.globalAlpha = intensity;
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.strokeRect(x - 1, y - 1, w + 2, h + 2);
  ctx.restore();
}