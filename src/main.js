import { HUD } from './ui/hud.js';
import './ui/hud.css';
import { mountGame, startLoop, stopLoop, resetGame, onResize } from './game/game.js';

/**
 * Boot HUD
 */
const hud = HUD.init({
  mode: 'start',
  round: 1,
  sector: 'Quarantine Canopy',
  mission: 'ESCAPE',
  hp: 100, maxHp: 100,
  ammo: 48,
  score: 0,
  onStart: () => {
    // Mount the canvas into the HUD frame host
    const host = hud.getStageHost();
    mountGame(host, {
      onDamage: (dmg, hp) => hud.update({ hp }),
      onAmmo: (ammo) => hud.update({ ammo }),
      onScore: (score) => hud.update({ score }),
      onSector: (sector, round, mission) => hud.update({ sector, round, mission })
    });
    startLoop();
    window.addEventListener('resize', onResize);
  },
  onRestart: () => {
    resetGame();
    hud.update({ hp: 100, ammo: 48, score: 0, round: 1, sector: 'Quarantine Canopy', mission: 'ESCAPE' });
    startLoop();
  },
  onQuit: () => {
    stopLoop();
    HUD.setMode('start');
  },
});

// Simulate progression events for demo
// (Press space to simulate damage; press R to end and show end screen)
window.addEventListener('keydown', (e) => {
  if (e.key === 'r' || e.key === 'R') {
    stopLoop();
    HUD.setMode('end', { victory:false, reason:'Demo over — user pressed R.' });
  }
});
