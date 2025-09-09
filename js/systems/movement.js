export function MovementSystem(dt, world) {
  for (const e of world.entities.values()) {
    if (!e.vel || !e.pos) continue;
    e.pos.x += (e.vel.x || 0) * dt;
    e.pos.y += (e.vel.y || 0) * dt;
  }
}


