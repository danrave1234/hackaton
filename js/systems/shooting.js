import { addEntity } from '../world/world.js';
import { createBullet } from '../entities/factory.js';

export function ShootingSystem(dt, world, bus) {
  for (const e of world.entities.values()) {
    if (!(e.tags||[]).includes('player')) continue;
    const keys = window.PlayerKeys || new Set();
    const fire = keys.has(' ') || keys.has('enter');
    if (!fire) continue;
    const weapon = e.weapons?.[0];
    if (!weapon) continue;
    e.lastShot = e.lastShot || 0;
    e.lastShot -= dt;
    if (e.lastShot > 0) continue;
    e.lastShot = weapon.rate;
    const x = e.pos.x + (e.size?.w || 36) / 2;
    const y = e.pos.y;
    addEntity(world, createBullet(x, y, weapon.speed, 0, weapon.w, weapon.h));
    if (bus && typeof bus.emit === 'function') bus.emit('sfx:laser');
  }
}


