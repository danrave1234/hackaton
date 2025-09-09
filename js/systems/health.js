export function createHealthSystem() {
  const healthBar = document.getElementById('healthBar');
  const healthText = document.getElementById('healthText');
  const shieldBar = document.getElementById('shieldBar');
  const shieldText = document.getElementById('shieldText');
  const shieldContainer = document.getElementById('shieldContainer');

  function updateHealthBar(player) {
    if (!player || !player.health) return;

    const healthPercent = (player.health.current / player.health.max) * 100;
    const healthColor = healthPercent > 60 ? 'tw-bg-green-500' : 
                       healthPercent > 30 ? 'tw-bg-yellow-500' : 'tw-bg-red-500';
    
    const shadowClass = healthPercent > 60 ? 'tw-shadow-green-500/50' : 
                       healthPercent > 30 ? 'tw-shadow-yellow-500/50' : 'tw-shadow-red-500/50';
    
    if (healthBar) {
      healthBar.style.width = `${healthPercent}%`;
      healthBar.className = `tw-h-full tw-rounded-full tw-transition-all tw-duration-300 tw-shadow-sm ${healthColor} ${shadowClass}`;
    }
    
    if (healthText) {
      healthText.textContent = `${Math.ceil(player.health.current)}/${player.health.max}`;
      healthText.className = `tw-text-xs tw-font-mono tw-font-bold ${
        healthPercent > 60 ? 'tw-text-green-400' : 
        healthPercent > 30 ? 'tw-text-yellow-400' : 'tw-text-red-400'
      }`;
    }

    // Update ship status
    const statusElement = document.querySelector('[data-ship-status]');
    
    if (statusElement) {
      let status = 'OPERATIONAL';
      let statusClass = 'tw-text-green-400';
      
      if (healthPercent <= 25) {
        status = 'CRITICAL';
        statusClass = 'tw-text-red-400';
      } else if (healthPercent <= 50) {
        status = 'DAMAGED';
        statusClass = 'tw-text-yellow-400';
      }
      
      statusElement.textContent = status;
      statusElement.className = statusClass;
    }

    // Shield system
    if (player.shield && player.shield.max > 0) {
      const shieldPercent = (player.shield.current / player.shield.max) * 100;
      
      if (shieldContainer) {
        shieldContainer.classList.remove('tw-hidden');
      }
      
      if (shieldBar) {
        shieldBar.style.width = `${shieldPercent}%`;
      }
      
      if (shieldText) {
        shieldText.textContent = `${Math.ceil(player.shield.current)}/${player.shield.max}`;
      }
    } else {
      if (shieldContainer) {
        shieldContainer.classList.add('tw-hidden');
      }
    }
  }

  function damagePlayer(player, damage) {
    if (!player || !player.health) return false;

    // Shield absorbs damage first
    if (player.shield && player.shield.current > 0) {
      const shieldDamage = Math.min(damage, player.shield.current);
      player.shield.current -= shieldDamage;
      damage -= shieldDamage;
      
      // If shield is broken, trigger recharge timer (based on defensive cards from project idea)
      if (player.shield.current <= 0) {
        player.shield.current = 0;
        player.shield.rechargeTimer = 3.0; // 3 seconds to recharge
      }
    }

    // Remaining damage goes to health
    if (damage > 0) {
      player.health.current -= damage;
      player.health.current = Math.max(0, player.health.current);
    }

    updateHealthBar(player);
    return player.health.current <= 0; // Return true if player died
  }

  function healPlayer(player, amount) {
    if (!player || !player.health) return;

    player.health.current = Math.min(player.health.max, player.health.current + amount);
    updateHealthBar(player);
  }

  function addShield(player, amount, instances = 1) {
    if (!player || !player.shield) return;

    player.shield.max = amount;
    player.shield.current = amount;
    player.shield.instances = instances;
    player.shield.rechargeTimer = 0;
    updateHealthBar(player);
  }

  function updateShieldRecharge(player, dt) {
    if (!player || !player.shield) return;

    if (player.shield.rechargeTimer > 0) {
      player.shield.rechargeTimer -= dt;
      if (player.shield.rechargeTimer <= 0) {
        player.shield.current = player.shield.max;
        updateHealthBar(player);
      }
    }
  }

  function system(dt, world, bus) {
    // Find player
    for (const entity of world.entities.values()) {
      if ((entity.tags || []).includes('player')) {
        updateHealthBar(entity);
        updateShieldRecharge(entity, dt);
        break;
      }
    }
  }

  return {
    system,
    damagePlayer,
    healPlayer,
    addShield,
    updateHealthBar
  };
}
