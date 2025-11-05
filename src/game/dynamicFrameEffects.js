// src/ui/dynamicFrameEffects.js
// Simplified dynamic effects for functional HUD elements

/**
 * Simple Frame Effects Manager
 * Handles basic visual feedback for the simplified HUD
 */
class DynamicFrameEffects {
  constructor() {
    this.isInitialized = false;
    this.animationFrameId = null;
    this.startTime = Date.now();
  }

  /**
   * Initialize basic effects
   */
  init() {
    if (this.isInitialized) return;
    
    this.setupBasicEffects();
    this.isInitialized = true;
    console.log('Simplified Dynamic Frame Effects initialized');
  }

  /**
   * Setup basic visual feedback effects
   */
  setupBasicEffects() {
    // Simple warning flash for low health
    this.setupHealthWarning();
    // Simple ammo warning
    this.setupAmmoWarning();
  }

  /**
   * Setup health warning effect
   */
  setupHealthWarning() {
    // This will be triggered by game events
  }

  /**
   * Setup ammo warning effect
   */
  setupAmmoWarning() {
    // This will be triggered by game events
  }

  /**
   * Trigger simple effects based on game events
   */
  triggerEffect(type, intensity = 1.0) {
    switch (type) {
      case 'damage':
        this.flashElement('.hp-bar', '#ff4444', 200);
        break;
      case 'low-health':
        this.pulseElement('.hp-fill', '#ff4444', 1000);
        break;
      case 'low-ammo':
        this.flashElement('.pips', '#ffcc00', 300);
        break;
      case 'score':
        this.flashElement('#hud-score', '#00ff88', 150);
        break;
    }
  }

  /**
   * Simple flash effect
   */
  flashElement(selector, color, duration) {
    const element = document.querySelector(selector);
    if (!element) return;

    const originalBackground = element.style.backgroundColor;
    element.style.backgroundColor = color;
    element.style.transition = `background-color ${duration}ms ease`;

    setTimeout(() => {
      element.style.backgroundColor = originalBackground;
    }, duration);
  }

  /**
   * Simple pulse effect
   */
  pulseElement(selector, color, duration) {
    const element = document.querySelector(selector);
    if (!element) return;

    element.style.animation = `pulse ${duration}ms ease-in-out infinite`;
    element.style.setProperty('--pulse-color', color);

    // Add CSS for pulse animation if not exists
    if (!document.querySelector('#pulse-animation')) {
      const style = document.createElement('style');
      style.id = 'pulse-animation';
      style.textContent = `
        @keyframes pulse {
          0% { box-shadow: 0 0 0 rgba(255, 68, 68, 0); }
          50% { box-shadow: 0 0 10px var(--pulse-color, #ff4444); }
          100% { box-shadow: 0 0 0 rgba(255, 68, 68, 0); }
        }
      `;
      document.head.appendChild(style);
    }

    // Remove pulse after some time
    setTimeout(() => {
      element.style.animation = '';
    }, duration * 3);
  }

  /**
   * Update HUD values with simple feedback
   */
  updateHUDValue(elementId, newValue, options = {}) {
    const element = document.getElementById(elementId);
    if (!element) return;

    const { flash = false, flashColor = '#00ff88' } = options;

    element.textContent = newValue;

    if (flash) {
      this.flashElement(`#${elementId}`, flashColor, 200);
    }
  }

  /**
   * Show intel popup (for future implementation)
   */
  showIntelPopup(content) {
    const popup = document.getElementById('intel-popup');
    const contentDiv = document.getElementById('intel-content');
    
    if (popup && contentDiv) {
      contentDiv.textContent = content;
      popup.classList.add('show');
      
      // Hide after 5 seconds or on keypress
      const hidePopup = () => {
        popup.classList.remove('show');
        document.removeEventListener('keydown', hidePopup);
      };
      
      document.addEventListener('keydown', hidePopup, { once: true });
      setTimeout(hidePopup, 5000);
    }
  }

  /**
   * Cleanup
   */
  destroy() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    
    this.isInitialized = false;
    
    // Remove dynamic styles
    document.querySelectorAll('#pulse-animation').forEach(el => {
      if (el.parentNode) {
        el.parentNode.removeChild(el);
      }
    });
  }
}

// Create global instance
export const dynamicFrameEffects = new DynamicFrameEffects();

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => dynamicFrameEffects.init(), 100);
  });
} else {
  setTimeout(() => dynamicFrameEffects.init(), 100);
}

// Export for manual control
export { DynamicFrameEffects };