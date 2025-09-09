// Internal cache for spritesheet and meta
let playerSpriteCache = null;
let bulletSpriteCache = null;
let sectorBackgroundCache = new Map(); // Cache for sector backgrounds (keyed by src)
let enemySpriteCache = new Map(); // Cache for enemy sprites by resolved src

// Import explosion rendering
import { renderExplosions } from './explosion.js';

function resolveSpriteSrc(raw) {
  if (!raw) return undefined;
  let out = raw;
  if (out.startsWith('@asset/')) out = out.replace(/^@asset\//, 'asset/');
  else if (out.startsWith('@')) {
    // Support friendly aliases
    const lower = out.toLowerCase();
    if (lower === '@basic_enemy.png') {
      return 'asset/spritesheet/Basic enemy.png';
    }
    out = 'asset/spritesheet/' + out.slice(1);
  }
  // If path starts with asset/ and page is served from /pages/, prefix ../
  if (out.startsWith('asset/')) {
    const inPages = /\/pages\//.test(location.pathname);
    if (inPages) out = '../' + out;
  }
  return out;
}

function ensureEnemySprite(spriteRef) {
  const src = resolveSpriteSrc(spriteRef);
  if (!src) return null;
  if (enemySpriteCache.has(src)) return enemySpriteCache.get(src);
  const img = new Image();
  img.src = src;
  const data = { img, src };
  enemySpriteCache.set(src, data);
  return data;
}

function ensurePlayerSprite(canvas) {
  if (playerSpriteCache && playerSpriteCache.img) return playerSpriteCache;
  const src = resolveSpriteSrc(canvas?.dataset?.playerSprite);
  if (!src) return null;
  const img = new Image();
  img.src = src;
  const gridStr = canvas?.dataset?.playerSpriteGrid || '';
  const animStr = canvas?.dataset?.playerSpriteAnim || '';
  const fpsStr = canvas?.dataset?.playerAnimFps || '10';
  const m = /^(\d+)x(\d+)$/i.exec(gridStr.trim());
  const cols = m ? parseInt(m[1], 10) : 1;
  const rows = m ? parseInt(m[2], 10) : 1;
  const anim = animStr
    ? animStr.split(',').map((s) => parseInt(s.trim(), 10)).filter((n) => Number.isFinite(n))
    : [];
  const fps = Math.max(1, parseInt(fpsStr, 10) || 10);
  playerSpriteCache = { img, cols, rows, anim, fps, t: 0, idx: 0 };
  return playerSpriteCache;
}

function ensureBulletSprite(canvas) {
  const src = resolveSpriteSrc(canvas?.dataset?.bulletSprite);
  if (!src) return null;

  // Force refresh if cache exists but source changed
  if (bulletSpriteCache && bulletSpriteCache.src !== src) {
    bulletSpriteCache = null;
  }

  if (bulletSpriteCache && bulletSpriteCache.img) return bulletSpriteCache;

  const img = new Image();
  img.src = src;
  // Simple PNG - no sprite animation, just a single image
  bulletSpriteCache = { img, src };
  return bulletSpriteCache;
}

function ensureSectorBackground(sector) {
  if (sectorBackgroundCache.has(sector)) {
    return sectorBackgroundCache.get(sector);
  }
  
  // Create background image path based on sector number
  const filename = `${sector}_sector_${getSectorName(sector)}.png`;
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

function getSectorName(sector) {
  const sectorNames = {
    1: 'sun',
    2: 'earth', 
    3: 'moon',
    4: 'mars',
    5: 'jupiter',
    6: 'saturn',
    7: 'uranus',
    8: 'neptune',
    9: 'galaxy',
    10: 'blackhole'
  };
  return sectorNames[sector] || 'sun';
}

function renderEnemy(ctx, enemy, time) {
  ctx.save();
  ctx.translate(enemy.pos.x, enemy.pos.y);
  
  // Debug: Log enemy types occasionally
  if (Math.random() < 0.01) {
    console.log(`[RENDER] Enemy type: ${enemy.type}, tags:`, enemy.tags);
  }
  
  // Render based on enemy type
  switch (enemy.type) {
    case 'hunter-seeker':
      renderHunterSeeker(ctx, enemy, time);
      break;
    case 'geo-lancer':
      renderGeoLancer(ctx, enemy, time);
      break;
    case 'fabricator':
      renderFabricator(ctx, enemy, time);
      break;
    case 'asteroid':
      renderAsteroid(ctx, enemy, time);
      break;
    case 'minion':
      renderMinion(ctx, enemy, time);
      break;
    case 'boss-bio-mechanical':
      renderBoss(ctx, enemy, time);
      break;
    case 'boss-sentinel-prime':
      renderBoss(ctx, enemy, time);
      break;
    default:
      renderBasicEnemy(ctx, enemy, time);
      break;
  }
  
  // Render common enemy effects (EMP, control, etc.)
  renderEnemyEffects(ctx, enemy, time);
  
  // Player-specific HUD overlays (cooldowns)
  if ((enemy.tags||[]).includes('player')) {
    // Debris heal cooldown indicator above player
    const cd = enemy.debrisHealCooldown || 0;
    const cdMax = enemy._debrisHealCooldownMax || 0;
    if (cdMax > 0) {
      const ratio = Math.max(0, Math.min(1, cd / cdMax));
      ctx.save();
      ctx.translate(0, -enemy.radius - 20);
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(-20, -6, 40, 8);
      ctx.fillStyle = '#4CAF50';
      ctx.fillRect(-20, -6, 40 * (1 - ratio), 8);
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1;
      ctx.strokeRect(-20, -6, 40, 8);
      ctx.restore();
    }
  }

  ctx.restore();
}

function renderBoss(ctx, enemy, time) {
  const sheet = enemy.sprite ? ensureEnemySprite(enemy.sprite) : null;
  const hasImg = sheet && sheet.img && sheet.img.complete && sheet.img.naturalWidth > 0;
  
  if (hasImg) {
    // Render boss sprite at actual size without scaling
    const spriteWidth = sheet.img.naturalWidth;
    const spriteHeight = sheet.img.naturalHeight;
    ctx.drawImage(sheet.img, -spriteWidth/2, -spriteHeight/2, spriteWidth, spriteHeight);
  } else {
    // Fallback rendering for bosses
    ctx.fillStyle = enemy.color;
    ctx.beginPath();
    ctx.arc(0, 0, enemy.radius, 0, Math.PI * 2);
    ctx.fill();
    
    // Boss indicator
    ctx.strokeStyle = '#ffff00';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, enemy.radius + 5, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function renderHunterSeeker(ctx, enemy, time) {
  const behavior = enemy.behavior || {};
  const sheet = enemy.sprite ? ensureEnemySprite(enemy.sprite) : null;
  const hasImg = sheet && sheet.img && sheet.img.complete && sheet.img.naturalWidth > 0;
  
  // Rotate to face the player direction if available
  let angle = 0;
  try {
    const player = Array.from(window.currentWorld?.entities?.values?.() || []).find((e) => (e.tags||[]).includes('player'));
    if (player) {
      angle = Math.atan2(player.pos.y - enemy.pos.y, player.pos.x - enemy.pos.x);
    }
  } catch {}
  ctx.rotate(angle);

  if (hasImg) {
    // Slice frame from spritesheet using grid + optional animation
    const gridStr = enemy.spriteGrid || '1x1';
    const m = /^([0-9]+)x([0-9]+)$/i.exec(gridStr.trim());
    const cols = m ? parseInt(m[1], 10) : 1;
    const rows = m ? parseInt(m[2], 10) : 1;

    if (enemy.spriteAnim) {
      enemy._animT = (enemy._animT || 0) + (1/60);
      const fps = Math.max(1, parseInt(enemy.spriteFps || 8, 10));
      const seq = String(enemy.spriteAnim).split(',').map(s => parseInt(s.trim(), 10)).filter(Number.isFinite);
      if (seq.length > 0) {
        const frame = Math.floor(enemy._animT * fps) % seq.length;
        enemy.spriteIndex = seq[frame];
      }
    }

    const idx = Math.max(0, enemy.spriteIndex || 0);
    const colW = Math.floor(sheet.img.naturalWidth / Math.max(1, cols));
    const rowH = Math.floor(sheet.img.naturalHeight / Math.max(1, rows));
    const cx = cols > 0 ? (idx % cols) : 0;
    const cy = rows > 0 ? Math.floor(idx / cols) % rows : 0;
    const sx = cx * colW;
    const sy = cy * rowH;

    const size = enemy.radius * 2.0;
    ctx.drawImage(sheet.img, sx, sy, colW, rowH, -size/2, -size/2, size, size);
  } else {
    // Arrow-head shaped drone (vector fallback)
    ctx.fillStyle = enemy.color;
    ctx.beginPath();
    ctx.moveTo(enemy.radius, 0); // Point
    ctx.lineTo(-enemy.radius * 0.6, -enemy.radius * 0.4);
    ctx.lineTo(-enemy.radius * 0.3, 0);
    ctx.lineTo(-enemy.radius * 0.6, enemy.radius * 0.4);
    ctx.closePath();
    ctx.fill();

    // Red optical sensor
    ctx.fillStyle = behavior.phase === 'lock-on' ? '#ff0000' : '#ffaa00';
    ctx.beginPath();
    ctx.arc(enemy.radius * 0.7, 0, 3, 0, Math.PI * 2);
    ctx.fill();

    // Thruster effect when pursuing
    if (behavior.phase === 'pursuit') {
      ctx.fillStyle = '#00aaff';
      for (let i = 0; i < 3; i++) {
        const flameX = -enemy.radius - (i * 4);
        const flameY = (Math.random() - 0.5) * 6;
        ctx.beginPath();
        ctx.arc(flameX, flameY, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}

function renderGeoLancer(ctx, enemy, time) {
  const behavior = enemy.behavior || {};
  const sheet = enemy.sprite ? ensureEnemySprite(enemy.sprite) : null;
  const hasImg = sheet && sheet.img && sheet.img.complete && sheet.img.naturalWidth > 0;
  const gridStr = enemy.spriteGrid || '1x1';
  const m = /^(\d+)x(\d+)$/i.exec(gridStr.trim());
  const cols = m ? parseInt(m[1], 10) : 1;
  const rows = m ? parseInt(m[2], 10) : 1;
  let idx = Math.max(0, enemy.spriteIndex || 0);
  const colW = hasImg ? Math.floor(sheet.img.naturalWidth / Math.max(1, cols)) : 0;
  const rowH = hasImg ? Math.floor(sheet.img.naturalHeight / Math.max(1, rows)) : 0;

  // Choose frame by state to match provided 3x4 sheet
  if (enemy.health !== undefined && enemy.health <= 2) {
    idx = (Math.floor(time * 6) % 2) ? 6 : 7; // destroyed flicker
  } else if (behavior.active) {
    if (behavior.lastShot !== undefined && behavior.lastShot < 0.15) {
      idx = 8; // firing
    } else if (behavior.chargeTimer && behavior.chargeTimer > 0) {
      idx = 5; // charge up
    } else if (behavior.justActivated && behavior.justActivated > 0) {
      idx = 3; // activation
    } else {
      idx = (Math.floor(time * 3) % 2) ? 1 : 2; // active idle
    }
  } else {
    idx = 0; // inactive
  }

  const cx = cols > 0 ? (idx % cols) : 0;
  const cy = rows > 0 ? Math.floor(idx / cols) % rows : 0;
  const sx = cx * colW;
  const sy = cy * rowH;
  
  if (enemy.disguised || !behavior.active) {
    // Render as asteroid or disguised sprite
    if (hasImg) {
      const size = enemy.radius * 2;
      ctx.drawImage(sheet.img, sx, sy, colW, rowH, -size/2, -size/2, size, size);
    } else {
      ctx.fillStyle = enemy.color;
      // Draw irregular asteroid shape
      ctx.beginPath();
      const points = 8;
      for (let i = 0; i < points; i++) {
        const angle = (i / points) * Math.PI * 2;
        const variation = 0.7 + Math.sin(time * 0.5 + i) * 0.3;
        const radius = enemy.radius * variation;
        const x = Math.cos(angle) * radius;
        const y = Math.sin(angle) * radius;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fill();
    }
  } else {
    // Activated state - show weapon
    if (hasImg) {
      const size = enemy.radius * 2;
      ctx.drawImage(sheet.img, sx, sy, colW, rowH, -size/2, -size/2, size, size);
    } else {
      ctx.fillStyle = enemy.color;
      ctx.beginPath();
      ctx.arc(0, 0, enemy.radius, 0, Math.PI * 2);
      ctx.fill();
    }
    
    // Weapon barrel
    ctx.fillStyle = '#ff6600';
    ctx.fillRect(enemy.radius * 0.5, -3, enemy.radius * 0.8, 6);
    
    // Charging indicator
    if (behavior.chargeTimer > 0) {
      const chargeProgress = 1 - (behavior.chargeTimer / behavior.chargeTime);
      ctx.strokeStyle = '#ffff00';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, enemy.radius + 8, -Math.PI/2, -Math.PI/2 + (chargeProgress * Math.PI * 2));
      ctx.stroke();
    }
  }
}

function renderFabricator(ctx, enemy, time) {
  const sheet = enemy.sprite ? ensureEnemySprite(enemy.sprite) : null;
  const hasImg = sheet && sheet.img && sheet.img.complete && sheet.img.naturalWidth > 0;
  const size = enemy.radius;
  if (hasImg) {
    // Support grid-based slicing for the summoner sheet (default 3x3)
    const gridStr = enemy.spriteGrid || '3x3';
    const m = /^([0-9]+)x([0-9]+)$/i.exec(gridStr.trim());
    const cols = m ? parseInt(m[1], 10) : 1;
    const rows = m ? parseInt(m[2], 10) : 1;

    // Choose a frame based on behavior/state
    let idx = Math.max(0, enemy.spriteIndex || 0);
    const b = enemy.behavior || {};

    // Summoning animation near the end of the spawn cycle
    if (typeof b.spawnCycle === 'number' && typeof b.spawnTimer === 'number') {
      const remain = b.spawnCycle - b.spawnTimer;
      if (remain <= 0.6) idx = 1; // Summoning - start
      if (remain <= 0.3) idx = 2; // Summoning - deploy
    }

    // Attacking animation during attack cycle window
    if (typeof b.attackCycle === 'number' && typeof b.attackTimer === 'number') {
      const t = b.attackTimer;
      if (t <= 0.2) idx = 3; // Attacking - start
      else if (t <= 0.5) idx = 4; // Attacking - soft/charge
      else if (t >= b.attackCycle - 0.15) idx = 5; // Firing
    }

    // Low-health destroyed looks
    if (enemy.health !== undefined && enemy.health <= 2) {
      idx = 6; // Destroyed stage 1
      if ((time % 0.3) > 0.15) idx = 7; // flicker between destroyed frames
    }

    const colW = Math.floor(sheet.img.naturalWidth / Math.max(1, cols));
    const rowH = Math.floor(sheet.img.naturalHeight / Math.max(1, rows));
    const cx = cols > 0 ? (idx % cols) : 0;
    const cy = rows > 0 ? Math.floor(idx / cols) % rows : 0;
    const sx = cx * colW;
    const sy = cy * rowH;

    const w = size * 2.2;
    const h = size * 1.6;
    ctx.drawImage(sheet.img, sx, sy, colW, rowH, -w/2, -h/2, w, h);
  } else {
    // Large, boxy design fallback
    ctx.fillStyle = enemy.color;
    ctx.fillRect(-size, -size * 0.6, size * 2, size * 1.2);
    // Assembly ports (glowing when spawning)
    const spawning = enemy.behavior && enemy.behavior.spawnTimer > enemy.behavior.spawnCycle - 0.5;
    ctx.fillStyle = spawning ? '#00ff00' : '#444444';
    ctx.fillRect(-size * 1.2, -size * 0.3, size * 0.4, size * 0.6);
    ctx.fillRect(size * 0.8, -size * 0.3, size * 0.4, size * 0.6);
    // Central eye
    ctx.fillStyle = '#ff0000';
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.3, 0, Math.PI * 2);
    ctx.fill();
    // Twin cannons
    ctx.fillStyle = '#888888';
    ctx.fillRect(size * 0.3, -size * 0.8, size * 0.4, size * 0.3);
    ctx.fillRect(size * 0.3, size * 0.5, size * 0.4, size * 0.3);
  }
  // Health indicator bars (but not bosses)
  if (enemy.health && !enemy.isBoss && !enemy.isFinalBoss) {
    ctx.fillStyle = enemy.health > 4 ? '#00ff00' : enemy.health > 2 ? '#ffff00' : '#ff0000';
    const barWidth = (enemy.health / 8) * size * 2;
    ctx.fillRect(-size, -size - 8, barWidth, 4);
  }
}

function renderAsteroid(ctx, enemy, time) {
  const behavior = enemy.behavior || {};
  const sheet = enemy.sprite ? ensureEnemySprite(enemy.sprite) : null;
  const hasImg = sheet && sheet.img && sheet.img.complete && sheet.img.naturalWidth > 0;
  
  // Rotate the asteroid
  ctx.rotate(behavior.rotation || 0);
  
  if (hasImg) {
    const size = enemy.radius * 2;
    ctx.drawImage(sheet.img, -size/2, -size/2, size, size);
  } else {
    ctx.fillStyle = enemy.color;
    
    // Irregular asteroid shape based on size
    ctx.beginPath();
    const points = enemy.size === 'large' ? 12 : enemy.size === 'small' ? 6 : 8;
    for (let i = 0; i < points; i++) {
      const angle = (i / points) * Math.PI * 2;
      const variation = 0.6 + Math.sin(time * 0.2 + i) * 0.4;
      const radius = enemy.radius * variation;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
    
    // Surface details
    ctx.fillStyle = '#666666';
    for (let i = 0; i < 3; i++) {
      const x = (Math.random() - 0.5) * enemy.radius;
      const y = (Math.random() - 0.5) * enemy.radius;
      const size = Math.random() * 3 + 1;
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function renderMinion(ctx, enemy, time) {
  const sheet = enemy.sprite ? ensureEnemySprite(enemy.sprite) : null;
  const hasImg = sheet && sheet.img && sheet.img.complete && sheet.img.naturalWidth > 0;
  if (hasImg) {
    const gridStr = enemy.spriteGrid || '1x1';
    const m = /^([0-9]+)x([0-9]+)$/i.exec(gridStr.trim());
    const cols = m ? parseInt(m[1], 10) : 1;
    const rows = m ? parseInt(m[2], 10) : 1;

    // Advance animation if sequence provided
    if (enemy.spriteAnim) {
      enemy._animT = (enemy._animT || 0) + (1/60);
      const fps = Math.max(1, parseInt(enemy.spriteFps || 8, 10));
      const seq = String(enemy.spriteAnim).split(',').map(s => parseInt(s.trim(), 10)).filter(Number.isFinite);
      if (seq.length > 0) {
        const frame = Math.floor(enemy._animT * fps) % seq.length;
        enemy.spriteIndex = seq[frame];
      }
    }

    const idx = Math.max(0, enemy.spriteIndex || 0);
    const colW = Math.floor(sheet.img.naturalWidth / Math.max(1, cols));
    const rowH = Math.floor(sheet.img.naturalHeight / Math.max(1, rows));
    const cx = cols > 0 ? (idx % cols) : 0;
    const cy = rows > 0 ? Math.floor(idx / cols) % rows : 0;
    const sx = cx * colW;
    const sy = cy * rowH;

    const size = enemy.radius * 2.2;
    ctx.drawImage(sheet.img, sx, sy, colW, rowH, -size/2, -size/2, size, size);
  } else {
    // Small, swarming enemy
    ctx.fillStyle = enemy.color;
    
    // Main body - smaller than basic enemies
    ctx.beginPath();
    ctx.arc(0, 0, enemy.radius, 0, Math.PI * 2);
    ctx.fill();
    
    // Erratic movement trail
    ctx.strokeStyle = enemy.color;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.3;
    ctx.beginPath();
    ctx.moveTo(-enemy.radius * 2, 0);
    ctx.lineTo(-enemy.radius * 4, Math.sin(time * 5) * enemy.radius);
    ctx.stroke();
    ctx.globalAlpha = 1;
    
    // Blinking "angry" core
    if (Math.floor(time * 8) % 2) {
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(0, 0, enemy.radius * 0.4, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function renderBasicEnemy(ctx, enemy, time) {
  const sheet = enemy.sprite ? ensureEnemySprite(enemy.sprite) : null;
  const hasImg = sheet && sheet.img && sheet.img.complete && sheet.img.naturalWidth > 0;
  if (hasImg) {
    const gridStr = enemy.spriteGrid || '1x1';
    const m = /^(\d+)x(\d+)$/i.exec(gridStr.trim());
    const cols = m ? parseInt(m[1], 10) : 1;
    const rows = m ? parseInt(m[2], 10) : 1;
    const size = enemy.radius * 2;

    // Advance animation
    if (enemy.spriteAnim) {
      enemy._animT = (enemy._animT || 0) + (1/60);
      const fps = Math.max(1, parseInt(enemy.spriteFps || 8, 10));
      const seq = String(enemy.spriteAnim).split(',').map(s => parseInt(s.trim(), 10)).filter(n => Number.isFinite(n));
      if (seq.length > 0) {
        const frame = Math.floor((enemy._animT * fps)) % seq.length;
        enemy.spriteIndex = seq[frame];
      }
    }

    const idx = Math.max(0, enemy.spriteIndex || 0);
    const colW = Math.floor(sheet.img.naturalWidth / Math.max(1, cols));
    const rowH = Math.floor(sheet.img.naturalHeight / Math.max(1, rows));
    const cx = cols > 0 ? (idx % cols) : 0;
    const cy = rows > 0 ? Math.floor(idx / cols) % rows : 0;
    const sx = cx * colW;
    const sy = cy * rowH;
    ctx.drawImage(sheet.img, sx, sy, colW, rowH, -size/2, -size/2, size, size);
  } else {
    // Triangle basic look
    ctx.fillStyle = enemy.color || '#fca5a5';
    ctx.beginPath();
    ctx.moveTo(enemy.radius, 0); // tip
    ctx.lineTo(-enemy.radius, -enemy.radius * 0.6);
    ctx.lineTo(-enemy.radius, enemy.radius * 0.6);
    ctx.closePath();
    ctx.fill();
  }
}

function renderEnemyEffects(ctx, enemy, time) {
  // Visual effects for special enemy states
  if (enemy.empStunned) {
    // EMP stun effect - electric sparks
    ctx.strokeStyle = '#FFD700';
    ctx.lineWidth = 2;
    for (let i = 0; i < 4; i++) {
      const angle = (time * 10 + i * Math.PI / 2) % (Math.PI * 2);
      const sparkX = Math.cos(angle) * (enemy.radius + 5);
      const sparkY = Math.sin(angle) * (enemy.radius + 5);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(sparkX, sparkY);
      ctx.stroke();
    }
  }

  if (enemy.controlled) {
    // Controlled enemy indicator - green glow
    ctx.save();
    ctx.shadowColor = '#4CAF50';
    ctx.shadowBlur = 10;
    ctx.strokeStyle = '#4CAF50';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, enemy.radius + 4, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
  
  // Health indicator for enemies with multiple hit points (but not bosses)
  if (enemy.health && enemy.health > 1 && !enemy.isBoss && !enemy.isFinalBoss) {
    const maxHealth = enemy.maxHealth || 8; // Use actual maxHealth if available
    const healthRatio = enemy.health / maxHealth;
    ctx.fillStyle = healthRatio > 0.6 ? '#00ff00' : healthRatio > 0.3 ? '#ffff00' : '#ff0000';
    ctx.fillRect(-enemy.radius, -enemy.radius - 12, (enemy.radius * 2) * healthRatio, 3);
    
    // Health bar border
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.strokeRect(-enemy.radius, -enemy.radius - 12, enemy.radius * 2, 3);
  }
}

function renderEnemyBullet(ctx, bullet, time) {
  ctx.save();
  ctx.translate(bullet.pos.x, bullet.pos.y);
  
  if ((bullet.tags||[]).includes('geo-lance')) {
    // Energy lance - bright beam
    ctx.fillStyle = bullet.color || '#ffaa00';
    const w = bullet.rect?.w || 20;
    const h = bullet.rect?.h || 4;
    ctx.fillRect(-w/2, -h/2, w, h);
    
    // Glow effect
    ctx.shadowColor = bullet.color || '#ffaa00';
    ctx.shadowBlur = 8;
    ctx.fillRect(-w/2, -h/2, w, h);
  } else if ((bullet.tags||[]).includes('plasma-sphere')) {
    // Plasma sphere - destructible projectile
    ctx.fillStyle = bullet.color || '#aa00ff';
    ctx.beginPath();
    ctx.arc(0, 0, bullet.radius || 8, 0, Math.PI * 2);
    ctx.fill();
    
    // Pulsing energy effect
    const pulseRadius = (bullet.radius || 8) + Math.sin(time * 6) * 2;
    ctx.strokeStyle = bullet.color || '#aa00ff';
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    ctx.arc(0, 0, pulseRadius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
    
    // Health indicator for destructible projectiles
    if (bullet.destructible && bullet.health && bullet.health > 1) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-bullet.radius, -bullet.radius - 8, (bullet.radius * 2) * (bullet.health / 2), 2);
    }
  } else {
    // Generic enemy bullet
    ctx.fillStyle = bullet.color || '#ff0000';
    const w = bullet.rect?.w || 8;
    const h = bullet.rect?.h || 8;
    ctx.fillRect(-w/2, -h/2, w, h);
  }
  
  ctx.restore();
}

export function RenderSystem(dt, world) {
  const { ctx, canvas, sector } = world;
  
  // Render sector background
  const sectorBg = ensureSectorBackground(sector || 1);
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
    // Fallback background with space colors
    ctx.fillStyle = '#0b1220';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Simple parallax stars as fallback
    const layers = [
      { color: 'rgba(255,255,255,0.4)', speed: 50, size: 2 },
      { color: 'rgba(186,230,253,0.35)', speed: 90, size: 2.5 },
      { color: 'rgba(103,232,249,0.30)', speed: 140, size: 3 },
    ];
    layers.forEach((layer, idx) => {
      ctx.fillStyle = layer.color;
      for (let i = 0; i < 80; i++) {
        const x = ((i * 120 + (world.time * layer.speed)) % (canvas.width + 200)) - 100;
        const y = (i * 53 + idx * 37) % canvas.height;
        ctx.fillRect(canvas.width - x, y, layer.size, layer.size);
      }
    });
  }

  const playerSheet = ensurePlayerSprite(canvas);
  if (playerSheet && playerSheet.anim.length > 0) {
    playerSheet.t += dt;
    const frame = Math.floor(playerSheet.t * playerSheet.fps) % playerSheet.anim.length;
    playerSheet.idx = playerSheet.anim[frame];
  }
  const bulletSprite = ensureBulletSprite(canvas);

  // Draw entities
  for (const e of world.entities.values()) {
    if ((e.tags||[]).includes('player')) {
      const sizeW = e.size?.w || 120;
      const sizeH = e.size?.h || 60;
      const img = playerSheet?.img;
      if (img && img.complete && img.naturalWidth > 0 && playerSheet) {
        const colW = Math.floor(img.naturalWidth / Math.max(1, playerSheet.cols));
        const rowH = Math.floor(img.naturalHeight / Math.max(1, playerSheet.rows));
        const idx = playerSheet.idx || 0;
        const cx = idx % playerSheet.cols;
        const cy = Math.floor(idx / playerSheet.cols) % playerSheet.rows;
        const sx = cx * colW;
        const sy = cy * rowH;
        // Anchor support via dataset (ax,ay from 0..1). Default center.
        let ax = 0.5, ay = 0.5;
        const anchorStr = canvas.dataset?.playerAnchor || '';
        if (anchorStr) {
          const parts = anchorStr.split(',').map((v) => parseFloat(v.trim())).filter((n) => Number.isFinite(n));
          if (parts.length === 2) { ax = parts[0]; ay = parts[1]; }
        }
        ctx.drawImage(img, sx, sy, colW, rowH, e.pos.x - sizeW * ax, e.pos.y - sizeH * ay, sizeW, sizeH);
      } else {
        ctx.save();
        ctx.translate(e.pos.x, e.pos.y);
        ctx.fillStyle = e.color || '#a7f3d0';
        ctx.beginPath();
        ctx.moveTo(18, 0);
        ctx.lineTo(-18, -10);
        ctx.lineTo(-18, 10);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }

      // Draw shield if active
      if (e.shield && (e.shield.hits > 0 || e.shield.invulnerable)) {
        ctx.save();
        ctx.translate(e.pos.x, e.pos.y);

        // Shield visual effects
        if (e.shield.invulnerable) {
          // Invulnerability - flashing white/blue shield
          const flash = Math.sin(world.time * 15) > 0;
          ctx.strokeStyle = flash ? '#FFFFFF' : '#4ECDC4';
          ctx.lineWidth = 3;
        } else {
          // Normal shield - cyan color with intensity based on remaining hits
          const intensity = e.shield.hits / Math.max(1, e.shield.maxHits);
          ctx.strokeStyle = `rgba(78, 205, 196, ${0.3 + intensity * 0.7})`;
          ctx.lineWidth = 2;
        }

        // Draw shield circle
        const shieldRadius = Math.max(sizeW, sizeH) * 0.7;
        ctx.setLineDash([8, 4]);
        ctx.beginPath();
        ctx.arc(0, 0, shieldRadius, 0, Math.PI * 2);
        ctx.stroke();

        // Draw shield strength indicators
        const segments = e.shield.maxHits;
        if (segments > 0) {
          ctx.setLineDash([]);
          ctx.lineWidth = 4;
          for (let i = 0; i < segments; i++) {
            const angle = (i / segments) * Math.PI * 2 - Math.PI / 2;
            const isActive = i < e.shield.hits;
            ctx.strokeStyle = isActive ? '#4ECDC4' : 'rgba(78, 205, 196, 0.2)';

            const startAngle = angle - (Math.PI / segments) * 0.4;
            const endAngle = angle + (Math.PI / segments) * 0.4;

            ctx.beginPath();
            ctx.arc(0, 0, shieldRadius + 8, startAngle, endAngle);
            ctx.stroke();
          }
        }

        ctx.restore();
      }
    } else if ((e.tags||[]).includes('bullet')) {
      // Special rendering for giant laser
      if ((e.tags||[]).includes('giant-laser')) {
        ctx.save();

        // Giant laser glow effect
        const glowRadius = e.rect.h;
        const gradient = ctx.createRadialGradient(
          e.pos.x + e.rect.w/2, e.pos.y, 0,
          e.pos.x + e.rect.w/2, e.pos.y, glowRadius
        );
        gradient.addColorStop(0, e.color || '#FFD700');
        gradient.addColorStop(0.3, 'rgba(255, 215, 0, 0.8)');
        gradient.addColorStop(1, 'rgba(255, 215, 0, 0)');

        ctx.fillStyle = gradient;
        ctx.fillRect(
          e.pos.x - glowRadius/2,
          e.pos.y - glowRadius,
          e.rect.w + glowRadius,
          glowRadius * 2
        );

        // Core laser beam
        ctx.fillStyle = e.color || '#FFD700';
        ctx.fillRect(e.pos.x, e.pos.y - e.rect.h / 2, e.rect.w, e.rect.h);

        ctx.restore();
      } else {
        // Regular bullet with sprite support
        const img = bulletSprite?.img;
        const bw = e.rect?.w || 4;
        const bh = e.rect?.h || 1;
        
        // Clamp drawing so bullets don't render past the canvas edge
        const maxX = Math.min(e.pos.x, canvas.width - (img ? 12 : bw));
        const drawX = Math.max(0, maxX);

        if (img && img.complete && img.naturalWidth > 0) {
          // Render PNG at a slightly larger fixed size
          const fixedW = 12;  // Slightly bigger width
          const fixedH = 4;   // Slightly bigger height
          ctx.drawImage(img, drawX, e.pos.y - fixedH / 2, fixedW, fixedH);
          if (window.DEBUG_BULLETS) console.log('Bullet rendered as PNG:', fixedW, 'x', fixedH);
        } else {
          // Fallback rectangle
          ctx.fillStyle = '#93c5fd';
          ctx.fillRect(drawX, e.pos.y - bh / 2, bw, bh);
          if (window.DEBUG_BULLETS) console.log('Bullet rendered as rect:', bw, 'x', bh);
        }
      }
    } else if ((e.tags||[]).includes('enemy-bullet')) {
      // Render enemy bullets with distinct colors and effects
      const bw = e.rect?.w || 8;
      const bh = e.rect?.h || 8;
      
      if ((e.tags||[]).includes('geo-lance')) {
        // Geo-Lancer energy lance - elongated with glow
        ctx.save();
        ctx.shadowBlur = 10;
        ctx.shadowColor = e.color || '#ffaa00';
        ctx.fillStyle = e.color || '#ffaa00';
        ctx.fillRect(e.pos.x - bw/2, e.pos.y - bh/2, bw, bh);
        ctx.restore();
      } else if ((e.tags||[]).includes('plasma-sphere')) {
        // Fabricator plasma sphere - circular with pulsing glow
        const radius = e.radius || 8;
        ctx.save();
        
        // Pulsing glow effect
        const pulseIntensity = 0.5 + 0.5 * Math.sin(world.time * 6);
        ctx.shadowBlur = 15 * pulseIntensity;
        ctx.shadowColor = e.color || '#aa00ff';
        
        // Outer glow
        ctx.beginPath();
        ctx.arc(e.pos.x, e.pos.y, radius * 1.5, 0, Math.PI * 2);
        ctx.fillStyle = `${e.color || '#aa00ff'}30`;
        ctx.fill();
        
        // Core sphere
        ctx.beginPath();
        ctx.arc(e.pos.x, e.pos.y, radius, 0, Math.PI * 2);
        ctx.fillStyle = e.color || '#aa00ff';
        ctx.fill();
        
        ctx.restore();
      } else {
        // Generic enemy bullet
        ctx.fillStyle = e.color || '#ff4444';
        ctx.fillRect(e.pos.x - bw/2, e.pos.y - bh/2, bw, bh);
      }
    } else if ((e.tags||[]).includes('enemy')) {
      renderEnemy(ctx, e, world.time);
    } else if ((e.tags||[]).includes('enemy-bullet')) {
      renderEnemyBullet(ctx, e, world.time);
    } else if ((e.tags||[]).includes('powerup')) {
      // Power-up rendering
      ctx.save();
      ctx.translate(e.pos.x, e.pos.y);

      // Rotating glow effect
      const glowRadius = e.radius * 2;
      const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, glowRadius);
      gradient.addColorStop(0, e.color || '#FFC107');
      gradient.addColorStop(0.5, 'rgba(255, 193, 7, 0.5)');
      gradient.addColorStop(1, 'rgba(255, 193, 7, 0)');

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(0, 0, glowRadius, 0, Math.PI * 2);
      ctx.fill();

      // Core power-up
      ctx.fillStyle = e.color || '#FFC107';
      ctx.beginPath();
      ctx.arc(0, 0, e.radius, 0, Math.PI * 2);
      ctx.fill();

      // Rotating highlight
      ctx.rotate(world.time * 3);
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(-e.radius/2, -1, e.radius, 2);
      ctx.fillRect(-1, -e.radius/2, 2, e.radius);

      ctx.restore();
    } else if ((e.tags||[]).includes('drone')) {
      // Drone rendering
      ctx.save();
      ctx.translate(e.pos.x, e.pos.y);

      if (e.isAlive) {
        // Active drone - blue with energy glow
        ctx.shadowColor = e.color || '#45B7D1';
        ctx.shadowBlur = 8;
        ctx.fillStyle = e.color || '#45B7D1';
        ctx.beginPath();
        ctx.arc(0, 0, e.radius, 0, Math.PI * 2);
        ctx.fill();

        // Drone "eye" or core
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(0, 0, e.radius * 0.4, 0, Math.PI * 2);
        ctx.fill();

        // Health indicator
        const healthSegments = e.maxHits;
        for (let i = 0; i < healthSegments; i++) {
          const angle = (i / healthSegments) * Math.PI * 2;
          const isActive = i < e.hits;
          ctx.strokeStyle = isActive ? '#45B7D1' : 'rgba(69, 183, 209, 0.3)';
          ctx.lineWidth = 2;

          const startAngle = angle - Math.PI / 8;
          const endAngle = angle + Math.PI / 8;

          ctx.beginPath();
          ctx.arc(0, 0, e.radius + 6, startAngle, endAngle);
          ctx.stroke();
        }
      } else {
        // Dead drone - gray and static
        ctx.fillStyle = e.color || '#666666';
        ctx.beginPath();
        ctx.arc(0, 0, e.radius, 0, Math.PI * 2);
        ctx.fill();

        // Damage sparks
        ctx.strokeStyle = '#FF6B6B';
        ctx.lineWidth = 1;
        for (let i = 0; i < 3; i++) {
          const angle = Math.random() * Math.PI * 2;
          const length = 4 + Math.random() * 4;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(Math.cos(angle) * length, Math.sin(angle) * length);
          ctx.stroke();
        }
      }

      ctx.restore();
    } else if ((e.tags||[]).includes('satellite-cannon')) {
      // Satellite cannon rendering
      ctx.save();
      ctx.translate(e.pos.x, e.pos.y);

      // Main cannon body
      ctx.fillStyle = e.color || '#FFD700';
      ctx.beginPath();
      ctx.ellipse(0, 0, 25, 15, 0, 0, Math.PI * 2);
      ctx.fill();

      // Cannon barrel
      ctx.fillStyle = '#FFA500';
      ctx.fillRect(15, -3, 30, 6);

      // Energy glow
      ctx.shadowColor = '#FFD700';
      ctx.shadowBlur = 15;
      ctx.strokeStyle = '#FFD700';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(0, 0, 28, 18, 0, 0, Math.PI * 2);
      ctx.stroke();

      // Charging indicator
      if (e.chargeTime !== undefined && e.maxChargeTime) {
        const chargeProgress = e.chargeTime / e.maxChargeTime;
        ctx.fillStyle = `rgba(255, 255, 255, ${chargeProgress})`;
        ctx.beginPath();
        ctx.ellipse(0, 0, 20 * chargeProgress, 12 * chargeProgress, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    } else if ((e.tags||[]).includes('mega-beam')) {
      // Mega beam rendering (enhanced giant laser)
      ctx.save();

      // Massive glow effect
      const glowRadius = e.rect.h * 2;
      const gradient = ctx.createRadialGradient(
        e.pos.x + e.rect.w/2, e.pos.y, 0,
        e.pos.x + e.rect.w/2, e.pos.y, glowRadius
      );
      gradient.addColorStop(0, e.color || '#FFD700');
      gradient.addColorStop(0.2, 'rgba(255, 215, 0, 0.9)');
      gradient.addColorStop(0.6, 'rgba(255, 165, 0, 0.5)');
      gradient.addColorStop(1, 'rgba(255, 215, 0, 0)');

      ctx.fillStyle = gradient;
      ctx.fillRect(
        e.pos.x - glowRadius,
        e.pos.y - glowRadius,
        e.rect.w + glowRadius * 2,
        glowRadius * 2
      );

      // Core mega beam
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(e.pos.x, e.pos.y - e.rect.h / 2, e.rect.w, e.rect.h);

      // Outer beam
      ctx.fillStyle = e.color || '#FFD700';
      ctx.fillRect(e.pos.x, e.pos.y - e.rect.h / 2 - 2, e.rect.w, e.rect.h + 4);

      ctx.restore();
    }

    // Render ramming mode effect on player
    if ((e.tags||[]).includes('player') && e.combo && e.combo.rammingActive) {
      ctx.save();
      ctx.translate(e.pos.x, e.pos.y);

      // Ramming aura effect
      const time = world.time * 20;
      const pulse = Math.sin(time) * 0.5 + 0.5;

      ctx.strokeStyle = `rgba(255, 69, 0, ${0.3 + pulse * 0.7})`;
      ctx.lineWidth = 4;
      ctx.setLineDash([]);

      const auraRadius = (e.size?.w || 36) * (0.8 + pulse * 0.4);
      ctx.beginPath();
      ctx.arc(0, 0, auraRadius, 0, Math.PI * 2);
      ctx.stroke();

      // Fire trail effect
      ctx.fillStyle = `rgba(255, 69, 0, ${0.2 + pulse * 0.3})`;
      ctx.beginPath();
      ctx.ellipse(-20, 0, 30, 15, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }
  }
  
  // Render explosions
  renderExplosions(ctx, world);
}


