import { markForRemoval } from '../world/world.js';

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
        if (bus && typeof bus.emit === 'function') bus.emit('sfx:explosion', { x: e.pos.x, y: e.pos.y });
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
        // Player hit by enemy - trigger death
        bus.emit('player:died', { x: p.pos.x, y: p.pos.y });
        console.log('[COLLISION] Player hit enemy! Game Over!');
        break;
      }
    }
  }
}


