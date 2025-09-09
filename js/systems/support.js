// Support System - Handles tractor beam, drones, EMP, energy leech, and chimera override
import { upgradeManager } from './upgrades.js';
import { addEntity, markForRemoval } from '../world/world.js';
import { createBullet } from '../entities/factory.js';

// Create power-up/debris entities for tractor beam testing
function createPowerUp(x, y) {
  return {
    tags: ['powerup'],
    pos: { x, y },
    vel: { x: -60, y: 0 },
    radius: 8,
    color: '#FFC107',
    value: 50
  };
}

// Create drone entity
function createDrone(x, y, playerId) {
  return {
    tags: ['drone'],
    pos: { x, y },
    vel: { x: 0, y: 0 },
    radius: 12,
    color: '#45B7D1',
    playerId: playerId,
    hits: 2,
    maxHits: 2,
    orbitAngle: Math.random() * Math.PI * 2,
    orbitRadius: 60,
    isAlive: true
  };
}

export function SupportSystem(dt, world, bus) {
  // Initialize support system state
  if (!SupportSystem.initialized) {
    SupportSystem.powerUpSpawnTimer = 0;
    SupportSystem.empCooldown = 0;
    SupportSystem.overrideCooldown = 0;
    SupportSystem.initialized = true;
  }

  const effects = upgradeManager.getAllEffects();
  const players = [];
  const powerUps = [];
  const drones = [];
  const enemies = [];

  // Collect entities
  for (const e of world.entities.values()) {
    if ((e.tags||[]).includes('player')) players.push(e);
    if ((e.tags||[]).includes('powerup')) powerUps.push(e);
    if ((e.tags||[]).includes('drone')) drones.push(e);
    if ((e.tags||[]).includes('enemy')) enemies.push(e);
  }

  // Update cooldowns
  SupportSystem.empCooldown = Math.max(0, SupportSystem.empCooldown - dt);
  SupportSystem.overrideCooldown = Math.max(0, SupportSystem.overrideCooldown - dt);

  for (const player of players) {
    // Initialize player support state
    if (!player.support) {
      player.support = {
        dronesSpawned: false,
        droneReviveProgress: 0
      };
    }

    // 1. TRACTOR BEAM - Pull in power-ups
    if (effects.tractorBeam) {
      const tractorRange = effects.tractorRange || 80;
      
      for (const powerUp of powerUps) {
        const dx = player.pos.x - powerUp.pos.x;
        const dy = player.pos.y - powerUp.pos.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance <= tractorRange && distance > 5) {
          // Pull power-up towards player
          const pullStrength = 150;
          const normalizedDx = dx / distance;
          const normalizedDy = dy / distance;
          
          powerUp.vel.x += normalizedDx * pullStrength * dt;
          powerUp.vel.y += normalizedDy * pullStrength * dt;
        } else if (distance <= 5) {
          // Collect power-up
          markForRemoval(world, powerUp.id);
          bus.emit('score:add', powerUp.value || 50);
          if (bus && typeof bus.emit === 'function') {
            bus.emit('sfx:power_up');
          }
        }
      }
    }

    // 2. DRONES - Spawn and manage defense drones
    if (effects.drones && !player.support.dronesSpawned) {
      // Spawn 2 drones around the player
      const drone1 = createDrone(player.pos.x - 40, player.pos.y - 30, player.id);
      const drone2 = createDrone(player.pos.x - 40, player.pos.y + 30, player.id);
      drone1.orbitAngle = 0;
      drone2.orbitAngle = Math.PI;
      
      addEntity(world, drone1);
      addEntity(world, drone2);
      player.support.dronesSpawned = true;
    }

    // 3. EMP PULSE - Disable enemy turrets (visual effect for now)
    if (effects.empPulse && SupportSystem.empCooldown <= 0) {
      const keys = window.PlayerKeys || new Set();
      if (keys.has('q') || keys.has('Q')) { // Q key to trigger EMP
        SupportSystem.empCooldown = effects.empCooldown || 8;
        
        // Apply EMP effect to all enemies
        for (const enemy of enemies) {
          enemy.empStunned = true;
          enemy.empTimer = effects.empDuration || 2;
          enemy.originalColor = enemy.color;
          enemy.color = '#888888'; // Gray out stunned enemies
        }
        
        console.log('[SUPPORT] EMP Pulse activated! Enemies stunned for', effects.empDuration, 'seconds');
        
        if (bus && typeof bus.emit === 'function') {
          // Could add EMP sound effect here
          bus.emit('sfx:power_up'); // Temporary sound
        }
      }
    }

    // 4. CHIMERA OVERRIDE - Take control of enemy
    if (effects.chimeraOverride && SupportSystem.overrideCooldown <= 0) {
      const keys = window.PlayerKeys || new Set();
      if (keys.has('e') || keys.has('E')) { // E key to trigger override
        // Find closest enemy
        let closestEnemy = null;
        let closestDistance = Infinity;
        
        for (const enemy of enemies) {
          if (enemy.controlled) continue; // Skip already controlled enemies
          
          const dx = player.pos.x - enemy.pos.x;
          const dy = player.pos.y - enemy.pos.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          
          if (distance < closestDistance) {
            closestDistance = distance;
            closestEnemy = enemy;
          }
        }
        
        if (closestEnemy && closestDistance <= 150) { // Override range
          SupportSystem.overrideCooldown = effects.overrideCooldown || 15;
          
          // Take control of enemy
          closestEnemy.controlled = true;
          closestEnemy.controlTimer = effects.overrideDuration || 10;
          closestEnemy.originalColor = closestEnemy.color;
          closestEnemy.color = '#4CAF50'; // Green for friendly
          closestEnemy.vel.x = Math.abs(closestEnemy.vel.x); // Move right with player
          
          console.log('[SUPPORT] Chimera Override activated! Enemy controlled for', effects.overrideDuration, 'seconds');
          
          if (bus && typeof bus.emit === 'function') {
            bus.emit('sfx:power_up'); // Temporary sound
          }
        }
      }
    }
  }

  // Manage drone behavior
  for (const drone of drones) {
    const owner = players.find(p => p.id === drone.playerId);
    if (!owner) {
      markForRemoval(world, drone.id);
      continue;
    }

    if (drone.isAlive) {
      // Orbit around player
      drone.orbitAngle += dt * 2; // Rotation speed
      drone.pos.x = owner.pos.x + Math.cos(drone.orbitAngle) * drone.orbitRadius - 20;
      drone.pos.y = owner.pos.y + Math.sin(drone.orbitAngle) * drone.orbitRadius;
      
      // Check drone-enemy collisions (drones block bullets/enemies)
      for (const enemy of enemies) {
        if (enemy.controlled) continue; // Don't collide with controlled enemies
        
        const dx = drone.pos.x - enemy.pos.x;
        const dy = drone.pos.y - enemy.pos.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance <= drone.radius + enemy.radius) {
          drone.hits--;
          markForRemoval(world, enemy.id);
          
          if (bus && typeof bus.emit === 'function') {
            bus.emit('sfx:explosion', { x: enemy.pos.x, y: enemy.pos.y });
            bus.emit('enemy:died'); // Count towards level progress
            bus.emit('score:add', 150); // Bonus score for drone kills
            
            // Energy leech effect
            if (effects.energyLeech && owner.shield) {
              const healAmount = Math.floor((effects.leechAmount || 0.1) * owner.shield.maxHits);
              owner.shield.hits = Math.min(owner.shield.maxHits, owner.shield.hits + healAmount);
              console.log('[SUPPORT] Energy leech healed', healAmount, 'shield points');
            }
          }
          
          if (drone.hits <= 0) {
            drone.isAlive = false;
            drone.color = '#666666'; // Gray out dead drone
            console.log('[SUPPORT] Drone destroyed!');
          }
          
          break;
        }
      }
    }
  }

  // Handle EMP stunned enemies
  for (const enemy of enemies) {
    if (enemy.empStunned) {
      enemy.empTimer = Math.max(0, enemy.empTimer - dt);
      if (enemy.empTimer <= 0) {
        enemy.empStunned = false;
        enemy.color = enemy.originalColor || '#fca5a5';
        delete enemy.originalColor;
      } else {
        // Slow down stunned enemies
        enemy.vel.x *= 0.1;
        enemy.vel.y *= 0.1;
      }
    }
    
    // Handle controlled enemies
    if (enemy.controlled) {
      enemy.controlTimer = Math.max(0, enemy.controlTimer - dt);
      if (enemy.controlTimer <= 0) {
        enemy.controlled = false;
        enemy.color = enemy.originalColor || '#fca5a5';
        enemy.vel.x = -Math.abs(enemy.vel.x); // Return to moving left
        delete enemy.originalColor;
        console.log('[SUPPORT] Enemy control expired');
      }
    }
  }

  // Spawn occasional power-ups for tractor beam testing
  if (effects.tractorBeam) {
    SupportSystem.powerUpSpawnTimer -= dt;
    if (SupportSystem.powerUpSpawnTimer <= 0) {
      SupportSystem.powerUpSpawnTimer = 8 + Math.random() * 4; // Every 8-12 seconds
      
      const y = 80 + Math.random() * (world.canvas.height - 160);
      addEntity(world, createPowerUp(world.canvas.width + 20, y));
    }
  }
}
