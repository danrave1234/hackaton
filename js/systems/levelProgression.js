// Level Progression System - Manages level completion and progression
import { cardSelectionScreen } from './cardSelection.js';

export function createLevelProgressionSystem() {
  let enemiesKilled = 0;
  let enemiesPerLevel = 10; // Start with 10 enemies per level
  let currentLevel = 1;
  let levelCompleteTriggered = false;
  let isProcessingLevelComplete = false;

  function showLevelCompleteScreen(onContinue) {
    const levelCompleteElement = document.createElement('div');
    levelCompleteElement.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 40, 0, 0.9);
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      z-index: 9999;
      font-family: monospace;
      color: white;
      animation: levelCompleteIn 0.8s ease-out;
    `;

    // Add CSS animations
    const style = document.createElement('style');
    style.textContent = `
      @keyframes levelCompleteIn {
        0% { 
          opacity: 0; 
          transform: scale(0.8);
        }
        50% {
          opacity: 1;
          transform: scale(1.1);
        }
        100% { 
          opacity: 1; 
          transform: scale(1);
        }
      }
      @keyframes levelCompleteOut {
        from { 
          opacity: 1; 
          transform: scale(1);
        }
        to { 
          opacity: 0; 
          transform: scale(0.9);
        }
      }
      .pulse {
        animation: pulse 2s infinite;
      }
      @keyframes pulse {
        0%, 100% { transform: scale(1); }
        50% { transform: scale(1.05); }
      }
    `;
    document.head.appendChild(style);

    levelCompleteElement.innerHTML = `
      <div style="text-align: center; background: rgba(0,0,0,0.7); padding: 60px; border-radius: 20px; border: 3px solid #4CAF50;">
        <h1 style="font-size: 72px; margin: 0 0 20px 0; color: #4CAF50; text-shadow: 3px 3px 6px rgba(0,0,0,0.8);" class="pulse">
          LEVEL ${currentLevel} COMPLETE!
        </h1>
        <div style="font-size: 24px; margin: 20px 0; color: #FFC107;">
          <p style="margin: 10px 0;">Enemies Defeated: ${enemiesKilled}</p>
          <p style="margin: 10px 0;">Level Score: ${enemiesKilled * 100}</p>
        </div>
        <div style="margin: 30px 0; padding: 20px; background: rgba(76, 175, 80, 0.1); border-radius: 10px;">
          <p style="font-size: 18px; color: #8BC34A; margin: 0;">
            ⭐ Excellent work, Captain! ⭐
          </p>
          <p style="font-size: 16px; color: #ccc; margin: 10px 0 0 0;">
            Preparing upgrades for next sector...
          </p>
        </div>
        <div style="margin-top: 40px;">
          <div style="color: #888; font-size: 14px;">
            Proceeding to upgrade selection in <span id="countdown">3</span>s
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(levelCompleteElement);

    // Countdown before auto-proceeding to card selection
    let countdown = 3;
    const countdownEl = document.getElementById('countdown');
    const countdownInterval = setInterval(() => {
      countdown--;
      if (countdownEl) countdownEl.textContent = countdown;
      
      if (countdown <= 0) {
        clearInterval(countdownInterval);
        
        // Fade out level complete screen
        levelCompleteElement.style.animation = 'levelCompleteOut 0.5s ease-in forwards';
        
        setTimeout(() => {
          if (levelCompleteElement.parentNode) {
            levelCompleteElement.parentNode.removeChild(levelCompleteElement);
          }
          onContinue();
        }, 500);
      }
    }, 1000);

    console.log(`[LEVEL PROGRESSION] Level ${currentLevel} complete! Enemies killed: ${enemiesKilled}`);
  }

  function proceedToNextLevel() {
    currentLevel++;
    enemiesKilled = 0;
    enemiesPerLevel = Math.min(20, 10 + currentLevel * 2); // Increase difficulty
    levelCompleteTriggered = false;
    isProcessingLevelComplete = false;

    console.log(`[LEVEL PROGRESSION] Starting level ${currentLevel}, need to kill ${enemiesPerLevel} enemies`);

    // Update URL to reflect new level
    const url = new URL(window.location);
    url.searchParams.set('round', currentLevel);
    window.history.pushState({}, '', url);

    // Update HUD
    const hudRound = document.getElementById('hudRound');
    if (hudRound) hudRound.textContent = `R${currentLevel}`;

    // Resume enemy spawning with increased difficulty
    if (window.spawnSystem) {
      window.spawnSystem.resume();
      // Increase spawn rate for higher levels
      window.spawnSystem.setSpawnRate(Math.max(0.3, 0.9 - (currentLevel * 0.1)));
    }
  }

  return {
    system(dt, world, bus) {
      // Subscribe to enemy death events once
      if (!createLevelProgressionSystem._subscribed) {
        bus.on('enemy:died', () => {
          enemiesKilled++;
          console.log(`[LEVEL PROGRESSION] Enemy killed. Progress: ${enemiesKilled}/${enemiesPerLevel}`);
          
          // Check if level is complete
          if (enemiesKilled >= enemiesPerLevel && !levelCompleteTriggered) {
            levelCompleteTriggered = true;
            
            // Stop enemy spawning
            if (window.spawnSystem) {
              window.spawnSystem.pause();
            }
            
            // Wait a moment for last effects, then show level complete
            setTimeout(() => {
              if (!isProcessingLevelComplete) {
                isProcessingLevelComplete = true;
                
                showLevelCompleteScreen(() => {
                  // Show card selection screen
                  cardSelectionScreen.show((selectedCard) => {
                    console.log('[LEVEL PROGRESSION] Card selection complete, proceeding to next level');
                    proceedToNextLevel();
                  });
                });
              }
            }, 1000);
          }
        });
        
        createLevelProgressionSystem._subscribed = true;
      }
      
      // Update HUD with level progress
      const hudProgress = document.getElementById('hudProgress');
      if (hudProgress) {
        hudProgress.textContent = `${enemiesKilled}/${enemiesPerLevel}`;
      }
    },

    // Get current level info
    getCurrentLevel() {
      return currentLevel;
    },

    getEnemiesKilled() {
      return enemiesKilled;
    },

    getEnemiesPerLevel() {
      return enemiesPerLevel;
    },

    // Force level completion (for testing)
    forceCompleteLevel(bus) {
      if (!levelCompleteTriggered) {
        enemiesKilled = enemiesPerLevel;
        if (bus) bus.emit('enemy:died'); // Trigger the completion check
      }
    },

    // Reset for new game
    reset() {
      currentLevel = 1;
      enemiesKilled = 0;
      enemiesPerLevel = 10;
      levelCompleteTriggered = false;
      isProcessingLevelComplete = false;
    }
  };
}
