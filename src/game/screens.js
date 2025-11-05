// src/ui/screens.js
import { state } from "../core/state.js";
import { resources } from "./resources.js";

export function showEndScreen(kind = "fail", opts = {}) {
  if (document.getElementById('end-screen')) return;
  try { window.dispatchEvent(new Event('end-screen-open')); } catch {}
  for (const id of ["how-to-play","htp","overlay"]) {
    const el = document.getElementById(id);
    if (el) try { el.remove(); } catch {}
  }

  const canvas = document.getElementById("gameCanvas") || document.querySelector("canvas");
  if (canvas) canvas.style.display = "none";

  const isVictory = String(kind).toLowerCase() === "victory";
  const defaultImg = isVictory ? "victory.png" : "gameover.png";

  let bgUrl = `assets/images/${defaultImg}`;
  try {
    const imgObj = resources?.images?.[defaultImg];
    if (imgObj && (imgObj.currentSrc || imgObj.src)) bgUrl = imgObj.currentSrc || imgObj.src;
  } catch {}

  let screen = document.getElementById("end-screen");
  if (!screen) {
    screen = document.createElement("div");
    screen.id = "end-screen";
    screen.className = "screen-container-4x3"; // Use same class as other screens
    document.body.appendChild(screen);
  }
  
  // FORCE 4:3 positioning like other screens with ENHANCED BEVELED STYLING
  Object.assign(screen.style, {
    position: "fixed",
    left: "50%",
    top: "50%",
    transform: "translate(-50%, -50%)",
    width: "min(100vw, calc(100vh * 4 / 3))",
    height: "calc(min(100vw, calc(100vh * 4 / 3)) * 3 / 4)",
    background: "#000",
    zIndex: "20000",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center",
    // ENHANCED BEVELED BORDER STYLING
    border: isVictory ? "6px solid" : "6px solid",
    borderColor: isVictory ? 
      "#c7ffc7 #1a5a1a #1a5a1a #c7ffc7" : 
      "#ff6b6b #5a1a1a #5a1a1a #ff6b6b",
    boxShadow: isVictory ? 
      `inset 3px 3px 0 #9fdf9f, 
       inset -3px -3px 0 #0d3d0d, 
       inset 6px 6px 0 #7fcf7f, 
       inset -6px -6px 0 #083308, 
       0 0 30px rgba(199, 255, 199, 0.4)` : 
      `inset 3px 3px 0 #ff9f9f,
       inset -3px -3px 0 #3d0d0d,
       inset 6px 6px 0 #ff7f7f,
       inset -6px -6px 0 #330808,
       0 0 30px rgba(255, 107, 107, 0.4)`,
    overflow: "hidden",
    pointerEvents: "all",
  });

  // Clear existing content and rebuild
  screen.innerHTML = "";

  // Background image
  let bg = document.createElement("img");
  bg.id = "end-bg";
  bg.alt = isVictory ? "Victory" : "Mission Failed";
  bg.decoding = "async";
  bg.src = bgUrl;
  Object.assign(bg.style, {
    position: "absolute",
    top: "0",
    left: "0",
    width: "100%",
    height: "100%",
    objectFit: "cover", // Changed from "contain" to "cover" to fill viewport
    objectPosition: "center center", // Center the image when cropped
    pointerEvents: "none",
    filter: isVictory ? "saturate(1.1) contrast(1.05)" : "grayscale(0.1) brightness(0.8)",
    zIndex: "1",
  });
  screen.appendChild(bg);

  // Content overlay
  let overlay = document.createElement("div");
  overlay.id = "end-overlay";
  Object.assign(overlay.style, {
    position: "relative",
    zIndex: "2",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "1rem",
    padding: "1rem",
    textAlign: "center",
    fontFamily: "var(--military-font)",
    color: isVictory ? "#e6ffe6" : "#ffe6e6",
    textShadow: "0 2px 4px rgba(0,0,0,.8)",
    pointerEvents: "none",
    width: "100%",
    height: "100%",
  });
  screen.appendChild(overlay);

  // Title
  let title = document.createElement("div");
  title.id = "end-title";
  title.textContent = isVictory ? (opts.title || "VICTORY") : (opts.title || "MISSION FAILED");
  Object.assign(title.style, {
    fontSize: "clamp(2rem, 6vw, 4rem)",
    fontWeight: "900",
    letterSpacing: "2px",
    textTransform: "uppercase",
    margin: "1rem auto",
    textShadow: isVictory ? "0 0 15px #c7ffc7" : "0 0 15px #ff4d4d",
  });
  overlay.appendChild(title);

  // Stats
  let stats = document.createElement("div");
  stats.id = "end-stats";
  const score = (state.score ?? 0);
  let bestScore = 0;
  try { bestScore = parseInt(localStorage.getItem("bestScore") || "0", 10) || 0; } catch {}
  if (score > bestScore) {
    bestScore = score;
    try { localStorage.setItem("bestScore", String(bestScore)); } catch {}
  }
  stats.innerHTML = `
    <div style="color:#ffc107;font-weight:900;letter-spacing:1px;font-size:clamp(1rem,3vw,2rem);text-shadow:0 0 6px rgba(255,193,7,.45);margin:0.5rem auto;">FINAL SCORE: <b>${score}</b></div>
    <div style="opacity:.9;color:#ffe59e;font-size:clamp(0.8rem,2.5vw,1.5rem);margin:0.5rem auto;">BEST: <b>${bestScore}</b></div>
  `;
  Object.assign(stats.style, {
    pointerEvents: "none",
    margin: "1rem auto",
  });
  overlay.appendChild(stats);

  // Restart button
  let btn = document.createElement("button");
  btn.id = "restart-button";
  btn.textContent = isVictory ? "PLAY AGAIN" : "RESTART";
  Object.assign(btn.style, {
    fontFamily: "var(--military-font)",
    fontSize: "clamp(0.8rem, 2.5vw, 1.1rem)",
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    width: "min(250px, 70%)",
    padding: "1em 1.5em",
    cursor: "pointer",
    background: "linear-gradient(135deg, #b8860b, #daa520)",
    border: "3px solid #ffc107",
    color: "#000",
    borderRadius: "10px",
    boxShadow: "0 0 15px rgba(255, 193, 7, 0.6)",
    transition: "all 0.25s ease",
    margin: "1rem auto 0 auto",
    display: "block",
    fontWeight: "bold",
    pointerEvents: "auto",
    zIndex: "3",
  });
  overlay.appendChild(btn);

  // Remove the layoutEndFrame function - not needed with CSS positioning
  state.gameStarted = false;

  const restart = () => {
    try { document.removeEventListener('keydown', keyHandler, true); } catch{};
    try { window.dispatchEvent(new Event('end-screen-cleanup')); } catch{};

    // show canvas immediately to avoid a black flash
    const cv = document.getElementById("gameCanvas") || document.querySelector("canvas");
    if (cv) cv.style.display = "block";
    screen.style.display = "none";

    // Preferred: in-app restart if your boot exposes it
    try {
      if (typeof window.restartGame === "function") {
        window.restartGame();
        return;
      }
    } catch (e) {
      console.warn("[screens] restartGame hook failed, reloading:", e);
    }

    // Guaranteed fallback
    location.reload();
  };

  btn.onclick = restart;
  function keyHandler(e) {
    const overlayVisible = !!document.getElementById('end-screen');
    if (!overlayVisible) return;
    if (e.code === 'Enter' || e.code === 'Space') { e.preventDefault(); restart(); }
  }
  document.addEventListener("keydown", keyHandler, true);
}
