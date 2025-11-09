// src/ui/screens.js
import { state } from "../core/state.js";
import { resources } from "./resources.js";

export function showEndScreen(kind = "fail", opts = {}) {
  try {
    if (String(kind).toLowerCase() === 'victory') {
      resources.audio?.fxVictoryFanfare && resources.audio.fxVictoryFanfare.play?.().catch(()=>{});
    } else {
      resources.audio?.gameOverMusic && resources.audio.gameOverMusic.play?.().catch(()=>{});
    }
  } catch {}

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
  
  // Fullscreen overlay styling
  Object.assign(screen.style, {
    position: "fixed",
    inset: "0",
    width: "100vw",
    height: "100vh",
    background: "#000",
    zIndex: "20000",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center",
    // No decorative border for fullscreen
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
    objectFit: "cover", // fill viewport
    objectPosition: "center center",
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

  state.gameStarted = false;

  const restart = () => {
    try { document.removeEventListener('keydown', keyHandler, true); } catch{};
    try { window.dispatchEvent(new Event('end-screen-cleanup')); } catch{};

    const cv = document.getElementById("gameCanvas") || document.querySelector("canvas");
    if (cv) cv.style.display = "block";
    screen.style.display = "none";

    try {
      if (typeof window.restartGame === "function") {
        window.restartGame();
        return;
      }
    } catch (e) {
      console.warn("[screens] restartGame hook failed, reloading:", e);
    }

    location.reload();
  };

  // Gate restart behind explicit click
  btn.onclick = restart;
}

