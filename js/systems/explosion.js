// Explosion System - handles sprite-based explosion animations
import { addEntity, markForRemoval } from '../world/world.js';

// Internal cache for explosion sprite
let explosionSpriteCache = null;

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

export function ensureExplosionSprite(canvas) {
  if (explosionSpriteCache && explosionSpriteCache.img) return explosionSpriteCache;
  
  // Try to get explosion sprite from canvas dataset or use default path
  const src = resolveSpriteSrc(canvas?.dataset?.explosionSprite || '@explosion.png');
  if (!src) return null;
  
  const img = new Image();
  img.src = src;
  
  // Parse grid information - detect grid size from spritesheet or use default
  const gridStr = canvas?.dataset?.explosionSpriteGrid || '8x8';
  const fpsStr = canvas?.dataset?.explosionAnimFps || '15';
  
  const m = /^(\d+)x(\d+)$/i.exec(gridStr.trim());
  const cols = m ? parseInt(m[1], 10) : 8;
  const rows = m ? parseInt(m[2], 10) : 8;
  const fps = Math.max(1, parseInt(fpsStr, 10) || 15);
  
  // Create animation sequence (0 to cols*rows-1)
  const totalFrames = cols * rows;
  const animSequence = Array.from({ length: totalFrames }, (_, i) => i);
  
  explosionSpriteCache = { 
    img, 
    cols, 
    rows, 
    animSequence, 
    fps,
    src 
  };
  
  return explosionSpriteCache;
}

export function createExplosion(x, y, size = 80) {
  return {
    tags: ['explosion'],
    pos: { x, y },
    size: { w: size, h: size },
    animation: {
      currentFrame: 0,
      timeAccumulator: 0,
      totalFrames: 64, // 8x8 grid default (64 frames)
      fps: 20, // Even faster animation to reduce delay
      loop: false,
      finished: false
    },
    color: '#ff6b6b' // Fallback color if sprite fails
  };
}

export function ExplosionSystem(dt, world, bus) {
  const canvas = world.canvas;
  const explosionSprite = ensureExplosionSprite(canvas);
  
  // Update explosion animations
  for (const entity of world.entities.values()) {
    if (!(entity.tags || []).includes('explosion')) continue;
    
    const anim = entity.animation;
    if (!anim || anim.finished) continue;
    
    // Update animation timer
    anim.timeAccumulator += dt;
    const frameTime = 1 / anim.fps;
    
    if (anim.timeAccumulator >= frameTime) {
      anim.timeAccumulator -= frameTime;
      anim.currentFrame++;
      
      // Check if animation is complete
      if (anim.currentFrame >= anim.totalFrames) {
        if (anim.loop) {
          anim.currentFrame = 0;
        } else {
          anim.finished = true;
          // Mark for removal
          markForRemoval(world, entity.id);
        }
      }
    }
  }
}

export function renderExplosions(ctx, world) {
  const canvas = world.canvas;
  const explosionSprite = ensureExplosionSprite(canvas);
  
  for (const entity of world.entities.values()) {
    if (!(entity.tags || []).includes('explosion')) continue;
    
    const anim = entity.animation;
    if (!anim || anim.finished) continue;
    
    const x = entity.pos.x;
    const y = entity.pos.y;
    const w = entity.size?.w || 60;
    const h = entity.size?.h || 60;
    
    // Calculate animation progress for effects
    const progress = anim.currentFrame / anim.totalFrames;
    const scale = 1.0 + (progress * 0.3); // Start normal size, grow moderately during animation
    const alpha = progress < 0.8 ? 1.0 : Math.max(0, (1 - progress) / 0.2); // Full opacity until 80%, then quick fade
    
    // Draw sprite-based explosion if available
    if (explosionSprite && explosionSprite.img && explosionSprite.img.complete && explosionSprite.img.naturalWidth > 0) {
      const img = explosionSprite.img;
      const cols = explosionSprite.cols;
      const rows = explosionSprite.rows;
      
      // Calculate source rectangle for current frame
      const frameIndex = Math.min(anim.currentFrame, explosionSprite.animSequence.length - 1);
      const spriteIndex = explosionSprite.animSequence[frameIndex];
      
      const colW = Math.floor(img.naturalWidth / cols);
      const rowH = Math.floor(img.naturalHeight / rows);
      
      const cx = spriteIndex % cols;
      const cy = Math.floor(spriteIndex / cols) % rows;
      
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
      const scaledW = w * scale;
      const scaledH = h * scale;
      
      // Draw main explosion sprite
      ctx.drawImage(img, sx, sy, colW, rowH, x - scaledW / 2, y - scaledH / 2, scaledW, scaledH);
      
      // Add a glowing outer layer for extra effect (larger, more transparent)
      if (progress < 0.8) {
        ctx.globalAlpha = alpha * 0.3;
        const glowScale = scale * 1.5;
        const glowW = w * glowScale;
        const glowH = h * glowScale;
        ctx.drawImage(img, sx, sy, colW, rowH, x - glowW / 2, y - glowH / 2, glowW, glowH);
      }
      
      ctx.restore();
      
    } else {
      // Enhanced fallback: multi-layer animated explosion
      ctx.save();
      
      // Outer glow layer
      const outerRadius = (w / 2) * scale * 1.5;
      const outerGradient = ctx.createRadialGradient(x, y, 0, x, y, outerRadius);
      outerGradient.addColorStop(0, `rgba(255, 140, 0, ${alpha * 0.4})`);
      outerGradient.addColorStop(0.5, `rgba(255, 69, 0, ${alpha * 0.2})`);
      outerGradient.addColorStop(1, 'rgba(255, 69, 0, 0)');
      
      ctx.fillStyle = outerGradient;
      ctx.beginPath();
      ctx.arc(x, y, outerRadius, 0, Math.PI * 2);
      ctx.fill();
      
      // Main explosion layer
      const mainRadius = (w / 2) * scale;
      const mainGradient = ctx.createRadialGradient(x, y, 0, x, y, mainRadius);
      mainGradient.addColorStop(0, `rgba(255, 255, 255, ${alpha * 0.9})`);
      mainGradient.addColorStop(0.3, `rgba(255, 140, 0, ${alpha * 0.8})`);
      mainGradient.addColorStop(0.7, `rgba(255, 69, 0, ${alpha * 0.6})`);
      mainGradient.addColorStop(1, `rgba(139, 0, 0, ${alpha * 0.2})`);
      
      ctx.fillStyle = mainGradient;
      ctx.beginPath();
      ctx.arc(x, y, mainRadius, 0, Math.PI * 2);
      ctx.fill();
      
      // Inner bright core
      const coreRadius = (w / 2) * scale * 0.4;
      const coreGradient = ctx.createRadialGradient(x, y, 0, x, y, coreRadius);
      coreGradient.addColorStop(0, `rgba(255, 255, 255, ${alpha})`);
      coreGradient.addColorStop(0.5, `rgba(255, 255, 200, ${alpha * 0.8})`);
      coreGradient.addColorStop(1, `rgba(255, 140, 0, ${alpha * 0.4})`);
      
      ctx.fillStyle = coreGradient;
      ctx.beginPath();
      ctx.arc(x, y, coreRadius, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.restore();
    }
  }
}

export function spawnExplosion(world, x, y, size = 60, bus = null) {
  const explosion = createExplosion(x, y, size);
  addEntity(world, explosion);
  
  // Emit explosion sound effect
  if (bus && typeof bus.emit === 'function') {
    bus.emit('sfx:explosion', { x, y });
  }
  
  return explosion;
}
