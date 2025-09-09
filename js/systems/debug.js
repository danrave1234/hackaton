// Debug System for level progression and development tools
// Provides level skip functionality and visual indicators

import { CARD_TYPES, UPGRADE_DEFINITIONS, COMBO_EFFECTS, upgradeManager } from './upgrades.js';

export class DebugSystem {
  constructor() {
    this.enabled = false; // Set to false for production
    this.currentLevel = 1;
    this.levelParts = ['Start', 'Enemies', 'Mini-Boss', 'Boss', 'Complete'];
    this.currentPart = 0;
    this.levelStartTime = 0;
    this.partDuration = 30000; // 30 seconds per part
    this.visualIndicator = null;
    this.skipToEndRequested = false;
    
    // Level progression tracking
    this.enemiesKilled = 0;
    this.enemiesNeededForNextLevel = 10; // Enemies to kill before level completes
    
    this.init();
  }

  init() {
    if (!this.enabled) return;
    
    // Create visual indicator
    this.createVisualIndicator();
    
    // Create upgrade debug panel
    this.createUpgradeDebugPanel();
    
    // Set up keyboard shortcuts
    this.setupKeyboardShortcuts();
    
    console.log('[DEBUG] Debug System initialized - F9: Skip Level | F8: Upgrades | F7: Skip to Boss | F10: Next Part');
  }

  createUpgradeDebugPanel() {
    const panel = document.createElement('div');
    panel.id = 'debug-upgrade-panel';
    panel.style.cssText = `
      position: fixed;
      top: 60px;
      right: 10px;
      background: rgba(0, 0, 0, 0.85);
      color: white;
      padding: 10px;
      font-family: monospace;
      font-size: 12px;
      border-radius: 4px;
      z-index: 1000;
      border: 2px solid #666;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.5);
      min-width: 200px;
      display: none;
    `;

    const header = document.createElement('div');
    header.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
      padding-bottom: 4px;
      border-bottom: 1px solid #666;
    `;
    header.innerHTML = `
      <span style="font-weight: bold; color: #4CAF50;">🛠️ Debug Upgrades</span>
      <span style="cursor: pointer; padding: 0 4px;" onclick="this.parentElement.parentElement.style.display='none'">❌</span>
    `;
    panel.appendChild(header);

    // Create sections for each card type
    for (const [key, type] of Object.entries(CARD_TYPES)) {
      const section = document.createElement('div');
      section.style.cssText = 'margin-bottom: 10px;';
      
      const title = document.createElement('div');
      title.style.cssText = 'font-weight: bold; color: #FFC107; margin-bottom: 4px;';
      title.textContent = UPGRADE_DEFINITIONS[type].name;
      section.appendChild(title);

      // Create level selector
      const select = document.createElement('select');
      select.style.cssText = `
        background: #333;
        color: white;
        border: 1px solid #666;
        padding: 2px;
        width: 100%;
        margin-bottom: 4px;
      `;

      // Add level options
      select.innerHTML = '<option value="0">None</option>' +
        UPGRADE_DEFINITIONS[type].levels.map((level, i) => 
          '<option value="' + (i + 1) + '">' + level.name + ' (Level ' + (i + 1) + ')</option>'
        ).join('');

      // Handle level changes
      const self = this;
      select.addEventListener('change', function() {
        const level = parseInt(this.value);
        const currentLevel = upgradeManager.getLevel(type);
        
        // Set the level directly in the upgrade manager
        if (level > currentLevel) {
          for (let i = currentLevel; i < level; i++) {
            upgradeManager.upgradeCard(type);
          }
        } else {
          // Reset and rebuild to desired level
          upgradeManager.playerUpgrades[type] = level;
          upgradeManager.checkForCombo();
        }
        
        self.updateUpgradeDebugPanel();
      });

      section.appendChild(select);
      panel.appendChild(section);
    }

    // Add combo status section
    const comboSection = document.createElement('div');
    comboSection.style.cssText = 'margin-top: 10px; padding-top: 8px; border-top: 1px solid #666;';
    comboSection.innerHTML = '<div style="font-weight: bold; color: #FF6B6B;">Active Combos</div>';
    
    const comboStatus = document.createElement('div');
    comboStatus.id = 'debug-combo-status';
    comboStatus.style.cssText = 'color: #ccc; font-size: 11px; margin-top: 4px;';
    comboSection.appendChild(comboStatus);
    
    panel.appendChild(comboSection);
    document.body.appendChild(panel);
    this.upgradeDebugPanel = panel;
  }

  updateUpgradeDebugPanel() {
    if (!this.upgradeDebugPanel) return;

    const comboStatus = document.getElementById('debug-combo-status');
    if (comboStatus) {
        const combo = upgradeManager.activeCombo;
        if (combo && COMBO_EFFECTS[combo]) {
          comboStatus.innerHTML = 
            '<span style="color: #4CAF50;">✓</span> ' + COMBO_EFFECTS[combo].name + '<br>' +
            '<small>' + COMBO_EFFECTS[combo].description + '</small>';
        } else {
          comboStatus.innerHTML = '<span style="color: #666;">No active combos</span>';
        }
      }
  }

  createVisualIndicator() {
    // Create debug indicator at top of screen
    this.visualIndicator = document.createElement('div');
    this.visualIndicator.id = 'debug-level-indicator';
    this.visualIndicator.style.cssText = `
      position: fixed;
      top: 10px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(255, 0, 0, 0.8);
      color: white;
      padding: 8px 16px;
      font-family: monospace;
      font-size: 14px;
      font-weight: bold;
      border-radius: 4px;
      z-index: 1000;
      pointer-events: none;
      border: 2px solid #ff6b6b;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.5);
    `;
    
    document.body.appendChild(this.visualIndicator);
    this.updateVisualIndicator();
  }

  updateVisualIndicator() {
    if (!this.visualIndicator || !this.enabled) return;
    
    // Get current level info from level progression system
    const levelInfo = window.levelProgressionSystem ? {
      killed: window.levelProgressionSystem.getEnemiesKilled(),
      needed: window.levelProgressionSystem.getEnemiesPerLevel(),
      level: window.levelProgressionSystem.getCurrentLevel()
    } : {
      killed: this.enemiesKilled,
      needed: this.enemiesNeededForNextLevel,
      level: this.currentLevel
    };
    
    // Check if this is a boss level
    let isBossLevel = false;
    let bossStatus = '';
    
    // Check current level directly (levels 5 and 10 are boss levels)
    const currentLevel = levelInfo.level;
    if (currentLevel === 5 || currentLevel === 10) {
      isBossLevel = true;
      bossStatus = currentLevel === 10 ? ' [FINAL BOSS]' : ' [BOSS LEVEL]';
    }
    
    const progress = Math.min(100, (levelInfo.killed / levelInfo.needed) * 100);
    this.visualIndicator.innerHTML = `
      [DEBUG] Level ${levelInfo.level}${bossStatus} - ${this.levelParts[this.currentPart]} (${progress.toFixed(0)}%)
      <br><small>Enemies: ${levelInfo.killed}/${levelInfo.needed} | F9: Skip${isBossLevel ? ' to Boss' : ' to End'} | F10: Next Part</small>
    `;
  }

  setupKeyboardShortcuts() {
    if (!this.enabled) return;
    
    document.addEventListener('keydown', (e) => {
      if (e.key === 'F9') {
        e.preventDefault();
        this.skipToLevelEnd();
      } else if (e.key === 'F10') {
        e.preventDefault();
        this.nextPart();
      } else if (e.key === 'F8') {
        e.preventDefault();
        if (this.upgradeDebugPanel) {
          this.upgradeDebugPanel.style.display = 
            this.upgradeDebugPanel.style.display === 'none' ? 'block' : 'none';
        }
      } else if (e.key === 'F7') {
        e.preventDefault();
        this.skipToBoss();
      }
    });
  }

  skipToLevelEnd() {
    if (!this.enabled) return;
    
    console.log('[DEBUG] Skipping to level end');
    this.currentPart = this.levelParts.length - 1;
    this.skipToEndRequested = true;
    this.updateVisualIndicator();
    
    // Use the level progression system's forceCompleteLevel function
    if (window.levelProgressionSystem && window.gameWorld && window.gameBus) {
      window.levelProgressionSystem.forceCompleteLevel(window.gameBus, window.gameWorld);
    } else {
      console.warn('[DEBUG] Level progression system not available for skip');
    }
  }

  nextPart() {
    if (!this.enabled) return;
    
    if (this.currentPart < this.levelParts.length - 1) {
      this.currentPart++;
      console.log(`[DEBUG] Advanced to part: ${this.levelParts[this.currentPart]}`);
      this.updateVisualIndicator();
    }
  }
  
  skipToBoss() {
    if (!this.enabled) return;
    
    console.log('[DEBUG] Skipping to boss fight');
    
    // Use the level progression system's skipToBoss function
    if (window.levelProgressionSystem && window.gameWorld) {
      window.levelProgressionSystem.skipToBoss(window.gameWorld);
    } else {
      console.warn('[DEBUG] Level progression system not available for boss skip');
    }
  }

  completeLevel() {
    if (!this.enabled) return;
    
    console.log(`[DEBUG] Level ${this.currentLevel} completed`);
    
    // Don't auto-navigate - let the level progression system handle it
    // This allows the card selection to show properly
    console.log('[DEBUG] Level completion handled by level progression system');
  }

  showCompletionMessage(nextLevel) {
    const message = document.createElement('div');
    message.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: rgba(0, 255, 0, 0.9);
      color: white;
      padding: 20px;
      font-family: monospace;
      font-size: 18px;
      font-weight: bold;
      border-radius: 8px;
      z-index: 2000;
      text-align: center;
      border: 3px solid #00ff00;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.7);
    `;
    
    message.innerHTML = `
      [DEBUG] LEVEL ${this.currentLevel} COMPLETE<br>
      <small>Proceeding to Level ${nextLevel}...</small>
    `;
    
    document.body.appendChild(message);
    
    // Remove message after delay
    setTimeout(() => {
      if (message.parentNode) {
        message.parentNode.removeChild(message);
      }
    }, 3000);
  }

  // Called when an enemy is killed
  onEnemyKilled() {
    if (!this.enabled) return;
    
    this.enemiesKilled++;
    console.log(`[DEBUG] Enemy killed! Progress: ${this.enemiesKilled}/${this.enemiesNeededForNextLevel}`);
    this.updateVisualIndicator();
    
    // Don't auto-complete - let the level progression system handle boss logic
  }

  // System update function called by game loop
  update(dt, world, bus) {
    if (!this.enabled) return;
    
    // Initialize level start time
    if (this.levelStartTime === 0) {
      this.levelStartTime = world.time;
      
      // Get current level from URL
      const params = new URLSearchParams(window.location.search);
      this.currentLevel = Math.max(1, parseInt(params.get('round') || '1', 10) || 1);
      
      // Scale difficulty based on level
      this.enemiesNeededForNextLevel = 10 + (this.currentLevel - 1) * 5;
      
      this.updateVisualIndicator();
      
      // Subscribe to enemy kill events
      if (bus && typeof bus.on === 'function') {
        bus.on('enemy:died', () => this.onEnemyKilled());
      }
    }
    
    // Auto-advance through level parts based on time (if not manually controlled)
    if (!this.skipToEndRequested) {
      const elapsed = world.time - this.levelStartTime;
      const expectedPart = Math.floor(elapsed / this.partDuration);
      
      if (expectedPart > this.currentPart && expectedPart < this.levelParts.length - 1) {
        this.currentPart = expectedPart;
        this.updateVisualIndicator();
      }
    }
  }

  // Clean up when system is destroyed
  destroy() {
    if (this.visualIndicator && this.visualIndicator.parentNode) {
      this.visualIndicator.parentNode.removeChild(this.visualIndicator);
    }
  }
}

// Export factory function for consistency with other systems
export function createDebugSystem() {
  return new DebugSystem();
}

// Export system function for game loop integration
export function DebugSystemFunction(dt, world, bus) {
  if (window.debugSystem) {
    window.debugSystem.update(dt, world, bus);
  }
}