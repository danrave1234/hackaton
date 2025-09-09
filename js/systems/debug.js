// Debug System for level progression and development tools
// Provides level skip functionality and visual indicators

export class DebugSystem {
  constructor() {
    this.enabled = true; // Set to false for production
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
    
    // Set up keyboard shortcuts
    this.setupKeyboardShortcuts();
    
    console.log('[DEBUG] Debug System initialized - Press F9 to skip to level end');
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
    
    const progress = Math.min(100, (this.enemiesKilled / this.enemiesNeededForNextLevel) * 100);
    this.visualIndicator.innerHTML = `
      [DEBUG] Level ${this.currentLevel} - ${this.levelParts[this.currentPart]} (${progress.toFixed(0)}%)
      <br><small>Enemies: ${this.enemiesKilled}/${this.enemiesNeededForNextLevel} | F9: Skip to End | F10: Next Part</small>
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
      }
    });
  }

  skipToLevelEnd() {
    if (!this.enabled) return;
    
    console.log('[DEBUG] Skipping to level end');
    this.currentPart = this.levelParts.length - 1;
    this.skipToEndRequested = true;
    this.updateVisualIndicator();
    
    // Trigger level completion after a short delay
    setTimeout(() => {
      this.completeLevel();
    }, 1000);
  }

  nextPart() {
    if (!this.enabled) return;
    
    if (this.currentPart < this.levelParts.length - 1) {
      this.currentPart++;
      console.log(`[DEBUG] Advanced to part: ${this.levelParts[this.currentPart]}`);
      this.updateVisualIndicator();
    }
  }

  completeLevel() {
    if (!this.enabled) return;
    
    console.log(`[DEBUG] Level ${this.currentLevel} completed`);
    
    // Navigate to next level
    const nextLevel = this.currentLevel + 1;
    const currentUrl = new URL(window.location.href);
    currentUrl.searchParams.set('round', nextLevel.toString());
    
    // Show completion message
    this.showCompletionMessage(nextLevel);
    
    // Navigate after delay
    setTimeout(() => {
      window.location.href = currentUrl.toString();
    }, 2000);
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
    
    // Check if level should be completed
    if (this.enemiesKilled >= this.enemiesNeededForNextLevel) {
      console.log(`[DEBUG] Level ${this.currentLevel} target reached! Completing level...`);
      this.completeLevel();
    }
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
        bus.on('enemy:killed', () => this.onEnemyKilled());
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