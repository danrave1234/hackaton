import { markForRemoval } from '../world/world.js';
import { spawnExplosion } from './explosion.js';
import { upgradeManager } from './upgrades.js';

export function CollisionSystem(dt, world, bus) {
  const bullets = [];
  const enemies = [];
  const players = [];
  const enemyBullets = [];
  
  for (const e of world.entities.values()) {
    if ((e.tags||[]).includes('bullet')) bullets.push(e);
    if ((e.tags||[]).includes('enemy')) enemies.push(e);
    if ((e.tags||[]).includes('player')) players.push(e);
    if ((e.tags||[]).includes('enemy-bullet')) enemyBullets.push(e);
  }

  // Update player shield timers first
  for (const p of players) {
    if (p.shield && p.shield.invulnerable) {
      p.shield.invulnerableTimer -= dt;
      if (p.shield.invulnerableTimer <= 0) {
        p.shield.invulnerable = false;
      }
    }
  }

  // Bullet-Enemy collisions
  for (const b of bullets) {
    for (const e of enemies) {
      const bx2 = b.pos.x + b.rect.w;
      const by2 = b.pos.y + b.rect.h / 2;
      const bx1 = b.pos.x;
      const by1 = b.pos.y - b.rect.h / 2;
      const dx = Math.max(e.pos.x - e.radius, Math.min(bx2, e.pos.x + e.radius));
      const dy = Math.max(e.pos.y - e.radius, Math.min(by2, e.pos.y + e.radius));
      const inside = dx >= bx1 && dx <= bx2 && dy >= by1 && dy <= by2;
      if (inside) {
        // Check if it's a giant laser or mega beam (doesn't get destroyed)
        const isGiantLaser = (b.tags||[]).includes('giant-laser');
        const isMegaBeam = (b.tags||[]).includes('mega-beam');
        const isPiercing = isGiantLaser || isMegaBeam;

        if (!isPiercing) {
          markForRemoval(world, b.id);
        }

        // Handle enemy health/damage
        let enemyDestroyed = false;
        if (e.health && e.health > 1) {
          e.health--;
          // Visual feedback for damaged enemy
          const originalColor = e.color;
          e.color = '#ffffff';
          setTimeout(() => { e.color = originalColor; }, 100);
          console.log(`[COLLISION] Enemy damaged! Health: ${e.health}`);
        } else {
          enemyDestroyed = true;
        }

        if (enemyDestroyed) {
          markForRemoval(world, e.id);

          // Special bullets give more score, enemy type affects score
          let scoreValue = e.scoreValue || 100;
          if (e.type === 'fabricator') scoreValue = 500;
          else if (e.type === 'geo-lancer') scoreValue = 300;
          else if (e.type === 'hunter-seeker') scoreValue = 200;
          else if (e.type === 'asteroid') scoreValue = 150;
          else if (e.type === 'minion') scoreValue = 50;
          
          if (isGiantLaser) scoreValue *= 3;
          if (isMegaBeam) scoreValue *= 5;
          
          bus.emit('score:add', scoreValue);
          bus.emit('enemy:died'); // Emit event for level progression
          if (bus && typeof bus.emit === 'function') bus.emit('sfx:explosion', { x: e.pos.x, y: e.pos.y });
        }

        if (!isPiercing) break; // Piercing weapons continue through enemies
      }
    }
  }

  // Player bullets - Enemy bullets collisions (for destructible enemy bullets)
  for (const b of bullets) {
    for (const eb of enemyBullets) {
      if (!eb.destructible) continue; // Only destructible enemy bullets can be shot down
      
      const bx = b.pos.x;
      const by = b.pos.y;
      const bw = b.rect?.w || 8;
      const bh = b.rect?.h || 8;
      
      const ebx = eb.pos.x;
      const eby = eb.pos.y;
      const ebw = eb.rect?.w || 8;
      const ebh = eb.rect?.h || 8;
      
      if (bx < ebx + ebw && bx + bw > ebx && by < eby + ebh && by + bh > eby) {
        // Check if it's a giant laser or mega beam (doesn't get destroyed)
        const isGiantLaser = (b.tags||[]).includes('giant-laser');
        const isMegaBeam = (b.tags||[]).includes('mega-beam');
        const isPiercing = isGiantLaser || isMegaBeam;

        if (!isPiercing) {
          markForRemoval(world, b.id);
        }
        
        // Damage the enemy bullet
        eb.health = (eb.health || 1) - 1;
        if (eb.health <= 0) {
          markForRemoval(world, eb.id);
          bus.emit('score:add', 25); // Small score for shooting down enemy bullets
          if (bus && typeof bus.emit === 'function') {
            bus.emit('sfx:explosion', { x: eb.pos.x, y: eb.pos.y });
          }
        }
        
        if (!isPiercing) break;
      }
    }
  }

  // Enemy bullets - Player collisions
  for (const eb of enemyBullets) {
    for (const p of players) {
      const px = p.pos.x;
      const py = p.pos.y;
      const pw = p.size?.w || 36;
      const ph = p.size?.h || 18;
      
      // Check collision between enemy bullet and player rectangle
      const bx = eb.pos.x;
      const by = eb.pos.y;
      const bw = eb.rect?.w || 8;
      const bh = eb.rect?.h || 8;
      
      if (bx < px + pw && bx + bw > px && by < py + ph && by + bh > py) {
        markForRemoval(world, eb.id); // Remove the bullet
        
        // Apply damage to player
        const damage = eb.damage || 1;
        const playerDied = window.healthSystem?.damagePlayer?.(p, damage) || false;
        
        if (playerDied) {
          // Player death handling
          if (window.PlayerKeys) {
            window.PlayerKeys.clear();
          }
          
          const playerW = p.size?.w || 120;
          const playerH = p.size?.h || 60;
          const centerX = p.pos.x + (playerW * 0.15);
          const centerY = p.pos.y;
          
          spawnExplosion(world, centerX, centerY, Math.max(playerW * 0.8, playerH * 0.8), bus);
          markForRemoval(world, p.id);
          
          bus.emit('player:died', { x: p.pos.x, y: p.pos.y });
          console.log('[COLLISION] Player hit by enemy bullet! Game Over!');
        } else {
          console.log(`[COLLISION] Player hit by enemy bullet for ${damage} damage!`);
        }
        
        break; // Only hit one player per bullet
      }
    }
  }

  // Player-Enemy collisions
  for (const p of players) {
    for (const e of enemies) {
      const px = p.pos.x;
      const py = p.pos.y;
      const pw = p.size?.w || 36;
      const ph = p.size?.h || 18;
      
      // Check collision between player rectangle and enemy circle
      const dx = Math.max(e.pos.x - e.radius, Math.min(px + pw/2, e.pos.x + e.radius));
      const dy = Math.max(e.pos.y - e.radius, Math.min(py + ph/2, e.pos.y + e.radius));
      const distanceSquared = (dx - px - pw/2) * (dx - px - pw/2) + (dy - py - ph/2) * (dy - py - ph/2);
      
      if (distanceSquared < e.radius * e.radius) {
        // Get upgrade effects
        const effects = upgradeManager.getAllEffects();

        // Initialize shield system if not present
        if (p.shield === undefined) {
          p.shield = {
            hits: effects.shieldHits || 0,
            maxHits: effects.shieldHits || 0,
            invulnerable: false,
            invulnerableTimer: 0
          };
        }

        // Update shield with current upgrade level
        const newMaxHits = effects.shieldHits || 0;
        if (p.shield.maxHits < newMaxHits) {
          // Player upgraded shield - restore to full
          p.shield.hits = newMaxHits;
          p.shield.maxHits = newMaxHits;
        } else {
          p.shield.maxHits = newMaxHits;
          if (p.shield.hits > p.shield.maxHits) {
            p.shield.hits = p.shield.maxHits;
          }
        }


        // Skip damage if invulnerable
        if (p.shield.invulnerable) {
          markForRemoval(world, e.id); // Enemy still gets destroyed
          if (bus && typeof bus.emit === 'function') bus.emit('sfx:explosion', { x: e.pos.x, y: e.pos.y });
          continue;
        }

        // Handle shield absorption
        if (p.shield.hits > 0) {
          p.shield.hits--;
          markForRemoval(world, e.id);

          // Visual/audio feedback for shield hit
          if (bus && typeof bus.emit === 'function') {
            bus.emit('sfx:explosion', { x: e.pos.x, y: e.pos.y });
            // Could add shield hit sound here
          }

          console.log(`[COLLISION] Shield absorbed hit! Remaining: ${p.shield.hits}/${p.shield.maxHits}`);

          // Check if shield broken and has invulnerability effect
          if (p.shield.hits === 0 && effects.invulnerableOnBreak) {
            p.shield.invulnerable = true;
            p.shield.invulnerableTimer = effects.invulnerableDuration || 1;
            console.log('[COLLISION] Shield broken! Invulnerability activated!');
          }

          break;
        } else {
          // No shield - player dies
          bus.emit('player:died', { x: p.pos.x, y: p.pos.y });
          console.log('[COLLISION] Player hit enemy! Game Over!');
          break;
        }
        // Player hit by enemy - deal damage based on enemy size
        const damage = Math.floor(e.radius * 2); // Larger enemies deal more damage
        const playerDied = window.healthSystem?.damagePlayer?.(p, damage) || false;

        markForRemoval(world, e.id); // Remove the enemy that hit the player
        spawnExplosion(world, e.pos.x, e.pos.y, Math.max(40, e.radius * 2.5), bus);

        if (playerDied) {
          // Stop all player inputs immediately
          if (window.PlayerKeys) {
            window.PlayerKeys.clear();
          }

          // Calculate player visual center for explosion positioning
          const playerW = p.size?.w || 120;
          const playerH = p.size?.h || 60;
          // Default anchor is 0.35, 0.5 (from HTML config)
          const centerX = p.pos.x + (playerW * 0.15); // Move from 35% anchor to 50% center
          const centerY = p.pos.y; // Y is already centered (50% anchor)

          // Replace player with explosion at visual center (proportional to player size)
          spawnExplosion(world, centerX, centerY, Math.max(playerW * 0.8, playerH * 0.8), bus);
          markForRemoval(world, p.id);

          bus.emit('player:died', { x: p.pos.x, y: p.pos.y });
          console.log('[COLLISION] Player died! Game Over!');
        } else {
          console.log(`[COLLISION] Player took ${damage} damage!`);
        }
        break;
      }
    }
  }
  
  // Enemy Bullet-Player collisions
  for (const p of players) {
    for (const eb of enemyBullets) {
      const px = p.pos.x;
      const py = p.pos.y;
      const pw = p.size?.w || 36;
      const ph = p.size?.h || 18;
      
      // Check collision between player rectangle and enemy bullet
      let collision = false;
      
      if (eb.radius) {
        // Circular enemy bullet
        const dx = Math.max(eb.pos.x - eb.radius, Math.min(px + pw/2, eb.pos.x + eb.radius));
        const dy = Math.max(eb.pos.y - eb.radius, Math.min(py + ph/2, eb.pos.y + eb.radius));
        const distanceSquared = (dx - px - pw/2) * (dx - px - pw/2) + (dy - py - ph/2) * (dy - py - ph/2);
        collision = distanceSquared < eb.radius * eb.radius;
      } else {
        // Rectangular enemy bullet
        const ebx2 = eb.pos.x + (eb.rect?.w || 8);
        const eby2 = eb.pos.y + (eb.rect?.h || 8) / 2;
        const ebx1 = eb.pos.x;
        const eby1 = eb.pos.y - (eb.rect?.h || 8) / 2;
        collision = px < ebx2 && px + pw > ebx1 && py < eby2 && py + ph > eby1;
      }
      
      if (collision) {
        markForRemoval(world, eb.id); // Remove enemy bullet
        
        // Handle player damage
        const damage = eb.damage || 1;
        const playerDied = window.healthSystem?.damagePlayer?.(p, damage) || false;
        
        if (playerDied) {
          // Player died from enemy fire
          const playerW = p.size?.w || 120;
          const playerH = p.size?.h || 60;
          const centerX = p.pos.x + (playerW * 0.15);
          const centerY = p.pos.y;
          
          spawnExplosion(world, centerX, centerY, Math.max(playerW * 0.8, playerH * 0.8), bus);
          markForRemoval(world, p.id);
          bus.emit('player:died', { x: p.pos.x, y: p.pos.y });
          console.log('[COLLISION] Player killed by enemy fire!');
        } else {
          console.log(`[COLLISION] Player hit by enemy fire! Took ${damage} damage.`);
        }
        
        break;
      }
    }
  }
  
  // Player Bullet-Enemy Bullet collisions (shooting down enemy projectiles)
  for (const b of bullets) {
    for (const eb of enemyBullets) {
      if (!eb.destructible) continue; // Some enemy bullets can't be shot down
      
      const bx2 = b.pos.x + b.rect.w;
      const by2 = b.pos.y + b.rect.h / 2;
      const bx1 = b.pos.x;
      const by1 = b.pos.y - b.rect.h / 2;
      
      let collision = false;
      
      if (eb.radius) {
        // Circular enemy bullet
        const dx = Math.max(eb.pos.x - eb.radius, Math.min(bx2, eb.pos.x + eb.radius));
        const dy = Math.max(eb.pos.y - eb.radius, Math.min(by2, eb.pos.y + eb.radius));
        const inside = dx >= bx1 && dx <= bx2 && dy >= by1 && dy <= by2;
        collision = inside;
      } else {
        // Rectangular enemy bullet
        const ebx2 = eb.pos.x + (eb.rect?.w || 8);
        const eby2 = eb.pos.y + (eb.rect?.h || 8) / 2;
        const ebx1 = eb.pos.x;
        const eby1 = eb.pos.y - (eb.rect?.h || 8) / 2;
        collision = bx1 < ebx2 && bx2 > ebx1 && by1 < eby2 && by2 > eby1;
      }
      
      if (collision) {
        // Check if it's a giant laser or mega beam (doesn't get destroyed)
        const isGiantLaser = (b.tags||[]).includes('giant-laser');
        const isMegaBeam = (b.tags||[]).includes('mega-beam');
        const isPiercing = isGiantLaser || isMegaBeam;

        if (!isPiercing) {
          markForRemoval(world, b.id);
        }
        
        // Damage enemy bullet
        if (eb.health) {
          eb.health--;
          if (eb.health <= 0) {
            markForRemoval(world, eb.id);
            bus.emit('score:add', 25); // Bonus for shooting down enemy projectiles
            if (bus && typeof bus.emit === 'function') {
              bus.emit('sfx:explosion', { x: eb.pos.x, y: eb.pos.y });
            }
          }
        } else {
          markForRemoval(world, eb.id);
          bus.emit('score:add', 25);
          if (bus && typeof bus.emit === 'function') {
            bus.emit('sfx:explosion', { x: eb.pos.x, y: eb.pos.y });
          }
        }
        
        if (!isPiercing) break;
      }
    }
  }
  
  // Update Fabricator minion counts when minions are destroyed
  enemies.forEach(enemy => {
    if (enemy.type === 'fabricator' && enemy.behavior) {
      // Count current minions
      let currentMinions = 0;
      for (const e of world.entities.values()) {
        if ((e.tags||[]).includes('minion')) {
          currentMinions++;
        }
      }
      enemy.behavior.minionCount = currentMinions;
    }
  });
}