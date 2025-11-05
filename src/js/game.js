import { dom } from "./dom.js";
import { store, actions } from "./store.js";
import { screens } from "./screens.js";
import { bindInput } from "./input.js";
import { renderHUD } from "./hud.js";

let rafId = 0;
const ctx = dom.canvas?.getContext("2d");

function draw(){
  if (!ctx) return;
  ctx.clearRect(0, 0, dom.canvas.width, dom.canvas.height);
  // Example debug text
  ctx.fillStyle = "#0f0";
  ctx.font = "16px monospace";
  ctx.fillText(`Round ${store.round} | Sector ${store.sectorKey} | Score ${store.score}`, 12, 24);
}

function tick(){
  draw();
  renderHUD();
  rafId = requestAnimationFrame(tick);
}

export function startLoop(){
  cancelAnimationFrame(rafId);
  rafId = requestAnimationFrame(tick);
}
export function stopLoop(){
  cancelAnimationFrame(rafId);
  rafId = 0;
}

function onResize(){
  if (!dom.canvas) return;
  const rect = dom.canvas.getBoundingClientRect();
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  dom.canvas.width  = Math.round(rect.width  * dpr);
  dom.canvas.height = Math.round(rect.height * dpr);
  ctx?.setTransform(dpr,0,0,dpr,0,0);
}

function boot(){
  bindInput();
  onResize();
  renderHUD();
  screens.showStart();
}

window.addEventListener("resize", onResize, { passive:true });
window.addEventListener("orientationchange", onResize, { passive:true });
document.addEventListener("DOMContentLoaded", boot);