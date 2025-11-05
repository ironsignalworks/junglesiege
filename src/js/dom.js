const $ = (s, r=document) => r.querySelector(s);

export const dom = {
  canvas: $("#gameCanvas"),
  startScreen: $("#start-screen"),
  endScreen: $("#end-screen"),
  startBtn: $("#start-button"),
  restartBtn: $("#restart-button"),
  hudRoot:  $("#screen-hud"),
  hudTop:   document.querySelector(".hud-top"),
  hudBottom: document.querySelector(".hud-bottom"),
  hudRound:  document.querySelector(".hud-top .val.round"),
  hudSector: document.querySelector(".hud-top .val.sector"),
  hpFill:    document.querySelector(".hp-fill"),
  ammoPips:  document.querySelectorAll(".pips .pip"),
  scoreVal:  document.querySelector(".hud-value.score"),
};