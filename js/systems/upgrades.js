// Card Upgrade System - Weapon/Defense/Support progression system
// This module handles the 3-card upgrade system with 5 levels each

export const CARD_TYPES = {
  OFFENSIVE: 'offensive',
  DEFENSIVE: 'defensive', 
  SUPPORT: 'support'
};

export const UPGRADE_DEFINITIONS = {
  [CARD_TYPES.OFFENSIVE]: {
    name: 'Offensive Systems',
    description: 'Primary weapon upgrades',
    icon: '⚔️',
    levels: [
      {
        level: 1,
        name: 'Extra Beam',
        description: '1 additional beam',
        effects: { extraBeams: 1 }
      },
      {
        level: 2, 
        name: 'Double Beam',
        description: '2 additional beams',
        effects: { extraBeams: 2 }
      },
      {
        level: 3,
        name: 'Rapid Fire',
        description: '2 beams + increased attack speed',
        effects: { extraBeams: 2, attackSpeedMultiplier: 1.5 }
      },
      {
        level: 4,
        name: 'Triple Rapid',
        description: '3 beams + increased attack speed', 
        effects: { extraBeams: 3, attackSpeedMultiplier: 1.5 }
      },
      {
        level: 5,
        name: 'Giant Laser',
        description: '3 beams + GIANT laser every 5 seconds',
        effects: { extraBeams: 3, attackSpeedMultiplier: 1.5, giantLaser: true, giantLaserCooldown: 5 }
      }
    ]
  },

  [CARD_TYPES.DEFENSIVE]: {
    name: 'Defensive Systems', 
    description: 'Shield and armor upgrades',
    icon: '🛡️',
    levels: [
      {
        level: 1,
        name: 'Basic Shield',
        description: 'Absorb 1 damage instance',
        effects: { shieldHits: 1 }
      },
      {
        level: 2,
        name: 'Enhanced Shield', 
        description: 'Absorb 2 damage instances',
        effects: { shieldHits: 2 }
      },
      {
        level: 3,
        name: 'Advanced Shield',
        description: 'Absorb 3 damage instances',
        effects: { shieldHits: 3 }
      },
      {
        level: 4,
        name: 'Reinforced Shield',
        description: 'Absorb 4 damage instances', 
        effects: { shieldHits: 4 }
      },
      {
        level: 5,
        name: 'Aegis Protocol',
        description: 'Absorb 5 hits + 1s invulnerable when broken',
        effects: { shieldHits: 5, invulnerableOnBreak: true, invulnerableDuration: 1 }
      }
    ]
  },

  [CARD_TYPES.SUPPORT]: {
    name: 'Support Systems',
    description: 'Utility and drone upgrades', 
    icon: '🔧',
    levels: [
      {
        level: 1,
        name: 'Tractor Beam',
        description: 'Pull in nearby power-ups and debris',
        effects: { tractorBeam: true, tractorRange: 80 }
      },
      {
        level: 2,
        name: 'Defense Drones',
        description: 'Drones block bullets (2 hits), revive with 5 scrap',
        effects: { drones: true, droneHits: 2, droneReviveCost: 5 }
      },
      {
        level: 3,
        name: 'EMP Pulse',
        description: 'Disable enemy turrets for 2 seconds',
        effects: { empPulse: true, empDuration: 2, empCooldown: 8 }
      },
      {
        level: 4,
        name: 'Energy Leech',
        description: 'Recover HP/Shield when drones kill enemies',
        effects: { energyLeech: true, leechAmount: 0.1 }
      },
      {
        level: 5,
        name: 'Chimera Override',
        description: 'Control 1 enemy for 10 seconds',
        effects: { chimeraOverride: true, overrideDuration: 10, overrideCooldown: 15 }
      }
    ]
  }
};

export const COMBO_EFFECTS = {
  offensiveDefensive: {
    name: 'Ramming Protocol',
    description: 'Consume shield for 3s offensive ramming - no damage taken',
    requirements: { offensive: 5, defensive: 5 },
    effects: { rammingMode: true, rammingDuration: 3 }
  },
  supportOffensive: {
    name: 'Satellite Cannon',
    description: 'Drones fuse into cannon, mega-beam synced with giant laser',
    requirements: { support: 5, offensive: 5 },
    effects: { satelliteCannon: true }
  },
  supportDefensive: {
    name: 'Orbital Defense',
    description: 'Drones orbit as rotating shields, absorbing shots and ramming',
    requirements: { support: 5, defensive: 5 },
    effects: { orbitalDefense: true }
  }
};

// Player upgrade state management
export class UpgradeManager {
  constructor() {
    this.playerUpgrades = {
      [CARD_TYPES.OFFENSIVE]: 0,
      [CARD_TYPES.DEFENSIVE]: 0, 
      [CARD_TYPES.SUPPORT]: 0
    };
    this.activeCombo = null;
  }

  // Get current level for a card type
  getLevel(cardType) {
    return this.playerUpgrades[cardType] || 0;
  }

  // Upgrade a card type
  upgradeCard(cardType) {
    const currentLevel = this.getLevel(cardType);
    if (currentLevel < 5) {
      this.playerUpgrades[cardType] = currentLevel + 1;
      this.checkForCombo();
      return true;
    }
    return false;
  }

  // Check if any combo effects are available
  checkForCombo() {
    const levels = this.playerUpgrades;
    
    for (const [comboKey, combo] of Object.entries(COMBO_EFFECTS)) {
      const req = combo.requirements;
      const meetsRequirements = Object.entries(req).every(([cardType, requiredLevel]) => {
        return levels[cardType] >= requiredLevel;
      });
      
      if (meetsRequirements && !this.activeCombo) {
        this.activeCombo = comboKey;
        break;
      }
    }
  }

  // Get all current effects for the player
  getAllEffects() {
    const effects = {};
    
    // Add effects from each card type
    for (const [cardType, level] of Object.entries(this.playerUpgrades)) {
      if (level > 0) {
        const levelData = UPGRADE_DEFINITIONS[cardType].levels[level - 1];
        Object.assign(effects, levelData.effects);
      }
    }
    
    // Add combo effects
    if (this.activeCombo) {
      Object.assign(effects, COMBO_EFFECTS[this.activeCombo].effects);
    }
    
    return effects;
  }

  // Get available upgrade options (cards not at max level)
  getAvailableUpgrades() {
    const available = [];
    
    for (const [cardType, level] of Object.entries(this.playerUpgrades)) {
      if (level < 5) {
        const nextLevel = level + 1;
        const cardDef = UPGRADE_DEFINITIONS[cardType];
        const levelData = cardDef.levels[nextLevel - 1];
        
        available.push({
          cardType,
          currentLevel: level,
          nextLevel,
          card: cardDef,
          upgrade: levelData
        });
      }
    }
    
    return available;
  }

  // Reset all upgrades (for new game)
  reset() {
    this.playerUpgrades = {
      [CARD_TYPES.OFFENSIVE]: 0,
      [CARD_TYPES.DEFENSIVE]: 0,
      [CARD_TYPES.SUPPORT]: 0
    };
    this.activeCombo = null;
  }
}

// Global upgrade manager instance
export const upgradeManager = new UpgradeManager();
