import { addEntity } from '../world/world.js';
import { createBullet } from '../entities/factory.js';
import { upgradeManager } from './upgrades.js';

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
    
    // Get current upgrade effects
    const effects = upgradeManager.getAllEffects();

    // Initialize shooting timer
    if (e.lastShot === undefined) e.lastShot = 0;
    
    // Initialize giant laser timer
    if (e.giantLaserTimer === undefined) e.giantLaserTimer = 0;

    // Update timers
    e.lastShot -= dt;
    if (effects.giantLaser) {
      e.giantLaserTimer -= dt;
    }

    // Apply attack speed multiplier
    const fireRate = weapon.rate / (effects.attackSpeedMultiplier || 1);

    // Normal shooting
    if (e.lastShot <= 0) {
      e.lastShot = fireRate;

      // Calculate number of beams (1 default + extra beams)
      const totalBeams = 1 + (effects.extraBeams || 0);

      // Shoot multiple beams
      for (let i = 0; i < totalBeams; i++) {
        const x = e.pos.x + (e.size?.w || 36) / 2;
        let y = e.pos.y;

        // Spread beams vertically for multiple beams
        if (totalBeams > 1) {
          const spread = 20; // pixels between beams
          const offset = (i - (totalBeams - 1) / 2) * spread;
          y += offset;
        }

        addEntity(world, createBullet(x, y, weapon.speed, 0, weapon.w, weapon.h));
      }
      
      // Emit sound when bullets are created
      if (bus && typeof bus.emit === 'function') {
        bus.emit('sfx:laser');
        if (window.DEBUG_SFX) console.log('[DEBUG] Laser shot fired with', totalBeams, 'beams');
      }
    }

    // Giant laser attack (level 5 offensive)
    if (effects.giantLaser && e.giantLaserTimer <= 0) {
      e.giantLaserTimer = effects.giantLaserCooldown || 5;

      // Create giant laser (wider and more powerful)
      const x = e.pos.x + (e.size?.w || 36) / 2;
      const y = e.pos.y;

      // Create a massive laser beam
      addEntity(world, createGiantLaser(x, y, weapon.speed * 1.5, 0, weapon.w * 3, weapon.h * 2));

      if (bus && typeof bus.emit === 'function') {
        bus.emit('sfx:laser'); // Could add a different sound for giant laser
        if (window.DEBUG_SFX) console.log('[DEBUG] GIANT LASER fired!');
      }
    }
  }
}

// Create giant laser bullet (more powerful version)
function createGiantLaser(x, y, vx, vy, w, h) {
  return {
    tags: ['bullet', 'giant-laser'],
    pos: { x, y },
    vel: { x: vx, y: vy },
    rect: { w, h },
    damage: 300, // Higher damage than normal bullets
    color: '#FFD700', // Gold color for giant laser
  };
}


