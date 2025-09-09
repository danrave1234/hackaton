// Internal cache for spritesheet and meta
let playerSpriteCache = null;
let bulletSpriteCache = null;
let sectorBackgroundCache = new Map(); // Cache for sector backgrounds

// Import explosion rendering
import { renderExplosions } from './explosion.js';

function resolveSpriteSrc(raw) {
  if (!raw) return undefined;
  let out = raw;
  if (out.startsWith('@asset/')) out = out.replace(/^@asset\//, 'asset/');
  else if (out.startsWith('@')) out = 'asset/spritesheet/' + out.slice(1);
  // If path starts with asset/ and page is served from /pages/, prefix ../
  if (out.startsWith('asset/')) {
    const inPages = /\/pages\//.test(location.pathname);
    if (inPages) out = '../' + out;
  }
  return out;
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
        
        if (img && img.complete && img.naturalWidth > 0) {
          // Render PNG at a slightly larger fixed size
          const fixedW = 12;  // Slightly bigger width
          const fixedH = 4;   // Slightly bigger height
          ctx.drawImage(img, e.pos.x, e.pos.y - fixedH / 2, fixedW, fixedH);
          if (window.DEBUG_BULLETS) console.log('Bullet rendered as PNG:', fixedW, 'x', fixedH);
        } else {
          // Fallback rectangle
          ctx.fillStyle = '#93c5fd';
          ctx.fillRect(e.pos.x, e.pos.y - bh / 2, bw, bh);
          if (window.DEBUG_BULLETS) console.log('Bullet rendered as rect:', bw, 'x', bh);
        }
      }
    } else if ((e.tags||[]).includes('enemy')) {
      ctx.fillStyle = e.color || '#fca5a5';
      ctx.beginPath();
      ctx.arc(e.pos.x, e.pos.y, e.radius, 0, Math.PI * 2);
      ctx.fill();

      // Visual effects for special enemy states
      if (e.empStunned) {
        // EMP stun effect - electric sparks
        ctx.strokeStyle = '#FFD700';
        ctx.lineWidth = 2;
        for (let i = 0; i < 4; i++) {
          const angle = (world.time * 10 + i * Math.PI / 2) % (Math.PI * 2);
          const sparkX = e.pos.x + Math.cos(angle) * (e.radius + 5);
          const sparkY = e.pos.y + Math.sin(angle) * (e.radius + 5);
          ctx.beginPath();
          ctx.moveTo(e.pos.x, e.pos.y);
          ctx.lineTo(sparkX, sparkY);
          ctx.stroke();
        }
      }

      if (e.controlled) {
        // Controlled enemy indicator - green glow
        ctx.save();
        ctx.shadowColor = '#4CAF50';
        ctx.shadowBlur = 10;
        ctx.strokeStyle = '#4CAF50';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(e.pos.x, e.pos.y, e.radius + 4, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
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


