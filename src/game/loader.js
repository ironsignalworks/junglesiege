// src/assets/loader.js
import { resources } from "./resources.js";
import { constants } from "./constants.js";
import { bossDefinitions } from "./boss.js";

const IMG_TIMEOUT_MS = 15000; // allow large PNG backdrops on first load

// In-memory guard to avoid double-loading the same key this session
const _inflight = new Map();

/** Resolve a resource entry like "tank.png" → "assets/images/tank.png" */
function resolveImagePath(rel) {
  if (!rel || typeof rel !== "string") return rel;

  // Already absolute or asset-prefixed
  if (
    rel.startsWith("http://") ||
    rel.startsWith("https://") ||
    rel.startsWith("/") ||
    rel.startsWith("assets/")
  ) {
    return rel;
  }
  // Bare filenames or subpaths → assume under assets/images
  return "assets/images/" + rel.replace(/^\.?\/+/, "");
}

function createAudio(src) {
  const audio = new Audio(src);
  audio.preload = "auto";
  audio.addEventListener("error", () => console.warn("[loader] audio failed:", src));
  return audio;
}

function makePlaceholderCanvas(label = "?") {
  const c = document.createElement("canvas");
  c.width = 48; c.height = 48;
  const g = c.getContext("2d");
  g.fillStyle = "#333"; g.fillRect(0, 0, 48, 48);
  g.strokeStyle = "#f33"; g.lineWidth = 3; g.strokeRect(3, 3, 42, 42);
  g.fillStyle = "#fff"; g.font = "bold 10px monospace";
  g.fillText(String(label).slice(0, 3), 6, 26);
  return c;
}

/**
 * Loads an image (by path) into resources.images[key].
 * If it times out or errors, a placeholder canvas is stored instead.
 */
function loadImage(path, key) {
  const resolved = resolveImagePath(path);

  // If already loaded to an Image/Canvas, skip
  const existing = resources.images[key];
  if (existing instanceof HTMLImageElement || existing instanceof HTMLCanvasElement) {
    return Promise.resolve(existing);
  }

  // If this key is already loading, reuse the promise
  if (_inflight.has(key)) {
    return _inflight.get(key);
  }

  const p = new Promise((resolve) => {
    const img = new Image();
    // Optional: uncomment if you host assets on another origin and need CORS-safe drawImage
    // img.crossOrigin = "anonymous";
    img.decoding = "async";
    img.loading = "eager";

    let done = false;

    const t = setTimeout(() => {
      if (done) return;
      done = true;
      console.warn(`[loader] image timeout (${IMG_TIMEOUT_MS}ms): ${resolved} → placeholder`);
      const ph = makePlaceholderCanvas(key);
      resources.images[key] = ph;
      resolve(ph);
    }, IMG_TIMEOUT_MS);

    img.onload = () => {
      if (done) return;
      done = true;
      clearTimeout(t);
      resources.images[key] = img;
      resolve(img);
    };

    img.onerror = () => {
      if (done) return;
      done = true;
      clearTimeout(t);
      console.warn("[loader] image failed:", resolved, "→ placeholder");
      const ph = makePlaceholderCanvas(key);
      resources.images[key] = ph;
      resolve(ph);
    };

    img.src = resolved;
  }).finally(() => {
    _inflight.delete(key);
  });

  _inflight.set(key, p);
  return p;
}

/** Optional: runtime validator for boss assets */
export function verifyBossAssets(defs = bossDefinitions) {
  const issues = [];
  const isImgOrCanvas = (v) =>
    v instanceof HTMLImageElement || v instanceof HTMLCanvasElement;

  for (const def of defs || []) {
    const portrait = resources.images[def.image];
    const backdrop = resources.images[def.backdrop];

    if (!portrait) issues.push(`portrait key "${def.image}" not in resources.images`);
    if (!backdrop) issues.push(`backdrop key "${def.backdrop}" not in resources.images`);

    if (portrait && !isImgOrCanvas(portrait)) {
      issues.push(`portrait "${def.image}" is not Image/Canvas (got ${typeof portrait})`);
    }
    if (backdrop && !isImgOrCanvas(backdrop)) {
      issues.push(`backdrop "${def.backdrop}" is not Image/Canvas (got ${typeof backdrop})`);
    }
  }

  if (issues.length) {
    console.error("[Boss Asset Check] Problems:\n- " + issues.join("\n- "));
  } else {
    console.log("[Boss Asset Check] All boss portraits/backdrops present as Image/Canvas.");
  }
}

/**
 * Loads:
 *  1) All entries in resources.images (URL strings → Image objects)
 *  2) Any extra backgrounds listed in constants.bgImages (by filename)
 *  3) Any boss portraits/projectiles/backdrops referenced in defs (if not already present)
 *  4) Sets up audio players (non-blocking)
 */
export async function loadAllResources(defs = bossDefinitions) {
  console.log("[loader] begin; images in resources:", Object.keys(resources.images).length);

  const promises = [];

  // 1) Predefined resources (convert URL/bare filename strings to Image objects)
  for (const [key, rel] of Object.entries(resources.images)) {
    // If the entry is already an Image/Canvas, skip; otherwise load
    if (
      !(rel instanceof HTMLImageElement) &&
      !(rel instanceof HTMLCanvasElement)
    ) {
      promises.push(loadImage(rel, key));
    }
  }

  // 2) Backgrounds from constants (list of filenames like "bg_jungle1.png")
  for (const name of (constants.bgImages || [])) {
    if (!resources.images[name]) {
      promises.push(loadImage(name, name)); // name may be bare; resolver will prefix
    } else {
      // If present but still a string, ensure it's loaded
      const v = resources.images[name];
      if (typeof v === "string") {
        promises.push(loadImage(v, name));
      }
    }
  }

  // 3) Boss assets (portraits, projectiles, backdrops)
  for (const def of (defs || [])) {
    if (def.image) {
      const v = resources.images[def.image];
      if (!v) promises.push(loadImage(def.image, def.image));
      else if (typeof v === "string") promises.push(loadImage(v, def.image));
    }
    if (def.projectileType) {
      const v = resources.images[def.projectileType];
      if (!v) promises.push(loadImage(def.projectileType, def.projectileType));
      else if (typeof v === "string") promises.push(loadImage(v, def.projectileType));
    }
    if (def.backdrop) {
      const v = resources.images[def.backdrop];
      if (!v) promises.push(loadImage(def.backdrop, def.backdrop));
      else if (typeof v === "string") promises.push(loadImage(v, def.backdrop));
    }
  }

  // 4) Await everything (don’t throw on single failure)
  const results = await Promise.allSettled(promises);
  const rejected = results.filter(r => r.status === "rejected").length;
  console.log(`[loader] images done; total:${results.length} rejected:${rejected}`);

  // 5) Audio (non-blocking)
  const baseAudio = "assets/audio/";
  resources.audio.bgm = resources.audio.bgm || createAudio(baseAudio + "jungle_loop.mp3");
  resources.audio.instructionsBgm = resources.audio.instructionsBgm || createAudio(baseAudio + "bgm.wav");
  resources.audio.gameOverMusic = resources.audio.gameOverMusic || createAudio(baseAudio + "gameover.mp3");
  resources.audio.fxShot = resources.audio.fxShot || createAudio(baseAudio + "shot.mp3");
  resources.audio.fxExplosion = resources.audio.fxExplosion || createAudio(baseAudio + "explosion.mp3");

  console.log("[loader] done");
}
