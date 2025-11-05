// src/ui/notifications.js - Advanced Anti-Overlap Notification System
import { state } from "../core/state.js";

// FIXED POSITION SLOTS to prevent overlapping - arranged in a grid pattern
const NOTIFICATION_SLOTS = {
  // TOP ROW (avoid HUD area)
  slot1: { x: 15, y: 30 },
  slot2: { x: 35, y: 30 },
  slot3: { x: 65, y: 30 },
  slot4: { x: 85, y: 30 },
  
  // MIDDLE-HIGH ROW
  slot5: { x: 20, y: 45 },
  slot6: { x: 50, y: 45 },
  slot7: { x: 80, y: 45 },
  
  // MIDDLE ROW
  slot8: { x: 15, y: 60 },
  slot9: { x: 35, y: 60 },
  slot10: { x: 65, y: 60 },
  slot11: { x: 85, y: 60 },
  
  // LOWER ROW (avoid bottom HUD)
  slot12: { x: 25, y: 75 },
  slot13: { x: 75, y: 75 }
};

// Reserved zone for atomic switch (always top center)
const ATOMIC_ZONE = { x: 50, y: 15 };

// Slot assignment strategy based on notification type
const SLOT_PREFERENCE = {
  warning: ['slot1', 'slot3', 'slot5', 'slot8', 'slot10'],        // Corners and sides
  pill: ['slot2', 'slot6', 'slot9', 'slot13'],                   // Central positions
  ribbon: ['slot4', 'slot7', 'slot11', 'slot12']                 // Wide areas for ribbons
};

class NotificationManager {
  constructor() {
    this.activeNotifications = new Map();
    this.occupiedSlots = new Set();
    this.notificationId = 0;
    this.slotAssignmentHistory = [];
  }

  init() {
    if (!state.notifications) {
      state.notifications = {
        manager: this,
        active: new Map(),
        occupiedSlots: new Set()
      };
    }
  }

  // Get the best available slot for a notification type
  getBestSlot(type) {
    // Map CSS class names to internal type names
    const typeMap = {
      'warning-overlay': 'warning',
      'pill': 'pill', 
      'ribbon': 'ribbon'
    };
    
    const mappedType = typeMap[type] || type;
    const preferredSlots = SLOT_PREFERENCE[mappedType] || Object.keys(NOTIFICATION_SLOTS);
    
    // First, try preferred slots that aren't occupied
    for (const slotName of preferredSlots) {
      if (!this.occupiedSlots.has(slotName)) {
        return { slotName, position: NOTIFICATION_SLOTS[slotName] };
      }
    }
    
    // If all preferred slots are taken, try any available slot
    for (const [slotName, position] of Object.entries(NOTIFICATION_SLOTS)) {
      if (!this.occupiedSlots.has(slotName)) {
        return { slotName, position };
      }
    }
    
    // If all slots are occupied, use a fallback position with offset
    const fallbackOffset = this.occupiedSlots.size * 15; // Stagger fallbacks
    return {
      slotName: 'fallback',
      position: { x: 10 + fallbackOffset, y: 85 }
    };
  }

  createNotification(config) {
    const {
      text,
      type = 'warning',
      style = 'gameplay',
      duration = 3000,
      forcePosition = null
    } = config;

    this.init();
    
    const id = ++this.notificationId;
    const element = document.createElement('div');
    
    // Set CSS classes based on type and style
    element.className = `${type} ${style}`;
    element.textContent = text;
    element.setAttribute('data-notification-id', id);
    
    // Position the notification
    let position;
    let slotName;
    
    if (forcePosition) {
      position = forcePosition;
      slotName = 'FORCED';
    } else if (style === 'atomic-switch') {
      position = { x: ATOMIC_ZONE.x, y: ATOMIC_ZONE.y };
      slotName = 'ATOMIC';
    } else {
      const result = this.getBestSlot(type);
      position = result.position;
      slotName = result.slotName;
      
      // Mark slot as occupied
      if (slotName !== 'fallback') {
        this.occupiedSlots.add(slotName);
      }
    }
    
    element.style.left = position.x + '%';
    element.style.top = position.y + '%';
    element.style.transform = 'translate(-50%, -50%)';
    
    // Add to DOM
    const viewport = document.getElementById('game-viewport');
    if (viewport) {
      viewport.appendChild(element);
      
      // Track the notification
      this.activeNotifications.set(id, {
        element,
        slotName,
        position,
        createdAt: performance.now(),
        duration,
        type
      });
      
      // Auto-remove after duration
      setTimeout(() => {
        this.removeNotification(id);
      }, duration);
    }
    
    return { id, element };
  }

  removeNotification(id) {
    const notification = this.activeNotifications.get(id);
    if (notification) {
      // Remove from DOM
      if (notification.element.parentNode) {
        notification.element.parentNode.removeChild(notification.element);
      }
      
      // Free up the slot immediately
      if (notification.slotName !== 'ATOMIC' && notification.slotName !== 'FORCED' && notification.slotName !== 'fallback') {
        this.occupiedSlots.delete(notification.slotName);
      }
      
      // Remove from tracking
      this.activeNotifications.delete(id);
    }
  }

  clearAll() {
    for (const [id] of this.activeNotifications) {
      this.removeNotification(id);
    }
    this.occupiedSlots.clear();
  }

  // Convenience methods for different notification types
  
  createWarning(text, style = 'gameplay', duration = 3000) {
    return this.createNotification({
      text,
      type: 'warning-overlay',
      style,
      duration
    });
  }

  createPill(text, style = 'status', duration = 2000) {
    return this.createNotification({
      text,
      type: 'pill',
      style,
      duration
    });
  }

  createRibbon(text, style = 'gameplay', duration = 4000) {
    return this.createNotification({
      text,
      type: 'ribbon',
      style,
      duration
    });
  }

  // Special atomic switch notification (always top center)
  createAtomicSwitch(text, duration = 5000) {
    return this.createNotification({
      text,
      type: 'warning-overlay',
      style: 'atomic-switch',
      duration
    });
  }
}

// Global notification manager instance
const notificationManager = new NotificationManager();

// Export convenience functions
export function showWarning(text, style = 'gameplay', duration = 3000) {
  return notificationManager.createWarning(text, style, duration);
}

export function showPill(text, style = 'status', duration = 2000) {
  return notificationManager.createPill(text, style, duration);
}

export function showRibbon(text, style = 'gameplay', duration = 4000) {
  return notificationManager.createRibbon(text, style, duration);
}

export function showAtomicSwitch(text, duration = 5000) {
  return notificationManager.createAtomicSwitch(text, duration);
}

// Game-specific notification shortcuts with staggered timing to use different slots
export function showLowHealth() {
  showWarning("LOW HEALTH", "critical", 2000);
  // Delay pill to ensure it gets a different slot
  setTimeout(() => showPill("CRITICAL", "critical", 1500), 100);
}

export function showLowAmmo() {
  showWarning("LOW AMMO", "critical", 2000);
  // Delay pill to ensure it gets a different slot
  setTimeout(() => showPill("RELOAD", "critical", 1500), 150);
}

export function showCombo(multiplier) {
  showRibbon(`${multiplier}X COMBO`, "gameplay", 3000);
}

export function showBossIntro(bossName) {
  showWarning(`${bossName} APPROACHING`, "boss-intro", 4000);
}

export function showIntelAcquired(count, total) {
  showPill(`INTEL ${count}/${total}`, "gameplay", 2000);
  // Delay ribbon to ensure it gets a different slot
  setTimeout(() => showRibbon("INTELLIGENCE ACQUIRED", "gameplay", 3000), 200);
}

export function showRoundStart(round) {
  showRibbon(`ROUND ${round}`, "gameplay", 2500);
}

export function showMissionComplete() {
  showRibbon("MISSION COMPLETE", "gameplay", 5000);
}

export function showPowerupAcquired(powerupName) {
  showPill(powerupName, "gameplay", 2000);
}

export function showWeaponPickup(weaponName) {
  showPill(`${weaponName} ACQUIRED`, "gameplay", 2000);
}

export function showAreaCleared() {
  showRibbon("AREA SECURED", "gameplay", 3000);
}

export function showObjectiveComplete() {
  showRibbon("OBJECTIVE COMPLETE", "gameplay", 3500);
}

export function clearAllNotifications() {
  notificationManager.clearAll();
}

// Initialize on module load
notificationManager.init();

export default notificationManager;