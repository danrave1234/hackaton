// Card Selection Screen - UI for choosing upgrades between levels
import { upgradeManager, UPGRADE_DEFINITIONS } from './upgrades.js';

export class CardSelectionScreen {
  constructor() {
    this.element = null;
    this.isVisible = false;
    this.onCardSelected = null;
  }

  // Show the card selection screen with available upgrades
  show(onCardSelected) {
    if (this.isVisible) return;
    
    this.onCardSelected = onCardSelected;
    this.isVisible = true;
    
    // Create the overlay
    this.element = document.createElement('div');
    this.element.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.9);
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      z-index: 10000;
      font-family: monospace;
      color: white;
      animation: fadeIn 0.5s ease-in;
    `;

    // Add CSS animation
    const style = document.createElement('style');
    style.textContent = `
      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      @keyframes cardHover {
        from { transform: translateY(0px); }
        to { transform: translateY(-5px); }
      }
      .card-hover {
        animation: cardHover 0.2s ease-out forwards;
      }
      .card-selected {
        animation: cardSelected 0.3s ease-out;
      }
      @keyframes cardSelected {
        0% { transform: scale(1); }
        50% { transform: scale(1.1); }
        100% { transform: scale(1); }
      }
    `;
    document.head.appendChild(style);

    const availableUpgrades = upgradeManager.getAvailableUpgrades();
    
    // If no upgrades available, skip screen
    if (availableUpgrades.length === 0) {
      setTimeout(() => this.selectCard(null), 100);
      return;
    }

    // Shuffle and pick 3 random upgrades (or all if less than 3)
    const shuffled = [...availableUpgrades].sort(() => Math.random() - 0.5);
    const cardOptions = shuffled.slice(0, Math.min(3, shuffled.length));

    this.element.innerHTML = `
      <div style="text-align: center; margin-bottom: 40px;">
        <h1 style="font-size: 48px; margin: 0 0 10px 0; color: #4CAF50; text-shadow: 2px 2px 4px rgba(0,0,0,0.8);">
          LEVEL COMPLETE
        </h1>
        <h2 style="font-size: 24px; margin: 0 0 20px 0; color: #FFC107;">
          Choose Your Upgrade
        </h2>
        <p style="font-size: 16px; color: #ccc; margin: 0;">
          Select one card to enhance your ship
        </p>
      </div>
      
      <div style="display: flex; gap: 30px; justify-content: center; flex-wrap: wrap;">
        ${cardOptions.map((option, index) => this.createCardHTML(option, index)).join('')}
      </div>
      
      <div style="margin-top: 40px; text-align: center; color: #888; font-size: 14px;">
        <p>Click a card to select it</p>
        <p>Current Levels: ${this.getCurrentLevelsText()}</p>
      </div>
    `;

    document.body.appendChild(this.element);

    // Add click handlers for cards
    cardOptions.forEach((option, index) => {
      const cardElement = document.getElementById(`card-${index}`);
      if (cardElement) {
        cardElement.addEventListener('click', () => this.selectCard(option));
        cardElement.addEventListener('mouseenter', () => {
          cardElement.classList.add('card-hover');
        });
        cardElement.addEventListener('mouseleave', () => {
          cardElement.classList.remove('card-hover');
        });
      }
    });

    console.log('[CARD SELECTION] Showing card selection screen with', cardOptions.length, 'options');
  }

  createCardHTML(option, index) {
    const { cardType, currentLevel, nextLevel, card, upgrade } = option;
    const isMaxed = nextLevel === 5;
    
    return `
      <div id="card-${index}" style="
        background: linear-gradient(145deg, #2a2a2a, #1a1a1a);
        border: 3px solid ${this.getCardColor(cardType)};
        border-radius: 15px;
        padding: 25px;
        width: 280px;
        min-height: 320px;
        cursor: pointer;
        transition: all 0.3s ease;
        box-shadow: 0 8px 16px rgba(0,0,0,0.3);
        position: relative;
        overflow: hidden;
      " onmouseover="this.style.transform='scale(1.05)'; this.style.boxShadow='0 12px 24px rgba(0,0,0,0.4)'" 
         onmouseout="this.style.transform='scale(1)'; this.style.boxShadow='0 8px 16px rgba(0,0,0,0.3)'">
        
        <!-- Card header -->
        <div style="text-align: center; margin-bottom: 20px;">
          <div style="font-size: 48px; margin-bottom: 10px;">${card.icon}</div>
          <h3 style="margin: 0; font-size: 20px; color: ${this.getCardColor(cardType)};">
            ${card.name}
          </h3>
          <p style="margin: 5px 0 0 0; font-size: 14px; color: #999;">
            Level ${currentLevel} → ${nextLevel}${isMaxed ? ' (MAX)' : ''}
          </p>
        </div>
        
        <!-- Upgrade info -->
        <div style="background: rgba(0,0,0,0.3); padding: 15px; border-radius: 8px; margin-bottom: 15px;">
          <h4 style="margin: 0 0 8px 0; font-size: 16px; color: #FFC107;">
            ${upgrade.name}
          </h4>
          <p style="margin: 0; font-size: 14px; color: #ccc; line-height: 1.4;">
            ${upgrade.description}
          </p>
        </div>
        
        <!-- Level progression -->
        <div style="margin-bottom: 15px;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
            <span style="font-size: 12px; color: #888;">Progress</span>
            <span style="font-size: 12px; color: #888;">${nextLevel}/5</span>
          </div>
          <div style="
            background: rgba(255,255,255,0.1);
            height: 6px;
            border-radius: 3px;
            overflow: hidden;
          ">
            <div style="
              background: ${this.getCardColor(cardType)};
              height: 100%;
              width: ${(nextLevel / 5) * 100}%;
              border-radius: 3px;
              transition: width 0.3s ease;
            "></div>
          </div>
        </div>
        
        <!-- Max level indicator -->
        ${isMaxed ? `
          <div style="
            position: absolute;
            top: 10px;
            right: 10px;
            background: #FF6B35;
            color: white;
            padding: 4px 8px;
            border-radius: 12px;
            font-size: 10px;
            font-weight: bold;
          ">MAX</div>
        ` : ''}
      </div>
    `;
  }

  getCardColor(cardType) {
    switch (cardType) {
      case 'offensive': return '#FF6B6B';
      case 'defensive': return '#4ECDC4'; 
      case 'support': return '#45B7D1';
      default: return '#666';
    }
  }

  getCurrentLevelsText() {
    const levels = upgradeManager.playerUpgrades;
    return `Offensive: ${levels.offensive}, Defensive: ${levels.defensive}, Support: ${levels.support}`;
  }

  selectCard(option) {
    if (!this.isVisible) return;
    
    console.log('[CARD SELECTION] Card selected:', option);
    
    // Apply upgrade if option selected
    if (option) {
      upgradeManager.upgradeCard(option.cardType);
      
      // Visual feedback
      const cardElement = document.getElementById(`card-${option.index}`);
      if (cardElement) {
        cardElement.classList.add('card-selected');
      }
    }
    
    // Hide card selection screen
    setTimeout(() => {
      // Preserve callback before hide clears it
      const proceed = this.onCardSelected;
      this.hide();
      
      // Create a countdown overlay
      const countdownOverlay = document.createElement('div');
      countdownOverlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.7);
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        z-index: 9999;
        font-family: monospace;
        color: white;
      `;
      
      countdownOverlay.innerHTML = `
        <div style="text-align: center; padding: 40px; border-radius: 20px;">
          <h2 style="font-size: 36px; margin: 0 0 20px 0; color: #4CAF50;">
            Get Ready!
          </h2>
          <div style="font-size: 72px; color: #FFC107;" id="countdown">3</div>
          <p style="margin: 20px 0 0 0; color: #ccc;">
            Next level starting...
          </p>
        </div>
      `;
      
      document.body.appendChild(countdownOverlay);
      
      // Start countdown
      let countdown = 3;
      const countdownElement = document.getElementById('countdown');
      
      const interval = setInterval(() => {
        countdown--;
        if (countdownElement) {
          countdownElement.textContent = countdown;
        }
        
        if (countdown <= 0) {
          clearInterval(interval);
          countdownOverlay.remove();
          if (typeof proceed === 'function') {
            proceed(option);
          }
        }
      }, 1000);
      
    }, option ? 600 : 100);
  }

  hide() {
    if (!this.isVisible || !this.element) return;
    
    this.isVisible = false;
    
    // Fade out animation
    this.element.style.animation = 'fadeOut 0.3s ease-out forwards';
    this.element.style.animationName = 'fadeOut';
    
    // Add fadeOut keyframes
    const style = document.createElement('style');
    style.textContent = `
      @keyframes fadeOut {
        from { opacity: 1; }
        to { opacity: 0; }
      }
    `;
    document.head.appendChild(style);
    
    setTimeout(() => {
      if (this.element && this.element.parentNode) {
        this.element.parentNode.removeChild(this.element);
      }
      this.element = null;
      this.onCardSelected = null;
    }, 300);
    
    console.log('[CARD SELECTION] Card selection screen hidden');
  }

  // Check if screen is currently visible
  get visible() {
    return this.isVisible;
  }
}

// Export singleton instance
export const cardSelectionScreen = new CardSelectionScreen();
