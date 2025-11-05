// src/systems/killstreaks.js
// Low-risk kill-streak plugin: self-contained, no engine refactor.
// Rewards: x2 => Shield (round-long), x3 => AmmoBay (+30), x4 => Parachute cascade.

import { state } from "../core/state.js";
import { resources } from "./resources.js";

(function initKillStreaksPlugin() {
  // ---- Safe state augmentation (no core edits required)
  state.flags ||= {};                 // timed flags (ms timestamps)
  state.roundFlags ||= {};            // cleared on new round
  state.streak ||= { count: 0, expires: 0, windowMs: 2000 };
  state._lastScoreForStreak ??= state.score || 0;
  state._lastHealthSeen ??= state.health ?? 0;
  state._lastGameStarted ??= !!state.gameStarted;

  // DOM helpers
  const d = document;
  function ensureShieldRing() {
    let ring = d.getElementById("shield-ring");
    if (!ring) {
      ring = d.createElement("img");
      ring.id = "shield-ring";
      ring.alt = "Shield";
      ring.style.cssText =
        "position:fixed;z-index:500000;pointer-events:none;display:none;transform:translate(-50%,-50%);";
      // prefer loader path if available
      const src = resources?.images?.["shield.png"]?.src || "assets/images/shield.png";
      ring.src = src;
      d.body.appendChild(ring);
    }
    return ring;
  }

  function showCaption(text, ms = 900) {
    const el = d.createElement("div");
    el.textContent = text;
    el.style.cssText =
      "position:fixed;left:50%;top:12%;transform:translateX(-50%);padding:6px 10px;border:1px solid #8fe88f;border-radius:10px;background:#10160acc;color:#bfffbf;font:14px monospace;z-index:600000";
    d.body.appendChild(el);
    setTimeout(() => el.remove(), ms);
  }

  // Timed / round flags
  function grantTimedFlag(name, ms) {
    state.flags[name] = Date.now() + ms;
  }
  function hasFlag(name) {
    return (state.flags[name] || 0) > Date.now();
  }
  function grantUntilRoundEnds(name) {
    state.roundFlags[name] = true;
  }
  function hasRoundFlag(name) {
    return !!state.roundFlags[name];
  }
  function resetRoundFlags() {
    state.roundFlags = {};
    state.streak.count = 0;
    state.streak.expires = 0;
  }

  // Streak tick & bump
  function tickKillStreak(now = performance.now()) {
    const s = state.streak;
    if (s.expires && now > s.expires) s.count = 0;
  }

  function onEnemyKilled(now = performance.now()) {
    const s = state.streak;
    if (now > s.expires) s.count = 0;
    s.count += 1;
    s.expires = now + (s.windowMs || 2000);

    // Rewards
    if (s.count === 2) {
      // Shield (rest of round)
      grantUntilRoundEnds("shield");
      showCaption("SHIELD ACTIVATED");
      try { resources?.audio?.powerupShield?.play().catch(()=>{}); } catch {}
    }

    if (s.count === 3) {
      // AmmoBay: spawn pickup if engine exposes window.spawnPickup; else grant directly
      if (typeof window !== "undefined" && typeof window.spawnPickup === "function") {
        const c = state.canvas;
        const x = Math.random() * ((c?.width || 800) - 48) + 24;
        const y = (c?.height || 600) - 48;
        window.spawnPickup({
          kind: "ammobay",
          sprite: "ammobay.png",
          x, y,
          vx: 0, vy: 0,
          amount: 30,
          lifetime: 12000
        });
      } else {
        // Fallback: give +30 instantly + caption
        state.ammo = Math.min((state.ammoMax || 9999), (state.ammo || 0) + 30);
        showCaption("AMMO +30");
        try { resources?.audio?.ammoPickup?.play().catch(()=>{});} catch {}
      }
    }

    if (s.count === 4) {
      // Parachute cascade: prefer spawnPickup; else DOM visuals only
      if (typeof window !== "undefined" && typeof window.spawnPickup === "function") {
        const c = state.canvas;
        for (let i = 0; i < 5; i++) {
          const x = Math.random() * ((c?.width || 800) - 48) + 24;
          const y = -20 - i * 30;
          const vx = (Math.random() * 0.6) - 0.3;
          const vy = 1 + Math.random() * 0.6;
          window.spawnPickup({
            kind: "parachute",
            sprite: "parachute.png",
            x, y, vx, vy,
            lifetime: 8000,
            collectible: false
          });
        }
      } else {
        domParachuteCascade();
      }
    }
  }

  function domParachuteCascade() {
    const sprites = 5;
    for (let i = 0; i < sprites; i++) {
      const img = d.createElement("img");
      img.src = resources?.images?.["parachute.png"]?.src || "assets/images/parachute.png";
      img.alt = "Parachute";
      img.style.cssText = "position:fixed; top:-40px; z-index:400000; pointer-events:none; height:28px;";
      const startX = Math.random() * (window.innerWidth - 40) + 20;
      img.style.left = startX + "px";
      d.body.appendChild(img);

      const drift = (Math.random() * 0.6) - 0.3;
      let y = -40;
      const vy = 1 + Math.random() * 0.8;
      const t0 = performance.now();
      function step(t) {
        const dt = (t - t0) / 16.67;
        y += vy;
        const x = startX + drift * (y * 0.5);
        img.style.transform = `translate(${x - startX}px, ${y}px)`;
        if (y < window.innerHeight + 40) requestAnimationFrame(step);
        else img.remove();
      }
      requestAnimationFrame(step);
    }
  }

  // Health gate: if shield is up, prevent health from dropping
  function shieldDamageGate() {
    if (!hasRoundFlag("shield")) {
      state._lastHealthSeen = state.health ?? state._lastHealthSeen;
      return;
    }
    const h = state.health ?? 0;
    if (h < state._lastHealthSeen) {
      // restore and play a soft "ping"
      state.health = state._lastHealthSeen;
      try { resources?.audio?.shieldHit?.play().catch(()=>{});} catch {}
    } else {
      state._lastHealthSeen = h;
    }
  }

  // Visual: shield ring anchored over the tank via DOM
  function tickShieldRing() {
    const ring = ensureShieldRing();
    if (!hasRoundFlag("shield") || !state.gameStarted) {
      ring.style.display = "none";
      return;
    }
    const canvas = d.getElementById("gameCanvas") || d.querySelector("canvas");
    if (!canvas) { ring.style.display = "none"; return; }
    const rect = canvas.getBoundingClientRect();
    const cw = canvas.width || rect.width;
    const ch = canvas.height || rect.height;
    // Locate the tank center (best-effort)
    const tank = state.tank || state.player || {};
    const x = typeof tank.x === "number" ? tank.x : cw * 0.5;
    const y = typeof tank.y === "number" ? tank.y : ch * 0.5;
    const scaleX = rect.width / cw;
    const scaleY = rect.height / ch;

    // Size ring relative to a 64px base tank
    const base = 80;
    ring.width = base;
    ring.height = base;

    const px = rect.left + x * scaleX;
    const py = rect.top + y * scaleY;
    ring.style.left = px + "px";
    ring.style.top = py + "px";
    ring.style.display = "block";
  }

  // Detect new rounds to clear round flags (best-effort)
  function maybeResetRoundFlags() {
    const started = !!state.gameStarted;
    if (started && !state._lastGameStarted) {
      // game just started (e.g., Restart)
      resetRoundFlags();
      state._lastHealthSeen = state.health ?? 0;
    }
    // also clear if score reset (often indicates new round)
    if ((state._lastScoreForStreak || 0) > 0 && (state.score || 0) === 0 && started) {
      resetRoundFlags();
    }
    state._lastGameStarted = started;
  }

  // Watch score to detect kills (delta > 0 -> kills)
  function watchScoreForKills() {
    const cur = state.score || 0;
    const prev = state._lastScoreForStreak || 0;
    const delta = cur - prev;
    if (delta > 0) {
      // Treat as that many kills (usually delta=1)
      for (let i = 0; i < delta; i++) onEnemyKilled();
    }
    state._lastScoreForStreak = cur;
  }

  // Main lightweight loop (decoupled from engine loop)
  function tick() {
    try {
      tickKillStreak();
      watchScoreForKills();
      shieldDamageGate();
      tickShieldRing();
      maybeResetRoundFlags();
    } catch (e) {
      // Keep it silent; don't break the game loop
      // console.warn("[KS] tick error", e);
    }
    requestAnimationFrame(tick);
  }

  // Boot
  if (!window.__killStreaksBooted) {
    window.__killStreaksBooted = true;
    requestAnimationFrame(tick);
    // Expose a tiny debug API
    window.KillStreaks = {
      get state() { return state; },
      reset() { state.streak.count = 0; state.streak.expires = 0; },
      setWindow(ms) { state.streak.windowMs = ms; },
      simulateKill(n=1) { while(n-->0) onEnemyKilled(); },
    };
  }
})();
