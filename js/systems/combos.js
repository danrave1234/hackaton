// Combo Effects System - Handles special abilities when multiple card types are maxed
import { upgradeManager, COMBO_EFFECTS } from './upgrades.js';
import { markForRemoval, addEntity } from '../world/world.js';

export function ComboSystem(dt, world, bus) {
  const effects = upgradeManager.getAllEffects();
  const activeCombo = upgradeManager.activeCombo;
  
  if (!activeCombo) return;
  
  const players = [];
  const enemies = [];
  const drones = [];
  
  // Collect entities
  for (const e of world.entities.values()) {
    if ((e.tags||[]).includes('player')) players.push(e);
    if ((e.tags||[]).includes('enemy')) enemies.push(e);
    if ((e.tags||[]).includes('drone')) drones.push(e);
  }
  
  for (const player of players) {
    // Initialize combo state
    if (!player.combo) {
      player.combo = {
        rammingActive: false,
        rammingTimer: 0,
        satelliteCannonActive: false,
        orbitalDefenseActive: false
      };
    }
    
    const keys = window.PlayerKeys || new Set();
    
    // 1. RAMMING PROTOCOL (Offensive + Defensive)
    if (activeCombo === 'offensiveDefensive' && effects.rammingMode) {
      // Init ramming cooldown state
      if (player.combo.rammingCooldown === undefined) player.combo.rammingCooldown = 0;
      player.combo.rammingCooldown = Math.max(0, player.combo.rammingCooldown - dt);

      // Activate with R key if off cooldown
      if ((keys.has('r') || keys.has('R')) && !player.combo.rammingActive && player.combo.rammingCooldown <= 0 && player.shield && player.shield.hits > 0) {
        player.combo.rammingActive = true;
        player.combo.rammingTimer = effects.rammingDuration || 3;
        player.combo.rammingCooldown = (effects.rammingCooldown || 10);
        
        // Consume all shield hits
        player.shield.hits = 0;
        
        console.log('[COMBO] Ramming Protocol activated!');
        
        if (bus && typeof bus.emit === 'function') {
          bus.emit('sfx:power_up'); // Could add ramming sound
        }
      }
      
      // Handle ramming mode
      if (player.combo.rammingActive) {
        player.combo.rammingTimer -= dt;
        
        // Check ramming collisions with enemies
        for (const enemy of enemies) {
          if (enemy.controlled) continue; // Don't ram controlled enemies
          
          const dx = player.pos.x - enemy.pos.x;
          const dy = player.pos.y - enemy.pos.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          const collisionDistance = (player.size?.w || 36) / 2 + enemy.radius;
          
          if (distance <= collisionDistance) {
            // Destroy enemy without taking damage
            markForRemoval(world, enemy.id);
            bus.emit('score:add', 500); // Bonus score for ramming
            bus.emit('enemy:died');
            
            if (bus && typeof bus.emit === 'function') {
              bus.emit('sfx:explosion', { x: enemy.pos.x, y: enemy.pos.y });
            }
          }
        }
        
        // End ramming mode
        if (player.combo.rammingTimer <= 0) {
          player.combo.rammingActive = false;
          console.log('[COMBO] Ramming Protocol ended');
        }
      }
    }
    
    // 2. SATELLITE CANNON (Support + Offensive)
    if (activeCombo === 'supportOffensive' && effects.satelliteCannon) {
      if (!player.combo.satelliteCannonActive) {
        // Fuse drones into satellite cannon
        const aliveDrones = drones.filter(d => d.playerId === player.id && d.isAlive);
        if (aliveDrones.length > 0) {
          player.combo.satelliteCannonActive = true;
          
          // Remove drones and create satellite cannon
          aliveDrones.forEach(drone => markForRemoval(world, drone.id));
          
          // Create satellite cannon entity
          const satelliteCannon = {
            tags: ['satellite-cannon'],
            pos: { x: player.pos.x - 60, y: player.pos.y },
            vel: { x: 0, y: 0 },
            radius: 20,
            color: '#FFD700',
            playerId: player.id,
            chargeTime: 0,
            maxChargeTime: 2,
            cooldown: 0
          };
          
          addEntity(world, satelliteCannon);
          console.log('[COMBO] Satellite Cannon deployed!');
        }
      }
    }
    
    // 3. ORBITAL DEFENSE (Support + Defensive)
    if (activeCombo === 'supportDefensive' && effects.orbitalDefense) {
      if (!player.combo.orbitalDefenseActive) {
        // Convert drones to orbital defense mode
        const aliveDrones = drones.filter(d => d.playerId === player.id && d.isAlive);
        if (aliveDrones.length > 0) {
          player.combo.orbitalDefenseActive = true;
          
          // Modify drones for orbital defense
          aliveDrones.forEach((drone, index) => {
            drone.orbitalDefense = true;
            drone.orbitSpeed = 3;
            drone.orbitRadius = 40;
            drone.orbitAngle = (index / aliveDrones.length) * Math.PI * 2;
            drone.hits = drone.maxHits; // Restore to full health
            drone.color = '#4ECDC4'; // Change color to match shield
          });
          
          console.log('[COMBO] Orbital Defense activated!');
        }
      }
    }
  }
  
  // Handle satellite cannon behavior
  const satelliteCannons = [];
  for (const e of world.entities.values()) {
    if ((e.tags||[]).includes('satellite-cannon')) {
      satelliteCannons.push(e);
    }
  }
  
  for (const cannon of satelliteCannons) {
    const owner = players.find(p => p.id === cannon.playerId);
    if (!owner) {
      markForRemoval(world, cannon.id);
      continue;
    }
    
    // Follow player
    cannon.pos.x = owner.pos.x - 60;
    cannon.pos.y = owner.pos.y;
    
    // Update timers
    cannon.cooldown = Math.max(0, cannon.cooldown - dt);
    
    // Auto-fire mega beam when giant laser fires
    if (owner.giantLaserTimer !== undefined && owner.giantLaserTimer <= 0.1 && cannon.cooldown <= 0) {
      cannon.cooldown = 5; // Same as giant laser cooldown
      
      // Fire satellite mega beam
      const megaBeam = {
        tags: ['bullet', 'mega-beam'],
        pos: { x: cannon.pos.x + 20, y: cannon.pos.y },
        vel: { x: 800, y: 0 },
        rect: { w: 60, h: 12 },
        damage: 500,
        color: '#FFD700'
      };
      
      addEntity(world, megaBeam);
      console.log('[COMBO] Satellite Cannon fired mega beam!');
      
      if (bus && typeof bus.emit === 'function') {
        bus.emit('sfx:laser');
      }
    }
  }
  
  // Handle orbital defense drones
  for (const drone of drones) {
    if (drone.orbitalDefense) {
      const owner = players.find(p => p.id === drone.playerId);
      if (!owner) continue;
      
      // Faster orbit for defense
      drone.orbitAngle += dt * drone.orbitSpeed;
      drone.pos.x = owner.pos.x + Math.cos(drone.orbitAngle) * drone.orbitRadius - 20;
      drone.pos.y = owner.pos.y + Math.sin(drone.orbitAngle) * drone.orbitRadius;
      
      // Enhanced ramming damage
      for (const enemy of enemies) {
        if (enemy.controlled) continue;
        
        const dx = drone.pos.x - enemy.pos.x;
        const dy = drone.pos.y - enemy.pos.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance <= drone.radius + enemy.radius) {
          // Destroy enemy without losing drone health
          markForRemoval(world, enemy.id);
          bus.emit('score:add', 200);
          bus.emit('enemy:died');
          
          if (bus && typeof bus.emit === 'function') {
            bus.emit('sfx:explosion', { x: enemy.pos.x, y: enemy.pos.y });
          }
        }
      }
    }
  }
}
