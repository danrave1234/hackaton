export function PlayerControlSystem(dt, world) {
  const keys = PlayerControlSystem.keys;
  if (!keys) return;
  const canvas = world.canvas;
  
  // Check if player is alive
  let playerExists = false;
  for (const e of world.entities.values()) {
    if ((e.tags||[]).includes('player')) {
      playerExists = true;
      break;
    }
  }
  
  // If no player exists, stop processing inputs
  if (!playerExists) {
    keys.clear();
    return;
  }
  
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

    // Initialize ability cooldown state on player entity
    if (!e.abilityCooldowns) {
      e.abilityCooldowns = {
        heal: 0,
        shield: 0
      };
    }

    // Decrease cooldown timers
    e.abilityCooldowns.heal = Math.max(0, (e.abilityCooldowns.heal || 0) - dt);
    e.abilityCooldowns.shield = Math.max(0, (e.abilityCooldowns.shield || 0) - dt);

    // Add shield when pressing 'Q' key with cooldown
    if (keys.has('q') && window.healthSystem && e.abilityCooldowns.shield <= 0) {
      const shieldAmount = 50; // Based on defensive cards level 1 from project idea
      window.healthSystem.addShield(e, shieldAmount, 1);
      e.abilityCooldowns.shield = 8; // seconds
      keys.delete('q');
    }

    // Heal when pressing 'E' key with cooldown
    if (keys.has('e') && window.healthSystem && e.abilityCooldowns.heal <= 0) {
      window.healthSystem.healPlayer(e, 20);
      e.abilityCooldowns.heal = 5; // seconds
      keys.delete('e');
    }
  }
}

PlayerControlSystem.keys = new Set();

export function attachInputListeners() {
  const keys = PlayerControlSystem.keys;
  window.addEventListener('keydown', (e) => keys.add(e.key.toLowerCase()));
  window.addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
}


