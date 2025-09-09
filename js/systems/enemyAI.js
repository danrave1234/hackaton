// Enemy AI System - Handles specialized behaviors for different enemy types
import { addEntity, markForRemoval } from '../world/world.js';
import { 
  createMinion, 
  createBioTendril, 
  createPhantomDrone, 
  ENEMY_TYPES 
} from '../entities/factory.js';

// Simple boss projectile creation
function createBossProjectile(x, y, vx, vy, type = 'basic') {
  return {
    tags: ['enemy-bullet', 'boss-projectile'],
    pos: { x, y },
    vel: { x: vx, y: vy },
    radius: type === 'advanced' ? 8 : 6,
    color: type === 'advanced' ? '#ff6600' : '#ff0000',
    damage: type === 'advanced' ? 15 : 10,
    life: 5.0, // 5 seconds max life
    type: 'boss-projectile'
  };
}

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
        
      case 'swarmer':
        updateSwarmerBehavior(enemy, player, dt, world);
        break;
        
      case ENEMY_TYPES.BOSS_BIO_MECHANICAL:
        updateBioMechanicalOvermindBehavior(enemy, player, dt, world, bus);
        break;
        
      case ENEMY_TYPES.BOSS_SENTINEL_PRIME:
        updateSentinelPrimeBehavior(enemy, player, dt, world, bus);
        break;
        
      case 'bio-tendril':
        updateBioTendrilBehavior(enemy, player, dt, world, bus);
        break;
        
      case 'phantom-drone':
        updatePhantomDroneBehavior(enemy, player, dt, world, bus);
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

// Bio-Mechanical Overmind Boss AI (Level 5) - Simplified hovering behavior
function updateBioMechanicalOvermindBehavior(enemy, player, dt, world, bus) {
  const behavior = enemy.behavior;
  const canvas = world.canvas;
  
  // Initialize center position if not set
  if (behavior.hoverCenterX === 0) {
    behavior.hoverCenterX = canvas.width * 0.7; // Position towards right side
    behavior.hoverCenterY = canvas.height / 2;
  }
  
  // Move to center position initially
  if (behavior.moveToCenter) {
    const dx = behavior.hoverCenterX - enemy.pos.x;
    const dy = behavior.hoverCenterY - enemy.pos.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance > 50) {
      // Move towards center
      enemy.vel.x = (dx / distance) * behavior.moveSpeed;
      enemy.vel.y = (dy / distance) * behavior.moveSpeed;
    } else {
      // Reached center, start hovering
      behavior.moveToCenter = false;
      enemy.vel.x = 0;
      enemy.vel.y = 0;
    }
  } else {
    // Hover around center in circular pattern
    behavior.hoverAngle += behavior.hoverSpeed * dt;
    
    const targetX = behavior.hoverCenterX + Math.cos(behavior.hoverAngle) * behavior.hoverRadius;
    const targetY = behavior.hoverCenterY + Math.sin(behavior.hoverAngle) * behavior.hoverRadius * 0.5; // Elliptical
    
    // Smooth movement towards hover position
    const dx = targetX - enemy.pos.x;
    const dy = targetY - enemy.pos.y;
    
    enemy.vel.x = dx * 2; // Adjust speed multiplier for smooth following
    enemy.vel.y = dy * 2;
  }
  
  // Simple attack pattern
  behavior.attackTimer += dt;
  if (behavior.attackTimer >= behavior.attackRate) {
    // Fire simple projectiles at player
    fireSimpleBossProjectile(enemy, player, world, bus);
    behavior.attackTimer = 0;
    behavior.attackType = (behavior.attackType + 1) % 3; // Cycle through 3 attack types
  }
}

// Simple boss projectile firing functions
function fireSimpleBossProjectile(enemy, player, world, bus) {
  const dx = player.pos.x - enemy.pos.x;
  const dy = player.pos.y - enemy.pos.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  
  if (distance > 0) {
    const speed = 200;
    const vx = (dx / distance) * speed;
    const vy = (dy / distance) * speed;
    
    // Fire 1-3 projectiles based on attack type
    const attackType = enemy.behavior.attackType;
    
    if (attackType === 0) {
      // Single aimed shot
      const projectile = createBossProjectile(enemy.pos.x - 40, enemy.pos.y, vx, vy);
      addEntity(world, projectile);
    } else if (attackType === 1) {
      // Triple shot spread
      for (let i = -1; i <= 1; i++) {
        const angle = Math.atan2(dy, dx) + (i * 0.3);
        const spreadVx = Math.cos(angle) * speed;
        const spreadVy = Math.sin(angle) * speed;
        const projectile = createBossProjectile(enemy.pos.x - 40, enemy.pos.y + (i * 20), spreadVx, spreadVy);
        addEntity(world, projectile);
      }
    } else {
      // Burst fire
      for (let i = 0; i < 2; i++) {
        setTimeout(() => {
          const projectile = createBossProjectile(enemy.pos.x - 40, enemy.pos.y, vx, vy);
          addEntity(world, projectile);
        }, i * 200);
      }
    }
  }
}

function fireAdvancedBossProjectile(enemy, player, world, bus, attackType) {
  const dx = player.pos.x - enemy.pos.x;
  const dy = player.pos.y - enemy.pos.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  
  if (distance > 0) {
    const speed = 250;
    const vx = (dx / distance) * speed;
    const vy = (dy / distance) * speed;
    
    if (attackType === 0) {
      // Heavy single shot
      const projectile = createBossProjectile(enemy.pos.x - 60, enemy.pos.y, vx, vy, 'advanced');
      addEntity(world, projectile);
    } else if (attackType === 1) {
      // Five-way spread
      for (let i = -2; i <= 2; i++) {
        const angle = Math.atan2(dy, dx) + (i * 0.25);
        const spreadVx = Math.cos(angle) * speed;
        const spreadVy = Math.sin(angle) * speed;
        const projectile = createBossProjectile(enemy.pos.x - 60, enemy.pos.y + (i * 25), spreadVx, spreadVy, 'advanced');
        addEntity(world, projectile);
      }
    } else if (attackType === 2) {
      // Rapid burst
      for (let i = 0; i < 3; i++) {
        setTimeout(() => {
          const projectile = createBossProjectile(enemy.pos.x - 60, enemy.pos.y, vx, vy, 'advanced');
          addEntity(world, projectile);
        }, i * 150);
      }
    } else {
      // Spiral pattern
      for (let i = 0; i < 6; i++) {
        const angle = (Math.PI * 2 / 6) * i;
        const spiralVx = Math.cos(angle) * speed * 0.8;
        const spiralVy = Math.sin(angle) * speed * 0.8;
        const projectile = createBossProjectile(enemy.pos.x - 60, enemy.pos.y, spiralVx, spiralVy, 'advanced');
        addEntity(world, projectile);
      }
    }
  }
}

// Phase 1: Corrosive Growth
function updateBioOvermindPhase1(enemy, player, dt, world, bus) {
  const behavior = enemy.behavior;
  
  // Spawn/regenerate tendrils
  behavior.tendrilRegenTimer += dt;
  if (behavior.tendrilRegenTimer >= behavior.tendrilRegenRate && behavior.tendrils.length < 4) {
    spawnBioTendril(enemy, world);
    behavior.tendrilRegenTimer = 0;
  }
  
  // Corrosive projectile attacks
  behavior.corrosiveTimer += dt;
  if (behavior.corrosiveTimer >= behavior.corrosiveFireRate) {
    fireCorrosiveProjectiles(enemy, player, world, bus);
    behavior.corrosiveTimer = 0;
  }
}

// Phase 2: Swarm Release
function updateBioOvermindPhase2(enemy, player, dt, world, bus) {
  const behavior = enemy.behavior;
  
  // Release swarms of fast enemies
  behavior.swarmTimer += dt;
  if (behavior.swarmTimer >= behavior.swarmRate) {
    releaseSwarmUnits(enemy, world, bus);
    behavior.swarmTimer = 0;
  }
  
  // Sweeping laser attacks
  behavior.laserSweepTimer += dt;
  if (behavior.laserSweepTimer >= behavior.laserSweepRate) {
    fireSweepingLaser(enemy, player, world, bus);
    behavior.laserSweepTimer = 0;
    behavior.laserAngle = 0;
  }
  
  // Update laser sweep angle
  if (behavior.laserSweepTimer < 2.0) {
    behavior.laserAngle += dt * Math.PI;
  }
}

// Phase 3: Desperation Pulse
function updateBioOvermindPhase3(enemy, player, dt, world, bus) {
  const behavior = enemy.behavior;
  
  // Violent contraction/expansion cycle
  behavior.contractTimer += dt;
  if (behavior.contractTimer >= behavior.contractRate) {
    behavior.pulsing = !behavior.pulsing;
    behavior.contractTimer = 0;
    
    if (behavior.pulsing) {
      // Start pulse charge
      behavior.pulseTimer = 0;
      behavior.pulseExpansion = 0;
    }
  }
  
  if (behavior.pulsing) {
    behavior.pulseTimer += dt;
    behavior.pulseExpansion = Math.min(1, behavior.pulseTimer / behavior.pulseChargeTime);
    
    // Visual effects - boss grows and glows
    enemy.radius = 80 + behavior.pulseExpansion * 40;
    
    if (behavior.pulseTimer >= behavior.pulseChargeTime) {
      // Release corrosive pulse
      releaseCorrosivePulse(enemy, world, bus);
      behavior.pulsing = false;
      behavior.pulseExpansion = 0;
      enemy.radius = 80;
    }
  }
}

// Sentinel Prime Final Boss AI (Level 10) - Simplified hovering behavior
function updateSentinelPrimeBehavior(enemy, player, dt, world, bus) {
  const behavior = enemy.behavior;
  const canvas = world.canvas;
  
  // Initialize center position if not set
  if (behavior.hoverCenterX === 0) {
    behavior.hoverCenterX = canvas.width * 0.65; // Position towards right side
    behavior.hoverCenterY = canvas.height / 2;
  }
  
  // Move to center position initially
  if (behavior.moveToCenter) {
    const dx = behavior.hoverCenterX - enemy.pos.x;
    const dy = behavior.hoverCenterY - enemy.pos.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance > 60) {
      // Move towards center
      enemy.vel.x = (dx / distance) * behavior.moveSpeed;
      enemy.vel.y = (dy / distance) * behavior.moveSpeed;
    } else {
      // Reached center, start hovering
      behavior.moveToCenter = false;
      enemy.vel.x = 0;
      enemy.vel.y = 0;
    }
  } else {
    // Hover around center in circular pattern (slower than level 5 boss)
    behavior.hoverAngle += behavior.hoverSpeed * dt;
    
    const targetX = behavior.hoverCenterX + Math.cos(behavior.hoverAngle) * behavior.hoverRadius;
    const targetY = behavior.hoverCenterY + Math.sin(behavior.hoverAngle) * behavior.hoverRadius * 0.3; // More horizontal ellipse
    
    // Smooth movement towards hover position
    const dx = targetX - enemy.pos.x;
    const dy = targetY - enemy.pos.y;
    
    enemy.vel.x = dx * 1.5; // Slightly slower movement than level 5 boss
    enemy.vel.y = dy * 1.5;
  }
  
  // Attack pattern (slightly faster than level 5)
  behavior.attackTimer += dt;
  if (behavior.attackTimer >= behavior.attackRate) {
    // Fire more intense projectiles at player
    fireAdvancedBossProjectile(enemy, player, world, bus, behavior.attackType);
    behavior.attackTimer = 0;
    behavior.attackType = (behavior.attackType + 1) % 4; // Cycle through 4 attack types
  }
}

// Phase 1: Armored Barrage
function updateSentinelPhase1(enemy, player, dt, world, bus) {
  const behavior = enemy.behavior;
  
  // Fire from active weapon emplacements
  behavior.weaponEmplacements.forEach(weapon => {
    if (!weapon.destroyed) {
      switch (weapon.type) {
        case 'missile':
          behavior.starfallTimer += dt;
          if (behavior.starfallTimer >= behavior.starfallRate) {
            fireStarfallMunitions(enemy, weapon, player, world, bus);
            behavior.starfallTimer = 0;
          }
          break;
        case 'particle':
          behavior.particleTimer += dt;
          if (behavior.particleTimer >= behavior.particleRate) {
            fireParticleAnnihilator(enemy, weapon, player, world, bus);
            behavior.particleTimer = 0;
          }
          break;
        case 'cannon':
          behavior.cannonTimer += dt;
          if (behavior.cannonTimer >= behavior.cannonRate) {
            fireHeavyCannon(enemy, weapon, player, world, bus);
            behavior.cannonTimer = 0;
          }
          break;
      }
    }
  });
}

// Phase 2: Core Exposure & Defense
function updateSentinelPhase2(enemy, player, dt, world, bus) {
  const behavior = enemy.behavior;
  
  // Frontal deflector shield
  behavior.deflectorTimer += dt;
  if (behavior.deflectorTimer >= behavior.deflectorRate) {
    behavior.deflectorActive = !behavior.deflectorActive;
    behavior.deflectorTimer = 0;
  }
  
  // Spawn phantom drones
  behavior.droneSpawnTimer += dt;
  if (behavior.droneSpawnTimer >= behavior.droneSpawnRate && behavior.phantomDrones.length < 3) {
    spawnPhantomDrone(enemy, world);
    behavior.droneSpawnTimer = 0;
  }
  
  // Core vulnerability window
  enemy.coreVulnerable = !behavior.deflectorActive;
}

// Phase 3: Overload Protocol
function updateSentinelPhase3(enemy, player, dt, world, bus) {
  const behavior = enemy.behavior;
  
  // Regenerating barriers
  behavior.barrierTimer += dt;
  if (behavior.barrierTimer >= behavior.barrierRate / (1 + behavior.desperationLevel)) {
    behavior.barrierActive = !behavior.barrierActive;
    behavior.barrierTimer = 0;
  }
  
  // Desperate attacks - all weapons fire faster
  const speedMultiplier = 1 + behavior.desperationLevel * 0.5;
  
  behavior.starfallTimer += dt * speedMultiplier;
  if (behavior.starfallTimer >= behavior.starfallRate) {
    fireDesperateBarrage(enemy, player, world, bus);
    behavior.starfallTimer = 0;
  }
  
  // Screen-wide bullet patterns
  if (behavior.phaseTimer % 3 < dt) {
    fireOverloadPattern(enemy, world, bus);
  }
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

// Bio-Mechanical Overmind weapon functions
function spawnBioTendril(boss, world) {
  const angles = [Math.PI * 0.25, Math.PI * 0.75, Math.PI * 1.25, Math.PI * 1.75];
  const tendrilIndex = boss.behavior.tendrils.length;
  
  if (tendrilIndex < 4) {
    const angle = angles[tendrilIndex];
    const distance = 100;
    const x = boss.pos.x + Math.cos(angle) * distance;
    const y = boss.pos.y + Math.sin(angle) * distance;
    
    const tendril = createBioTendril(x, y, boss.id);
    addEntity(world, tendril);
    boss.behavior.tendrils.push(tendril.id);
    
    console.log('[BOSS] Bio-Mechanical Overmind spawned tendril');
  }
}

function fireCorrosiveProjectiles(boss, player, world, bus) {
  const numProjectiles = 3;
  const spread = Math.PI / 3;
  const baseAngle = Math.atan2(player.pos.y - boss.pos.y, player.pos.x - boss.pos.x);
  
  for (let i = 0; i < numProjectiles; i++) {
    const angle = baseAngle + (i - 1) * spread / 2;
    const speed = 150;
    
    const projectile = {
      tags: ['enemy-bullet', 'corrosive'],
      pos: { x: boss.pos.x, y: boss.pos.y },
      vel: { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed },
      rect: { w: 12, h: 12 },
      color: '#8B4513',
      damage: 2,
      lifetime: 4.0,
      timer: 0,
      corrosive: true
    };
    
    addEntity(world, projectile);
  }
  
  if (bus && typeof bus.emit === 'function') {
    bus.emit('sfx:corrosive-shot', { x: boss.pos.x, y: boss.pos.y });
  }
}

function releaseSwarmUnits(boss, world, bus) {
  const numSwarmers = 2 + Math.floor(Math.random() * 3);
  
  for (let i = 0; i < numSwarmers; i++) {
    const angle = (Math.PI * 2 * i) / numSwarmers;
    const distance = 80;
    const x = boss.pos.x + Math.cos(angle) * distance;
    const y = boss.pos.y + Math.sin(angle) * distance;
    
    const swarmer = {
      tags: ['enemy', 'swarmer'],
      pos: { x, y },
      vel: { x: -300 + Math.random() * 100, y: (Math.random() - 0.5) * 200 },
      radius: 8,
      color: '#FF4500',
      type: 'swarmer',
      behavior: {
        aggressive: true,
        speed: 350,
        lifetime: 8.0,
        timer: 0
      },
      health: 1,
      scoreValue: 75
    };
    
    addEntity(world, swarmer);
  }
  
  console.log(`[BOSS] Bio-Mechanical Overmind released ${numSwarmers} swarm units`);
}

function fireSweepingLaser(boss, player, world, bus) {
  const laserLength = 600;
  const numSegments = 12;
  
  for (let i = 0; i < numSegments; i++) {
    const segmentLength = laserLength / numSegments;
    const x = boss.pos.x + Math.cos(boss.behavior.laserAngle) * segmentLength * i;
    const y = boss.pos.y + Math.sin(boss.behavior.laserAngle) * segmentLength * i;
    
    const laserSegment = {
      tags: ['enemy-bullet', 'laser-sweep'],
      pos: { x, y },
      vel: { x: 0, y: 0 },
      rect: { w: 8, h: 20 },
      color: '#FF0000',
      damage: 3,
      lifetime: 0.5,
      timer: 0,
      piercing: true
    };
    
    addEntity(world, laserSegment);
  }
  
  if (bus && typeof bus.emit === 'function') {
    bus.emit('sfx:laser-sweep', { x: boss.pos.x, y: boss.pos.y });
  }
}

function releaseCorrosivePulse(boss, world, bus) {
  const pulseRadius = 200;
  const numWaves = 3;
  
  for (let wave = 0; wave < numWaves; wave++) {
    const waveRadius = pulseRadius * (wave + 1) / numWaves;
    const numProjectiles = 16 + wave * 8;
    
    for (let i = 0; i < numProjectiles; i++) {
      const angle = (Math.PI * 2 * i) / numProjectiles;
      const speed = 100 + wave * 50;
      
      const pulse = {
        tags: ['enemy-bullet', 'corrosive-pulse'],
        pos: { x: boss.pos.x, y: boss.pos.y },
        vel: { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed },
        rect: { w: 10, h: 10 },
        color: '#8B0000',
        damage: 4,
        lifetime: 3.0,
        timer: 0,
        destroysProjectiles: true
      };
      
      addEntity(world, pulse);
    }
  }
  
  if (bus && typeof bus.emit === 'function') {
    bus.emit('sfx:corrosive-pulse', { x: boss.pos.x, y: boss.pos.y });
    bus.emit('screen:shake', { intensity: 20 });
  }
  
  console.log('[BOSS] Bio-Mechanical Overmind released corrosive pulse!');
}

// Sentinel Prime weapon functions
function fireStarfallMunitions(boss, weapon, player, world, bus) {
  const numMissiles = 3;
  const weaponX = boss.pos.x + weapon.pos.x;
  const weaponY = boss.pos.y + weapon.pos.y;
  
  for (let i = 0; i < numMissiles; i++) {
    const targetX = player.pos.x + (Math.random() - 0.5) * 100;
    const targetY = player.pos.y + (Math.random() - 0.5) * 100;
    
    const missile = {
      tags: ['enemy-bullet', 'starfall-missile'],
      pos: { x: weaponX, y: weaponY },
      vel: { x: 0, y: 0 },
      rect: { w: 8, h: 16 },
      color: '#FFA500',
      damage: 3,
      lifetime: 5.0,
      timer: 0,
      behavior: {
        target: { x: targetX, y: targetY },
        speed: 200,
        homing: true,
        armTime: 0.5
      }
    };
    
    addEntity(world, missile);
  }
  
  if (bus && typeof bus.emit === 'function') {
    bus.emit('sfx:missile-launch', { x: weaponX, y: weaponY });
  }
}

function fireParticleAnnihilator(boss, weapon, player, world, bus) {
  const weaponX = boss.pos.x + weapon.pos.x;
  const weaponY = boss.pos.y + weapon.pos.y;
  const beamLength = 800;
  const numSegments = 20;
  
  const angle = Math.atan2(player.pos.y - weaponY, player.pos.x - weaponX);
  
  for (let i = 0; i < numSegments; i++) {
    const segmentLength = beamLength / numSegments;
    const x = weaponX + Math.cos(angle) * segmentLength * i;
    const y = weaponY + Math.sin(angle) * segmentLength * i;
    
    const beamSegment = {
      tags: ['enemy-bullet', 'particle-beam'],
      pos: { x, y },
      vel: { x: 0, y: 0 },
      rect: { w: 12, h: 6 },
      color: '#00FFFF',
      damage: 4,
      lifetime: 1.0,
      timer: 0,
      piercing: true
    };
    
    addEntity(world, beamSegment);
  }
  
  if (bus && typeof bus.emit === 'function') {
    bus.emit('sfx:particle-beam', { x: weaponX, y: weaponY });
  }
}

function fireHeavyCannon(boss, weapon, player, world, bus) {
  const weaponX = boss.pos.x + weapon.pos.x;
  const weaponY = boss.pos.y + weapon.pos.y;
  const numShells = 2;
  
  for (let i = 0; i < numShells; i++) {
    const angle = Math.atan2(player.pos.y - weaponY, player.pos.x - weaponX) + (i - 0.5) * 0.2;
    const speed = 250;
    
    const shell = {
      tags: ['enemy-bullet', 'heavy-shell'],
      pos: { x: weaponX, y: weaponY },
      vel: { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed },
      rect: { w: 16, h: 8 },
      color: '#FFD700',
      damage: 5,
      lifetime: 4.0,
      timer: 0,
      explosive: true,
      explosionRadius: 40
    };
    
    addEntity(world, shell);
  }
  
  if (bus && typeof bus.emit === 'function') {
    bus.emit('sfx:heavy-cannon', { x: weaponX, y: weaponY });
  }
}

function spawnPhantomDrone(boss, world) {
  const angle = Math.random() * Math.PI * 2;
  const distance = 150;
  const x = boss.pos.x + Math.cos(angle) * distance;
  const y = boss.pos.y + Math.sin(angle) * distance;
  
  const drone = createPhantomDrone(x, y, boss.id);
  addEntity(world, drone);
  boss.behavior.phantomDrones.push(drone.id);
  
  console.log('[BOSS] Sentinel Prime spawned phantom drone');
}

function fireDesperateBarrage(boss, player, world, bus) {
  const numProjectiles = 8;
  const spread = Math.PI * 2;
  
  for (let i = 0; i < numProjectiles; i++) {
    const angle = (spread * i) / numProjectiles;
    const speed = 180;
    
    const projectile = {
      tags: ['enemy-bullet', 'desperate-shot'],
      pos: { x: boss.pos.x, y: boss.pos.y },
      vel: { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed },
      rect: { w: 12, h: 12 },
      color: '#FF6600',
      damage: 3,
      lifetime: 5.0,
      timer: 0
    };
    
    addEntity(world, projectile);
  }
}

function fireOverloadPattern(boss, world, bus) {
  const patterns = [
    // Spiral pattern
    () => {
      const numSpirals = 4;
      const projectilesPerSpiral = 8;
      
      for (let spiral = 0; spiral < numSpirals; spiral++) {
        for (let i = 0; i < projectilesPerSpiral; i++) {
          const angle = (Math.PI * 2 * i) / projectilesPerSpiral + spiral * Math.PI / 2;
          const speed = 120;
          
          const projectile = {
            tags: ['enemy-bullet', 'overload-spiral'],
            pos: { x: boss.pos.x, y: boss.pos.y },
            vel: { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed },
            rect: { w: 8, h: 8 },
            color: '#FF0080',
            damage: 2,
            lifetime: 6.0,
            timer: 0
          };
          
          addEntity(world, projectile);
        }
      }
    },
    // Wave pattern
    () => {
      const numWaves = 3;
      const projectilesPerWave = 12;
      
      for (let wave = 0; wave < numWaves; wave++) {
        for (let i = 0; i < projectilesPerWave; i++) {
          const angle = Math.PI + (Math.PI * i) / projectilesPerWave;
          const speed = 100 + wave * 30;
          
          const projectile = {
            tags: ['enemy-bullet', 'overload-wave'],
            pos: { x: boss.pos.x, y: boss.pos.y },
            vel: { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed },
            rect: { w: 10, h: 10 },
            color: '#8000FF',
            damage: 2,
            lifetime: 5.0,
            timer: 0
          };
          
          addEntity(world, projectile);
        }
      }
    }
  ];
  
  // Randomly select a pattern
  const pattern = patterns[Math.floor(Math.random() * patterns.length)];
  pattern();
  
  if (bus && typeof bus.emit === 'function') {
    bus.emit('sfx:overload-pattern', { x: boss.pos.x, y: boss.pos.y });
  }
}

// Bio-Tendril behavior
function updateBioTendrilBehavior(enemy, player, dt, world, bus) {
  const behavior = enemy.behavior;
  
  // Regeneration check
  if (behavior.regenerating) {
    enemy.health = Math.min(enemy.maxHealth, enemy.health + dt * 10);
    if (enemy.health >= enemy.maxHealth) {
      behavior.regenerating = false;
      enemy.color = '#654321';
    }
  }
  
  // Wave motion
  const waveMotion = Math.sin(Date.now() * 0.003 + behavior.waveOffset) * 20;
  enemy.pos.y += waveMotion * dt;
  
  // Fire corrosive projectiles
  behavior.fireTimer += dt;
  if (behavior.fireTimer >= behavior.fireRate) {
    fireTendrilProjectile(enemy, player, world, bus);
    behavior.fireTimer = 0;
  }
}

function fireTendrilProjectile(tendril, player, world, bus) {
  const dx = player.pos.x - tendril.pos.x;
  const dy = player.pos.y - tendril.pos.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  
  if (distance > 0) {
    const speed = 120;
    const projectile = {
      tags: ['enemy-bullet', 'tendril-shot'],
      pos: { x: tendril.pos.x, y: tendril.pos.y },
      vel: { x: (dx / distance) * speed, y: (dy / distance) * speed },
      rect: { w: 8, h: 8 },
      color: '#8B4513',
      damage: 1,
      lifetime: 4.0,
      timer: 0,
      corrosive: true
    };
    
    addEntity(world, projectile);
  }
}

// Phantom Drone behavior
function updatePhantomDroneBehavior(enemy, player, dt, world, bus) {
  const behavior = enemy.behavior;
  
  // Find parent boss
  const parent = Array.from(world.entities.values()).find(e => e.id === behavior.parentId);
  if (!parent) {
    markForRemoval(world, enemy.id);
    return;
  }
  
  // Orbit around parent
  behavior.orbitAngle += behavior.orbitSpeed * dt;
  const orbitX = parent.pos.x + Math.cos(behavior.orbitAngle) * behavior.orbitRadius;
  const orbitY = parent.pos.y + Math.sin(behavior.orbitAngle) * behavior.orbitRadius;
  
  // Smooth movement to orbit position
  const dx = orbitX - enemy.pos.x;
  const dy = orbitY - enemy.pos.y;
  enemy.vel.x = dx * 2;
  enemy.vel.y = dy * 2;
  
  // Mimic parent attacks
  behavior.mimicTimer += dt;
  if (behavior.mimicTimer >= behavior.mimicRate) {
    mimicParentAttack(enemy, parent, player, world, bus);
    behavior.mimicTimer = 0;
  }
}

function mimicParentAttack(drone, parent, player, world, bus) {
  // Fire a weaker version of parent's attacks
  const angle = Math.atan2(player.pos.y - drone.pos.y, player.pos.x - drone.pos.x);
  const speed = 150;
  
  const projectile = {
    tags: ['enemy-bullet', 'mimic-shot'],
    pos: { x: drone.pos.x, y: drone.pos.y },
    vel: { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed },
    rect: { w: 6, h: 6 },
    color: '#4169E1',
    damage: 2,
    lifetime: 3.0,
    timer: 0
  };
  
  addEntity(world, projectile);
}

// Swarmer behavior (spawned by Bio-Mechanical Overmind)
function updateSwarmerBehavior(enemy, player, dt, world) {
  const behavior = enemy.behavior;
  
  // Update lifetime
  behavior.timer += dt;
  if (behavior.timer >= behavior.lifetime) {
    markForRemoval(world, enemy.id);
    return;
  }
  
  // Aggressive homing toward player
  const dx = player.pos.x - enemy.pos.x;
  const dy = player.pos.y - enemy.pos.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  
  if (distance > 0) {
    const homingForce = behavior.speed;
    enemy.vel.x = (dx / distance) * homingForce;
    enemy.vel.y = (dy / distance) * homingForce;
  }
  
  // Add erratic movement for unpredictability
  enemy.vel.x += (Math.random() - 0.5) * 50;
  enemy.vel.y += (Math.random() - 0.5) * 50;
  
  // Speed limits
  const maxSpeed = behavior.speed;
  const speed = Math.sqrt(enemy.vel.x * enemy.vel.x + enemy.vel.y * enemy.vel.y);
  if (speed > maxSpeed) {
    enemy.vel.x = (enemy.vel.x / speed) * maxSpeed;
    enemy.vel.y = (enemy.vel.y / speed) * maxSpeed;
  }
  
  // Visual effect - pulsing color to show aggression
  const pulse = Math.sin(behavior.timer * 10) * 0.3 + 0.7;
  enemy.color = `hsl(15, 100%, ${Math.floor(pulse * 60)}%)`;
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
    
    // Special behavior for homing missiles
    if (bullet.behavior && bullet.behavior.homing && bullet.timer > bullet.behavior.armTime) {
      const dx = bullet.behavior.target.x - bullet.pos.x;
      const dy = bullet.behavior.target.y - bullet.pos.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance > 10) {
        bullet.vel.x = (dx / distance) * bullet.behavior.speed;
        bullet.vel.y = (dy / distance) * bullet.behavior.speed;
      }
    }
    
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
