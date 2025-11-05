// src/ui/hud.js — single-module HUD system
export const HUD = (() => {
  let state = {
    round: 1,
    sector: "E1M1",
    mission: "ESCAPE",
    hp: 100,
    maxHp: 100,
    ammo: 60,
    score: 0,
    mode: "start",
    onStart: null,
    onRestart: null,
    onQuit: null,
  };

  let root, frame, topRail, botRail, stageHost, overlay;
  let els = {};

  function ensureRoot() {
    root = document.getElementById('hud-root');
    if (!root) {
      root = document.createElement('div');
      root.id = 'hud-root';
      document.body.appendChild(root);
    }
  }

  function mount() {
    ensureRoot();
    root.innerHTML = `
      <div class="hud-frame">
        <div class="hud-frame-inner" aria-label="Game HUD Frame">
          <div class="hud-rail top" id="hudTop">
            <div class="pill"><span>Round</span><span class="val" id="hudRound">1</span></div>
            <div class="pill"><span>Sector</span><span class="val" id="hudSector">E1M1</span></div>
            <div class="pill"><span>Mission</span><span class="val" id="hudMission">ESCAPE</span></div>
            <div class="pill"><span>Mode</span><span class="val" id="hudMode">START</span></div>
          </div>

          <div id="game-stage-host"></div>

          <div class="hud-rail bottom" id="hudBottom">
            <div class="pill"><span>HP</span><span class="val" id="hudHp">100</span></div>
            <div class="pill"><span>Ammo</span><span class="val" id="hudAmmo">60</span></div>
            <div class="pill"><span>Score</span><span class="val" id="hudScore">000000</span></div>
          </div>

          <div class="hud-overlay hidden" id="hudOverlay"></div>
        </div>
      </div>
    `;

    topRail = root.querySelector('#hudTop');
    botRail = root.querySelector('#hudBottom');
    overlay = root.querySelector('#hudOverlay');
    stageHost = root.querySelector('#game-stage-host');

    els.round   = root.querySelector('#hudRound');
    els.sector  = root.querySelector('#hudSector');
    els.mission = root.querySelector('#hudMission');
    els.mode    = root.querySelector('#hudMode');
    els.hp      = root.querySelector('#hudHp');
    els.ammo    = root.querySelector('#hudAmmo');
    els.score   = root.querySelector('#hudScore');
  }

  function renderOverlayStart() {
    overlay.innerHTML = `
      <div class="overlay-card">
        <div class="overlay-title">Operation: Jungle Siege</div>
        <div class="overlay-sub">Recover five intel pieces. Survive the ICHOR-X zone.</div>
        <div class="rule"></div>
        <div class="meta-grid">
          <div class="meta"><span>Round</span><span class="val">\${state.round}</span></div>
          <div class="meta"><span>Sector</span><span class="val">\${state.sector}</span></div>
          <div class="meta"><span>Mission</span><span class="val">\${state.mission}</span></div>
        </div>
        <div style="display:flex; gap:12px; flex-wrap:wrap">
          <button class="btn" id="btnStart">Start Mission</button>
          <button class="btn" id="btnQuit">Quit</button>
        </div>
      </div>
    `;
    const startBtn = overlay.querySelector('#btnStart');
    const quitBtn  = overlay.querySelector('#btnQuit');
    startBtn?.addEventListener('click', () => {
      setMode('game');
      state.onStart && state.onStart();
    });
    quitBtn?.addEventListener('click', () => state.onQuit && state.onQuit());
  }

  function renderOverlayEnd({ victory = false, reason = '' } = {}) {
    overlay.innerHTML = `
      <div class="overlay-card">
        <div class="overlay-title">\${victory ? 'Extraction Complete' : 'Mission Failed'}</div>
        <div class="overlay-sub">\${reason || (victory ? 'All objectives secured.' : 'The jungle took another soul.')}</div>
        <div class="rule"></div>

        <div class="meta-grid">
          <div class="meta"><span>Round</span><span class="val">\${state.round}</span></div>
          <div class="meta \${state.hp <= 0 ? 'bad':''}"><span>HP</span><span class="val">\${state.hp}/\${state.maxHp}</span></div>
          <div class="meta"><span>Score</span><span class="val">\${state.score}</span></div>
        </div>

        <div style="display:flex; gap:12px; flex-wrap:wrap">
          <button class="btn" id="btnRestart">Restart</button>
          <button class="btn" id="btnQuit">Quit</button>
        </div>
      </div>
    `;
    const restartBtn = overlay.querySelector('#btnRestart');
    const quitBtn    = overlay.querySelector('#btnQuit');
    restartBtn?.addEventListener('click', () => {
      setMode('game');
      state.onRestart && state.onRestart();
    });
    quitBtn?.addEventListener('click', () => state.onQuit && state.onQuit());
  }

  function setMode(mode, endPayload) {
    state.mode = mode;
    els.mode.textContent = mode.toUpperCase();
    if (mode === 'start') {
      overlay.classList.remove('hidden');
      renderOverlayStart();
    } else if (mode === 'end') {
      overlay.classList.remove('hidden');
      renderOverlayEnd(endPayload);
    } else {
      overlay.classList.add('hidden');
    }
  }

  function update(patch = {}) {
    Object.assign(state, patch);
    els.round.textContent   = state.round;
    els.sector.textContent  = state.sector;
    els.mission.textContent = state.mission;
    els.hp.textContent      = Math.max(0, Math.floor(state.hp));
    els.ammo.textContent    = Math.max(0, Math.floor(state.ammo));
    els.score.textContent   = String(state.score).padStart(6,'0');

    const hpPill = els.hp.closest('.pill');
    if (hpPill) {
      hpPill.classList.toggle('bad', state.hp <= state.maxHp * 0.25);
      hpPill.classList.toggle('good', state.hp > state.maxHp * 0.75);
    }
  }

  function getStageHost() { return stageHost; }

  function init(options = {}) {
    mount();
    state = { ...state, ...options };
    update();
    setMode(state.mode || 'start');
    return { update, setMode, getStageHost };
  }

  function teardown() {
    root?.remove();
    root = null;
  }

  return { init, update, setMode, getStageHost, teardown };
})();
