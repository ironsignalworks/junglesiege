// src/ui/howToPlay.js
import { resources } from "./resources.js";

export function showHowToPlay(onStart) {
  // Hide any end-screen behind the HTP overlay
  const __endOverlay =
    document.getElementById("end-screen-hard") ||
    document.getElementById("end-screen");
  if (__endOverlay) __endOverlay.style.display = "none";

  // Reuse or create the overlay
  let overlay = document.getElementById("how-to-play");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "how-to-play";
    overlay.style.cssText =
      "position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.85);z-index:200000;color:#e6ffe6;font-family:monospace;pointer-events:all;font-size:16px;line-height:1.4;overflow:auto;";
    const inner = document.createElement("div");
    inner.style.cssText =
      "width:min(92vw,760px);max-height:88vh;overflow:auto;padding:18px 22px;border:1px solid #6f9a6f;background:#10160a;border-radius:12px;box-shadow:0 6px 30px rgba(0,0,0,.4);";

    inner.innerHTML = `
      <h2 style="margin:0 0 12px;letter-spacing:1px;">HOW TO PLAY</h2>
      <div style="display:grid;gap:8px;margin-bottom:14px;">
        <div>🎮 <b>MOVE:</b> WASD, arrows or mouse</div>
        <div>🖱️ <b>FIRE:</b> mouse click or space bar</div>
        <div>
          🔋 <b>AMMO:</b> pick up ammo drops to refill
          <img src="assets/images/ammo2.png" alt="ammo" style="height:20px;vertical-align:middle;margin-left:6px;">
        </div>
        <div>
          ❤️‍🩹 <b>HEALTH:</b> grab medkit
          <img src="assets/images/medkit.png" alt="medkit" style="height:20px;vertical-align:middle;margin-left:6px;">
        </div>
      </div>

      <div style="margin:6px 0 12px;opacity:.95;">
       ⚠️ Each battlefield is harder, <b>don't run out of ammo!</b> ⚠️
      </div>

      <div style="text-align:center;margin-top:8px;">
        <button id="htp-start"
          style="padding:10px 18px;border-radius:10px;border:1px solid #8fe88f;background:#1a2a14;color:#bfffbf;cursor:pointer;font-family:monospace;font-size:16px;box-shadow:0 2px 10px rgba(0,0,0,.4);">
          Start
        </button>
      </div>
    `;

    overlay.appendChild(inner);
    document.body.appendChild(overlay);

    // Wire the Start button
    const btn = inner.querySelector("#htp-start");
    if (btn) {
      btn.onclick = () => {
        // stop any HTP bgm if you have one
        try {
          if (resources?.audio?.instructionsBgm) {
            resources.audio.instructionsBgm.pause();
            resources.audio.instructionsBgm.currentTime = 0;
          }
        } catch {}
        overlay.remove();
        if (typeof onStart === "function") onStart();
      };
    }

    // Optional: close on Escape
    const escHandler = (e) => {
      if (e.code === "Escape") {
        e.preventDefault();
        if (overlay && overlay.parentNode) overlay.remove();
        if (typeof onStart === "function") onStart();
        document.removeEventListener("keydown", escHandler, true);
      }
    };
    document.addEventListener("keydown", escHandler, true);
  } else {
    overlay.style.display = "flex";
  }
}
