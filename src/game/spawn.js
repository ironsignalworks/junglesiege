// src/systems/spawn.js
import { state, playSound } from "../core/state.js";
import { constants } from "./constants.js";
import { resources } from "./resources.js";
import { isColliding } from "./collisions.js";
import { spawnSlugFromKill } from "./slug.js";

// ------------ helpers -------------------------------------------------------
const AMMO_CAP = Number.isFinite(constants?.ammoCap) ? constants.ammoCap : 150;

function hasShieldActive() {
  return (state.shieldUntil || 0) > Date.now();
}

// Quick center caption
function showCaption(text, ms = 1000) {
  try {
    const old = document.getElementById("streak-caption");
    if (old) old.remove();
    const el = document.createElement("div");
    el.id = "streak-caption";
    el.textContent = text;
    el.style.cssText = [
      "position:fixed",
      "left:50%","top:50%","transform:translate(-50%,-50%)",
      "padding:12px 18px",
      "border:1px solid #8fe88f","border-radius:12px",
      "background:#10160acc","color:#bfffbf",
      "font:700 28px/1 monospace","letter-spacing:1px",
      "z-index:600000","pointer-events:none","text-align:center",
      "box-shadow:0 6px 24px rgba(0,0,0,.45)"
    ].join(";");
    document.body.appendChild(el);
    setTimeout(() => el.remove(), ms);
  } catch {}
}

// ---- NEW: sane defaults for zombie types to avoid .length on undefined ----
const DEFAULT_ZOMBIE_TYPES = [
  { type: "zombie",  image: "zombie.png",  hp: 3, fireRate: 120, bulletSpeed: 4 },
  { type: "zombie2", image: "zombie2.png", hp: 4, fireRate: 140, bulletSpeed: 4 },
  { type: "zombie3", image: "zombie3.png", hp: 5, fireRate: 160, bulletSpeed: 5 },
  { type: "zombie4", image: "zombie4.png", hp: 6, fireRate: 180, bulletSpeed: 5 },
];

const ZOMBIE_TYPES = (
  constants && Array.isArray(constants.zombieTypes) && constants.zombieTypes.length
) ? constants.zombieTypes : DEFAULT_ZOMBIE_TYPES;

function pickZombieType() {
  const list = Array.isArray(ZOMBIE_TYPES) && ZOMBIE_TYPES.length ? ZOMBIE_TYPES : DEFAULT_ZOMBIE_TYPES;
  const idx = (Math.random() * list.length) | 0;
  return list[idx] || DEFAULT_ZOMBIE_TYPES[0];
}

// ---- NEW: bottom Ammo Bay crate used by handleCombo() ----
function spawnAmmoBayAtBottom() {
  if (!state.canvas) return;
  const cw = state.canvas.width;
  const ch = state.canvas.height;
  const bottomY = ch - (state.bottomBarHeight || 120) - 8;

  const w = 36, h = 36;
  const x = Math.max(0, Math.random() * (cw - w));
  const y = bottomY - h;

  if (!Array.isArray(state.ammoDrops)) state.ammoDrops = [];
  state.ammoDrops.push({
    x, y, width: w, height: h,
    dy: 0,                        // sits on the ground
    isAmmoBay: true,              // flagged → picked up in processSpecialAmmoBay()
    type: "ammobay.png",
    amount: 30
  });

  showCaption("AMMO BAY DEPLOYED", 900);
}

// Handles AMMO BAY crate (adds ammo, sfx, caption)
function processSpecialAmmoBay() {
  try {
    const tank = state?.tank;
    if (!tank || !state?.canvas) return;

    const sacks = [];
    if (Array.isArray(state.ammoBayDrops)) sacks.push(state.ammoBayDrops);
    if (Array.isArray(state.ammoDrops))    sacks.push(state.ammoDrops);
    if (Array.isArray(state.crates))       sacks.push(state.crates);
    if (Array.isArray(state.pickups))      sacks.push(state.pickups);

    const groundY = state.canvas.height - (state.bottomBarHeight || 120) - 8;

    for (const bag of sacks) {
      for (let i = bag.length - 1; i >= 0; i--) {
        const c = bag[i];
        const name = String(c?.type || "").toLowerCase();
        const isAmmoBay = c?.isAmmoBay === true || name.includes("ammobay");
        if (!isAmmoBay) continue;

        if (typeof c.dy === "number") c.y += c.dy;
        if (c.y > groundY - (c.height || 0)) c.y = groundY - (c.height || 0);

        if (isColliding(c, tank)) {
          const gain = Number.isFinite(c?.amount) ? c.amount : 30;
          const cap  = Number.isFinite(constants?.ammoCap) ? constants.ammoCap : 150;
          state.ammo = Math.min((state.ammo || 0) + gain, cap);

          try {
            if (typeof playSound === "function" && resources?.audio?.ammobay) {
              playSound(resources.audio.ammobay);
            }
          } catch {}

          showCaption(`AMMO BAY +${gain}`, 900);
          bag.splice(i, 1);
        }
      }
    }
  } catch (e) {
    console.warn("[spawn] processSpecialAmmoBay failed:", e);
  }
}

// Parachute pickups that heal like medkits
function spawnParachutePickups(count = 2) {
  const cw = state.canvas?.width ?? 800;
  const w = 75, h = 75;

  for (let i = 0; i < count; i++) {
    const x = Math.random() * Math.max(0, cw - w);
    state.medkitDrops.push({
      x, y: -h, width: w, height: h,
      dy: 2.8 + Math.random() * 0.6,
      type: "parachute.png"
    });
  }
  showCaption("SUPPLY DROP!", 900);
}

// ------------ original & minimally edited code ------------------------------
export function spawnZombie(speed) {
  if (state.bossActive || state.bossAnnouncementShowing) return;

  // SAFE: pick from guarded list
  const zType = pickZombieType();

  // Guarded numbers
  const zHP = Number.isFinite(zType?.hp) ? zType.hp : 3;
  const zFR = Math.max(30, Number.isFinite(zType?.fireRate) ? zType.fireRate : 120);
  const zBS = Math.max(3, Number.isFinite(zType?.bulletSpeed) ? zType.bulletSpeed : 4);

  const zombieBaseW = 48;
  const zombieBaseH = 72;
  const zScale = Number.isFinite(constants?.zombieScale) ? constants.zombieScale : 1.0;
  const zombieWidth = Math.round(zombieBaseW * zScale);
  const zombieHeight = Math.round(zombieBaseH * zScale);
  const canvasWidth = state.canvas?.width ?? 800;
  const x = Math.random() * Math.max(0, canvasWidth - zombieWidth);

  state.zombies.push({
    x,
    y: -zombieHeight,
    width: zombieWidth,
    height: zombieHeight,
    speed,
    health: zHP,
    type: zType.type || "zombie",
    fireCooldown: Math.floor(Math.random() * zFR) + zFR * 2,
    fireRate: Math.floor(zFR * 3.0),
    bulletSpeed: Math.max(3, zBS - 1),
    vx: (Math.random() * 1.2) - 0.6,
    wobbleAmp: 1.4 + Math.random() * 1.6,
    wobbleSpeed: 0.05 + Math.random() * 0.05,
    t: Math.random() * Math.PI * 2,
    spriteKey: (zType.image || `${zType.type || "zombie"}.png`)
  });
}

export function nextRound() {
  if (!state.gameStarted) return;
  
  state.bossDefeated = false;
  
  // PREVENT PREMATURE ROUND INCREMENT
  // Only increment if this isn't the first round
  if (state.round > 1 || state._hasStartedFirstRound) {
    state.round++;
  }
  state._hasStartedFirstRound = true;
  
  console.log("[spawn] nextRound() - Current round:", state.round);
  
  state.spawningInProgress = true;

  // reset 3s shield
  state.shieldUntil = 0;

  const numZombies = Math.max(3, Math.floor(3 * state.round + Math.random() * (state.round * 2)));
  let zombiesToSpawn = numZombies;

  function scheduleNextZombie() {
    if (zombiesToSpawn <= 0 || !state.gameStarted || state.bossActive || state.bossAnnouncementShowing) {
      state.spawningInProgress = false;
      return;
    }
    const baseSpeed = 0.8 + state.round * 0.12;
    const individualSpeed = baseSpeed + (Math.random() - 0.4) * 0.3;

    spawnZombie(individualSpeed);
    zombiesToSpawn--;

    const baseDelay = 800;
    const delay = Math.max(250, baseDelay - state.round * 10);
    setTimeout(scheduleNextZombie, delay + Math.random() * 250);
  }

  scheduleNextZombie();
}

/**
 * @param {number} currentTime
 * @param {(damage:number, boom:boolean)=>void} onPlayerHit
 * @param {(zombieObj:any)=>void} _onZombieKilled
 * @param {(bullet:any)=>void} pushEnemyBullet
 */
export function updateZombies(currentTime, onPlayerHit, _onZombieKilled, pushEnemyBullet) {
  const { zombies, canvas, tank } = state;
  const pushBullet = typeof pushEnemyBullet === "function" ? pushEnemyBullet : () => {};
  const scale = (state.zombieSpeedScale ?? 1.0);

  for (let zi = zombies.length - 1; zi >= 0; zi--) {
    const z = zombies[zi];

    // movement (scaled)
    z.t += z.wobbleSpeed;
    z.x += (z.vx + Math.sin(z.t) * z.wobbleAmp) * scale;
    z.y += z.speed * scale;

    if (z.x < 0) { z.x = 0; z.vx *= -0.8; }
    if (z.x > canvas.width - z.width) { z.x = canvas.width - z.width; z.vx *= -0.8; }
    if (z.y > canvas.height) { zombies.splice(zi, 1); continue; }

    if (isColliding(z, tank)) {
      zombies.splice(zi, 1);
      if (hasShieldActive()) {
        try { playSound && resources?.audio?.fxPickup && playSound(resources.audio.fxPickup); } catch {}
        showCaption("SHIELD HIT", 700);
        continue;
      }
      onPlayerHit(10, true);
      continue;
    }

    // firing
    z.fireCooldown = (z.fireCooldown || Math.floor(Math.random() * 60)) - 1;
    if (z.fireCooldown <= 0) {
      if (Math.random() < 0.70) {
        z.fireCooldown = z.fireRate + Math.floor(Math.random() * 60);
      } else {
        const aimed = Math.random() < 0.20;
        let dx, dy;
        if (aimed) {
          dx = (tank.x + tank.width / 2) - (z.x + z.width / 2);
          dy = (tank.y + tank.height / 2) - (z.y + z.height / 2);
          const dist = Math.max(1, Math.hypot(dx, dy));
          dx = (dx / dist) * z.bulletSpeed;
          dy = (dy / dist) * z.bulletSpeed;
        } else {
          dx = (Math.random() - 0.5) * 1.6;
          dy = z.bulletSpeed * (0.9 + Math.random() * 0.4);
        }

        pushBullet({
          x: z.x + z.width / 2 - 8,
          y: z.y + z.height / 2 - 8,
          width: 24,
          height: 24,
          dx, dy,
          owner: z.type,
          type: "ammo.png"
        });

        z.fireCooldown = z.fireRate + Math.floor(Math.random() * 80);
      }
    }

    // player bullets → hit zombie
    for (let i = state.bullets.length - 1; i >= 0; i--) {
      const bullet = state.bullets[i];
      if (isColliding(bullet, z)) {
        z.health--;
        state.bullets.splice(i, 1);

        if (z.health <= 0) {
          // external hook first
          if (typeof _onZombieKilled === "function") {
            try { _onZombieKilled(z); } catch {}
          }

          // slug from zombie4 (also checked in slug.js)
          try { spawnSlugFromKill(z); } catch {}

          zombies.splice(zi, 1);

          const add =
            z.type === "zombie4" ? 25 :
            z.type === "zombie3" ? 20 :
            z.type === "zombie2" ? 15 : 5;

          state.score = (state.score || 0) + add;
          handleCombo(currentTime);
          maybeDrop(z);

          if (!state.bossActive && !state.bossDefeated) state.bossTriggerCount--;
        }
        break;
      }
    }
  }

  // handle special AmmoBay pickup
  processSpecialAmmoBay();
}

function handleCombo(now) {
  if (now - state.lastKillTime < 900) {
    state.comboCount++;
    state.comboTimer = 25;
    state.comboDisplay =
      state.comboCount === 2 ? "DOUBLE KILL!" :
      state.comboCount === 3 ? "TRIPLE KILL!" :
      `${state.comboCount} KILL STREAK!`;
  } else {
    state.comboCount = 1;
    state.comboDisplay = "";
  }
  state.lastKillTime = now;

  // Streak rewards
  if (state.comboCount === 2) {
    state.shieldUntil = Date.now() + 3000; // 3s shield
    showCaption("SHIELD: 3s", 900);
    try { playSound && resources?.audio?.fxPickup && playSound(resources.audio.fxPickup); } catch {}
  } else if (state.comboCount === 3) {
    spawnAmmoBayAtBottom();
  } else if (state.comboCount === 4) {
    spawnParachutePickups(2);
    // Enable Meatgrinder mode at Quad Kill
    if (!state.meatgrinderMode) {
      state.meatgrinderMode = true;
      state.meatgrinderUntil = Date.now() + 10000; // 10s duration
      state.tankSpriteKey = "tank3.png";
      showCaption("MEATGRINDER!", 1000);
    }
  }
}

function maybeDrop(z) {
  // Ammo drop (25%)
  if (Math.random() < 0.25 && resources.images["ammo2.png"]) {
    state.ammoDrops.push({
      x: z.x + z.width / 2 - 13,
      y: z.y + z.height / 2 - 13,
      width: 27, height: 27, dy: 3,
      type: "ammo2.png"
    });
  }
  // Medkit drop (10%)
  if (Math.random() < 0.10 && resources.images["medkit.png"]) {
    state.medkitDrops.push({
      x: z.x + z.width / 2 - 13,
      y: z.y + z.height / 2,
      width: 27, height: 27, dy: 2.5,
      type: "medkit.png"
    });
  }
  state.ammo = Math.min((state.ammo || 0) + 2, AMMO_CAP);
  try { if (playSound && resources?.audio?.fxExplosion) { playSound(resources.audio.fxExplosion); } } catch {}
}
