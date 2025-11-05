import { createIntroOverlay } from "./introOverlay.js";

/**
 * Kurtz intro overlay:
 * - Enter / NumpadEnter: next
 * - Esc: skip
 * - Lighter backdrop (alpha 0.50)
 * - No bottom-screen footer; we keep prompts off the card.
 */
const _kurtz = createIntroOverlay({
  imgKey: "kurtz.png",
  bgImageKey: "introkurtz.png",

  overlayAlpha: 0.50,

  controls: {
    nextKeys: ["Enter", "NumpadEnter"],
    skipKeys: ["Escape"],
    blockSpaceAdvance: true
  },

  theme: {
    panelFill: "rgba(20,16,12,0.90)",
    panelStroke: "#2b251a",
    textColor: "#d7c38f",
    footerColor: "#bfbfbf",
    titleColor: "#e6d7a8",
    fontFamily: "'Press Start 2P', monospace"
  }
});

export function isKurtzIntroActive() { return _kurtz.isActive(); }
export function startKurtzIntro(opts = {}) {
  const mapped = { ...opts };
  if (mapped.portraitKey && !mapped.imgKey) mapped.imgKey = mapped.portraitKey;
  return _kurtz.start(mapped);
}
export function updateAndRenderKurtzIntro(ctx, now) { _kurtz.updateAndRender(ctx, now); }
export function disposeKurtzIntro() { _kurtz.dispose(); }
export function skipKurtzIntro() { _kurtz.skip(); }
