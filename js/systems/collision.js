import { markForRemoval } from '../world/world.js';
import { spawnExplosion } from './explosion.js';

export function CollisionSystem(dt, world, bus) {
  const bullets = [];
  const enemies = [];
  const players = [];
  
  for (const e of world.entities.values()) {
    if ((e.tags||[]).includes('bullet')) bullets.push(e);
    if ((e.tags||[]).includes('enemy')) enemies.push(e);
    if ((e.tags||[]).includes('player')) players.push(e);
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
        markForRemoval(world, b.id);
        markForRemoval(world, e.id);
        bus.emit('score:add', 100);
        bus.emit('enemy:killed'); // Emit event for level progression
        spawnExplosion(world, e.pos.x, e.pos.y, Math.max(40, e.radius * 2.5), bus);
        break;
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
        // Player hit by enemy - deal damage based on enemy size
        const damage = Math.floor(e.radius * 2); // Larger enemies deal more damage
        const playerDied = window.healthSystem?.damagePlayer?.(p, damage) || false;
        
        markForRemoval(world, e.id); // Remove the enemy that hit the player
        spawnExplosion(world, e.pos.x, e.pos.y, Math.max(40, e.radius * 2.5), bus);
        
        if (playerDied) {
          // Stop all player inputs immediately
          if (window.PlayerKeys) {
            window.PlayerKeys.clear();
          }
          
          // Calculate player visual center for explosion positioning
          const playerW = p.size?.w || 120;
          const playerH = p.size?.h || 60;
          // Default anchor is 0.35, 0.5 (from HTML config)
          const centerX = p.pos.x + (playerW * 0.15); // Move from 35% anchor to 50% center
          const centerY = p.pos.y; // Y is already centered (50% anchor)
          
          // Replace player with explosion at visual center (proportional to player size)
          spawnExplosion(world, centerX, centerY, Math.max(playerW * 0.8, playerH * 0.8), bus);
          markForRemoval(world, p.id);
          
          bus.emit('player:died', { x: p.pos.x, y: p.pos.y });
          console.log('[COLLISION] Player died! Game Over!');
        } else {
          console.log(`[COLLISION] Player took ${damage} damage!`);
        }
        break;
      }
    }
  }
}