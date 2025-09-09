import { addEntity } from '../world/world.js';
import { createEnemy } from '../entities/factory.js';

export function SpawnSystem(dt, world) {
  SpawnSystem.last = (SpawnSystem.last || 0) + dt;
  const every = 0.9;
  if (SpawnSystem.last > every) {
    SpawnSystem.last = 0;
    const y = 80 + Math.random() * (world.canvas.height - 160);
    const r = 10 + Math.random() * 14;
    addEntity(world, createEnemy(world.canvas.width + r + 20, y, r));
  }
}


