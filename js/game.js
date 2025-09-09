import { createLoop } from './engine/loop.js';
import { createEventBus } from './engine/events.js';
import { createWorld, addEntity } from './world/world.js';
import { createPlayer } from './entities/factory.js';
import { RenderSystem } from './systems/render.js';
import { MovementSystem } from './systems/movement.js';
import { PlayerControlSystem, attachInputListeners } from './systems/playerControl.js';
import { ShootingSystem } from './systems/shooting.js';
import { CollisionSystem } from './systems/collision.js';
import { CleanupSystem } from './systems/cleanup.js';
import { SpawnSystem } from './systems/spawn.js';
import { createScoreSystem } from './systems/score.js';
import { createSfxSystem } from './systems/sfx.js';
import { createDebugSystem, DebugSystemFunction } from './systems/debug.js';
import { createGameOverSystem } from './systems/gameOver.js';

document.addEventListener('DOMContentLoaded', () => {
  const $ = (sel) => document.querySelector(sel);

  // Read round from query param, default 1
  const params = new URLSearchParams(window.location.search);
  const round = Math.max(1, parseInt(params.get('round') || '1', 10) || 1);

  const banner = $('#roundBanner');
  const roundLabel = $('#roundLabel');
  const hudRound = $('#hudRound');
  const hudScore = $('#hudScore');
  const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('gameCanvas'));
  const ctx = canvas.getContext('2d');

  // Optional sprite dataset is still supported by RenderSystem fallback (kept simple here)

  if (roundLabel) roundLabel.textContent = String(round);
  if (hudRound) hudRound.textContent = `R${round}`;

  if (banner) {
    banner.classList.add('round-banner--in');
    setTimeout(() => {
      banner.classList.remove('round-banner--in');
      banner.classList.add('round-banner--out');
      setTimeout(() => banner.remove(), 800);
    }, 1400);
  }

  function fitCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  window.addEventListener('resize', fitCanvas);
  fitCanvas();

  // Create world and systems
  const world = createWorld(ctx, canvas);
  const bus = createEventBus();

  // Input
  attachInputListeners();
  window.PlayerKeys = PlayerControlSystem.keys;

  // Entities
  addEntity(world, createPlayer(120, canvas.height / 2));

  // Score + SFX + Debug + Game Over systems
  const score = createScoreSystem(hudScore);
  const sfx = createSfxSystem(canvas);
  const gameOver = createGameOverSystem();
  
  // Initialize debug system (development only)
  window.debugSystem = createDebugSystem();

  // Run loop in deterministic order
  createLoop([
    PlayerControlSystem,
    SpawnSystem,
    ShootingSystem,
    MovementSystem,
    CollisionSystem,
    CleanupSystem,
    RenderSystem,
    score.system,
    sfx.system,
    gameOver.system,
    DebugSystemFunction,
  ], world, bus);
});


