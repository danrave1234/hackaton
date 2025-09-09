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
import { createDebugSystem, DebugSystemFunction } from './systems/debug.js';
import { createGameOverSystem } from './systems/gameOver.js';
import { createHealthSystem } from './systems/health.js';
import { ExplosionSystem } from './systems/explosion.js';

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
  if (hudRound) hudRound.textContent = `SECTOR ${round}`;

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

  // Score + SFX + Debug + Game Over + Health systems
  const score = createScoreSystem(hudScore);

  // Enable SFX debugging to trace audio stacking issues (set to true if needed)
  window.DEBUG_SFX = false;
  const sfx = createSfxSystem(canvas);
  const gameOver = createGameOverSystem();
  const health = createHealthSystem();

  // Initialize debug system (development only)
  window.debugSystem = createDebugSystem();

  // Make health system globally available for collision system
  window.healthSystem = health;

  // Run loop in deterministic order
  createLoop([
    PlayerControlSystem,
    SpawnSystem,
    ShootingSystem,
    MovementSystem,
    CollisionSystem,
    ExplosionSystem,
    CleanupSystem,
    RenderSystem,
    score.system,
    sfx.system,
    gameOver.system,
    health.system,
    DebugSystemFunction,
  ], world, bus);
});

document.addEventListener('DOMContentLoaded', () => {
  // Allow disabling this simple demo renderer when ECS is active
  const canvasEl = /** @type {HTMLCanvasElement} */ (document.getElementById('gameCanvas'));
  if (canvasEl && String(canvasEl.dataset?.disableSimple).toLowerCase() === 'true') {
    return;
  }

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
  /** @type {{ player?: { cols:number, rows:number, index:number, frame?: {x:number,y:number,w:number,h:number}, anim?: { indices:number[], fps:number }, _t?: number }, bullet?: { cols:number, rows:number, index:number, frame?: {x:number,y:number,w:number,h:number} } }} */
  const spriteMeta = {};

  function loadSpriteFromDataset(key, datasetKey) {
    let src = canvas?.dataset?.[datasetKey];
    if (!src) return undefined;
    // Support aliases:
    // - @asset/... -> asset/...
    // - @filename -> asset/spritesheet/filename
    if (src.startsWith('@asset/')) src = src.replace(/^@asset\//, 'asset/');
    else if (src.startsWith('@')) src = 'asset/spritesheet/' + src.slice(1);
    // Resolve relative to page folder if needed
    if (src.startsWith('asset/')) {
      const inPages = /\/pages\//.test(location.pathname);
      if (inPages) src = '../' + src;
    }
    const img = new Image();
    img.src = src;
    return img;
  }

  spriteImages.player = loadSpriteFromDataset('player', 'playerSprite');
  spriteImages.enemy = loadSpriteFromDataset('enemy', 'enemySprite');
  spriteImages.bullet = loadSpriteFromDataset('bullet', 'bulletSprite');

  // Optional spritesheet metadata via dataset
  // data-player-sprite-grid="CxR" (e.g., 3x3), data-player-sprite-index="i" (0-based)
  // or data-player-sprite-frame="x,y,w,h" to specify a manual source rect
  (function parsePlayerSheetMeta() {
    const grid = canvas?.dataset?.playerSpriteGrid || '';
    const indexStr = canvas?.dataset?.playerSpriteIndex || '';
    const frameStr = canvas?.dataset?.playerSpriteFrame || '';
    if (frameStr) {
      const parts = frameStr.split(',').map((n) => parseInt(n.trim(), 10));
      if (parts.length === 4 && parts.every((n) => Number.isFinite(n))) {
        spriteMeta.player = { cols: 1, rows: 1, index: 0, frame: { x: parts[0], y: parts[1], w: parts[2], h: parts[3] } };
        return;
      }
    }
    const m = /^\s*(\d+)x(\d+)\s*$/i.exec(grid || '');
    if (m) {
      const cols = parseInt(m[1], 10) || 1;
      const rows = parseInt(m[2], 10) || 1;
      const index = Math.max(0, parseInt(indexStr || '0', 10) || 0);
      const animStr = canvas?.dataset?.playerSpriteAnim || '';
      const fpsStr = canvas?.dataset?.playerAnimFps || '';
      const anim = animStr
        ? { indices: animStr.split(',').map((s) => parseInt(s.trim(), 10)).filter((n) => Number.isFinite(n)), fps: Math.max(1, parseInt(fpsStr || '8', 10) || 8) }
        : undefined;
      spriteMeta.player = { cols, rows, index, anim, _t: 0 };
    }
  })();

  // Bullet spritesheet/frame support
  (function parseBulletSheetMeta() {
    const frameStr = canvas?.dataset?.bulletSpriteFrame || '';
    const percentStr = canvas?.dataset?.bulletSpritePercent || '';
    if (frameStr) {
      const parts = frameStr.split(',').map((n) => parseInt(n.trim(), 10));
      if (parts.length === 4 && parts.every((n) => Number.isFinite(n))) {
        spriteMeta.bullet = { cols: 1, rows: 1, index: 0, frame: { x: parts[0], y: parts[1], w: parts[2], h: parts[3] } };
        return;
      }
    }
    if (percentStr) {
      const p = percentStr.split(',').map((v) => parseFloat(v.trim()));
      if (p.length === 4 && p.every((n) => Number.isFinite(n))) {
        // store normalized; will convert at draw time using image natural size
        spriteMeta.bullet = { cols: 0, rows: 0, index: 0, frame: { x: p[0], y: p[1], w: p[2], h: p[3] } };
        (spriteMeta.bullet).percent = true;
        return;
      }
    }
    const grid = canvas?.dataset?.bulletSpriteGrid || '';
    const indexStr = canvas?.dataset?.bulletSpriteIndex || '';
    const m = /^\s*(\d+)x(\d+)\s*$/i.exec(grid || '');
    if (m) {
      const cols = parseInt(m[1], 10) || 1;
      const rows = parseInt(m[2], 10) || 1;
      const index = Math.max(0, parseInt(indexStr || '0', 10) || 0);
      spriteMeta.bullet = { cols, rows, index };
    }
  })();

  // Sound effects - removed duplicate audio system

  // Import explosion functions for simple renderer
  let gameExplosionModule = null;
  import('./systems/explosion.js').then(module => {
    gameExplosionModule = module;
    window.gameExplosionModule = module;
  });
  
  /** @type {{x:number,y:number,size:number,anim:{currentFrame:number,timeAccumulator:number,totalFrames:number,fps:number,finished:boolean}}[]} */
  const explosions = [];
  function spawnExplosion(x, y, baseColor = '#fca5a5') {
    // Create sprite-based explosion for simple renderer
    explosions.push({
      x,
      y,
      size: 80, // Proportional size
      anim: {
        currentFrame: 0,
        timeAccumulator: 0,
        totalFrames: 64, // 8x8 grid (64 frames)
        fps: 20, // Even faster animation to reduce delay
        finished: false
      },
      color: baseColor
    });
  }

  // Update labels
  if (roundLabel) roundLabel.textContent = String(round);
  if (hudRound) hudRound.textContent = `SECTOR ${round}`;

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
    width: 96,
    height: 48,
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
        // Audio will be handled by the main ECS SFX system
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

    // Update explosions
    for (let i = explosions.length - 1; i >= 0; i--) {
      const exp = explosions[i];
      const anim = exp.anim;
      
      anim.timeAccumulator += dt;
      const frameTime = 1 / anim.fps;
      
      if (anim.timeAccumulator >= frameTime) {
        anim.timeAccumulator -= frameTime;
        anim.currentFrame++;
        
        if (anim.currentFrame >= anim.totalFrames) {
          anim.finished = true;
          explosions.splice(i, 1);
        }
      }
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

  // Sector background cache for simple renderer
  let sectorBackgroundCache = new Map();
  
  function ensureSectorBackground(sector) {
    if (sectorBackgroundCache.has(sector)) {
      return sectorBackgroundCache.get(sector);
    }
    
    const sectorNames = {
      1: 'sun', 2: 'earth', 3: 'moon', 4: 'mars', 5: 'jupiter',
      6: 'saturn', 7: 'uranus', 8: 'neptune', 9: 'galaxy', 10: 'blackhole'
    };
    
    const sectorName = sectorNames[sector] || 'sun';
    const filename = `${sector}_sector_${sectorName}.png`;
    let src = `asset/background/${filename}`;
    
    // Handle relative path for pages folder
    if (/\/pages\//.test(location.pathname)) {
      src = '../' + src;
    }
    
    const img = new Image();
    img.src = src;
    
    const backgroundData = { img, src, sector };
    sectorBackgroundCache.set(sector, backgroundData);
    return backgroundData;
  }

  function drawBackground(ctx, t) {
    // Get sector background
    const sectorBg = ensureSectorBackground(round);
    
      if (sectorBg && sectorBg.img && sectorBg.img.complete && sectorBg.img.naturalWidth > 0) {
        ctx.save();
        
        // Enable smoothing for better quality
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        
        // Draw background image normally
        ctx.drawImage(sectorBg.img, 0, 0, canvas.width, canvas.height);
        
        // Add darkening overlay for better readability
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)'; // 50% dark overlay
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        ctx.restore();
     } else {
      // Fallback: Parallax starfield
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
      const meta = spriteMeta.player;
      if (meta) {
        let sx = 0, sy = 0, sw = 0, sh = 0;
        // Advance animation
        if (meta.anim && meta.anim.indices && meta.anim.indices.length > 0) {
          meta._t = (meta._t || 0) + (1 / 60);
          const fps = meta.anim.fps || 8;
          const frameIdx = Math.floor(meta._t * fps) % meta.anim.indices.length;
          meta.index = meta.anim.indices[frameIdx];
        }
        if (meta.frame) {
          ({ x: sx, y: sy, w: sw, h: sh } = meta.frame);
        } else {
          const cols = meta.cols || 1;
          const rows = meta.rows || 1;
          const colW = Math.floor(playerImg.naturalWidth / cols);
          const rowH = Math.floor(playerImg.naturalHeight / rows);
          const idx = meta.index || 0;
          const cx = idx % cols;
          const cy = Math.floor(idx / cols) % rows;
          sx = cx * colW;
          sy = cy * rowH;
          sw = colW;
          sh = rowH;
        }
        ctx.drawImage(playerImg, sx, sy, sw, sh, -drawW / 2, -drawH / 2, drawW, drawH);
      } else {
        ctx.drawImage(playerImg, -drawW / 2, -drawH / 2, drawW, drawH);
      }
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
    const bulletMeta = spriteMeta.bullet;
    if (bulletImg && bulletImg.complete && bulletImg.naturalWidth > 0) {
      if (bulletMeta && (bulletMeta.frame || bulletMeta.cols)) {
        bullets.forEach((b) => {
          let sx = 0, sy = 0, sw = bulletImg.naturalWidth, sh = bulletImg.naturalHeight;
          if (bulletMeta.frame) {
            if (bulletMeta.percent) {
              const fx = bulletMeta.frame.x, fy = bulletMeta.frame.y, fw = bulletMeta.frame.w, fh = bulletMeta.frame.h;
              sx = Math.floor(fx * bulletImg.naturalWidth);
              sy = Math.floor(fy * bulletImg.naturalHeight);
              sw = Math.floor(fw * bulletImg.naturalWidth);
              sh = Math.floor(fh * bulletImg.naturalHeight);
            } else {
              ({ x: sx, y: sy, w: sw, h: sh } = bulletMeta.frame);
            }
          } else if (bulletMeta.cols) {
            const cols = bulletMeta.cols || 1;
            const rows = bulletMeta.rows || 1;
            const colW = Math.floor(bulletImg.naturalWidth / cols);
            const rowH = Math.floor(bulletImg.naturalHeight / rows);
            const idx = bulletMeta.index || 0;
            const cx = idx % cols;
            const cy = Math.floor(idx / cols) % rows;
            sx = cx * colW;
            sy = cy * rowH;
            sw = colW;
            sh = rowH;
          }
          ctx.drawImage(bulletImg, sx, sy, sw, sh, b.x, b.y - b.h / 2, b.w, b.h);
        });
      } else {
        bullets.forEach((b) => {
          ctx.drawImage(bulletImg, b.x, b.y - b.h / 2, b.w, b.h);
        });
      }
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

    // Explosions
    explosions.forEach((exp) => {
      const anim = exp.anim;
      if (anim.finished) return;
      
      // Try to use explosion sprite if available
      const explosionSprite = gameExplosionModule?.ensureExplosionSprite?.(canvas);
      
      // Calculate animation progress for effects
      const progress = anim.currentFrame / anim.totalFrames;
      const scale = 1.0 + (progress * 0.3); // Start normal size, grow moderately during animation
      const alpha = Math.max(0, 1 - (progress * 0.6)); // Fade out more naturally
      
      if (explosionSprite && explosionSprite.img && explosionSprite.img.complete && explosionSprite.img.naturalWidth > 0) {
        const img = explosionSprite.img;
        const cols = explosionSprite.cols || 8;
        const rows = explosionSprite.rows || 8;
        
        // Calculate source rectangle for current frame
        const frameIndex = Math.min(anim.currentFrame, (cols * rows) - 1);
        
        const colW = Math.floor(img.naturalWidth / cols);
        const rowH = Math.floor(img.naturalHeight / rows);
        
        const cx = frameIndex % cols;
        const cy = Math.floor(frameIndex / cols) % rows;
        
        const sx = cx * colW;
        const sy = cy * rowH;
        
        ctx.save();
        
        // Enable image smoothing for better quality
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        
        // Apply additive blending for bright explosion effect
        ctx.globalCompositeOperation = 'screen';
        ctx.globalAlpha = alpha;
        
        // Calculate scaled size
        const size = exp.size || 80;
        const scaledSize = size * scale;
        
        // Draw main explosion sprite
        ctx.drawImage(img, sx, sy, colW, rowH, exp.x - scaledSize / 2, exp.y - scaledSize / 2, scaledSize, scaledSize);
        
        // Add a glowing outer layer for extra effect
        if (progress < 0.8) {
          ctx.globalAlpha = alpha * 0.3;
          const glowSize = scaledSize * 1.5;
          ctx.drawImage(img, sx, sy, colW, rowH, exp.x - glowSize / 2, exp.y - glowSize / 2, glowSize, glowSize);
        }
        
        ctx.restore();
        
      } else {
        // Enhanced fallback: multi-layer animated explosion
        ctx.save();
        
        const size = exp.size || 80;
        
        // Outer glow layer
        const outerRadius = (size / 2) * scale * 1.5;
        const outerGradient = ctx.createRadialGradient(exp.x, exp.y, 0, exp.x, exp.y, outerRadius);
        outerGradient.addColorStop(0, `rgba(255, 140, 0, ${alpha * 0.4})`);
        outerGradient.addColorStop(0.5, `rgba(255, 69, 0, ${alpha * 0.2})`);
        outerGradient.addColorStop(1, 'rgba(255, 69, 0, 0)');
        
        ctx.fillStyle = outerGradient;
        ctx.beginPath();
        ctx.arc(exp.x, exp.y, outerRadius, 0, Math.PI * 2);
        ctx.fill();
        
        // Main explosion layer
        const mainRadius = (size / 2) * scale;
        const mainGradient = ctx.createRadialGradient(exp.x, exp.y, 0, exp.x, exp.y, mainRadius);
        mainGradient.addColorStop(0, `rgba(255, 255, 255, ${alpha * 0.9})`);
        mainGradient.addColorStop(0.3, `rgba(255, 140, 0, ${alpha * 0.8})`);
        mainGradient.addColorStop(0.7, `rgba(255, 69, 0, ${alpha * 0.6})`);
        mainGradient.addColorStop(1, `rgba(139, 0, 0, ${alpha * 0.2})`);
        
        ctx.fillStyle = mainGradient;
        ctx.beginPath();
        ctx.arc(exp.x, exp.y, mainRadius, 0, Math.PI * 2);
        ctx.fill();
        
        // Inner bright core
        const coreRadius = (size / 2) * scale * 0.4;
        const coreGradient = ctx.createRadialGradient(exp.x, exp.y, 0, exp.x, exp.y, coreRadius);
        coreGradient.addColorStop(0, `rgba(255, 255, 255, ${alpha})`);
        coreGradient.addColorStop(0.5, `rgba(255, 255, 200, ${alpha * 0.8})`);
        coreGradient.addColorStop(1, `rgba(255, 140, 0, ${alpha * 0.4})`);
        
        ctx.fillStyle = coreGradient;
        ctx.beginPath();
        ctx.arc(exp.x, exp.y, coreRadius, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.restore();
      }
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


