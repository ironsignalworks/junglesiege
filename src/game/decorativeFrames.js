// src/ui/decorativeFrames.js
// Enhanced decorative frame utilities for RPG-style UI elements

/**
 * RPG Frame Color Palettes
 */
export const FRAME_PALETTES = {
  gold: {
    light: '#fff176',
    bright: '#ffeb3b',
    base: '#ffc107',
    dark: '#ff8f00',
    shadow: '#e65100',
    accent: '#bf360c'
  },
  silver: {
    light: '#eceff1',
    bright: '#cfd8dc',
    base: '#90a4ae',
    dark: '#607d8b',
    shadow: '#37474f',
    accent: '#263238'
  },
  bronze: {
    light: '#d7ccc8',
    bright: '#bcaaa4',
    base: '#8d6e63',
    dark: '#5d4037',
    shadow: '#3e2723',
    accent: '#1b0000'
  },
  copper: {
    light: '#ffccbc',
    bright: '#ff8a65',
    base: '#ff5722',
    dark: '#d84315',
    shadow: '#bf360c',
    accent: '#8f2500'
  },
  steel: {
    light: '#b0bec5',
    bright: '#78909c',
    base: '#546e7a',
    dark: '#37474f',
    shadow: '#263238',
    accent: '#000000'
  }
};

/**
 * Draw ornate corner decorations
 * @param {CanvasRenderingContext2D} ctx 
 * @param {number} x 
 * @param {number} y 
 * @param {number} w 
 * @param {number} h 
 * @param {Object} palette 
 * @param {number} size 
 */
export function drawCornerOrnaments(ctx, x, y, w, h, palette = FRAME_PALETTES.gold, size = 8) {
  ctx.save();
  
  const corners = [
    { x: x - size/2, y: y - size/2 }, // top-left
    { x: x + w - size/2, y: y - size/2 }, // top-right
    { x: x - size/2, y: y + h - size/2 }, // bottom-left
    { x: x + w - size/2, y: y + h - size/2 } // bottom-right
  ];
  
  corners.forEach(corner => {
    // Outer ring
    const gradient = ctx.createRadialGradient(
      corner.x + size/2, corner.y + size/2, 0,
      corner.x + size/2, corner.y + size/2, size/2
    );
    gradient.addColorStop(0, palette.bright);
    gradient.addColorStop(0.6, palette.base);
    gradient.addColorStop(1, palette.shadow);
    
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(corner.x + size/2, corner.y + size/2, size/2, 0, Math.PI * 2);
    ctx.fill();
    
    // Inner highlight
    ctx.fillStyle = palette.light;
    ctx.beginPath();
    ctx.arc(corner.x + size/2, corner.y + size/2, size/4, 0, Math.PI * 2);
    ctx.fill();
    
    // Center dot
    ctx.fillStyle = palette.accent;
    ctx.beginPath();
    ctx.arc(corner.x + size/2, corner.y + size/2, size/8, 0, Math.PI * 2);
    ctx.fill();
  });
  
  ctx.restore();
}

/**
 * Draw decorative border notches
 * @param {CanvasRenderingContext2D} ctx 
 * @param {number} x 
 * @param {number} y 
 * @param {number} w 
 * @param {number} h 
 * @param {Object} palette 
 * @param {number} notchSize 
 * @param {number} spacing 
 */
export function drawBorderNotches(ctx, x, y, w, h, palette = FRAME_PALETTES.gold, notchSize = 4, spacing = 20) {
  ctx.save();
  
  // Top border notches
  for (let i = spacing; i < w - spacing; i += spacing * 2) {
    const notchX = x + i;
    const notchY = y - notchSize/2;
    
    ctx.fillStyle = palette.base;
    ctx.fillRect(notchX - notchSize/2, notchY, notchSize, notchSize);
    
    ctx.fillStyle = palette.light;
    ctx.fillRect(notchX - notchSize/2, notchY, notchSize/2, notchSize);
    
    ctx.fillStyle = palette.shadow;
    ctx.fillRect(notchX, notchY, notchSize/2, notchSize);
  }
  
  // Bottom border notches
  for (let i = spacing; i < w - spacing; i += spacing * 2) {
    const notchX = x + i;
    const notchY = y + h - notchSize/2;
    
    ctx.fillStyle = palette.base;
    ctx.fillRect(notchX - notchSize/2, notchY, notchSize, notchSize);
    
    ctx.fillStyle = palette.light;
    ctx.fillRect(notchX - notchSize/2, notchY, notchSize/2, notchSize);
    
    ctx.fillStyle = palette.shadow;
    ctx.fillRect(notchX, notchY, notchSize/2, notchSize);
  }
  
  // Left border notches
  for (let i = spacing; i < h - spacing; i += spacing * 2) {
    const notchX = x - notchSize/2;
    const notchY = y + i;
    
    ctx.fillStyle = palette.base;
    ctx.fillRect(notchX, notchY - notchSize/2, notchSize, notchSize);
    
    ctx.fillStyle = palette.light;
    ctx.fillRect(notchX, notchY - notchSize/2, notchSize, notchSize/2);
    
    ctx.fillStyle = palette.shadow;
    ctx.fillRect(notchX, notchY, notchSize, notchSize/2);
  }
  
  // Right border notches
  for (let i = spacing; i < h - spacing; i += spacing * 2) {
    const notchX = x + w - notchSize/2;
    const notchY = y + i;
    
    ctx.fillStyle = palette.base;
    ctx.fillRect(notchX, notchY - notchSize/2, notchSize, notchSize);
    
    ctx.fillStyle = palette.light;
    ctx.fillRect(notchX, notchY - notchSize/2, notchSize, notchSize/2);
    
    ctx.fillStyle = palette.shadow;
    ctx.fillRect(notchX, notchY, notchSize, notchSize/2);
  }
  
  ctx.restore();
}

/**
 * Draw metallic texture overlay
 * @param {CanvasRenderingContext2D} ctx 
 * @param {number} x 
 * @param {number} y 
 * @param {number} w 
 * @param {number} h 
 * @param {number} intensity 
 */
export function drawMetallicTexture(ctx, x, y, w, h, intensity = 0.05) {
  ctx.save();
  
  // Create texture pattern
  const patternCanvas = document.createElement('canvas');
  patternCanvas.width = 8;
  patternCanvas.height = 8;
  const patternCtx = patternCanvas.getContext('2d');
  
  // Draw diagonal lines
  patternCtx.strokeStyle = `rgba(255, 255, 255, ${intensity})`;
  patternCtx.lineWidth = 1;
  patternCtx.beginPath();
  patternCtx.moveTo(0, 0);
  patternCtx.lineTo(8, 8);
  patternCtx.stroke();
  
  patternCtx.strokeStyle = `rgba(0, 0, 0, ${intensity})`;
  patternCtx.beginPath();
  patternCtx.moveTo(8, 0);
  patternCtx.lineTo(0, 8);
  patternCtx.stroke();
  
  const pattern = ctx.createPattern(patternCanvas, 'repeat');
  ctx.fillStyle = pattern;
  ctx.fillRect(x, y, w, h);
  
  ctx.restore();
}

/**
 * Draw enhanced ornate frame with all decorative elements
 * @param {CanvasRenderingContext2D} ctx 
 * @param {number} x 
 * @param {number} y 
 * @param {number} w 
 * @param {number} h 
 * @param {Object} options 
 */
export function drawOrnateFrame(ctx, x, y, w, h, options = {}) {
  const {
    palette = FRAME_PALETTES.gold,
    borderWidth = 6,
    cornerSize = 12,
    notchSize = 4,
    notchSpacing = 24,
    includeTexture = true,
    textureIntensity = 0.05,
    glowIntensity = 0.4
  } = options;
  
  ctx.save();
  
  // Main frame background with gradient
  const gradient = ctx.createLinearGradient(x, y, x + w, y + h);
  gradient.addColorStop(0, palette.base);
  gradient.addColorStop(0.5, palette.dark);
  gradient.addColorStop(1, palette.base);
  ctx.fillStyle = gradient;
  ctx.fillRect(x, y, w, h);
  
  // Enhanced 3D borders
  ctx.lineWidth = borderWidth;
  
  // Outer light borders
  ctx.strokeStyle = palette.light;
  ctx.beginPath();
  ctx.moveTo(x, y + h);
  ctx.lineTo(x, y);
  ctx.lineTo(x + w, y);
  ctx.stroke();
  
  // Outer dark borders
  ctx.strokeStyle = palette.shadow;
  ctx.beginPath();
  ctx.moveTo(x + w, y);
  ctx.lineTo(x + w, y + h);
  ctx.lineTo(x, y + h);
  ctx.stroke();
  
  // Inner highlight
  ctx.lineWidth = borderWidth - 2;
  ctx.strokeStyle = palette.bright;
  ctx.beginPath();
  ctx.moveTo(x + 2, y + h - 2);
  ctx.lineTo(x + 2, y + 2);
  ctx.lineTo(x + w - 2, y + 2);
  ctx.stroke();
  
  // Inner shadow
  ctx.strokeStyle = palette.accent;
  ctx.beginPath();
  ctx.moveTo(x + w - 2, y + 2);
  ctx.lineTo(x + w - 2, y + h - 2);
  ctx.lineTo(x + 2, y + h - 2);
  ctx.stroke();
  
  // Add metallic texture
  if (includeTexture) {
    drawMetallicTexture(ctx, x + borderWidth, y + borderWidth, 
                       w - borderWidth * 2, h - borderWidth * 2, textureIntensity);
  }
  
  // Add decorative notches
  drawBorderNotches(ctx, x, y, w, h, palette, notchSize, notchSpacing);
  
  // Add corner ornaments
  drawCornerOrnaments(ctx, x, y, w, h, palette, cornerSize);
  
  // Add glow effect
  if (glowIntensity > 0) {
    ctx.shadowColor = palette.bright;
    ctx.shadowBlur = 15;
    ctx.globalAlpha = glowIntensity;
    ctx.strokeStyle = palette.bright;
    ctx.lineWidth = 1;
    ctx.strokeRect(x - 1, y - 1, w + 2, h + 2);
  }
  
  ctx.restore();
}

/**
 * Draw floating text with ornate background
 * @param {CanvasRenderingContext2D} ctx 
 * @param {string} text 
 * @param {number} x 
 * @param {number} y 
 * @param {Object} options 
 */
export function drawOrnateTextBox(ctx, text, x, y, options = {}) {
  const {
    font = "bold 12px 'Press Start 2P', monospace",
    textColor = '#ffffff',
    shadowColor = '#000000',
    palette = FRAME_PALETTES.gold,
    padding = 16,
    minWidth = 120,
    borderWidth = 4
  } = options;
  
  ctx.save();
  
  // Measure text
  ctx.font = font;
  const textMetrics = ctx.measureText(text);
  const textWidth = Math.max(minWidth, textMetrics.width + padding * 2);
  const textHeight = 32 + padding;
  
  // Center the box on the given coordinates
  const boxX = x - textWidth / 2;
  const boxY = y - textHeight / 2;
  
  // Draw ornate frame
  drawOrnateFrame(ctx, boxX, boxY, textWidth, textHeight, {
    palette,
    borderWidth,
    cornerSize: 8,
    notchSize: 3,
    notchSpacing: 20,
    includeTexture: true,
    textureIntensity: 0.03,
    glowIntensity: 0.3
  });
  
  // Draw inner panel
  const innerGradient = ctx.createLinearGradient(
    boxX + borderWidth, boxY + borderWidth,
    boxX + textWidth - borderWidth, boxY + textHeight - borderWidth
  );
  innerGradient.addColorStop(0, '#2a2a2a');
  innerGradient.addColorStop(1, '#1a1a1a');
  ctx.fillStyle = innerGradient;
  ctx.fillRect(boxX + borderWidth, boxY + borderWidth, 
               textWidth - borderWidth * 2, textHeight - borderWidth * 2);
  
  // Draw text with shadow
  ctx.font = font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  
  // Text shadow
  ctx.fillStyle = shadowColor;
  ctx.fillText(text, x + 1, y + 1);
  
  // Main text
  ctx.fillStyle = textColor;
  ctx.fillText(text, x, y);
  
  ctx.restore();
}

/**
 * Draw progress bar with ornate frame
 * @param {CanvasRenderingContext2D} ctx 
 * @param {number} x 
 * @param {number} y 
 * @param {number} w 
 * @param {number} h 
 * @param {number} progress 
 * @param {Object} options 
 */
export function drawOrnateProgressBar(ctx, x, y, w, h, progress, options = {}) {
  const {
    palette = FRAME_PALETTES.gold,
    fillPalette = FRAME_PALETTES.copper,
    borderWidth = 3,
    includeNotches = true
  } = options;
  
  ctx.save();
  
  // Draw recessed background frame
  drawOrnateFrame(ctx, x, y, w, h, {
    palette,
    borderWidth,
    cornerSize: 6,
    notchSize: 2,
    notchSpacing: 16,
    includeTexture: true,
    textureIntensity: 0.02,
    glowIntensity: 0
  });
  
  // Draw dark recessed background
  const bgGradient = ctx.createLinearGradient(x, y, x, y + h);
  bgGradient.addColorStop(0, '#0d0d0d');
  bgGradient.addColorStop(1, '#1a1a1a');
  ctx.fillStyle = bgGradient;
  ctx.fillRect(x + borderWidth + 1, y + borderWidth + 1, 
               w - (borderWidth + 1) * 2, h - (borderWidth + 1) * 2);
  
  // Draw progress fill if there's any progress
  if (progress > 0) {
    const fillWidth = Math.floor((w - (borderWidth + 2) * 2) * Math.max(0, Math.min(1, progress)));
    const fillX = x + borderWidth + 2;
    const fillY = y + borderWidth + 2;
    const fillH = h - (borderWidth + 2) * 2;
    
    if (fillWidth > 8) { // Only draw if wide enough
      // Fill gradient
      const fillGradient = ctx.createLinearGradient(fillX, fillY, fillX, fillY + fillH);
      fillGradient.addColorStop(0, fillPalette.light);
      fillGradient.addColorStop(0.5, fillPalette.base);
      fillGradient.addColorStop(1, fillPalette.dark);
      ctx.fillStyle = fillGradient;
      ctx.fillRect(fillX, fillY, fillWidth, fillH);
      
      // Fill highlight
      ctx.fillStyle = fillPalette.bright;
      ctx.fillRect(fillX, fillY, fillWidth, 2);
      
      // Fill shadow
      ctx.fillStyle = fillPalette.shadow;
      ctx.fillRect(fillX, fillY + fillH - 2, fillWidth, 2);
      
      // Add metallic texture to fill
      drawMetallicTexture(ctx, fillX, fillY, fillWidth, fillH, 0.1);
    }
  }
  
  ctx.restore();
}

/**
 * Draw pulsing glow effect around an element
 * @param {CanvasRenderingContext2D} ctx 
 * @param {number} x 
 * @param {number} y 
 * @param {number} w 
 * @param {number} h 
 * @param {string} color 
 * @param {number} intensity 
 * @param {number} time 
 */
export function drawPulsingGlow(ctx, x, y, w, h, color = '#ffc107', intensity = 0.5, time = 0) {
  ctx.save();
  
  const pulse = Math.sin(time * 0.003) * 0.3 + 0.7; // Oscillates between 0.4 and 1.0
  const glowSize = 10 + pulse * 5;
  
  ctx.shadowColor = color;
  ctx.shadowBlur = glowSize;
  ctx.globalAlpha = intensity * pulse;
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.strokeRect(x - 2, y - 2, w + 4, h + 4);
  
  ctx.restore();
}