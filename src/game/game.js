// Minimal demo game to show HUD integration.
// Draws a moving square; space damages player, click to add score.
let canvas, ctx, hostEl;
let running = false;
let w = 800, h = 600; // internal 4:3
let t = 0;

// Simple "game state"
let gameState = {
  hp: 100,
  ammo: 48,
  score: 0,
  round: 1,
  sector: 'Quarantine Canopy',
  mission: 'ESCAPE',
  onDamage: null,
  onAmmo: null,
  onScore: null,
  onSector: null,
};

function mountGame(host, callbacks={}) {
  hostEl = host;
  hostEl.innerHTML = ''; // clear existing
  canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.display = 'block';
  ctx = canvas.getContext('2d');
  hostEl.appendChild(canvas);

  gameState = { ...gameState, ...callbacks };

  // Input for demo
  window.addEventListener('keydown', onKey);
  canvas.addEventListener('click', onClick);
  onResize();
}

function onKey(e) {
  if (e.key === ' ') {
    // damage
    gameState.hp = Math.max(0, gameState.hp - 7);
    gameState.onDamage && gameState.onDamage(7, gameState.hp);
  }
  if (e.key === 'f' || e.key === 'F') {
    // fire (use ammo)
    if (gameState.ammo > 0) {
      gameState.ammo -= 1;
      gameState.onAmmo && gameState.onAmmo(gameState.ammo);
    }
  }
  if (e.key === 'n' || e.key === 'N') {
    // next sector demo
    gameState.round += 1;
    const sectors = ['Quarantine Canopy','Flesh Mills','Silt Delta','Canopy Depths','Terminal Sector'];
    const idx = (gameState.round-1) % sectors.length;
    gameState.sector = sectors[idx];
    gameState.mission = ['ESCAPE','STABILIZE','RECOVER','REGULATE','DISCLOSE'][idx] || 'OBJECTIVE';
    gameState.onSector && gameState.onSector(gameState.sector, gameState.round, gameState.mission);
  }
}

function onClick() {
  // add score
  gameState.score += 50;
  gameState.onScore && gameState.onScore(gameState.score);
}

function startLoop() {
  if (running) return;
  running = true;
  requestAnimationFrame(loop);
}

function stopLoop() { running = false; }

function resetGame() {
  gameState.hp = 100;
  gameState.ammo = 48;
  gameState.score = 0;
  gameState.round = 1;
  gameState.sector = 'Quarantine Canopy';
  gameState.mission = 'ESCAPE';
}

function loop(ts) {
  if (!running) return;
  t += 0.016;
  // Clear
  ctx.fillStyle = '#000';
  ctx.fillRect(0,0,w,h);

  // Draw moving rect
  const x = 100 + Math.sin(t)*200;
  const y = 100 + Math.cos(t*0.7)*120;
  ctx.fillStyle = '#2fd4ff';
  ctx.fillRect(x, y, 80, 80);

  // HUD-like debug text inside canvas
  ctx.fillStyle = '#e0e0e0';
  ctx.font = '16px Roboto Mono, monospace';
  ctx.fillText('SPACE: damage | F: fire | click: +score | N: next sector | R: end', 16, h-16);

  requestAnimationFrame(loop);
}

function onResize() {
  // Keep 4:3 inside host (CSS handles aspect; canvas scales to fit)
  // No extra logic needed; canvas is responsive to container.
}

export { mountGame, startLoop, stopLoop, resetGame, onResize };
