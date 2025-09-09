import { createLoop } from './engine/loop.js';
import { createEventBus } from './engine/events.js';
import { createWorld, addEntity } from './world/world.js';
import { createPlayer } from './entities/factory.js';
import { RenderSystem } from './systems/render.js';
import { MovementSystem } from './systems/movement.js';
import { PlayerControlSystem, attachInputListeners } from './systems/playerControl.js';
import { ShootingSystem } from './systems/shooting.js';
import { CollisionSystem } from './systems/collision.js';
import { CleanupSystem } from './systems/cleanup.js';
import { SpawnSystem } from './systems/spawn.js';
import { createScoreSystem } from './systems/score.js';
import { createSfxSystem } from './systems/sfx.js';

document.addEventListener('DOMContentLoaded', () => {
  const $ = (sel) => document.querySelector(sel);

  // Read round from query param, default 1
  const params = new URLSearchParams(window.location.search);
  const round = Math.max(1, parseInt(params.get('round') || '1', 10) || 1);

  const banner = $('#roundBanner');
  const roundLabel = $('#roundLabel');
  const hudRound = $('#hudRound');
  const hudScore = $('#hudScore');
  const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('gameCanvas'));
  const ctx = canvas.getContext('2d');

  // Optional sprite dataset is still supported by RenderSystem fallback (kept simple here)

  if (roundLabel) roundLabel.textContent = String(round);
  if (hudRound) hudRound.textContent = `R${round}`;

  if (banner) {
    banner.classList.add('round-banner--in');
    setTimeout(() => {
      banner.classList.remove('round-banner--in');
      banner.classList.add('round-banner--out');
      setTimeout(() => banner.remove(), 800);
    }, 1400);
  }

  function fitCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  window.addEventListener('resize', fitCanvas);
  fitCanvas();

  // Create world and systems
  const world = createWorld(ctx, canvas);
  const bus = createEventBus();

  // Input
  attachInputListeners();
  window.PlayerKeys = PlayerControlSystem.keys;

  // Entities
  addEntity(world, createPlayer(120, canvas.height / 2));

  // Score + SFX systems
  const score = createScoreSystem(hudScore);
  const sfx = createSfxSystem(canvas);

  // Run loop in deterministic order
  createLoop([
    PlayerControlSystem,
    SpawnSystem,
    ShootingSystem,
    MovementSystem,
    CollisionSystem,
    CleanupSystem,
    RenderSystem,
    score.system,
    sfx.system,
  ], world, bus);
});

document.addEventListener('DOMContentLoaded', () => {
  const $ = (sel) => document.querySelector(sel);

  // Read round from query param, default 1
  const params = new URLSearchParams(window.location.search);
  const round = Math.max(1, parseInt(params.get('round') || '1', 10) || 1);

  const banner = $('#roundBanner');
  const roundLabel = $('#roundLabel');
  const hudRound = $('#hudRound');
  const hudScore = $('#hudScore');
  const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('gameCanvas'));
  const ctx = canvas.getContext('2d');

  // Optional sprite assets (read from canvas data-* attributes)
  /** @type {{ player?: HTMLImageElement, enemy?: HTMLImageElement, bullet?: HTMLImageElement }} */
  const spriteImages = {};

  function loadSpriteFromDataset(key, datasetKey) {
    const src = canvas?.dataset?.[datasetKey];
    if (!src) return undefined;
    const img = new Image();
    img.src = src;
    return img;
  }

  spriteImages.player = loadSpriteFromDataset('player', 'playerSprite');
  spriteImages.enemy = loadSpriteFromDataset('enemy', 'enemySprite');
  spriteImages.bullet = loadSpriteFromDataset('bullet', 'bulletSprite');

  // Sound effects
  const laserSfxSrcRaw = canvas?.dataset?.laserSfx || '@asset/sfx/laser_shoot.mp3';
  const laserSfxSrc = laserSfxSrcRaw.replace(/^@asset\//, 'asset/');
  const laserPool = Array.from({ length: 6 }, () => {
    const a = new Audio(laserSfxSrc);
    a.volume = 0.35;
    return a;
  });
  let nextLaserIdx = 0;
  function playLaser() {
    const a = laserPool[nextLaserIdx];
    nextLaserIdx = (nextLaserIdx + 1) % laserPool.length;
    try {
      a.currentTime = 0;
      const p = a.play();
      if (p && typeof p.then === 'function') p.catch(() => {});
    } catch {}
  }

  const explosionSfxSrcRaw = canvas?.dataset?.explosionSfx || '@asset/sfx/explosion.mp3';
  const explosionSfxSrc = explosionSfxSrcRaw.replace(/^@asset\//, 'asset/');
  const explosionPool = Array.from({ length: 5 }, () => {
    const a = new Audio(explosionSfxSrc);
    a.volume = 0.5;
    return a;
  });
  let nextExplosionIdx = 0;
  function playExplosionSfx() {
    const a = explosionPool[nextExplosionIdx];
    nextExplosionIdx = (nextExplosionIdx + 1) % explosionPool.length;
    try {
      a.currentTime = 0;
      const p = a.play();
      if (p && typeof p.then === 'function') p.catch(() => {});
    } catch {}
  }

  /** @type {{x:number,y:number,vx:number,vy:number,life:number,color:string}[]} */
  const particles = [];
  function spawnExplosion(x, y, baseColor = '#fca5a5') {
    playExplosionSfx();
    const count = 12 + (Math.random() * 6 | 0);
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2) * Math.random();
      const speed = 80 + Math.random() * 180;
      particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.5 + Math.random() * 0.4,
        color: baseColor,
      });
    }
  }

  // Update labels
  if (roundLabel) roundLabel.textContent = String(round);
  if (hudRound) hudRound.textContent = `R${round}`;

  // Trigger round banner animation
  if (banner) {
    banner.classList.add('round-banner--in');
    setTimeout(() => {
      banner.classList.remove('round-banner--in');
      banner.classList.add('round-banner--out');
      setTimeout(() => {
        banner.remove();
      }, 800);
    }, 1400);
  }

  // Resize canvas to fill screen while preserving aspect
  function fitCanvas() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    canvas.width = w;
    canvas.height = h;
  }
  window.addEventListener('resize', fitCanvas);
  fitCanvas();

  // Basic top-down horizontal shooter scaffold using simple shapes
  const player = {
    x: 120,
    y: canvas.height / 2,
    width: 36,
    height: 18,
    speed: 260,
    color: '#a7f3d0',
  };

  const keys = new Set();
  window.addEventListener('keydown', (e) => keys.add(e.key.toLowerCase()));
  window.addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));

  /** @type {{x:number,y:number, vx:number, vy:number, r:number, color:string}[]} */
  const enemies = [];
  /** @type {{x:number,y:number, vx:number, wy:number, w:number, h:number}[]} */
  const bullets = [];
  let score = 0;

  function spawnEnemy() {
    const y = 80 + Math.random() * (canvas.height - 160);
    const r = 10 + Math.random() * 14;
    enemies.push({
      x: canvas.width + r + 20,
      y,
      vx: -(100 + Math.random() * 100),
      vy: Math.sin(Date.now() * 0.002) * 20,
      r,
      color: '#fca5a5',
    });
  }

  let lastSpawn = 0;
  function update(dt) {
    // Player movement (WASD / arrows)
    const up = keys.has('w') || keys.has('arrowup');
    const down = keys.has('s') || keys.has('arrowdown');
    const left = keys.has('a') || keys.has('arrowleft');
    const right = keys.has('d') || keys.has('arrowright');

    if (up) player.y -= player.speed * dt;
    if (down) player.y += player.speed * dt;
    if (left) player.x -= player.speed * dt;
    if (right) player.x += player.speed * dt;

    // Clamp to screen
    player.x = Math.max(20, Math.min(canvas.width - 20, player.x));
    player.y = Math.max(20, Math.min(canvas.height - 20, player.y));

    // Shoot
    if (keys.has(' ') || keys.has('enter')) {
      // simple rate limit via modulo of time
      if ((performance.now() | 0) % 120 < 8) {
        bullets.push({ x: player.x + player.width, y: player.y, vx: 520, wy: 0, w: 14, h: 4 });
        playLaser();
      }
    }

    // Update bullets
    for (let i = bullets.length - 1; i >= 0; i--) {
      const b = bullets[i];
      b.x += b.vx * dt;
      if (b.x > canvas.width + 40) bullets.splice(i, 1);
    }

    // Spawn enemies
    lastSpawn += dt;
    const spawnEvery = 0.9;
    if (lastSpawn > spawnEvery) {
      lastSpawn = 0;
      spawnEnemy();
    }

    // Update enemies
    for (let i = enemies.length - 1; i >= 0; i--) {
      const e = enemies[i];
      e.x += e.vx * dt;
      e.y += Math.sin(performance.now() * 0.003 + i) * 0.5; // subtle drift
      if (e.x < -50) enemies.splice(i, 1);
    }

    // Update particles
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.98;
      p.vy *= 0.98;
      p.life -= dt;
      if (p.life <= 0) particles.splice(i, 1);
    }

    // Collisions
    for (let i = enemies.length - 1; i >= 0; i--) {
      const e = enemies[i];
      for (let j = bullets.length - 1; j >= 0; j--) {
        const b = bullets[j];
        if (b.x < e.x + e.r && b.x + b.w > e.x - e.r && b.y < e.y + e.r && b.y + b.h > e.y - e.r) {
          const hit = enemies.splice(i, 1)[0];
          bullets.splice(j, 1);
          score += 100;
          if (hit) spawnExplosion(hit.x, hit.y, hit.color);
          break;
        }
      }
    }

    if (hudScore) hudScore.textContent = `Score ${String(score).padStart(6, '0')}`;
  }

  function drawBackground(ctx, t) {
    // Parallax starfield
    ctx.fillStyle = '#0b1220';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const layers = [
      { color: 'rgba(255,255,255,0.4)', speed: 50, size: 2 },
      { color: 'rgba(186,230,253,0.35)', speed: 90, size: 2.5 },
      { color: 'rgba(103,232,249,0.30)', speed: 140, size: 3 },
    ];
    layers.forEach((layer, idx) => {
      ctx.fillStyle = layer.color;
      for (let i = 0; i < 80; i++) {
        const x = ((i * 120 + (t * layer.speed)) % (canvas.width + 200)) - 100;
        const y = (i * 53 + idx * 37) % canvas.height;
        ctx.fillRect(canvas.width - x, y, layer.size, layer.size);
      }
    });
  }

  function render() {
    drawBackground(ctx, performance.now() / 1000);

    // Player
    const playerImg = spriteImages.player;
    if (playerImg && playerImg.complete && playerImg.naturalWidth > 0) {
      ctx.save();
      ctx.translate(player.x, player.y);
      // Draw centered, scaled to logical size
      const drawW = player.width;
      const drawH = player.height;
      ctx.drawImage(playerImg, -drawW / 2, -drawH / 2, drawW, drawH);
      ctx.restore();
    } else {
      // Fallback (triangle-like ship)
      ctx.save();
      ctx.translate(player.x, player.y);
      ctx.fillStyle = player.color;
      ctx.beginPath();
      ctx.moveTo(18, 0);
      ctx.lineTo(-18, -10);
      ctx.lineTo(-18, 10);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // Bullets
    const bulletImg = spriteImages.bullet;
    if (bulletImg && bulletImg.complete && bulletImg.naturalWidth > 0) {
      bullets.forEach((b) => {
        ctx.drawImage(bulletImg, b.x, b.y - b.h / 2, b.w, b.h);
      });
    } else {
      ctx.fillStyle = '#93c5fd';
      bullets.forEach((b) => {
        ctx.fillRect(b.x, b.y - b.h / 2, b.w, b.h);
      });
    }

    // Enemies
    const enemyImg = spriteImages.enemy;
    if (enemyImg && enemyImg.complete && enemyImg.naturalWidth > 0) {
      enemies.forEach((e) => {
        const size = e.r * 2;
        ctx.drawImage(enemyImg, e.x - size / 2, e.y - size / 2, size, size);
      });
    } else {
      enemies.forEach((e) => {
        ctx.fillStyle = e.color;
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    // Particles (explosions)
    particles.forEach((p) => {
      const alpha = Math.max(0, Math.min(1, p.life / 0.5));
      ctx.fillStyle = `rgba(252,165,165,${alpha})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  let last = performance.now();
  function loop(now) {
    const dt = Math.min(0.033, (now - last) / 1000);
    last = now;
    update(dt);
    render();
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
});


