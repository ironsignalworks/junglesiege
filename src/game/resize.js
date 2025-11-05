// src/core/resize.js
import { state } from "../core/state.js";

export function fitCanvasToViewport() {
  const c = state.canvas || document.getElementById("gameCanvas");
  if (!c) return;

  // CSS size
  const cssW = Math.max(1, Math.floor(window.innerWidth));
  const cssH = Math.max(1, Math.floor(window.innerHeight));

  // Device pixel ratio at current zoom
  const dpr = window.devicePixelRatio || 1;
  state.dpr = dpr;

  // Backing store in device pixels
  c.width  = Math.round(cssW * dpr);
  c.height = Math.round(cssH * dpr);

  // CSS presentation size (dont scale via CSS transforms)
  c.style.width  = cssW + "px";
  c.style.height = cssH + "px";

  // Crisp sprites
  const ctx = c.getContext("2d");
  if (ctx) ctx.imageSmoothingEnabled = false;
}
