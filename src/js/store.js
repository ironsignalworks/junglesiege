export const store = {
  started: false,
  paused: false,
  round: 1,
  sectorKey: "ALPHA",
  hp: 100,
  ammo: 6,
  score: 0,
  bossMode: false,
  bestScore: 0,
};

export const actions = {
  startGame() { store.started = true; store.paused = false; store.hp = 100; store.ammo = 6; store.score = 0; },
  endGame(finalScore) { store.started = false; store.paused = true; store.bestScore = Math.max(store.bestScore, finalScore|0); },
  setSector(key) { store.sectorKey = key; },
  setRound(n) { store.round = n|0; },
  setBossMode(on) { store.bossMode = !!on; },
  addScore(n) { store.score += n|0; },
  damage(n) { store.hp = Math.max(0, store.hp - (n|0)); },
  consumeAmmo(n=1){ store.ammo = Math.max(0, store.ammo - (n|0)); },
};