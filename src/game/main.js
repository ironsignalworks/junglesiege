// src/main.js
import { state, updateCanvasSize, resetGame, playSound } from "../core/state.js";
import { constants } from "./constants.js";

// CRITICAL: Expose state globally for HUD updater
if (typeof window !== "undefined") {
  window.state = state;
  console.log("[main] Global state exposed for HUD updater");
}

import { loadAllResources, verifyBossAssets } from "./loader.js";
import { GameScene } from "./GameScene.js";
import { gameLoopFactory } from "./loop.js";
import { attachKeyboard } from "./keyboard.js";
import { attachPointer } from "./pointer.js";
import { initNapalmState, triggerNapalmStrike } from "./napalm.js";

// Enhanced RPG HUD with dynamic effects
import { dynamicFrameEffects } from "./dynamicFrameEffects.js";

// Preflight deps
import { resources } from "./resources.js";
import { bossDefinitions } from "./boss.js";
import { verifyResources } from "./preflight.js";

console.log("[main] script loaded");

// --- Optimized resize debounce (core-level) ---
const debounceResize = (() => {
  let timeoutId;
  const cache = new Map();
  return (fn, wait = 200) => {
    const key = fn.toString();
    if (cache.has(key)) return cache.get(key);
    
    const debouncedFn = (...args) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => fn.apply(null, args), wait);
    };
    
    cache.set(key, debouncedFn);
    return debouncedFn;
  };
})();

// --- Optimized DOM creation with templates ---
const createElementFromTemplate = (() => {
  const templateCache = new Map();
  
  return (templateHTML, id) => {
    let template = templateCache.get(templateHTML);
    if (!template) {
      template = document.createElement('template');
      template.innerHTML = templateHTML;
      templateCache.set(templateHTML, template);
    }
    
    const element = template.content.cloneNode(true).firstElementChild;
    if (id) element.id = id;
    return element;
  };
})();


// Keep HUD DOM in sync with state every frame (very cheap)
function __syncHudDom__() {
  try {
    const hpEl = document.getElementById('hud-health-value');
    const ammoEl = document.getElementById('hud-ammo-value');
    const scoreEl = document.getElementById('hud-score');
    if (hpEl) hpEl.textContent = String(state.health ?? 0);
    if (ammoEl) ammoEl.textContent = (state.ammo === Infinity ? '∞' : String(state.ammo ?? 0));
    if (scoreEl) scoreEl.textContent = String(state.score ?? 0).padStart(6, '0');
  } catch {}
}

// Simple start screen check
function ensureStartScreen() {
  let s = document.getElementById('start-screen');
  if (s) {
    return s;
  }
  
  // Create fallback start screen
  const template = `<div id="start-screen" class="screen-container-4x3">
    <h1>JUNGLE SIEGE</h1>
    <h2>Iron Signal Works Presents</h2>
    <button id="start-button" disabled>CHAOS LOADING...</button>
  </div>`;
  
  document.body.insertAdjacentHTML('beforeend', template);
  return document.getElementById('start-screen');
}

// Simple HUD creation
function ensureFrameHud() {
  let hud = document.getElementById('screen-hud');
  if (!hud) {
    const template = `<div id="screen-hud">
      <div class="hud-bottom">
        <div class="hud-seg roundsector">
          <div class="tag"><span class="lbl">ROUND</span><span id="hud-round" class="val">01</span></div>
          <div class="tag"><span class="lbl">SECTOR</span><span id="hud-sector" class="val">ALPHA</span></div>
        </div>
        <div class="hud-seg hp">
          <span class="hud-label">HP</span>
          <div class="hp-bar">
            <div class="hp-fill" id="hud-hp-fill" style="width:100%"></div>
          </div>
          <span class="hud-value" id="hud-health-value">100</span>
        </div>
        <div class="hud-seg ammo">
          <span class="hud-label">AMMO</span>
          <div class="pips" id="hud-ammo-pips">
            <div class="pip on"></div>
            <div class="pip on"></div>
            <div class="pip on"></div>
            <div class="pip on"></div>
            <div class="pip on"></div>
            <div class="pip on"></div>
          </div>
          <span class="hud-value" id="hud-ammo-value">50</span>
        </div>
        <div class="hud-seg score">
          <span class="hud-label">SCORE</span>
          <span class="hud-value" id="hud-score">000000</span>
        </div>
      </div>
          
        </div>
      </div>
    </div>`;
    
    hud = createElementFromTemplate(template, 'screen-hud');
    
    // Append to game viewport
    const gameViewport = document.getElementById('game-viewport');
    if (gameViewport) {
      gameViewport.appendChild(hud);
    } else {
      document.body.appendChild(hud);
    }
    
    console.log("[main] Created HUD with proper element structure");
  }
  
  // Show HUD and set initial values
  hud.classList.remove('hidden');
  hud.removeAttribute('aria-hidden');
  hud.style.display = 'block';
  hud.style.opacity = '1';
  
  // Force initial values update
  const healthValue = document.getElementById('hud-health-value');
  const ammoValue = document.getElementById('hud-ammo-value');
  const scoreValue = document.getElementById('hud-score');
  const roundValue = document.getElementById('hud-round');
  const sectorValue = document.getElementById('hud-sector');
  
  if (healthValue) healthValue.textContent = '100';
  if (ammoValue) ammoValue.textContent = '50';
  if (scoreValue) scoreValue.textContent = '000000';
  if (roundValue) roundValue.textContent = '01';
  if (sectorValue) sectorValue.textContent = 'ALPHA';
  
  console.log("[main] HUD initialized with values:", {
    health: healthValue?.textContent,
    ammo: ammoValue?.textContent,
    score: scoreValue?.textContent,
    round: roundValue?.textContent,
    sector: sectorValue?.textContent
  });
  
  return hud;
}

// Create end screen
// (removed unused createEndScreen; end screen handled by screens.js)

// Simple game start
function startGame(scene, { startScreen, canvas } = {}) {
  console.log("[main] startGame() - State at start:", {
    health: state.health,
    ammo: state.ammo,
    score: state.score,
    round: state.round
  });
  
  // Remove any existing canvas
  const existingCanvas = document.getElementById("gameCanvas");
  if (existingCanvas) {
    existingCanvas.remove();
  }
  
  // Create canvas
  const stage = document.getElementById('stage');
  if (!stage) {
    console.error("Stage element not found!");
    return;
  }
  
  const c = document.createElement("canvas");
  c.id = "gameCanvas";
  c.width = 800;
  c.height = 600;
  c.className = "active";
  
  stage.appendChild(c);
  state.canvas = c;
  
  // Get context
  state.ctx = state.canvas.getContext("2d", {
    alpha: false,
    desynchronized: true,
    powerPreference: "high-performance"
  });

  // Hide start screen
  if (startScreen) {
    startScreen.classList.add("fade-out");
    setTimeout(() => {
      startScreen.style.display = "none";
    }, 500);
  }
  
  // Show HUD - CRITICAL FOR HUD UPDATES
  const frameHud = document.getElementById("screen-hud");
  if (frameHud) {
    frameHud.classList.remove("hidden");
    frameHud.removeAttribute("aria-hidden");
    frameHud.style.display = "block";
    frameHud.style.opacity = "1";
    frameHud.style.visibility = "visible";
    console.log("[main] HUD made visible");
    
    // Force update HUD elements immediately
    setTimeout(() => {
      const healthEl = document.getElementById('hud-health-value');
      const ammoEl = document.getElementById('hud-ammo-value');
      const scoreEl = document.getElementById('hud-score');
      
      if (healthEl) healthEl.textContent = String(state.health);
      if (ammoEl) ammoEl.textContent = state.ammo === Infinity ? '∞' : String(state.ammo);
      if (scoreEl) scoreEl.textContent = String(state.score).padStart(6, '0');
      
      console.log("[main] Force updated HUD values:", {
        health: healthEl?.textContent,
        ammo: ammoEl?.textContent,
        score: scoreEl?.textContent
      });
    }, 100);
  } else {
    console.warn("[main] screen-hud element not found");
  }

  // Initialize enhanced frame effects
  try {
    if (dynamicFrameEffects && !dynamicFrameEffects.isInitialized) {
      dynamicFrameEffects.init();
      console.log("[main] Dynamic frame effects initialized");
    }
  } catch (e) {
    console.warn("[main] Dynamic frame effects failed to initialize:", e);
  }

  // Input
  attachPointer();
  attachKeyboard();

  // Initialize game state
  state.tank = state.tank || { x: 0, y: 0, width: 64, height: 64 };
  state.health = 100;    // Initialize health
  
  // Fix ammo initialization based on constants
  if (constants?.ammoInfinite) {
    state.ammo = Infinity;
    console.log("[main] Set infinite ammo");
  } else {
    state.ammo = constants?.startingAmmo || 50;
    console.log("[main] Set finite ammo:", state.ammo);
  }
  
  state.score = 0;       // Initialize score
  state.round = 1;       // FORCE START AT ROUND 1
  state.sector = 'ALPHA'; // FORCE START AT SECTOR ALPHA (English name)
  state.bossIndex = 0;   // FORCE START AT FIRST BOSS
  state.gameStarted = true; // CRITICAL: Set this flag for HUD visibility
  
  updateCanvasSize({ keepTankPosition: false });
  
  state.tank.x = Math.max(0, (state.canvas.width / 2) - (state.tank.width / 2));
  state.tank.y = Math.max(0, state.canvas.height - (state.bottomBarHeight || 96) - state.tank.height);

  console.log("[main] Game state initialized:", {
    health: state.health,
    ammo: state.ammo,
    score: state.score,
    round: state.round,
    sector: state.sector,
    bossIndex: state.bossIndex,
    gameStarted: state.gameStarted
  });
  
  // Initialize systems
  try { 
    initNapalmState(); 
  } catch (e) { 
    console.warn("initNapalmState failed", e); 
  }

  // Enter scene
  if (scene?.enter) { 
    try { 
      scene.enter(); 
    } catch (e) { 
      console.error("Scene enter() failed:", e); 
    } 
  }

  // Game loop with enhanced effects
  if (!state._gameLoop) {
    let lastFrameTime = 0;
    
    state._gameLoop = gameLoopFactory(
      (now) => { 
        try { 
          // FIXED: Always call update, don't throttle based on deltaTime
          // The original code was preventing updates from running frequently enough
          scene?.update?.(now);
          lastFrameTime = now;
        } catch (e) { 
          console.error("update() crash:", e); 
        } 
      },
      (now) => { 
        try { 
          scene?.render?.(now); 
        } catch (e) { 
          console.error("render() crash:", e); 
        } 
      }
    );
    requestAnimationFrame(state._gameLoop);
  }

  // Resize handling
  const resizeHandler = debounceResize(() => updateCanvasSize({ keepTankPosition: true }), 150);
  window.addEventListener("resize", resizeHandler, { passive: true });

  // Event listeners with enhanced effects
  const keydownHandler = (e) => {
    if (e.code === "KeyN") { 
      try { 
        triggerNapalmStrike();
        // Trigger special effect for napalm
        dynamicFrameEffects?.triggerEffect('powerup');
      } catch (err) { 
        console.warn("napalm N failed", err); 
      } 
    }
  };
  
  const pointerHandler = () => {
    try { 
      triggerNapalmStrike();
      // Trigger special effect for napalm
      dynamicFrameEffects?.triggerEffect('electrical');
    } catch (err) { 
      console.warn("napalm touch failed", err); 
    }
  };

  window.addEventListener("keydown", keydownHandler, { passive: true });
  state.canvas.addEventListener("pointerdown", pointerHandler, { passive: true });

  // Hook into game events for visual effects
  const originalUpdateHUD = window.updateHUD;
  window.updateHUD = function(...args) {
    const prevHealth = state.health;
    const prevScore = state.score;
    
    if (originalUpdateHUD) {
      originalUpdateHUD.apply(this, args);
    }
    
    // Trigger effects based on state changes
    if (state.health < prevHealth) {
      const damageIntensity = (prevHealth - state.health) / 100;
      dynamicFrameEffects?.triggerEffect('damage', damageIntensity);
    }
    
    if (state.score > prevScore) {
      const scoreGain = state.score - prevScore;
      if (scoreGain >= 1000) {
        dynamicFrameEffects?.triggerEffect('critical');
      }
    }
    
    if (state.health <= 20) {
      dynamicFrameEffects?.triggerEffect('warning');
    }
  };
}

// expose restart hooks for screens.js
window.__startGame = startGame;
window.restartGame = () => {
  try {
    // Clear overlays
    const end = document.getElementById("end-screen");
    if (end) end.remove();

    // Cleanup dynamic effects
    try {
      dynamicFrameEffects?.destroy();
    } catch (e) {
      console.warn("Error cleaning up dynamic effects:", e);
    }
    // Return to START screen instead of restarting the level
    try {
      resetGame();
    } catch {}

    // Hide canvas and HUD
    const canvas = document.getElementById("gameCanvas");
    if (canvas) canvas.style.display = "none";
    const hud = document.getElementById("screen-hud");
    if (hud) hud.style.display = "none";

    // Show start screen and wait for user to press START
    const startScreen = document.getElementById("start-screen");
    if (startScreen) {
      startScreen.style.display = "grid";
      document.body.classList.remove("game-started");
    }
  } catch (e) {
    console.error("[main] restartGame failed, fallback reload:", e);
    location.reload();
  }
};

// Expose dynamic effects for external use
if (typeof window !== "undefined") {
  window.dynamicFrameEffects = dynamicFrameEffects;
}

// Critical asset computation
const computeCritical = (() => {
  let cachedResult = null;
  
  return () => {
    if (cachedResult) return cachedResult;
    
    const criticalImages = new Set([
      "bg_intro.png",
      ...bossDefinitions.flatMap(b => [b.image, b.backdrop, b.projectileType].filter(Boolean))
    ]);
    
    cachedResult = { 
      criticalImages: [...criticalImages], 
      criticalAudio: [] 
    };
    
    return cachedResult;
  };
})();

// (removed unused showCriticalOverlay)

// Preflight check
async function runPreflight() {
  console.info("[main] preflight check starting…");
  const { criticalImages, criticalAudio } = computeCritical();

  try {
    const { missing, critMissing } = await verifyResources(resources, {
      timeoutMs: 12000,
      criticalImages,
      criticalAudio,
      onProgress: (n, total) => {
        if (n === total || n % 10 === 0) {
          console.log(`[preflight] ${n}/${total}`);
        }
      },
    });

    if (missing.images.length || missing.audio.length) {
      console.warn("[preflight] Missing (any):", missing);
    }
    
    if (critMissing.images.length || critMissing.audio.length) {
      console.warn("[preflight] CRITICAL missing (non-blocking):", critMissing);
    }
    
    console.info("[preflight] OK");
    return { ok: true };
  } catch (error) {
    console.error("[preflight] Check failed:", error);
    return { ok: false, error };
  }
}

// Debug function
// (removed verbose debugPositioning util)

// Debug HUD state
// (removed verbose debugHUD util)

// Debug function to manually test HUD updates
// (removed testHUD helper)

// Force show HUD function
// (removed forceShowHUD helper)

// Game initialization
async function initGame() {
  console.log("[main] initGame()");
  
  // (removed debug positioning log)
  
  const [frameHud] = await Promise.all([
    Promise.resolve(ensureFrameHud()),
  ]);
  
  const startScreen = document.getElementById("start-screen") || ensureStartScreen();
  let startBtn = document.getElementById("start-button") || 
                 startScreen?.querySelector("#start-button");
                 
  if (!startBtn && startScreen) {
    startBtn = Object.assign(document.createElement("button"), {
      id: "start-button",
      disabled: true,
      textContent: "CHAOS LOADING..."
    });
    startScreen.appendChild(startBtn);
  }
  
  const canvas = document.getElementById("gameCanvas");

  // Initial updates
  if (canvas) canvas.style.display = "none";
  if (startBtn) {
    Object.assign(startBtn, {
      disabled: true,
      textContent: "CHECKING ASSETS…"
    });
  }

  // Preflight check
  const pre = await runPreflight();
  if (!pre.ok) {
    if (startBtn) {
      Object.assign(startBtn, {
        disabled: true,
        textContent: "MISSING ASSETS"
      });
    }
    return;
  }

  // Resource loading with safety timeout
  const totalAssets = 
    (Object.keys(resources.images || {}).length +
     Object.keys(resources.audio || {}).length);
     
  const safetyMs = Math.min(8000, 2000 + totalAssets * 40);
  
  let safetyTimeout = setTimeout(() => {
    if (startBtn?.disabled) {
      console.warn("[main] loader safety trip → enabling START anyway");
      Object.assign(startBtn, {
        disabled: false,
        textContent: "START"
      });
    }
  }, safetyMs);

  try {
    let lastProgressUpdate = 0;
    
    await loadAllResources(bossDefinitions, (progress) => {
      const now = performance.now();
      
      if (safetyTimeout) { 
        clearTimeout(safetyTimeout); 
        safetyTimeout = null; 
      }
      
      if (startBtn && typeof progress === "number" && 
          (now - lastProgressUpdate > 100 || progress === 1)) {
        startBtn.textContent = `LOADING… ${Math.round(progress * 100)}%`;
        lastProgressUpdate = now;
      }
    });
    
    state.resourcesLoaded = true;
    console.log("[main] resources loaded");

    try { 
      verifyBossAssets(); 
    } catch (e) { 
      console.warn("verifyBossAssets reported issues:", e); 
    }
  } catch (err) {
    console.error("[main] loadAllResources failed:", err);
    if (startBtn) { 
      startBtn.textContent = "START (assets failed)"; 
    }
  } finally {
    if (safetyTimeout) { 
      clearTimeout(safetyTimeout); 
      safetyTimeout = null; 
    }
  }

  const scene = new GameScene();

  // Wire START button
  if (startBtn) {
    Object.assign(startBtn, {
      disabled: false,
      textContent: "START"
    });
    
    startBtn.onclick = (e) => {
      e.preventDefault();
      try { if (resources?.audio?.fxUiStart) playSound(resources.audio.fxUiStart); } catch {}
      try { requestFullscreenDesktop(); } catch {}
      try { lockLandscapeOnMobile(); } catch {}
      ensureRotateOverlayHandlers();
      startGame(scene, { startScreen, canvas });
    };
  } else {
    startGame(scene, { startScreen, canvas });
  }
}


// Stop the main loop when end screen opens
window.addEventListener('end-screen-open', () => {
  try { state.gameStarted = false; } catch {}
}, { once: true });

// Attempt fullscreen on desktop
function requestFullscreenDesktop() {
  const isTouch = matchMedia('(pointer: coarse)').matches;
  if (isTouch) return; // avoid odd behaviors on mobile
  const root = document.documentElement;
  if (root.requestFullscreen) root.requestFullscreen().catch(()=>{});
}

// Try to lock landscape on mobile (only works after user gesture)
function lockLandscapeOnMobile() {
  if ('orientation' in screen && typeof screen.orientation?.lock === 'function') {
    screen.orientation.lock('landscape').catch(()=>{});
  }
}

// Portrait overlay to hint rotation on mobile
function ensureRotateOverlayHandlers() {
  let ov = document.getElementById('rotate-overlay');
  if (!ov) {
    ov = document.createElement('div');
    ov.id = 'rotate-overlay';
    ov.innerHTML = '<div class="message">Rotate your device to landscape</div>';
    document.body.appendChild(ov);
  }
  const update = () => {
    const isTouch = matchMedia('(pointer: coarse)').matches;
    const isPortrait = window.matchMedia('(orientation: portrait)').matches;
    ov.style.display = (isTouch && isPortrait) ? 'flex' : 'none';
  };
  window.addEventListener('resize', update);
  window.addEventListener('orientationchange', update);
  update();
}

// Error handling
initGame().catch(e => {
  console.error("[main] init crash:", e);
  
  const errorDiv = document.createElement('div');
  errorDiv.className = 'screen-container-4x3';
  errorDiv.style.cssText = `
    display: flex;
    align-items: center;
    justify-content: center;
    text-align: center;
    background: rgba(0,0,0,0.9);
    color: #f00;
    font-family: monospace;
    z-index: 99999;
    border: 2px solid #ff6b6b;
    box-shadow: 0 0 25px rgba(255,107,107,0.3);
  `;
  
  const errorContent = document.createElement('div');
  errorContent.style.cssText = `
    background: #222;
    padding: 1.5rem;
    border-radius: 10px;
    border: 2px solid #ff6b6b;
    max-width: 80%;
    text-align: center;
  `;
  errorContent.innerHTML = `
    <h2 style="margin:0 0 1rem 0;color:#ff6b6b;">Initialization Failed</h2>
    <p style="margin:0 0 1.5rem 0;color:#fff;">Error: ${e.message}</p>
    <button onclick="location.reload()" style="font-family:inherit;padding:0.8em 1.5em;background:#ff6b6b;color:#fff;border:none;border-radius:8px;cursor:pointer;">Reload Game</button>
  `;
  
  errorDiv.appendChild(errorContent);
  document.body.appendChild(errorDiv);
});


