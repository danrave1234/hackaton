export function PlayerControlSystem(dt, world) {
  const keys = PlayerControlSystem.keys;
  if (!keys) return;
  const canvas = world.canvas;
  for (const e of world.entities.values()) {
    if (!(e.tags||[]).includes('player')) continue;
    const speed = e.stats?.speed || 200;
    const up = keys.has('w') || keys.has('arrowup');
    const down = keys.has('s') || keys.has('arrowdown');
    const left = keys.has('a') || keys.has('arrowleft');
    const right = keys.has('d') || keys.has('arrowright');
    e.pos.y += (up ? -speed : 0) * dt + (down ? speed : 0) * dt;
    e.pos.x += (left ? -speed : 0) * dt + (right ? speed : 0) * dt;
    // Clamp
    e.pos.x = Math.max(20, Math.min(canvas.width - 20, e.pos.x));
    e.pos.y = Math.max(20, Math.min(canvas.height - 20, e.pos.y));
  }
}

PlayerControlSystem.keys = new Set();

export function attachInputListeners() {
  const keys = PlayerControlSystem.keys;
  window.addEventListener('keydown', (e) => keys.add(e.key.toLowerCase()));
  window.addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
}


