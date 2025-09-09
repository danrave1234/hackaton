// Enemy AI System - Handles specialized behaviors for different enemy types
import { addEntity, markForRemoval } from '../world/world.js';
import { createMinion, ENEMY_TYPES } from '../entities/factory.js';

export function EnemyAISystem(dt, world, bus) {
  const enemies = [];
  const players = [];
  
  // Collect entities
  for (const e of world.entities.values()) {
    if ((e.tags||[]).includes('enemy')) enemies.push(e);
    if ((e.tags||[]).includes('player')) players.push(e);
  }
  
  const player = players[0]; // Assume single player
  if (!player) return;
  
  enemies.forEach(enemy => {
    switch (enemy.type) {
      case ENEMY_TYPES.HUNTER_SEEKER:
        updateHunterSeekerBehavior(enemy, player, dt);
        break;
        
      case ENEMY_TYPES.GEO_LANCER:
        updateGeoLancerBehavior(enemy, player, dt, world, bus);
        break;
        
      case ENEMY_TYPES.FABRICATOR:
        updateFabricatorBehavior(enemy, player, dt, world, bus);
        break;
        
      case ENEMY_TYPES.ASTEROID:
        updateAsteroidBehavior(enemy, dt);
        break;
        
      case 'minion':
        updateMinionBehavior(enemy, player, dt, world);
        break;
        
      default:
        // Basic enemy behavior (simple movement)
        updateBasicBehavior(enemy, dt);
        break;
    }
  });
}

function updateHunterSeekerBehavior(enemy, player, dt) {
  const behavior = enemy.behavior;
  
  switch (behavior.phase) {
    case 'lock-on':
      // Hover and acquire target lock
      behavior.lockTimer -= dt;
      enemy.vel.x = -50; // Slow movement during lock-on
      enemy.vel.y = Math.sin(Date.now() * 0.005) * 30; // Hovering motion
      
      // Visual indicator: change color during lock-on
      enemy.color = `hsl(${Math.floor((behavior.lockTimer / 1.0) * 60)}, 100%, 50%)`;
      
      if (behavior.lockTimer <= 0) {
        // Target acquired - store player position
        behavior.targetPos.x = player.pos.x;
        behavior.targetPos.y = player.pos.y;
        behavior.phase = 'pursuit';
        enemy.color = '#ff0000'; // Red when pursuing
      }
      break;
      
    case 'pursuit':
      // High-speed pursuit toward target position
      const dx = behavior.targetPos.x - enemy.pos.x;
      const dy = behavior.targetPos.y - enemy.pos.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance > 10) {
        // Normalize direction and apply speed
        enemy.vel.x = (dx / distance) * behavior.speed;
        enemy.vel.y = (dy / distance) * behavior.speed;
      } else {
        // Reached target position, enter correction phase
        behavior.phase = 'correction';
        behavior.correctionTimer = behavior.correctionDelay;
      }
      break;
      
    case 'correction':
      // Brief delay before correcting course
      behavior.correctionTimer -= dt;
      enemy.vel.x *= 0.8; // Slow down
      enemy.vel.y *= 0.8;
      
      if (behavior.correctionTimer <= 0) {
        // Update target to current player position
        behavior.targetPos.x = player.pos.x;
        behavior.targetPos.y = player.pos.y;
        behavior.phase = 'pursuit';
      }
      break;
  }
}

function updateGeoLancerBehavior(enemy, player, dt, world, bus) {
  const behavior = enemy.behavior;
  
  // Calculate distance to player
  const dx = player.pos.x - enemy.pos.x;
  const dy = player.pos.y - enemy.pos.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  
  if (!behavior.active && distance <= behavior.detectionRange) {
    // Activate when player is in range
    behavior.active = true;
    enemy.disguised = false;
    enemy.color = '#ff6b35'; // Change to weapon color
    console.log('[ENEMY AI] Geo-Lancer activated!');
  }
  
  if (behavior.active) {
    // Update charging/firing cycle
    behavior.lastShot += dt;
    
    if (behavior.chargeTimer > 0) {
      // Charging weapon
      behavior.chargeTimer -= dt;
      const chargeProgress = 1 - (behavior.chargeTimer / behavior.chargeTime);
      enemy.color = `hsl(${20 + chargeProgress * 40}, 100%, ${50 + chargeProgress * 30}%)`;
      
      if (behavior.chargeTimer <= 0) {
        // Fire at player's current position
        fireGeoLancerShot(enemy, player, world, bus);
        behavior.lastShot = 0;
      }
    } else if (behavior.lastShot >= behavior.fireRate) {
      // Start charging for next shot
      behavior.chargeTimer = behavior.chargeTime;
    }
  }
}

function updateFabricatorBehavior(enemy, player, dt, world, bus) {
  const behavior = enemy.behavior;
  
  // Update spawn cycle
  behavior.spawnTimer += dt;
  if (behavior.spawnTimer >= behavior.spawnCycle && behavior.minionCount < behavior.maxMinions) {
    spawnMinion(enemy, world);
    behavior.spawnTimer = 0;
    behavior.minionCount++;
  }
  
  // Update attack cycle
  behavior.attackTimer += dt;
  if (behavior.attackTimer >= behavior.attackCycle) {
    fireFabricatorWeapons(enemy, player, world, bus);
    behavior.attackTimer = 0;
  }
  
  // Slow, steady movement
  enemy.vel.y += Math.sin(Date.now() * 0.002) * 10 * dt; // Slight vertical drift
}

function updateAsteroidBehavior(enemy, dt) {
  const behavior = enemy.behavior;
  
  // Rotate asteroid
  behavior.rotation += behavior.rotationSpeed * dt;
  
  // Apply drift movement
  enemy.vel.y += behavior.drift * dt * 0.1;
  
  // Keep within reasonable bounds
  if (Math.abs(enemy.vel.y) > 50) {
    enemy.vel.y *= 0.9;
  }
}

function updateMinionBehavior(enemy, player, dt, world) {
  const behavior = enemy.behavior;
  
  // Update lifetime
  behavior.timer += dt;
  if (behavior.timer >= behavior.lifetime) {
    markForRemoval(world, enemy.id);
    return;
  }
  
  // Swarm behavior - slight homing toward player
  const dx = player.pos.x - enemy.pos.x;
  const dy = player.pos.y - enemy.pos.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  
  if (distance > 0) {
    const homingForce = 50;
    enemy.vel.x += (dx / distance) * homingForce * dt;
    enemy.vel.y += (dy / distance) * homingForce * dt;
  }
  
  // Add some erratic movement
  enemy.vel.x += (Math.random() - 0.5) * 100 * dt;
  enemy.vel.y += (Math.random() - 0.5) * 100 * dt;
  
  // Speed limits
  const maxSpeed = 250;
  const speed = Math.sqrt(enemy.vel.x * enemy.vel.x + enemy.vel.y * enemy.vel.y);
  if (speed > maxSpeed) {
    enemy.vel.x = (enemy.vel.x / speed) * maxSpeed;
    enemy.vel.y = (enemy.vel.y / speed) * maxSpeed;
  }
}

function updateBasicBehavior(enemy, dt) {
  // Simple sine wave movement for basic enemies
  enemy.vel.y = Math.sin(Date.now() * 0.003 + enemy.pos.x * 0.01) * 30;
}

function fireGeoLancerShot(enemy, player, world, bus) {
  // Create energy lance projectile
  const dx = player.pos.x - enemy.pos.x;
  const dy = player.pos.y - enemy.pos.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  
  if (distance > 0) {
    const speed = 400;
    const projectile = {
      tags: ['enemy-bullet', 'geo-lance'],
      pos: { x: enemy.pos.x, y: enemy.pos.y },
      vel: { x: (dx / distance) * speed, y: (dy / distance) * speed },
      rect: { w: 20, h: 4 },
      color: '#ffaa00',
      damage: 2,
      lifetime: 3.0,
      timer: 0
    };
    
    addEntity(world, projectile);
    
    // Sound effect
    if (bus && typeof bus.emit === 'function') {
      bus.emit('sfx:laser-shoot', { x: enemy.pos.x, y: enemy.pos.y });
    }
  }
}

function fireFabricatorWeapons(enemy, player, world, bus) {
  // Fire twin plasma spheres
  const dx = player.pos.x - enemy.pos.x;
  const dy = player.pos.y - enemy.pos.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  
  if (distance > 0) {
    const speed = 180;
    const spread = 30;
    
    // Fire two projectiles with slight spread
    for (let i = 0; i < 2; i++) {
      const angle = Math.atan2(dy, dx) + (i - 0.5) * spread * Math.PI / 180;
      
      const projectile = {
        tags: ['enemy-bullet', 'plasma-sphere'],
        pos: { x: enemy.pos.x + (i - 0.5) * 20, y: enemy.pos.y },
        vel: { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed },
        rect: { w: 16, h: 16 },
        radius: 8,
        color: '#aa00ff',
        damage: 3,
        lifetime: 4.0,
        timer: 0,
        destructible: true, // Can be shot down
        health: 2
      };
      
      addEntity(world, projectile);
    }
    
    // Sound effect
    if (bus && typeof bus.emit === 'function') {
      bus.emit('sfx:laser-shoot', { x: enemy.pos.x, y: enemy.pos.y });
    }
  }
}

function spawnMinion(fabricator, world) {
  // Spawn minion near fabricator
  const spawnOffset = 40;
  const angle = Math.random() * Math.PI * 2;
  const x = fabricator.pos.x + Math.cos(angle) * spawnOffset;
  const y = fabricator.pos.y + Math.sin(angle) * spawnOffset;
  
  const minion = createMinion(x, y);
  addEntity(world, minion);
  
  console.log('[ENEMY AI] Fabricator spawned minion');
}

// Update enemy bullets (projectiles fired by enemies)
export function updateEnemyBullets(dt, world) {
  const enemyBullets = [];
  
  for (const e of world.entities.values()) {
    if ((e.tags||[]).includes('enemy-bullet')) {
      enemyBullets.push(e);
    }
  }
  
  enemyBullets.forEach(bullet => {
    bullet.timer += dt;
    
    // Remove bullets that have exceeded their lifetime
    if (bullet.timer >= bullet.lifetime) {
      markForRemoval(world, bullet.id);
      return;
    }
    
    // Remove bullets that are off-screen
    if (bullet.pos.x < -50 || bullet.pos.x > world.canvas.width + 50 ||
        bullet.pos.y < -50 || bullet.pos.y > world.canvas.height + 50) {
      markForRemoval(world, bullet.id);
    }
  });
}
