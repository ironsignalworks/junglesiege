// src/core/state.js - Optimized state management
import { constants } from "../game/constants.js";

// Object pooling for frequently created objects
class ObjectPool {
  constructor(createFn, resetFn, initialSize = 10) {
    this.createFn = createFn;
    this.resetFn = resetFn;
    this.pool = [];
    this.active = new Set();
    
    // Pre-populate pool
    for (let i = 0; i < initialSize; i++) {
      this.pool.push(this.createFn());
    }
  }
  
  get() {
    let obj = this.pool.pop();
    if (!obj) {
      obj = this.createFn();
    }
    this.active.add(obj);
    return obj;
  }
  
  release(obj) {
    if (this.active.has(obj)) {
      this.active.delete(obj);
      this.resetFn(obj);
      this.pool.push(obj);
    }
  }
  
  releaseAll() {
    this.active.forEach(obj => {
      this.resetFn(obj);
      this.pool.push(obj);
    });
    this.active.clear();
  }
}

// Object pools for common game objects
const bulletPool = new ObjectPool(
  () => ({ x: 0, y: 0, vx: 0, vy: 0, width: 16, height: 16, type: null }),
  (obj) => { obj.x = 0; obj.y = 0; obj.vx = 0; obj.vy = 0; obj.type = null; },
  50
);

const zombiePool = new ObjectPool(
  () => ({ x: 0, y: 0, vx: 0, vy: 0, width: 32, height: 48, health: 1, type: null }),
  (obj) => { obj.x = 0; obj.y = 0; obj.vx = 0; obj.vy = 0; obj.health = 1; obj.type = null; },
  100
);

const dropPool = new ObjectPool(
  () => ({ x: 0, y: 0, width: 24, height: 24, type: null, dy: 0 }),
  (obj) => { obj.x = 0; obj.y = 0; obj.type = null; obj.dy = 0; },
  30
);

// Optimized state object with performance tracking
export const state = {
  // Canvas / DOM refs
  canvas: null,
  ctx: null,

  // Lifecycle
  introActive: true,
  introDuration: 3500,
  introStartedAt: 0,
  gameStarted: false,
  resourcesLoaded: false,
  spawningInProgress: false,

  // Player & core stats
  tank: { x: 0, y: 0, width: 80, height: 80 },
  ammo: 100,
  health: 100,
  score: 0,
  round: 0,

  // Collections (using more efficient data structures)
  bullets: [],
  zombies: [],
  enemyBullets: [],
  ammoDrops: [],
  medkitDrops: [],
  bossProjectiles: [],

  // Boss flow
  boss: null,
  bossActive: false,
  bossDefeated: false,
  bossIndex: 0,
  bossTriggerCount: constants.bossTriggerThresholds
    ? constants.bossTriggerThresholds[0]
    : 0,
  bossAnnouncementShowing: false,

  // Backdrop
  currentBgName: "bg_jungle1.png",

  // Input (using more efficient input tracking)
  keys: new Set(), // Track pressed keys efficiently
  keyLeft: false,
  keyRight: false,
  keyUp: false,
  keyDown: false,
  pointerX: 0,
  pointerY: 0,
  pointerDown: false,

  // FX
  screenShake: 0,
  flashWhite: 0,
  flashRed: 0,

  // Loop timing (for FPS bookkeeping in game loop)
  frameCount: 0,
  lastTime: 0,
  fps: 0,
  performanceMode: 'high', // Added for adaptive performance

  // HUD / layout
  bottomBarHeight: 96,
  dpr: 1,
  
  // Object pools
  pools: {
    bullet: bulletPool,
    zombie: zombiePool,
    drop: dropPool
  },

  // Performance metrics
  metrics: {
    drawCalls: 0,
    entityCount: 0,
    memoryUsage: 0,
    gcCount: 0
  }
};

// Optimized resize function with caching and reduced allocations
let resizeCache = null;
let lastResizeTime = 0;

export function updateCanvasSize({ keepTankPosition = true } = {}) {
  const { canvas, tank } = state;
  if (!canvas) return;
  
  const now = performance.now();
  
  // Throttle resize operations
  if (now - lastResizeTime < 16) return; // Max 60fps resize
  lastResizeTime = now;
  
  // Get the 4:3 container dimensions
  const gameViewport = document.getElementById("game-viewport");
  const stage = document.getElementById("stage");
  
  if (!gameViewport || !stage) {
    console.warn("Game viewport or stage not found");
    return;
  }
  
  const rectW = Math.max(1, stage.clientWidth || stage.offsetWidth || 800);
  const rectH = Math.max(1, stage.clientHeight || stage.offsetHeight || 600);
  
  // Use cached values if dimensions haven't changed
  const cacheKey = `${rectW}x${rectH}`;
  if (resizeCache && resizeCache.key === cacheKey) {
    const cached = resizeCache.values;
    
    if (canvas.width !== cached.canvasWidth || canvas.height !== cached.canvasHeight) {
      canvas.width = cached.canvasWidth;
      canvas.height = cached.canvasHeight;
      
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.imageSmoothingEnabled = false;
      }
    }
    
    if (keepTankPosition && tank) {
      tank.x = Math.max(0, Math.min(tank.x, cached.drawW - tank.width));
      tank.y = Math.max(0, Math.min(tank.y, cached.drawH - tank.height));
    }
    return;
  }
  
  // Use the stage dimensions (4:3 aspect ratio)
  const drawW = rectW;
  const drawH = rectH;
  
  const dpr = window.devicePixelRatio || 1;
  state.dpr = dpr;
  
  // Set canvas backing store to match 4:3 container size
  const canvasWidth = Math.round(drawW);
  const canvasHeight = Math.round(drawH);
  
  // Cache the computed values
  resizeCache = {
    key: cacheKey,
    values: {
      canvasWidth,
      canvasHeight,
      drawW,
      drawH
    }
  };
  
  // Apply canvas size
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;
  
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.imageSmoothingEnabled = false;
  }
  
  if (keepTankPosition && tank) {
    tank.x = Math.max(0, Math.min(tank.x, drawW - tank.width));
    tank.y = Math.max(0, Math.min(tank.y, drawH - tank.height));
  }
}

// Optimized game reset with object pooling
export function resetGame() {
  const { canvas, tank } = state;
  if (!canvas) return;

  // Release all pooled objects back to their pools
  state.bullets.forEach(bullet => state.pools.bullet.release(bullet));
  state.zombies.forEach(zombie => state.pools.zombie.release(zombie));
  state.enemyBullets.forEach(bullet => state.pools.bullet.release(bullet));
  state.ammoDrops.forEach(drop => state.pools.drop.release(drop));
  state.medkitDrops.forEach(drop => state.pools.drop.release(drop));

  // Clear arrays efficiently
  state.bullets.length = 0;
  state.zombies.length = 0;
  state.enemyBullets.length = 0;
  state.ammoDrops.length = 0;
  state.medkitDrops.length = 0;
  state.bossProjectiles.length = 0;

  // Reset stats
  state.ammo = Number.isFinite(constants?.startingAmmo) ? constants.startingAmmo : 50;
  state.health = 100;
  state.score = 0;
  state.round = 0;
  state.spawningInProgress = false;

  // Reset tank position
  if (tank) {
    tank.x = canvas.width / 2 - tank.width / 2;
    tank.y = canvas.height - (state.bottomBarHeight || 96) - tank.height;
  }
  
  state.pointerX = canvas.width / 2;
  state.pointerY = tank ? tank.y : 0;

  // Reset boss state
  state.boss = null;
  state.bossActive = false;
  state.bossDefeated = false;
  state.bossIndex = 0;
  state.bossAnnouncementShowing = false;
  state.bossTriggerCount = constants.bossTriggerThresholds
    ? constants.bossTriggerThresholds[0]
    : 0;

  state.currentBgName = "bg_jungle1.png";
  
  // Clear input state
  state.keys.clear();
  state.keyLeft = false;
  state.keyRight = false;
  state.keyUp = false;
  state.keyDown = false;
  state.pointerDown = false;

  // Reset metrics
  state.metrics.drawCalls = 0;
  state.metrics.entityCount = 0;
}

// Optimized sound playing with audio pooling
const audioPool = new Map();
const MAX_CONCURRENT_SOUNDS = 10;

export function playSound(sound) {
  if (!sound || !sound.src) return;
  
  try {
    // Get or create audio pool for this sound
    if (!audioPool.has(sound.src)) {
      audioPool.set(sound.src, []);
    }
    
    const pool = audioPool.get(sound.src);
    
    // Find available audio instance or create new one
    let audio = pool.find(a => a.ended || a.paused);
    
    if (!audio && pool.length < MAX_CONCURRENT_SOUNDS) {
      audio = sound.cloneNode();
      pool.push(audio);
    }
    
    if (audio) {
      audio.currentTime = 0;
      audio.play().catch(() => {});
    }
  } catch (e) {
    // Fallback to original sound
    try {
      sound.currentTime = 0;
      sound.play().catch(() => {});
    } catch {}
  }
}

// Helper functions for object pooling
export function createBullet(x, y, vx, vy, type = null) {
  const bullet = state.pools.bullet.get();
  Object.assign(bullet, { x, y, vx, vy, type });
  return bullet;
}

export function createZombie(x, y, type = null) {
  const zombie = state.pools.zombie.get();
  Object.assign(zombie, { x, y, type, health: 1 });
  return zombie;
}

export function createDrop(x, y, type, width = 24, height = 24) {
  const drop = state.pools.drop.get();
  Object.assign(drop, { x, y, type, width, height });
  return drop;
}

// Performance monitoring utilities
export function updateMetrics() {
  state.metrics.entityCount = 
    state.bullets.length + 
    state.zombies.length + 
    state.enemyBullets.length + 
    state.ammoDrops.length + 
    state.medkitDrops.length + 
    state.bossProjectiles.length;
    
  // Estimate memory usage (rough calculation)
  state.metrics.memoryUsage = state.metrics.entityCount * 100; // ~100 bytes per entity
}

// Cleanup function for when game is destroyed
export function cleanup() {
  // Release all pooled objects
  state.pools.bullet.releaseAll();
  state.pools.zombie.releaseAll();
  state.pools.drop.releaseAll();
  
  // Clear audio pools
  audioPool.clear();
  
  // Clear resize cache
  resizeCache = null;
}
