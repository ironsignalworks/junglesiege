import { state } from "../core/state.js";
import { firePlayerBullet } from "./projectiles.js";

export function attachKeyboard() {
  // Remove existing listeners to prevent duplicates
  document.removeEventListener("keydown", onDown);
  document.removeEventListener("keyup", onUp);
  
  document.addEventListener("keydown", onDown);
  document.addEventListener("keyup", onUp);
  
  console.log("[keyboard] Keyboard input attached");
}

function onDown(e) {
  const k = e.key || e.code || '';
  console.log("[keyboard] Key down:", k, "State before:", {
    keyLeft: state.keyLeft,
    keyRight: state.keyRight,
    keyUp: state.keyUp,
    keyDown: state.keyDown
  });
  
  if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown',' ','Space','Spacebar','KeyA','KeyD','KeyW','KeyS','a','d','w','s'].includes(k)) { 
    try { e.preventDefault(); } catch {} 
  }
  
  if (e.key === "ArrowLeft" || e.code === "ArrowLeft" || e.key === "a" || e.code === "KeyA") {
    // Make horizontal keys mutually exclusive to avoid ghost drift
    state.keyLeft = true;
    state.keyRight = false;
    console.log("[keyboard] Set keyLeft = true, keyRight = false");
  }
  if (e.key === "ArrowRight" || e.code === "ArrowRight" || e.key === "d" || e.code === "KeyD") {
    state.keyRight = true;
    state.keyLeft = false;
    console.log("[keyboard] Set keyRight = true, keyLeft = false");
  }
  if (e.key === "ArrowUp" || e.code === "ArrowUp" || e.key === "w" || e.code === "KeyW") {
    state.keyUp = true;
    console.log("[keyboard] Set keyUp = true");
  }
  if (e.key === "ArrowDown" || e.code === "ArrowDown" || e.key === "s" || e.code === "KeyS") {
    state.keyDown = true;
    console.log("[keyboard] Set keyDown = true");
  }
  if (e.key === " " || e.key === "Spacebar" || e.code === "Space") firePlayerBullet();
}

function onUp(e) {
  console.log("[keyboard] Key up:", e.key || e.code);
  
  if (e.key === "ArrowLeft" || e.code === "ArrowLeft" || e.key === "a" || e.code === "KeyA") {
    state.keyLeft = false;
    console.log("[keyboard] Set keyLeft = false");
  }
  if (e.key === "ArrowRight" || e.code === "ArrowRight" || e.key === "d" || e.code === "KeyD") {
    state.keyRight = false;
    console.log("[keyboard] Set keyRight = false");
  }
  if (e.key === "ArrowUp" || e.code === "ArrowUp" || e.key === "w" || e.code === "KeyW") {
    state.keyUp = false;
    console.log("[keyboard] Set keyUp = false");
  }
  if (e.key === "ArrowDown" || e.code === "ArrowDown" || e.key === "s" || e.code === "KeyS") {
    state.keyDown = false;
    console.log("[keyboard] Set keyDown = false");
  }
}

// Clear keys on window blur to avoid stuck movement
window.addEventListener('blur', () => {
  state.keyLeft = false;
  state.keyRight = false;
  state.keyUp = false;
  state.keyDown = false;
  if (state.keys && typeof state.keys.clear === 'function') state.keys.clear();
  console.log('[keyboard] Cleared keys on window blur');
});
