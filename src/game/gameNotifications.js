// src/ui/gameNotifications.js - Game-specific notification bridge
// Routes all game notifications through the main notification system

import { 
  showWarning, 
  showPill, 
  showRibbon, 
  showAtomicSwitch,
  clearAllNotifications 
} from "./notifications.js";

// Export all the main notification functions for game use
export { 
  showWarning, 
  showPill, 
  showRibbon, 
  showAtomicSwitch,
  clearAllNotifications 
};

// Game-specific notification shortcuts
export function notifyLowHealth() {
  showWarning("LOW HEALTH", "critical", 2000);
  setTimeout(() => showPill("CRITICAL", "critical", 1500), 100);
}

export function notifyLowAmmo() {
  showWarning("LOW AMMO", "critical", 2000);
  setTimeout(() => showPill("RELOAD", "critical", 1500), 150);
}

export function notifyCombo(multiplier) {
  showRibbon(`${multiplier}X COMBO`, "gameplay", 3000);
}

export function notifyBossIntro(bossName) {
  // NOTE: This function creates DOM-based boss notifications
  // The main game uses canvas-based boss intros (drawBossIntro in GameScene.js)
  // This should only be used when the canvas system is not available
  showWarning(`${bossName} APPROACHING`, "boss-intro", 4000);
}

export function notifyIntelAcquired(count, total) {
  showPill(`INTEL ${count}/${total}`, "gameplay", 2000);
  setTimeout(() => showRibbon("INTELLIGENCE ACQUIRED", "gameplay", 3000), 200);
}

export function notifyRoundStart(round) {
  showRibbon(`ROUND ${round}`, "gameplay", 2500);
}

export function notifyMissionComplete() {
  showRibbon("MISSION COMPLETE", "gameplay", 5000);
}

export function notifyPowerupAcquired(powerupName) {
  showPill(powerupName, "gameplay", 2000);
}

export function notifyWeaponPickup(weaponName) {
  showPill(`${weaponName} ACQUIRED`, "gameplay", 2000);
}

export function notifyAreaCleared() {
  showRibbon("AREA SECURED", "gameplay", 3000);
}

export function notifyObjectiveComplete() {
  showRibbon("OBJECTIVE COMPLETE", "gameplay", 3500);
}

export function notifyAtomicSwitch() {
  showAtomicSwitch("ATOMIC SWITCH ENGAGED!", 5000);
}

// Special notifications for roach events
export function notifyRoachEvent(eventType, data = {}) {
  switch (eventType) {
    case 'LOW_HEALTH':
      notifyLowHealth();
      break;
    case 'LOW_AMMO':
      notifyLowAmmo();
      break;
    case 'BOSS_INTRO':
      notifyBossIntro(data.name || "UNKNOWN BOSS");
      break;
    case 'ROUND_START':
      notifyRoundStart(data.round || 1);
      break;
    case 'INTEL_GAINED':
      notifyIntelAcquired(data.count || 1, data.total || 5);
      break;
    default:
      // Default to a status pill for unknown events
      showPill(eventType.replace(/_/g, ' '), "status", 2000);
      break;
  }
}

export function testNotificationSystem() {
  // Test all notification types to verify slot-based positioning
  showWarning("TEST WARNING 1", "critical", 10000);
  setTimeout(() => showWarning("TEST WARNING 2", "gameplay", 10000), 100);
  setTimeout(() => showWarning("TEST WARNING 3", "status", 10000), 200);
  
  setTimeout(() => showPill("TEST PILL 1", "critical", 10000), 300);
  setTimeout(() => showPill("TEST PILL 2", "gameplay", 10000), 400);
  setTimeout(() => showPill("TEST PILL 3", "status", 10000), 500);
  
  setTimeout(() => showRibbon("TEST RIBBON 1", "critical", 10000), 600);
  setTimeout(() => showRibbon("TEST RIBBON 2", "gameplay", 10000), 700);
  setTimeout(() => showRibbon("TEST RIBBON 3", "status", 10000), 800);
  
  setTimeout(() => showAtomicSwitch("ATOMIC TEST", 10000), 900);
  
  console.log("Test notifications spawned - check for overlaps");
}

// Export test function globally for debugging
if (typeof window !== 'undefined') {
  window.testNotifications = testNotificationSystem;
}