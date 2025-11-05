// src/story/storyCards.js
import { createIntroOverlay } from "../ui/introOverlay.js";

/**
 * Story cards reuse the Intro Overlay with per-card avatar + background.
 * Gated input: Enter -> next, Esc -> skip. No bottom footer UI.
 */

const overlay = createIntroOverlay({
  // Defaults used if a specific card doesn't provide its own keys
  bgImageKey: "introkurtz.png",
  imgKey: "kurtz.png",

  // Typing / pacing (faster, shorter hold)
  preDelay: 300,
  typeDelay: 22,
  doneHold: 540,

  // Make the dimmer lighter so scene stays visible
  overlayAlpha: 0.50,

  // Remove bottom footer; show a small prompt inside the panel
  ui: {
    showBottomFooter: false,
    inCardPrompt: "ENTER (next)   ESC (skip)",
    promptAlign: "right",
    promptMargin: 12
  },

  // Key mapping
  controls: {
    nextKeys: ["Enter", "NumpadEnter"],
    skipKeys: ["Escape"],
    blockSpaceAdvance: true
  },

  // Visual theme (matches Kurtz overlay)
  theme: {
    panelFill: "rgba(20,16,12,0.90)",
    panelStroke: "#2b251a",
    textColor: "#d7c38f",
    titleColor: "#e6d7a8",
    fontFamily: "'Press Start 2P', monospace"
  }
});

export function isStoryCardActive() {
  return overlay.isActive();
}

export function renderStoryCards(ctx, now) {
  if (overlay.isActive()) overlay.updateAndRender(ctx, now);
}

/* -------------------- Cards -------------------- */

// 1) After boss Katana Joe
export function cardAfterKatanaJoe() {
  return overlay.start({
    imgKey: "katanaJoe.png",
    bgImageKey: "bg_katanaJoe.png",
    lines: [
      "The blade stills; the delta breathes black.",
      "Joe's dossier bleeds ichor and regret.",
      "Cold-Iron Darts: a dead countermeasure.",
      "Command left the swamp--something else didn't."
    ]
  });
}

// 2) Before boss Dr Slime
export function cardBeforeDrSlime() {
  return overlay.start({
    imgKey: "drSlime.png",
    bgImageKey: "bg_drSlime.png",
    lines: [
      "The labs hum like throats trying to scream.",
      "He called it a cure; the jungle calls it food.",
      "Pipes sweat ICHOR-X. Doors remember names.",
      "Step lightly--these walls incubate."
    ]
  });
}

// 3) Finale -- before DD Nukes
export function cardBeforeDDNukes() {
  return overlay.start({
    imgKey: "ddNukes.png",
    bgImageKey: "bg_ddNukes_pre.png",
    lines: [
      "Every trench clock ticks to zero.",
      "DD Nukes isn't a man--he's a dose.",
      "Warheads pray in racks like saints with pins.",
      "Mask the fear. Unmask the vessel."
    ]
  });
}

// 4) Finale -- after DD Nukes (endgame choice revelation)
export function cardAfterDDNukes_Reveal() {
  return overlay.start({
    imgKey: "revelation.png",
    bgImageKey: "bg_ddNukes_post.png",
    lines: [
      "Shrapnel stops. The lie does not.",
      "Nukes cracks--Kurtz looks out from the ruin.",
      "The uplinks chant: WAR IS THE SERUM.",
      "Choose quickly; the jungle already has."
    ]
  });
}

/* -------------------- Endings -------------------- */

// Ending A: Join Kurtz (loop restarts, harder)
export function endScreen_JoinKurtz() {
  return overlay.start({
    imgKey: "ending_join.png",
    bgImageKey: "bg_ending_join.png",
    lines: [
      "Assimilation logged: you kneel to the Redline.",
      "HUD fractures; ICHOR-X veins lace your sight.",
      "The hive learns your name, then wears it.",
      "Cycle restarts--harder. You are inside it."
    ]
  });
}

// Ending B: Burn the jungle (counter-agent complete)
export function endScreen_BurnJungle() {
  return overlay.start({
    imgKey: "ending_burn.png",
    bgImageKey: "bg_ending_burn.png",
    lines: [
      "Counter-agent dispersed. Detonation complete.",
      "Vines carbonize; the canopy exhales silence.",
      "Then--coughing, distant... closer.",
      "Saved the world--or saved what's left of it."
    ]
  });
}
