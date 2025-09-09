import { markForRemoval } from '../world/world.js';
import { upgradeManager } from './upgrades.js';

export function CollisionSystem(dt, world, bus) {
  const bullets = [];
  const enemies = [];
  const players = [];
  
  for (const e of world.entities.values()) {
    if ((e.tags||[]).includes('bullet')) bullets.push(e);
    if ((e.tags||[]).includes('enemy')) enemies.push(e);
    if ((e.tags||[]).includes('player')) players.push(e);
  }

  // Update player shield timers first
  for (const p of players) {
    if (p.shield && p.shield.invulnerable) {
      p.shield.invulnerableTimer -= dt;
      if (p.shield.invulnerableTimer <= 0) {
        p.shield.invulnerable = false;
      }
    }
  }

  // Bullet-Enemy collisions
  for (const b of bullets) {
    for (const e of enemies) {
      const bx2 = b.pos.x + b.rect.w;
      const by2 = b.pos.y + b.rect.h / 2;
      const bx1 = b.pos.x;
      const by1 = b.pos.y - b.rect.h / 2;
      const dx = Math.max(e.pos.x - e.radius, Math.min(bx2, e.pos.x + e.radius));
      const dy = Math.max(e.pos.y - e.radius, Math.min(by2, e.pos.y + e.radius));
      const inside = dx >= bx1 && dx <= bx2 && dy >= by1 && dy <= by2;
      if (inside) {
        // Check if it's a giant laser or mega beam (doesn't get destroyed)
        const isGiantLaser = (b.tags||[]).includes('giant-laser');
        const isMegaBeam = (b.tags||[]).includes('mega-beam');
        const isPiercing = isGiantLaser || isMegaBeam;
        
        if (!isPiercing) {
          markForRemoval(world, b.id);
        }
        
        markForRemoval(world, e.id);
        
        // Special bullets give more score
        let scoreValue = 100;
        if (isGiantLaser) scoreValue = 300;
        if (isMegaBeam) scoreValue = 500;
        bus.emit('score:add', scoreValue);
        bus.emit('enemy:died'); // Emit event for level progression
        if (bus && typeof bus.emit === 'function') bus.emit('sfx:explosion', { x: e.pos.x, y: e.pos.y });
        
        if (!isPiercing) break; // Piercing weapons continue through enemies
      }
    }
  }

  // Player-Enemy collisions
  for (const p of players) {
    for (const e of enemies) {
      const px = p.pos.x;
      const py = p.pos.y;
      const pw = p.size?.w || 36;
      const ph = p.size?.h || 18;
      
      // Check collision between player rectangle and enemy circle
      const dx = Math.max(e.pos.x - e.radius, Math.min(px + pw/2, e.pos.x + e.radius));
      const dy = Math.max(e.pos.y - e.radius, Math.min(py + ph/2, e.pos.y + e.radius));
      const distanceSquared = (dx - px - pw/2) * (dx - px - pw/2) + (dy - py - ph/2) * (dy - py - ph/2);
      
      if (distanceSquared < e.radius * e.radius) {
        // Get upgrade effects
        const effects = upgradeManager.getAllEffects();
        
        // Initialize shield system if not present
        if (p.shield === undefined) {
          p.shield = {
            hits: effects.shieldHits || 0,
            maxHits: effects.shieldHits || 0,
            invulnerable: false,
            invulnerableTimer: 0
          };
        }
        
        // Update shield with current upgrade level
        const newMaxHits = effects.shieldHits || 0;
        if (p.shield.maxHits < newMaxHits) {
          // Player upgraded shield - restore to full
          p.shield.hits = newMaxHits;
          p.shield.maxHits = newMaxHits;
        } else {
          p.shield.maxHits = newMaxHits;
          if (p.shield.hits > p.shield.maxHits) {
            p.shield.hits = p.shield.maxHits;
          }
        }
        
        
        // Skip damage if invulnerable
        if (p.shield.invulnerable) {
          markForRemoval(world, e.id); // Enemy still gets destroyed
          if (bus && typeof bus.emit === 'function') bus.emit('sfx:explosion', { x: e.pos.x, y: e.pos.y });
          continue;
        }
        
        // Handle shield absorption
        if (p.shield.hits > 0) {
          p.shield.hits--;
          markForRemoval(world, e.id);
          
          // Visual/audio feedback for shield hit
          if (bus && typeof bus.emit === 'function') {
            bus.emit('sfx:explosion', { x: e.pos.x, y: e.pos.y });
            // Could add shield hit sound here
          }
          
          console.log(`[COLLISION] Shield absorbed hit! Remaining: ${p.shield.hits}/${p.shield.maxHits}`);
          
          // Check if shield broken and has invulnerability effect
          if (p.shield.hits === 0 && effects.invulnerableOnBreak) {
            p.shield.invulnerable = true;
            p.shield.invulnerableTimer = effects.invulnerableDuration || 1;
            console.log('[COLLISION] Shield broken! Invulnerability activated!');
          }
          
          break;
        } else {
          // No shield - player dies
          bus.emit('player:died', { x: p.pos.x, y: p.pos.y });
          console.log('[COLLISION] Player hit enemy! Game Over!');
          break;
        }
      }
    }
  }
}