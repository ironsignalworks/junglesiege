// src/systems/fx.js
import { state } from "../core/state.js";
import { resources } from "./resources.js";

/* ---------------- helpers: atlas + robust resolution ---------------- */

function toLC(k) {
  return (typeof k === "string" ? k : "").trim().toLowerCase();
}

function filenameNoExt(s) {
  const base = String(s).split("/").pop();
  return base.replace(/\.(png|jpg|jpeg|webp|gif)$/i, "").toLowerCase();
}

function looksLikeTntName(noext) {
  return (
    /(?:^|[_\-\.])xp[_\- ]?\d{1,3}$/i.test(noext) ||
    /(?:^|[_\-\.])expl(?:osion)?[_\- ]?\d{1,3}$/i.test(noext) ||
    /(?:^|[_\-\.])exp[_\- ]?\d{1,3}$/i.test(noext)
  );
}

function looksLikeFleshName(noext) {
  return (
    /(?:^|[_\-\.])f(?:lesh)?[_\- ]?\d{1,3}$/i.test(noext) ||
    /(?:^|[_\-\.])gore[_\- ]?\d{1,3}$/i.test(noext)
  );
}

/**
 * Build an atlas that:
 * - discovers TNT and flesh frames by looking at BOTH keys and each Image's .src
 * - stores either actual Image objects (preferred) OR the key string (fallback)
 * - keeps a case-insensitive key map
 */
function buildFxAtlas(images) {
  const atlas = {
    tntFrames: [],     // frames are either HTMLImageElement or string keys
    fleshFrames: [],   // same as above
    keyMap: new Map(), // lc(key) -> real key
    _loggedOnce: { tnt: false, flesh: false },
  };
  if (!images || typeof images !== "object") return atlas;

  const tntCandidates = [];
  const fleshCandidates = [];

  for (const k of Object.keys(images)) {
    const v = images[k];
    const realKey = k;
    atlas.keyMap.set(toLC(realKey), realKey);

    // 1) try by key name
    {
      const noext = filenameNoExt(realKey);
      if (looksLikeTntName(noext)) {
        const m = noext.match(/(\d{1,3})$/);
        tntCandidates.push({ n: m ? parseInt(m[1], 10) : 999, ref: v || realKey });
      }
      if (looksLikeFleshName(noext)) {
        const m = noext.match(/(\d{1,3})$/);
        fleshCandidates.push({ n: m ? parseInt(m[1], 10) : 999, ref: v || realKey });
      }
    }

    // 2) also try by Image src (covers loaders that use hashed keys)
    if (v && typeof v === "object" && "src" in v && typeof v.src === "string") {
      const noextSrc = filenameNoExt(v.src);
      if (looksLikeTntName(noextSrc)) {
        const m = noextSrc.match(/(\d{1,3})$/);
        tntCandidates.push({ n: m ? parseInt(m[1], 10) : 999, ref: v });
      }
      if (looksLikeFleshName(noextSrc)) {
        const m = noextSrc.match(/(\d{1,3})$/);
        fleshCandidates.push({ n: m ? parseInt(m[1], 10) : 999, ref: v });
      }
    }
  }

  tntCandidates.sort((a, b) => a.n - b.n);
  fleshCandidates.sort((a, b) => a.n - b.n);

  atlas.tntFrames = tntCandidates.map(x => x.ref);
  atlas.fleshFrames = fleshCandidates.map(x => x.ref);

  return atlas;
}

// last-resort resolver: try keys, key sans extension, and endsWith on value.src
function getImageLoose(key) {
  if (!key || typeof key !== "string") return null;
  const images = resources && resources.images;
  if (!images) return null;

  const want = toLC(key);
  const wantNoExt = filenameNoExt(want);

  // exact key (ci)
  for (const k of Object.keys(images)) {
    if (toLC(k) === want) return images[k];
  }
  // no-ext key
  for (const k of Object.keys(images)) {
    if (filenameNoExt(k) === wantNoExt) return images[k];
  }
  // value.src endsWith
  for (const k of Object.keys(images)) {
    const v = images[k];
    if (v && typeof v === "object" && typeof v.src === "string") {
      const src = v.src.toLowerCase();
      if (src.endsWith("/" + want) || src.endsWith("/" + wantNoExt) || src.endsWith("/" + wantNoExt + ".png")) {
        return v;
      }
    }
  }
  return null;
}

function logOnce(kind, msg) {
  state._fxAtlas = state._fxAtlas || { _loggedOnce: {} };
  const logged = state._fxAtlas._loggedOnce || (state._fxAtlas._loggedOnce = {});
  if (!logged[kind]) {
    console.warn("[FX]", msg, { available: Object.keys((resources && resources.images) || {}) });
    logged[kind] = true;
  }
}

/* ---------------- public API ---------------- */

export function initFx() {
  if (!Array.isArray(state.fx)) state.fx = [];
  state._fxAtlas = buildFxAtlas((resources && resources.images) || {});
  state._fxAtlasVersion = Object.keys((resources && resources.images) || {}).length;
}

/**
 * Spawn an explosion animation.
 * kind: "tnt" | "flesh"
 * opts: { x, y, shake?: number, scale?: number, frameMs?: number, sizePx?: number, maxPx?: number }
 */
export function spawnFxExplosion(kind, opts) {
  const x = (opts && opts.x != null ? opts.x : 0) | 0;
  const y = (opts && opts.y != null ? opts.y : 0) | 0;
  const shake = Number(opts && opts.shake) || 0;

  // small by default
  const DEFAULT_SCALES = { tnt: 0.70, flesh: 0.10 };
  // cap flesh size even if source PNGs are huge
  const DEFAULT_MAXPX = { flesh: 32 };

  const providedScale = (opts && Number.isFinite(opts.scale)) ? Number(opts.scale) : null;
  const scale = (providedScale != null) ? providedScale : (DEFAULT_SCALES[kind] || 1);

  const providedSizePx = (opts && Number.isFinite(opts.sizePx)) ? Number(opts.sizePx) : null;
  const providedMaxPx  = (opts && Number.isFinite(opts.maxPx))  ? Number(opts.maxPx)  : null;

  const sizePx = providedSizePx ?? null;
  const maxPx  = (providedMaxPx != null) ? providedMaxPx : (DEFAULT_MAXPX[kind] ?? null);

  const frameMs = Number(opts && opts.frameMs) || 70;

  // refresh atlas if images changed
  const imgCount = Object.keys((resources && resources.images) || {}).length;
  if (!state._fxAtlas || state._fxAtlasVersion !== imgCount) {
    state._fxAtlas = buildFxAtlas((resources && resources.images) || {});
    state._fxAtlasVersion = imgCount;
  }

  const atlas = state._fxAtlas;

  // canonical names (string fallback if we didnt discover via atlas)
  const canonicalTnt   = ["xp1.png", "xp2.png", "xp3.png"];
  const canonicalFlesh = ["f1.png", "f2.png", "f3.png", "f4.png", "f5.png"];

  // prefer discovered frames (may be Image objects already)
  let frames = (kind === "tnt") ? atlas.tntFrames.slice() : atlas.fleshFrames.slice();

  // flesh fallback to TNT if absent
  if (kind === "flesh" && frames.length === 0) {
    if (atlas.tntFrames.length) {
      frames = atlas.tntFrames.slice();
    } else {
      // try to resolve canonical TNT frames to Images
      frames = canonicalTnt.map(k => (resources?.images?.[k] || getImageLoose(k))).filter(Boolean);
    }
    if (!frames.length) {
      // final fallback: use canonical names; renderer will try to resolve each frame lazily
      frames = canonicalFlesh.slice();
      logOnce("flesh", "No flesh frames found. Falling back to TNT/canonical sequence.");
    }
  }

  // TNT fallback if needed
  if (kind === "tnt" && frames.length === 0) {
    frames = canonicalTnt.map(k => (resources?.images?.[k] || getImageLoose(k))).filter(Boolean);
    if (!frames.length) {
      frames = canonicalTnt.slice();
      logOnce("tnt", "No TNT frames found; using canonical names with loose lookup.");
    }
  }

  // trim to expected frame counts
  const need = (kind === "tnt") ? 3 : 5;
  if (frames.length > need) frames = frames.slice(0, need);

  // keep only strings or images
  frames = frames.filter(f =>
    (typeof f === "string" && f.length > 0) ||
    (f && typeof f === "object")
  );

  state.fx.push({
    kind,
    x,
    y,
    frames,               // array of Image OR string keys; renderer handles both
    startedAt: (performance?.now?.() ?? Date.now()),
    frameMs,
    scale,
    sizePx,
    maxPx,
    shakeAmount: shake,
    shakeApplied: false,
  });
}

export function updateAndRenderFx(ctx, now) {
  if (!Array.isArray(state.fx) || state.fx.length === 0) return;

  const images = (resources && resources.images) || {};
  const imgCount = Object.keys(images).length;
  if (!state._fxAtlas || state._fxAtlasVersion !== imgCount) {
    state._fxAtlas = buildFxAtlas(images);
    state._fxAtlasVersion = imgCount;
  }
  const atlas = state._fxAtlas;

  for (let i = state.fx.length - 1; i >= 0; i--) {
    const fx = state.fx[i];

    // one-time screenshake
    if (!fx.shakeApplied && fx.shakeAmount > 0) {
      state.screenShake = Math.max(state.screenShake || 0, fx.shakeAmount);
      fx.shakeApplied = true;
    }

    if (!Array.isArray(fx.frames) || fx.frames.length === 0) {
      state.fx.splice(i, 1);
      continue;
    }

    const elapsed = now - fx.startedAt;
    const idx = Math.floor(elapsed / fx.frameMs);

    if (idx >= fx.frames.length) {
      state.fx.splice(i, 1);
      continue;
    }

    const frameRef = fx.frames[idx];
    let img = null;

    if (frameRef && typeof frameRef === "object" && ("width" in frameRef || "naturalWidth" in frameRef)) {
      // We already stored an Image object in the atlas
      img = frameRef;
    } else if (typeof frameRef === "string") {
      // resolve string key
      img = images[frameRef];
      if (!img) {
        const actualKey = atlas.keyMap?.get?.(toLC(frameRef));
        if (actualKey) img = images[actualKey];
      }
      if (!img) img = getImageLoose(frameRef);
    }

    // If we have an image but its not loaded yet, skip drawing (avoid placeholder blob)
    const imgReady = !!(img && ((img.complete !== false && (img.naturalWidth || img.width)) || (img.getContext && img.width)));

    if (imgReady) {
      const baseW = (img.naturalWidth || img.width || 64);
      const baseH = (img.naturalHeight || img.height || 64);

      // start from scale
      let w = Math.round(baseW * (fx.scale || 1));
      let h = Math.round(baseH * (fx.scale || 1));

      // exact size: largest side equals sizePx
      if (Number.isFinite(fx.sizePx) && fx.sizePx > 0) {
        const denom = Math.max(baseW, baseH) || 1;
        const k = fx.sizePx / denom;
        w = Math.max(1, Math.round(baseW * k));
        h = Math.max(1, Math.round(baseH * k));
      }

      // max cap: clamp proportionally
      if (Number.isFinite(fx.maxPx) && fx.maxPx > 0) {
        const largest = Math.max(w, h);
        if (largest > fx.maxPx) {
          const k2 = fx.maxPx / (largest || 1);
          w = Math.max(1, Math.round(w * k2));
          h = Math.max(1, Math.round(h * k2));
        }
      }

      ctx.drawImage(img, fx.x - (w >> 1), fx.y - (h >> 1), w, h);
    } else {
      // image not yet resolved/loaded  skip drawing this frame (no blob)
      // (we still keep timing; the sequence will disappear once frames elapse)
    }
  }
}

/* ---------------- drawing fallback (kept, but now unused for loading) ---------------- */

function drawBlobFallback(ctx, fx) {
  ctx.save();
  ctx.fillStyle = fx.kind === "tnt" ? "rgba(255,180,60,0.85)" : "rgba(220,60,60,0.85)";
  const r = Math.round(22 * (fx.scale || 1));
  ctx.beginPath();
  ctx.arc(fx.x, fx.y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
