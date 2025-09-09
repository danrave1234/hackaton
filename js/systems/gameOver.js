// Game Over System - handles player death and game restart
export function createGameOverSystem() {
  let gameOverTriggered = false;
  let gameOverElement = null;

  function showGameOverScreen() {
    if (gameOverTriggered) return;
    gameOverTriggered = true;

    // Create game over overlay
    gameOverElement = document.createElement('div');
    gameOverElement.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.8);
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      z-index: 10000;
      font-family: monospace;
      color: white;
      text-align: center;
    `;

    gameOverElement.innerHTML = `
      <div style="background: rgba(139, 69, 19, 0.9); padding: 40px; border-radius: 10px; border: 3px solid #ff0000;">
        <h1 style="font-size: 48px; margin: 0 0 20px 0; color: #ff4444;">GAME OVER</h1>
        <p style="font-size: 20px; margin: 0 0 30px 0;">Your ship was destroyed!</p>
        <button id="restartGame" style="
          background: #4CAF50;
          color: white;
          border: none;
          padding: 15px 30px;
          font-size: 18px;
          font-family: monospace;
          border-radius: 5px;
          cursor: pointer;
          margin: 10px;
        ">Restart Level</button>
        <button id="backToMenu" style="
          background: #2196F3;
          color: white;
          border: none;
          padding: 15px 30px;
          font-size: 18px;
          font-family: monospace;
          border-radius: 5px;
          cursor: pointer;
          margin: 10px;
        ">Back to Menu</button>
      </div>
    `;

    document.body.appendChild(gameOverElement);

    // Add event listeners
    document.getElementById('restartGame').addEventListener('click', () => {
      window.location.reload();
    });

    document.getElementById('backToMenu').addEventListener('click', () => {
      window.location.href = 'index.html';
    });

    console.log('[GAME OVER] Game over screen displayed');
  }

  return {
    system(dt, world, bus) {
      // Subscribe to player death event once
      if (!createGameOverSystem._subscribed) {
        bus.on('player:died', (data) => {
          console.log('[GAME OVER] Player died at:', data);
          // Small delay to let explosion/effects play
          setTimeout(() => {
            showGameOverScreen();
          }, 500);
        });
        createGameOverSystem._subscribed = true;
      }
    },
    
    destroy() {
      if (gameOverElement && gameOverElement.parentNode) {
        gameOverElement.parentNode.removeChild(gameOverElement);
      }
    }
  };
}
