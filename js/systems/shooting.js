import { addEntity } from '../world/world.js';
import { createBullet } from '../entities/factory.js';

export function ShootingSystem(dt, world, bus) {
  for (const e of world.entities.values()) {
    if (!(e.tags||[]).includes('player')) continue;
    const keys = window.PlayerKeys || new Set();
    const fire = keys.has(' ') || keys.has('enter');
    if (!fire) {
      // Reset shooting state when not firing
      e.wasFiring = false;
      continue;
    }
    const weapon = e.weapons?.[0];
    if (!weapon) continue;
    
    // Initialize shooting timer
    if (e.lastShot === undefined) e.lastShot = 0;
    
    // Update timer
    e.lastShot -= dt;
    
    // Can shoot when timer expires
    if (e.lastShot <= 0) {
      e.lastShot = weapon.rate;
      const x = e.pos.x + (e.size?.w || 36) / 2;
      const y = e.pos.y;
      addEntity(world, createBullet(x, y, weapon.speed, 0, weapon.w, weapon.h));
      
      // Always emit sound when bullet is created
      if (bus && typeof bus.emit === 'function') {
        bus.emit('sfx:laser');
        if (window.DEBUG_SFX) console.log('[DEBUG] Laser shot fired');
      }
    }
  }
}


