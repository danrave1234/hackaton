import { flushRemovals, markForRemoval } from '../world/world.js';

export function CleanupSystem(dt, world) {
  // Cull off-screen bullets/enemies
  const { width, height } = world.canvas;
  for (const e of world.entities.values()) {
    if (!e.pos) continue;
    if ((e.tags||[]).includes('bullet') && e.pos.x > width + 40) markForRemoval(world, e.id);
    if ((e.tags||[]).includes('enemy') && e.pos.x < -50) markForRemoval(world, e.id);
  }
  flushRemovals(world);
}


