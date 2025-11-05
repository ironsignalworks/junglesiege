import { dom } from "./dom.js";

export const screens = {
  showStart() {
    dom.startScreen?.classList.add("show");
    dom.endScreen?.classList.remove("show");
    document.body.classList.remove("game-started");
  },
  hideStart(){ dom.startScreen?.classList.remove("show"); },
  showEnd(){
    dom.endScreen?.classList.add("show");
    document.body.classList.remove("game-started");
  },
  hideEnd(){ dom.endScreen?.classList.remove("show"); },
};