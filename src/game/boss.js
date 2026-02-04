// src/systems/boss.js - SIMPLIFIED AND FIXED

/** Legacy-style Boss with pluggable attack patterns */
export class Boss {
  constructor(def, sprite, x, y) {
    // Identity / visuals
    this.name = def.name || "BOSS";
    this.quote = def.quote || null;
    this.sprite = sprite;
    this.backdrop = def.backdrop;

    // Position / size - MAKE BOSSES 30% BIGGER
    this.x = x || 0;
    this.y = y || 0;
    this.width = Math.floor((def.width || 150) * 1.3); // 30% BIGGER
    this.height = Math.floor((def.height || 200) * 1.3); // 30% BIGGER

    // Stats
    this.maxHealth = def.maxHealth ?? 60;
    this.health = this.maxHealth;
    this.speed = def.speed ?? 2.0;
    this.isAlive = true;

    // Attacks - SIMPLIFIED
    this.attackPattern = def.attackPattern || "default";
    this.projectileType = def.projectileType || "ammo.png";
    this.attackCooldown = 60; // Fixed cooldown

    // Internal
    this._t = 0;
    this.state = { 
      phase: 0,
      timer: 0,
      lastHealthGate: 1.0,
    };
  }

  /** Spawn projectile helper */
  _spawnProjectile(projectiles, p) {
    const base = {
      x: this.x + this.width / 2 - 16,
      y: this.y + this.height / 2 - 16,
      vx: 0, vy: 0,
      width: 64, height: 64, // DOUBLED SIZE (was 32x32, now 64x64) - 100% BIGGER
      type: this.projectileType,
      from: "boss",
    };
    const out = Object.assign(base, p || {}); out.owner = 'boss'; out.fromBoss = true;
    
    // ENSURE ALL PROJECTILE SIZES ARE DOUBLED
    if (out.width <= 64) out.width = Math.max(out.width * 2, 48); // Minimum 48px, double existing
    if (out.height <= 64) out.height = Math.max(out.height * 2, 48); // Minimum 48px, double existing
    
    projectiles.push(out);
  }

  /** Basic movement toward player */
  _pursue(player, canvas, bottomBarHeight) {
    const cx = this.x + this.width / 2;
    const cy = this.y + this.height / 2;
    const px = player.x + player.width / 2;
    const py = player.y + player.height / 2;
    let dx = px - cx;
    let dy = py - cy;
    const dist = Math.max(1, Math.hypot(dx, dy));
    
    if (dist > 10) {
      this.x += (dx / dist) * this.speed;
      this.y += (dy / dist) * this.speed;
      
      // Keep boss in bounds
      this.x = Math.max(0, Math.min(canvas.width - this.width, this.x));
      const maxY = canvas.height - bottomBarHeight - this.height - 50;
      this.y = Math.max(10, Math.min(maxY, this.y));
    if (this.attackPattern === 'slam') { const topBandMaxY = Math.max(10, Math.floor(canvas.height * 0.35) - this.height); this.y = Math.min(this.y, topBandMaxY); }
    }
    return { dx, dy, dist, cx, cy, px, py };
  }

  /** Maintain a preferred distance band; retreat if too close, approach if too far, otherwise strafe */
  _maintainDistance(player, canvas, bottomBarHeight, opts = {}) {
    const min = Number.isFinite(opts.min) ? opts.min : 220;
    const max = Number.isFinite(opts.max) ? opts.max : 360;
    const strafeSpeed = Number.isFinite(opts.strafeSpeed) ? opts.strafeSpeed : 2.0;

    const cx = this.x + this.width / 2;
    const cy = this.y + this.height / 2;
    const px = player.x + player.width / 2;
    const py = player.y + player.height / 2;
    let dx = px - cx;
    let dy = py - cy;
    const dist = Math.max(1, Math.hypot(dx, dy));

    const vScale = (this.attackPattern === 'slam') ? 0.5 : 1.0;
    if (dist < min) {
      this.x -= (dx / dist) * (this.speed * 1.8);
      this.y -= (dy / dist) * (this.speed * 1.2) * vScale;
    } else if (dist > max) {
      this.x += (dx / dist) * (this.speed * 0.9);
      this.y += (dy / dist) * (this.speed * 0.7) * vScale;
    } else {
      // in band: strafe horizontally to feel smarter
      this.x += Math.sign(Math.sin(this._t * 0.05)) * strafeSpeed;
    }

    // Constrain to arena
    this.x = Math.max(0, Math.min(canvas.width - this.width, this.x));
    const maxY = canvas.height - bottomBarHeight - this.height - 50;
    this.y = Math.max(10, Math.min(maxY, this.y));
    if (this.attackPattern === 'slam') { const topBandMaxY = Math.max(10, Math.floor(canvas.height * 0.35) - this.height); this.y = Math.min(this.y, topBandMaxY); }
  }

  /** Aimed shot at player */
  _aimAtPlayer(player, projectiles, speed = 6) {
    const cx = this.x + this.width / 2;
    const cy = this.y + this.height / 2;
    const px = player.x + player.width / 2;
    const py = player.y + player.height / 2;
    const ang = Math.atan2(py - cy, px - cx);
    
    this._spawnProjectile(projectiles, {
      x: cx - 32, y: cy - 32, // Adjusted for bigger projectiles (was -16, now -32)
      vx: Math.cos(ang) * speed,
      vy: Math.sin(ang) * speed,
      type: this.projectileType,
      width: 48, height: 48 // DOUBLED SIZE (was 24x24, now 48x48)
    });
  }

  /** Main update */
  update(player, projectiles, canvas, bottomBarHeight) {
    if (!this.isAlive) return;

    // Basic movement
    this._maintainDistance(player, canvas, bottomBarHeight);

    // Attack pattern
    const pattern = AttackPatterns[this.attackPattern] || AttackPatterns.default;
    pattern.call(this, { player, projectiles, canvas, bottomBarHeight });

    this._t++;
    this.state.timer++;
  }

  render(ctx) {
    if (!this.isAlive) return;
    if (this.sprite) {
      ctx.drawImage(this.sprite, this.x, this.y, this.width, this.height);
    } else {
      // Fallback visual
      ctx.save();
      ctx.fillStyle = "#b71c1c";
      ctx.fillRect(this.x, this.y, this.width, this.height);
      ctx.fillStyle = "#fff";
      ctx.font = "bold 18px monospace";
      ctx.fillText(this.name, this.x + 6, this.y - 8);
      ctx.restore();
    }
  }
}

/** ---------- SIMPLIFIED ATTACK PATTERNS ---------- */
const AttackPatterns = {
  // Default: simple aimed shots
  default({ player, projectiles }) {
    if (this._t % 75 === 0) this._aimAtPlayer(player, projectiles, 6);
  },

  // Mallet Melissa: rush + slam
  slam({ player, projectiles, canvas, bottomBarHeight }) {
    const s = this.state;
    
    if (s.phase === 0) { // Rush phase
      if (s.timer < 30) return; // windup
      const k = this._pursue(player, canvas, bottomBarHeight);
      const mult = 2.5;
      this.x += (k.dx / Math.max(1, k.dist)) * this.speed * mult;
      this.y += (k.dy / Math.max(1, k.dist)) * this.speed * mult * 0.35;
      { const topBandMaxY = Math.max(10, Math.floor(canvas.height * 0.35) - this.height); this.y = Math.min(this.y, topBandMaxY); }
      
      if (s.timer >= 40) { 
        s.phase = 1; 
        s.timer = 0; 
      }
    } else if (s.phase === 1) { // Slam phase
      if (s.timer === 0) {
        // Create shockwave
        const cx = this.x + this.width / 2;
        const cy = this.y + this.height;
        this._spawnProjectile(projectiles, {
          x: cx, y: cy,
          kind: "shock_ring",
          radius: 8, dr: 6, maxRadius: 200, ttl: 40,
          type: "shockwave.png",
          vx: 0, vy: 0,
          width: 24, height: 24
        });
      }
      
      if (s.timer > 20) { 
        s.phase = 0; 
        s.timer = 0; 
      }
    }

    // Regular aimed shots
    if (this._t % 60 === 0) {
      this._aimAtPlayer(player, projectiles);
    }
  },

  // TNTina: timed bombs
  timed_bombs({ player, projectiles }) {
    if (this._t % 80 === 0) {
      const px = player.x + (Math.random() * 100 - 50);
      const py = player.y + (Math.random() * 50 - 25);
      this._spawnProjectile(projectiles, {
        x: px, y: py,
        vx: 0, vy: 0,
        kind: "timer_bomb",
        fuse: 90, blinkStart: 45,
        type: this.projectileType,
        width: 36, height: 36
      });
    }
  },

  // Katana Joe: FIXED - simple dash with slashes
  dash_slash({ projectiles, canvas, player }) {
    const s = this.state;
    
    // Initialize if needed
    if (!s.init) {
      s.init = true;
      s.laneY = this.y;
      s.dir = Math.random() < 0.5 ? -1 : 1;
      s.cool = 0;
    }
    
    if (s.cool <= 0) {
      // Occasionally change lane
      if (Math.random() < 0.008) {
        s.laneY = 60 + Math.random() * (canvas.height * 0.4);
      }
      
      // Move toward lane
      const dy = s.laneY - this.y;
      this.y += Math.sign(dy) * Math.min(Math.abs(dy), 4);
      
      // Dash horizontally
      this.x += s.dir * 8;
      
      // Reverse at edges
      if (this.x < 20 || this.x + this.width > canvas.width - 20) {
        s.dir *= -1;
        s.cool = 15; // Brief pause
      }
      
      // Leave slash trails
      if (this._t % 4 === 0) {
        this._spawnProjectile(projectiles, {
          x: this.x + this.width / 2,
          y: this.y + this.height / 2,
          vx: 0, vy: 0,
          type: "slash.png",
          kind: "trail",
          ttl: 20,
          width: 48, height: 18
        });
      }
    } else {
      s.cool--;
    }

    // Regular aimed shots (katana throws)
    if (this._t % 45 === 0) {
      this._aimAtPlayer(player, projectiles, 7);
    }
  },

  // Chainsaw Carla: slow push + puddles
  slow_push_bleed({ player, projectiles }) {
    // Slow advance toward player
    const cx = this.x + this.width / 2;
    const cy = this.y + this.height / 2;
    const px = player.x + player.width / 2;
    const py = player.y + player.height / 2;
    const ang = Math.atan2(py - cy, px - cx);
    
    this.x += Math.cos(ang) * 1.0;
    this.y += Math.sin(ang) * 1.0;

    // Drop blood puddles
    if (this._t % 50 === 0) {
      this._spawnProjectile(projectiles, {
        x: this.x + this.width / 2,
        y: this.y + this.height - 10,
        kind: "puddle",
        radius: 30,
        ttl: 200,
        type: "blood_puddle.png",
        vx: 0, vy: 0,
        width: 24, height: 24
      });
    }

    // Chainsaw shots
    if (this._t % 60 === 20) {
      this._aimAtPlayer(player, projectiles, 5);
    }
  },

  // General Slaughter: lob shots
  lob_shield({ player, projectiles }) {
    if (this._t % 70 === 0) {
      const speed = 4.5;
      const cx = this.x + this.width / 2;
      const cy = this.y + this.height / 2;
      const px = player.x + player.width / 2 + (Math.random() * 60 - 30);
      const py = player.y + player.height / 2 + (Math.random() * 30 - 15);
      const ang = Math.atan2(py - cy, px - cx);
      
      this._spawnProjectile(projectiles, {
        x: cx - 12, y: cy - 12,
        vx: Math.cos(ang) * speed,
        vy: Math.sin(ang) * speed * 0.6,
        gravity: 0.2,
        type: this.projectileType,
        kind: "lob",
        width: 28, height: 28
      });
    }
  },

  // Lord Humungus: hook attacks
  hook_pull({ player, projectiles }) {
    const s = this.state;
    if (!s.cool) s.cool = 0;
    
    if (s.cool <= 0) {
      const cx = this.x + this.width / 2;
      const cy = this.y + this.height / 2;
      const px = player.x + player.width / 2;
      const py = player.y + player.height / 2;
      const ang = Math.atan2(py - cy, px - cx);
      const speed = 8;
      
      this._spawnProjectile(projectiles, {
        x: cx - 8, y: cy - 8,
        vx: Math.cos(ang) * speed,
        vy: Math.sin(ang) * speed,
        type: this.projectileType,
        kind: "hook",
        width: 24, height: 24
      });
      
      s.cool = 100;
    } else {
      s.cool--;
    }
  },

  // Admiral Vex: anchor + mines
  anchor_stun_mines({ player, projectiles }) {
    // Anchor attack
    if (this._t % 120 === 10) {
      const cx = this.x + this.width / 2;
      const cy = this.y + this.height / 2;
      const px = player.x + player.width / 2;
      const py = player.y + player.height / 2;
      const ang = Math.atan2(py - cy, px - cx);
      
      this._spawnProjectile(projectiles, {
        x: cx, y: cy,
        vx: Math.cos(ang) * 6,
        vy: Math.sin(ang) * 6,
        type: this.projectileType,
        kind: "stun_anchor",
        stunTime: 30,
        width: 40, height: 40
      });
    }
    
    // Drift mines
    if (this._t % 80 === 0) {
      this._spawnProjectile(projectiles, {
        x: this.x + Math.random() * this.width,
        y: this.y + this.height + 10,
        vx: (Math.random() * 2 - 1) * 1.0,
        vy: 1.0 + Math.random() * 0.5,
        type: "mine.png",
        kind: "drift_mine",
        width: 26, height: 26
      });
    }
  },

  // Dr. Slime: spawn slugs
  spawns_slugs({ player, projectiles }) {
    const ratio = this.health / this.maxHealth;
    const s = this.state;
    
    if (s.lastHealthGate - ratio >= 0.25) {
      s.lastHealthGate = ratio;
      
      // Spawn 2-3 slugs
      const count = 2 + Math.floor(Math.random() * 2);
      for (let i = 0; i < count; i++) {
        this._spawnProjectile(projectiles, {
          x: this.x + Math.random() * this.width,
          y: this.y + this.height - 8,
          vx: (Math.random() * 2 - 1) * 1.2,
          vy: 1.5 + Math.random(),
          type: this.projectileType,
          kind: "spawned_slug",
          ttl: 300,
          width: 20, height: 16
        });
      }
    }
    
    // Regular aimed shots
    if (this._t % 90 === 0) {
      this._aimAtPlayer(player, projectiles, 6);
    }
  },

  // Major DD Nukes: warheads + retreat
  warhead_rings_flee({ player, projectiles, canvas, bottomBarHeight }) {
    // Slow warhead
    if (this._t % 140 === 15) {
      const cx = this.x + this.width / 2;
      const cy = this.y + this.height / 2;
      const px = player.x + player.width / 2;
      const py = player.y + player.height / 2;
      const ang = Math.atan2(py - cy, px - cx);
      
      this._spawnProjectile(projectiles, {
        x: cx, y: cy,
        vx: Math.cos(ang) * 2.0,
        vy: Math.sin(ang) * 2.0,
        type: this.projectileType,
        kind: "slow_warhead",
        onDetonate: "shock_rings_3",
        width: 34, height: 34
      });
    }
    
    // Shock rings
    if (this._t % 100 === 0) {
      const cx = this.x + this.width / 2;
      const cy = this.y + this.height - 6;
      this._spawnProjectile(projectiles, {
        x: cx, y: cy,
        kind: "shock_ring",
        radius: 6, dr: 5, maxRadius: 240, ttl: 45,
        type: "shockwave.png",
        vx: 0, vy: 0,
        width: 24, height: 24
      });
    }
    
    // Flee when low health
    if (this.health / this.maxHealth <= 0.25) {
      // stronger flee when low
      const cx = this.x + this.width / 2, cy = this.y + this.height / 2;
      const px = player.x + player.width / 2, py = player.y + player.height / 2;
      const dx = px - cx, dy = py - cy; const d = Math.max(1, Math.hypot(dx, dy));
      this.x -= (dx / d) * (this.speed * 1.8);
      this.y -= (dy / d) * (this.speed * 1.5);
    } else {
      // otherwise keep a mid-range distance
      this._maintainDistance(player, canvas, bottomBarHeight, { min: 260, max: 420, strafeSpeed: 2.5 });
    }
  },

  // Colonel Kurtz: phase attacks
  phase_swap({ player, projectiles }) {
    const s = this.state;
    
    if (!s.init) {
      s.init = true;
      s.phase = 0;
      s.timer = 0;
    }
    
    s.timer++;
    
    if (s.phase === 0) { // Multi-shot phase
      this._maintainDistance(player, canvas, bottomBarHeight, { min: 280, max: 460, strafeSpeed: 2.8 });
      if (this._t % 25 === 0) {
        const cx = this.x + this.width / 2;
        const cy = this.y + this.height / 2;
        const px = player.x + player.width / 2;
        const py = player.y + player.height / 2;
        const ang = Math.atan2(py - cy, px - cx);
        
        // Triple shot
        for (let i = -1; i <= 1; i++) {
          const a = ang + i * 0.15;
          this._spawnProjectile(projectiles, {
            x: cx, y: cy,
            vx: Math.cos(a) * 6,
            vy: Math.sin(a) * 6,
            type: this.projectileType,
            kind: "skull",
            width: 28, height: 28
          });
        }
      }
      
      if (s.timer > 200) { 
        s.phase = 1; 
        s.timer = 0; 
      }
    } else if (s.phase === 1) { // Sweep phase
      this._maintainDistance(player, canvas, bottomBarHeight, { min: 240, max: 420, strafeSpeed: 3.0 });
      if (this._t % 40 === 0) {
        const lanes = 3 + Math.floor(Math.random() * 2);
        for (let i = 0; i < lanes; i++) {
          this._spawnProjectile(projectiles, {
            x: 0, y: 70 + i * 80 + (Math.random() * 30 - 15),
            vx: 7, vy: 0,
            type: "flame_line.png",
            kind: "sweep",
            width: 64, height: 20
          });
        }
      }
      
      if (s.timer > 160) { 
        s.phase = 2; 
        s.timer = 0; 
      }
    } else if (s.phase === 2) { // Final phase
      this._maintainDistance(player, canvas, bottomBarHeight, { min: 220, max: 400, strafeSpeed: 3.2 });
      if (this._t % 50 === 0) {
        this._aimAtPlayer(player, projectiles, 8);
      }
      
      if (s.timer > 120) {
        s.phase = 0;
        s.timer = 0;
      }
    }
  },
};

/** -------- BOSS DEFINITIONS MATCHING NARRATIVE_AUTO.JSON -------- */
export const bossDefinitions = [
  {
    name: "Mallet Melissa.",
    quote: "I can teach you how to use this.",
    image: "melissa.png",
    backdrop: "sector_alpha.png",
    projectileType: "mace.png",
    width: 160, height: 200,
    maxHealth: 50, speed: 2.0,
    attackPattern: "slam",
    intelDrop: "99FZ3 Catalyst Chip",
    sector: "Alpha: Quarantine Canopy",
    sectorCode: "?"
  },
  {
    name: "TNTina.",
    quote: "Light the fuse, baby!",
    image: "tntina.png",
    backdrop: "sector_beta.png",
    projectileType: "tnt.png",
    width: 160, height: 200,
    maxHealth: 60, speed: 2.1,
    attackPattern: "timed_bombs",
    intelDrop: "Stabilizer Module",
    sector: "Beta: Flesh Mills",
    sectorCode: "?"
  },
  {
    name: "Katana Joe.",
    quote: "Ready to slice!",
    image: "katana.png",
    backdrop: "sector_gamma.png",
    projectileType: "katana2.png",
    width: 150, height: 220,
    maxHealth: 70, speed: 2.5,
    attackPattern: "dash_slash",
    intelDrop: "Cold-Iron Darts Blueprint (on reaching streak).",
    sector: "Gamma: Silt Delta",
    sectorCode: "?"
  },
  {
    name: "Chainsaw Carla.",
    quote: "Let's cut to the chase!",
    image: "chainsaw_carla.png",
    backdrop: "sector_delta.png",
    projectileType: "chainsaw.png",
    width: 170, height: 210,
    maxHealth: 80, speed: 2.0,
    attackPattern: "slow_push_bleed",
    intelDrop: "Uplink Auth Rod (flavor).",
    sector: "Delta: Bone Yard",
    sectorCode: "?"
  },
  {
    name: "General Slaughter.",
    quote: "Your rank means nothing.",
    image: "slaughter.png",
    backdrop: "sector_epsilon.png",
    projectileType: "pigfeet.png",
    width: 180, height: 220,
    maxHealth: 90, speed: 2.1,
    attackPattern: "lob_shield",
    intelDrop: "Redline Uplink Codes",
    sector: "Epsilon: Redline",
    sectorCode: "?"
  },
  {
    name: "Lord Humungus.",
    quote: "Bow before chaos!",
    image: "humungus.png",
    backdrop: "sector_gamma_x.png",
    projectileType: "chain.png",
    width: 175, height: 215,
    maxHealth: 95, speed: 2.2,
    attackPattern: "hook_pull",
    intelDrop: "Ichor-X Sample Vial (flavor).",
    sector: "Revisit",
    sectorCode: "R"
  },
  {
    name: "Ghost of Admiral Vex.",
    quote: "All hands... to hell!",
    image: "admiral_vex.png",
    backdrop: "estuary_night.png",
    projectileType: "anchor.png",
    width: 180, height: 220,
    maxHealth: 100, speed: 2.0,
    attackPattern: "anchor_stun_mines",
    intelDrop: "Black-Box Fragment (flavor).",
    sector: "Estuary Night",
    sectorCode: "E"
  },
  {
    name: "Dr. Slime.",
    quote: "You're overdue for your final procedure.",
    image: "drslime.png",
    backdrop: "sector_alpha_lab.png",
    projectileType: "slug.png",
    width: 170, height: 210,
    maxHealth: 105, speed: 2.1,
    attackPattern: "spawns_slugs",
    intelDrop: "Truth File",
    sector: "Alpha Labs (Return)",
    sectorCode: "L"
  },
  {
    name: "DD Nukes.",
    quote: "Ugh!",
    image: "nukes.png",
    backdrop: "redline_bunker.png",
    projectileType: "warhead.png",
    width: 185, height: 225,
    maxHealth: 110, speed: 2.0,
    attackPattern: "warhead_rings_flee",
    intelDrop: null,
    sector: "Alpha Labs (Return)", // Same sector as Dr. Slime per narrative
    sectorCode: "L"
  },
  {
    name: "Kurtz2 return, multi-phase fight.",
    quote: "You're an errand boy.",
    image: "kurtz.png",
    backdrop: "terminal.png",
    projectileType: "flame_skull.png",
    width: 180, height: 240,
    maxHealth: 120, speed: 2.1,
    attackPattern: "phase_swap",
    intelDrop: null,
    sector: "Alpha Labs (Return)", // Same as narrative
    sectorCode: "L"
  },
];

export default Boss;





