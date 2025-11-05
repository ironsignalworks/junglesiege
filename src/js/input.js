import { dom } from "./dom.js";
import { store, actions } from "./store.js";
import { screens } from "./screens.js";
import { renderHUD } from "./hud.js";
import { startLoop, stopLoop } from "./game.js";

export function bindInput(){
  dom.startBtn?.addEventListener("click", () => {
    actions.startGame();
    screens.hideStart();
    document.body.classList.add("game-started");
    renderHUD();
    startLoop();
  });

  dom.restartBtn?.addEventListener("click", () => {
    actions.startGame();
    screens.hideEnd();
    document.body.classList.add("game-started");
    renderHUD();
    startLoop();
  });

  window.addEventListener("keydown", (e) => {
    if (e.code === "KeyP") store.paused = !store.paused;
    if (e.code === "Space") { actions.consumeAmmo(1); actions.addScore(5); renderHUD(); }
  }, { passive:true });
}