import { addEntity } from '../world/world.js';
import { 
  createEnemy, 
  createHunterSeeker, 
  createGeoLancer, 
  createFabricator, 
  createAsteroid,
  createMinion,
  ENEMY_TYPES 
} from '../entities/factory.js';

// Progressive enemy spawn configuration by sector
const SECTOR_CONFIG = {
  1: { // Sun Sector - Tutorial
    enemies: { basic: 8, asteroid: 2 },
    spawnRate: 1.2,
    types: [ENEMY_TYPES.BASIC, ENEMY_TYPES.ASTEROID]
  },
  2: { // Earth Sector - Introduction of Hunter-Seekers
    enemies: { basic: 6, hunterSeeker: 2, asteroid: 2 },
    spawnRate: 1.0,
    types: [ENEMY_TYPES.BASIC, ENEMY_TYPES.HUNTER_SEEKER, ENEMY_TYPES.ASTEROID]
  },
  3: { // Moon Sector - More aggressive
    enemies: { basic: 5, hunterSeeker: 3, asteroid: 2 },
    spawnRate: 0.9,
    types: [ENEMY_TYPES.BASIC, ENEMY_TYPES.HUNTER_SEEKER, ENEMY_TYPES.ASTEROID]
  },
  4: { // Mars Sector - Introduction of Geo-Lancers
    enemies: { basic: 4, hunterSeeker: 2, geoLancer: 2, asteroid: 2 },
    spawnRate: 0.8,
    types: [ENEMY_TYPES.BASIC, ENEMY_TYPES.HUNTER_SEEKER, ENEMY_TYPES.GEO_LANCER, ENEMY_TYPES.ASTEROID]
  },
  5: { // Jupiter Sector - Gas giant challenges
    enemies: { basic: 3, hunterSeeker: 3, geoLancer: 2, asteroid: 3 },
    spawnRate: 0.7,
    types: [ENEMY_TYPES.BASIC, ENEMY_TYPES.HUNTER_SEEKER, ENEMY_TYPES.GEO_LANCER, ENEMY_TYPES.ASTEROID]
  },
  6: { // Saturn Sector - Introduction of Fabricators
    enemies: { basic: 2, hunterSeeker: 2, geoLancer: 2, fabricator: 1, asteroid: 2 },
    spawnRate: 0.7,
    types: [ENEMY_TYPES.BASIC, ENEMY_TYPES.HUNTER_SEEKER, ENEMY_TYPES.GEO_LANCER, ENEMY_TYPES.FABRICATOR, ENEMY_TYPES.ASTEROID]
  },
  7: { // Uranus Sector - Increased difficulty
    enemies: { basic: 2, hunterSeeker: 3, geoLancer: 3, fabricator: 1, asteroid: 3 },
    spawnRate: 0.6,
    types: [ENEMY_TYPES.BASIC, ENEMY_TYPES.HUNTER_SEEKER, ENEMY_TYPES.GEO_LANCER, ENEMY_TYPES.FABRICATOR, ENEMY_TYPES.ASTEROID]
  },
  8: { // Neptune Sector - High challenge
    enemies: { basic: 1, hunterSeeker: 4, geoLancer: 3, fabricator: 2, asteroid: 3 },
    spawnRate: 0.6,
    types: [ENEMY_TYPES.BASIC, ENEMY_TYPES.HUNTER_SEEKER, ENEMY_TYPES.GEO_LANCER, ENEMY_TYPES.FABRICATOR, ENEMY_TYPES.ASTEROID]
  },
  9: { // Galaxy Sector - Elite challenge
    enemies: { basic: 1, hunterSeeker: 3, geoLancer: 4, fabricator: 2, asteroid: 4 },
    spawnRate: 0.5,
    types: [ENEMY_TYPES.BASIC, ENEMY_TYPES.HUNTER_SEEKER, ENEMY_TYPES.GEO_LANCER, ENEMY_TYPES.FABRICATOR, ENEMY_TYPES.ASTEROID]
  },
  10: { // Black Hole Sector - Maximum difficulty
    enemies: { basic: 0, hunterSeeker: 4, geoLancer: 4, fabricator: 3, asteroid: 5 },
    spawnRate: 0.4,
    types: [ENEMY_TYPES.HUNTER_SEEKER, ENEMY_TYPES.GEO_LANCER, ENEMY_TYPES.FABRICATOR, ENEMY_TYPES.ASTEROID]
  }
};

export function SpawnSystem(dt, world) {
  // Initialize spawn system state
  if (!SpawnSystem.initialized) {
    SpawnSystem.last = 0;
    SpawnSystem.spawnRate = 0.9; // Default spawn rate
    SpawnSystem.paused = false;
    SpawnSystem.initialized = true;
    SpawnSystem.currentSector = 1;

    // Expose control methods globally for level progression
    window.spawnSystem = {
      pause: () => { SpawnSystem.paused = true; },
      resume: () => { SpawnSystem.paused = false; },
      setSpawnRate: (rate) => { SpawnSystem.spawnRate = rate; },
      isPaused: () => SpawnSystem.paused,
      setSector: (sector) => { 
        SpawnSystem.currentSector = sector;
        const config = SECTOR_CONFIG[sector] || SECTOR_CONFIG[1];
        SpawnSystem.spawnRate = config.spawnRate;
      },
      getCurrentSector: () => SpawnSystem.currentSector,
      getSectorConfig: () => SECTOR_CONFIG[SpawnSystem.currentSector] || SECTOR_CONFIG[1]
    };
  }
  
  // Don't spawn if paused
  if (SpawnSystem.paused) return;
  
  // Get current sector configuration
  const currentConfig = SECTOR_CONFIG[SpawnSystem.currentSector] || SECTOR_CONFIG[1];
  
  SpawnSystem.last += dt;
  if (SpawnSystem.last > SpawnSystem.spawnRate) {
    SpawnSystem.last = 0;
    
    // Debug: Show current sector info
    if (Math.random() < 0.1) { // Only log occasionally to avoid spam
      console.log(`[SPAWN] Sector ${SpawnSystem.currentSector} config:`, currentConfig);
    }
    
    // Determine which enemy type to spawn based on sector configuration (weighted random)
    const enemyType = selectEnemyTypeForSector(SpawnSystem.currentSector);
    
    if (enemyType) {
      spawnEnemyOfType(world, enemyType);
    }
  }
}

function getEnemyConfigKey(enemyType) {
  switch (enemyType) {
    case ENEMY_TYPES.BASIC: return 'basic';
    case ENEMY_TYPES.HUNTER_SEEKER: return 'hunterSeeker';
    case ENEMY_TYPES.GEO_LANCER: return 'geoLancer';
    case ENEMY_TYPES.FABRICATOR: return 'fabricator';
    case ENEMY_TYPES.ASTEROID: return 'asteroid';
    default: return 'basic';
  }
}

function selectEnemyTypeForSector(sector) {
  const config = SECTOR_CONFIG[sector] || SECTOR_CONFIG[1];
  const weights = config.enemies || {};

  // Build weighted list (frequency = configured count)
  const weighted = [];
  Object.entries(weights).forEach(([key, count]) => {
    const enemyType = getEnemyTypeFromKey(key);
    const times = Math.max(0, Math.floor(count));
    for (let i = 0; i < times; i++) weighted.push(enemyType);
  });

  if (weighted.length === 0) return ENEMY_TYPES.BASIC;

  const selected = weighted[Math.floor(Math.random() * weighted.length)];
  console.log(`[SPAWN] Sector ${sector}: Selected ${selected} from ${weighted.length} options`);
  return selected;
}

function getEnemyTypeFromKey(key) {
  switch (key) {
    case 'basic': return ENEMY_TYPES.BASIC;
    case 'hunterSeeker': return ENEMY_TYPES.HUNTER_SEEKER;
    case 'geoLancer': return ENEMY_TYPES.GEO_LANCER;
    case 'fabricator': return ENEMY_TYPES.FABRICATOR;
    case 'asteroid': return ENEMY_TYPES.ASTEROID;
    default: return ENEMY_TYPES.BASIC;
  }
}

function spawnEnemyOfType(world, enemyType) {
  const canvas = world.canvas;
  const baseY = 80 + Math.random() * (canvas.height - 160);
  const spawnX = canvas.width + 50;
  
  let enemy;
  
  switch (enemyType) {
    case ENEMY_TYPES.HUNTER_SEEKER:
      enemy = createHunterSeeker(spawnX, baseY);
      console.log(`[SPAWN] Created Hunter-Seeker at (${spawnX}, ${baseY})`);
      break;
      
    case ENEMY_TYPES.GEO_LANCER:
      // Spawn Geo-Lancers in asteroid fields (slightly varied positions)
      enemy = createGeoLancer(spawnX + Math.random() * 100, baseY + (Math.random() - 0.5) * 60);
      console.log(`[SPAWN] Created Geo-Lancer at (${spawnX}, ${baseY})`);
      break;
      
    case ENEMY_TYPES.FABRICATOR:
      enemy = createFabricator(spawnX, baseY);
      console.log(`[SPAWN] Created Fabricator at (${spawnX}, ${baseY})`);
      break;
      
    case ENEMY_TYPES.ASTEROID:
      const asteroidSize = Math.random() < 0.6 ? 'medium' : (Math.random() < 0.8 ? 'small' : 'large');
      enemy = createAsteroid(spawnX, baseY, asteroidSize);
      console.log(`[SPAWN] Created Asteroid (${asteroidSize}) at (${spawnX}, ${baseY})`);
      break;
      
    case ENEMY_TYPES.BASIC:
    default:
      const r = 10 + Math.random() * 14;
      enemy = createEnemy(spawnX, baseY, r, ENEMY_TYPES.BASIC);
      console.log(`[SPAWN] Created Basic Enemy at (${spawnX}, ${baseY})`);
      break;
  }
  
  if (enemy) {
    addEntity(world, enemy);
  } else {
    console.error(`[SPAWN] Failed to create enemy of type: ${enemyType}`);
  }
}


