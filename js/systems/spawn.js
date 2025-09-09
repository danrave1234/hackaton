import { addEntity } from '../world/world.js';
import { createEnemy } from '../entities/factory.js';

export function SpawnSystem(dt, world) {
  // Initialize spawn system state
  if (!SpawnSystem.initialized) {
    SpawnSystem.last = 0;
    SpawnSystem.spawnRate = 0.9; // Default spawn rate
    SpawnSystem.paused = false;
    SpawnSystem.initialized = true;
    
    // Expose control methods globally for level progression
    window.spawnSystem = {
      pause: () => { SpawnSystem.paused = true; },
      resume: () => { SpawnSystem.paused = false; },
      setSpawnRate: (rate) => { SpawnSystem.spawnRate = rate; },
      isPaused: () => SpawnSystem.paused
    };
  }
  
  // Don't spawn if paused
  if (SpawnSystem.paused) return;
  
  SpawnSystem.last += dt;
  if (SpawnSystem.last > SpawnSystem.spawnRate) {
    SpawnSystem.last = 0;
    const y = 80 + Math.random() * (world.canvas.height - 160);
    const r = 10 + Math.random() * 14;
    addEntity(world, createEnemy(world.canvas.width + r + 20, y, r));
  }
}


