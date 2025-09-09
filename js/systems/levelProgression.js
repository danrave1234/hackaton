// Level Progression System - Manages level completion and progression
import { cardSelectionScreen } from './cardSelection.js';
import { spawnExplosion } from './explosion.js';
import { markForRemoval } from '../world/world.js';

export function createLevelProgressionSystem() {
  // Travel-based progression
  // Initialize from URL param `round` if present
  const params = new URLSearchParams(location.search);
  let currentLevel = Math.max(1, parseInt(params.get('round') || '1', 10) || 1);
  let travelProgress = 0;        // seconds progressed in current sector
  let travelTarget = 30;         // seconds required to complete sector
  let levelCompleteTriggered = false;
  let isProcessingLevelComplete = false;
  let isGameOver = false;        // stop progression if player dies

  function computeTravelTargetForLevel(level) {
    // Scale duration modestly with sector (clamped)
    const base = 28;          // base seconds
    const increment = 2;      // add per level
    const maxSeconds = 48;    // cap
    return Math.min(maxSeconds, base + (level - 1) * increment);
  }


  // Initialize sector and travel target
  if (window.spawnSystem && window.spawnSystem.setSector) {
    window.spawnSystem.setSector(currentLevel);
  }
  travelTarget = computeTravelTargetForLevel(currentLevel);

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

    const percent = Math.min(100, Math.round((travelProgress / travelTarget) * 100));

    levelCompleteElement.innerHTML = `
      <div style="text-align: center; background: rgba(0,0,0,0.7); padding: 60px; border-radius: 20px; border: 3px solid #4CAF50;">
        <h1 style="font-size: 72px; margin: 0 0 20px 0; color: #4CAF50; text-shadow: 3px 3px 6px rgba(0,0,0,0.8);" class="pulse">
          LEVEL ${currentLevel} COMPLETE!
        </h1>
        <div style="font-size: 24px; margin: 20px 0; color: #FFC107;">
          <p style="margin: 10px 0;">Travel Progress: ${percent}%</p>
          <p style="margin: 10px 0;">Sector Time: ${Math.round(travelTarget)}s</p>
        </div>
        <div style="margin: 30px 0; padding: 20px; background: rgba(76, 175, 80, 0.1); border-radius: 10px;">
          <p style="font-size: 18px; color: #8BC34A; margin: 0;">
            ⭐ Route secured. Preparing upgrades for next sector... ⭐
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

    console.log(`[LEVEL PROGRESSION] Level ${currentLevel} complete by travel.`);
  }

  function proceedToNextLevel(world) {
    currentLevel++;
    travelProgress = 0;
    travelTarget = computeTravelTargetForLevel(currentLevel);
    levelCompleteTriggered = false;
    isProcessingLevelComplete = false;
    isGameOver = false;

    console.log(`[LEVEL PROGRESSION] Starting level ${currentLevel}, travel target ${Math.round(travelTarget)}s`);

    // Update URL to reflect new level
    const url = new URL(window.location);
    url.searchParams.set('round', currentLevel);
    window.history.pushState({}, '', url);

    // Background is sector-based via RenderSystem; world.sector is managed elsewhere.
    if (world) {
      world.sector = currentLevel;
    }

    // Update HUD
    const hudRound = document.getElementById('hudRound');
    if (hudRound) hudRound.textContent = `SECTOR ${currentLevel}`;
    const hudProgress = document.getElementById('hudProgress');
    if (hudProgress) hudProgress.textContent = `0%`;

    // Set current sector in spawn system and resume spawning
    if (window.spawnSystem) {
      window.spawnSystem.setSector(currentLevel);
      window.spawnSystem.resume();
    }
  }

  return {
    system(dt, world, bus) {
      // Subscribe once for game over to stop progression
      if (!createLevelProgressionSystem._subscribedGameOver) {
        bus.on('player:died', () => {
          isGameOver = true;
          if (window.spawnSystem) window.spawnSystem.pause();
        });
        createLevelProgressionSystem._subscribedGameOver = true;
      }

      // If player no longer exists in world, treat as game over
      const playersCheck = [];
      for (const e of world.entities.values()) {
        if ((e.tags||[]).includes('player')) playersCheck.push(e);
      }
      if (playersCheck.length === 0) {
        isGameOver = true;
        if (window.spawnSystem) window.spawnSystem.pause();
        return;
      }

      if (isGameOver) return;

      // Travel-based progress accumulation (use ship speed/time)
      // Prefer player velocity x if available; fallback to time
      const players = playersCheck;
      const player = players[0];

      let travelGain = dt;
      if (player && typeof player.vel?.x === 'number') {
        // Normalize by typical speed to convert to ~seconds of progress
        const norm = Math.max(120, player.stats?.speed || 260);
        travelGain = Math.max(0, (Math.abs(player.vel.x) / norm) * dt);
        // Ensure some progress even if player holds position
        travelGain = Math.max(travelGain, dt * 0.5);
      }

      // Make progression 20% faster
      travelGain *= 1.2;

      travelProgress += travelGain;

      // Update HUD with percentage progress
      const hudProgress = document.getElementById('hudProgress');
      if (hudProgress) {
        const pct = Math.min(100, Math.round((travelProgress / travelTarget) * 100));
        hudProgress.textContent = `${pct}%`;
      }

      // On completion, pause spawns and transition
      if (travelProgress >= travelTarget && !levelCompleteTriggered) {
        levelCompleteTriggered = true;

        // Screen-clearing blast: remove all enemies and enemy bullets with explosion effects
        const width = world.canvas?.width || 1280;
        const height = world.canvas?.height || 720;
        const centerX = width / 2;
        const centerY = height / 2;

        // Spawn multiple large explosions across the screen for visibility
        const s = Math.min(width, height);
        const blastPoints = [
          { x: centerX, y: centerY, s: s * 0.40 },
          { x: centerX - width * 0.30, y: centerY - height * 0.22, s: s * 0.28 },
          { x: centerX + width * 0.30, y: centerY + height * 0.22, s: s * 0.28 },
          { x: centerX - width * 0.35, y: centerY + height * 0.25, s: s * 0.24 },
          { x: centerX + width * 0.35, y: centerY - height * 0.25, s: s * 0.24 },
        ];
        blastPoints.forEach(p => spawnExplosion(world, p.x, p.y, p.s, bus));

        // Clear all enemies and enemy bullets
        const toRemove = [];
        for (const e of world.entities.values()) {
          const tags = e.tags || [];
          if (tags.includes('enemy') || tags.includes('enemy-bullet')) {
            toRemove.push(e.id);
          }
        }
        toRemove.forEach(id => markForRemoval(world, id));

        if (window.spawnSystem) window.spawnSystem.pause();
        // Give explosions time to play on screen before overlay
        setTimeout(() => {
          if (!isProcessingLevelComplete) {
            isProcessingLevelComplete = true;
            showLevelCompleteScreen(() => {
              cardSelectionScreen.show((selectedCard) => {
                proceedToNextLevel(world);
              });
            });
          }
        }, 1200);
      }
    },

    // Get current level info
    getCurrentLevel() {
      return currentLevel;
    },

    // Reset for new game
    reset() {
      currentLevel = 1;
      travelProgress = 0;
      travelTarget = computeTravelTargetForLevel(currentLevel);
      levelCompleteTriggered = false;
      isProcessingLevelComplete = false;
      isGameOver = false;
    }
  };
}
