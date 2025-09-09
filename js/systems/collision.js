import { markForRemoval } from '../world/world.js';

export function CollisionSystem(dt, world, bus) {
  const bullets = [];
  const enemies = [];
  for (const e of world.entities.values()) {
    if ((e.tags||[]).includes('bullet')) bullets.push(e);
    if ((e.tags||[]).includes('enemy')) enemies.push(e);
  }

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
        if (bus && typeof bus.emit === 'function') bus.emit('sfx:explosion', { x: e.pos.x, y: e.pos.y });
        break;
      }
    }
  }
}


