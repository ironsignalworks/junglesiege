
// src/game/hudShell.js
export function createHUD(root, opts={}){
  if(!root) throw new Error('createHUD: root required');
  root.classList.add('isw-hud');
  root.style.aspectRatio = opts.aspectRatio || '4 / 3';
  root.style.width = opts.width || 'min(1200px, 96vw)';
  root.style.height = 'auto';
  root.innerHTML = `
    <div class="isw-hud__frame"></div>
    <div class="isw-hud__top">
      <div class="isw-hud__panel"><div class="isw-hud__label">Round</div><div class="isw-hud__value isw-hud__value--sm" data-f="round">01</div></div>
      <div class="isw-hud__panel"><div class="isw-hud__label">Sector</div><div class="isw-hud__value isw-hud__value--sm" data-f="sector">E1M1</div></div>
      <div class="isw-hud__panel"><div class="isw-hud__label">Mission</div><div class="isw-hud__value isw-hud__value--lg" data-f="mission">ESCAPE</div></div>
    </div>
    <div class="isw-hud__play" data-f="play"></div>
    <div class="isw-hud__bot">
      <div class="isw-hud__panel"><div class="isw-hud__label">HP</div><div class="isw-hud__value isw-hud__value--sm" data-f="hpNum">100</div></div>
      <div class="isw-hud__panel isw-hud__barbox">
        <div class="isw-hud__barwrap">
          <div class="isw-hud__bar" data-f="hpBar" style="width:100%"></div>
          <div class="isw-hud__barnum" data-f="hpText">100/100</div>
        </div>
      </div>
      <div class="isw-hud__panel"><div class="isw-hud__label">Ammo</div><div class="isw-hud__value isw-hud__value--sm" data-f="ammo">000</div></div>
      <div class="isw-hud__panel"><div class="isw-hud__label">Score</div><div class="isw-hud__value" data-f="score">000000</div></div>
      <div class="isw-hud__panel"><div class="isw-hud__label">Mode</div><div class="isw-hud__value" data-f="mode">COMBAT</div></div>
    </div>`;
  const $ = k => root.querySelector(`[data-f="${k}"]`);
  const state = { round:1, sector:'E1M1', mission:'ESCAPE', hp:100, maxHp:100, ammo:0, score:0, mode:'COMBAT' };
  const pad = (n,len)=> String(n ?? 0).padStart(len,'0');
  function render(){
    $('round').textContent = pad(state.round,2);
    $('sector').textContent = state.sector;
    $('mission').textContent = state.mission;
    $('hpNum').textContent = pad(Math.round(state.hp),2);
    $('hpText').textContent = `${Math.round(state.hp)}/${state.maxHp}`;
    $('hpBar').style.width = Math.max(0,Math.min(100,(state.hp/state.maxHp)*100)) + '%';
    $('ammo').textContent = pad(state.ammo,3);
    $('score').textContent = pad(state.score,6);
    $('mode').textContent = state.mode;
  }
  function set(next){ Object.assign(state,next||{}); render(); }
  function mountPlay(node){ const el = $('play'); if(node) el.appendChild(node); return el; }
  render();
  return { set, mountPlay, state, root };
}

(function(){
  if (typeof window === 'undefined') return;
  window.addEventListener('DOMContentLoaded', () => {
    // Create HUD root
    const hudRoot = document.createElement('div');
    hudRoot.id = 'iswHudRoot';
    document.body.prepend(hudRoot);
    const hud = createHUD(hudRoot, {});

    // Move game viewport into play area
    const viewport = document.getElementById('game-viewport');
    if (viewport) hud.mountPlay(viewport);

    // Live bridge to window.state
    const loop = ()=>{
      const s = window.state || {};
      const player = s.player || s;
      hud.set({
        round: s.round ?? s.currentRound ?? 1,
        sector: s.sectorKey || s.sector || 'E1M1',
        mission: s.objective || s.mission || 'ESCAPE',
        hp: player.hp ?? s.hp ?? 100,
        maxHp: player.maxHp ?? s.maxHp ?? 100,
        ammo: player.ammo ?? s.ammo ?? 0,
        score: s.score ?? 0,
        mode: s.mode || s.gameMode || 'COMBAT',
      });
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  });
})();
