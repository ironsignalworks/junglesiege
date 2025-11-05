// src/input/pointer.js
import { state } from "../core/state.js";
import { firePlayerBullet } from "./projectiles.js";
import { constants } from "./constants.js";

function toCanvasXY(canvas, clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const x = ((clientX - rect.left) / rect.width) * canvas.width;
  const y = ((clientY - rect.top)  / rect.height) * canvas.height;
  return [x, y];
}

export function attachPointer() {
  const canvas = state.canvas || document.getElementById("gameCanvas");
  if (!canvas) {
    console.warn("[pointer] no canvas yet; will retry on next startGame()");
    return;
  }
  if (canvas._pointerBound) return;
  canvas._pointerBound = true;

  // Track recent pointer activity to prevent idle drift
  const now = () => (performance && performance.now ? performance.now() : Date.now());
  state._lastPointerMove = state._lastPointerMove || 0;
  state._pointerInside = false;

  const markMove = (cx, cy) => {
    state.pointerX = cx;
    state.pointerY = cy;
    state._lastPointerMove = now();
  };

  const onMouseMove = (e) => {
    const [cx, cy] = toCanvasXY(canvas, e.clientX, e.clientY);
    markMove(cx, cy);
  };

  const onMouseDown = (e) => {
    e.preventDefault();
    state.pointerDown = true;
    // Suspend firing when overlays are active (boss intro/story cards) or input locked
    if (state.inputLocked || state.bossAnnouncementShowing || state.overlayActive) return;
    try { firePlayerBullet(); } catch {}
  };
  const onMouseUp = () => { state.pointerDown = false; };

  const onTouchMove = (e) => {
    e.preventDefault();
    const t = e.touches[0];
    if (!t) return;
    const [cx, cy] = toCanvasXY(canvas, t.clientX, t.clientY);
    markMove(cx, cy);
  };

  const onTouchStart = (e) => {
    e.preventDefault();
    state.pointerDown = true;
    state._pointerInside = true;
    if (state.inputLocked || state.bossAnnouncementShowing || state.overlayActive) return;
    try { firePlayerBullet(); } catch {}
  };
  const onTouchEnd = () => { state.pointerDown = false; state._pointerInside = false; };

  canvas.addEventListener("mousemove", onMouseMove);
  canvas.addEventListener("mousedown", onMouseDown);
  window.addEventListener("mouseup", onMouseUp);
  canvas.addEventListener("touchmove", onTouchMove, { passive: false });
  canvas.addEventListener("touchstart", onTouchStart, { passive: false });
  window.addEventListener("touchend", onTouchEnd, { passive: true });
  canvas.addEventListener("mouseenter", () => { state._pointerInside = true; });
  canvas.addEventListener("mouseleave", () => { state._pointerInside = false; });

  // Follow pointer only when recently moved or pointer is down; no idle drift
  if (!state._pointerFollowTimer) {
    state._pointerFollowTimer = setInterval(() => {
      if (!state.gameStarted) return;
      const { pointerX, tank } = state;
      if (!tank || !Number.isFinite(pointerX)) return;

      const recentlyMoved = (now() - (state._lastPointerMove || 0)) <= 200;
      if (!state.keyLeft && !state.keyRight && (recentlyMoved || state.pointerDown) && state._pointerInside) {
        tank.x += (pointerX - (tank.x + tank.width / 2)) * 0.22;
      }

      const c = state.canvas;
      if (!c) return;
      
      // Clamp X position
      tank.x = Math.max(0, Math.min(c.width - tank.width, tank.x));

      // REMOVED: Y position override that was preventing keyboard movement
      // tank.y = c.height - bottomBar - tank.height;
    }, 30);
  }

  console.log("[pointer] bound");
}
