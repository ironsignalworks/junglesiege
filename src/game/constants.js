// src/core/constants.js

export const constants = {
  // --- ONE SWITCH TO RULE AMMO ---
  ammoInfinite: true,          // <- toggle this: true = infinite ammo, false = finite
  startingAmmo: 1000,          // <- used when ammoInfinite === false
  maxAmmo: 5000,               // cap for pickups if finite

  // Speeds
  playerBulletSpeed: 12,
  enemyBulletSpeed: 6,

  // Aiming
  playerAimHalfAngleDeg: 90,   // clamp player aim to +/- this angle about +X

  // UI/layout
  zombieScale: 1.35,
  hudScale: 0.68,
  bottomBarHeight: 110,

  // Assets / backgrounds (optional, used in GameScene)
  bgImages: [
    "bg_jungle1.png","bg_jungle2.png","bg_jungle3.png","bg_jungle4.png",
    "bg_jungle5.png","bg_jungle6.png","bg_jungle7.png","bg_jungle8.png",
    "bg_jungle9.png","bg_jungle10.png","bg_jungle11.png","bg_jungle12.png","bg_jungle13.png",
  ],

  // Optional: per-boss kill thresholds to trigger boss
  bossTriggerThresholds: {
    0: 10, 1: 12, 2: 14, 3: 16, 4: 18, 5: 20, 6: 22, 7: 24, 8: 26, 9: 28
  },
  // Toggle to remove canvas HUD drawing and rely on DOM frame HUD
  showCanvasHUD: false, // Use DOM HUD system instead of canvas HUD
};

export default constants;
