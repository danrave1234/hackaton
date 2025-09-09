export function createPlayer(x, y) {
  return {
    tags: ['player'],
    pos: { x, y },
    vel: { x: 0, y: 0 },
    size: { w: 120, h: 60 }, // Made spaceship bigger
    stats: { speed: 260 },
    color: '#a7f3d0',
    weapons: [{ rate: 0.12, speed: 520, w: 4, h: 1 }], // Ultra tiny bullets
    lastShot: 0,
    health: { current: 100, max: 100 },
    shield: { current: 0, max: 0, instances: 0 }, // Based on defensive cards from project idea
  };
}

export function createEnemy(x, y, r = 16, type = 'basic') {
  return {
    tags: ['enemy'],
    pos: { x, y },
    vel: { x: -160, y: 0 },
    radius: r,
    color: '#fca5a5',
    type: type,
    // Use spritesheet for BASIC enemy (@Basic enemy.png)
    sprite: type === 'basic' ? '@basic_enemy.png' : undefined,
    // 4x4 grid: first row is flying animation
    spriteGrid: type === 'basic' ? '4x4' : undefined,
    spriteAnim: type === 'basic' ? '0,1,2,3' : undefined,
    spriteFps: type === 'basic' ? 10 : undefined,
    spriteIndex: 0,
    health: 2
  };
}

// Enemy type definitions based on ENEMY_TYPES.MD
export const ENEMY_TYPES = {
  BASIC: 'basic',
  HUNTER_SEEKER: 'hunter-seeker',
  GEO_LANCER: 'geo-lancer', 
  FABRICATOR: 'fabricator',
  ASTEROID: 'asteroid',
  BOSS_BIO_MECHANICAL: 'boss-bio-mechanical',
  BOSS_SENTINEL_PRIME: 'boss-sentinel-prime'
};

// Hunter-Seeker: High-speed ramming drone
export function createHunterSeeker(x, y) {
  return {
    tags: ['enemy', 'hunter-seeker'],
    pos: { x, y },
    vel: { x: -80, y: 0 }, // Slower initial movement
    radius: 18,
    color: '#ff4444',
    type: ENEMY_TYPES.HUNTER_SEEKER,
    // Sprite available in assets (4x4 sheet)
    sprite: '@basic_enemy.png',
    spriteGrid: '4x4',
    spriteAnim: '0,1,2,3',
    spriteFps: 10,
    spriteIndex: 0,
    behavior: {
      phase: 'lock-on', // 'lock-on', 'pursuit', 'correction'
      lockTimer: 1.0, // Time to acquire target
      targetPos: { x: 0, y: 0 },
      speed: 300,
      correctionDelay: 0.3,
      correctionTimer: 0
    },
    health: 1
  };
}

// Geo-Lancer: Disguised asteroid turret
export function createGeoLancer(x, y) {
  return {
    tags: ['enemy', 'geo-lancer'],
    pos: { x, y },
    vel: { x: 0, y: 0 }, // Stationary
    radius: 20,
    color: '#8b7355', // Rock-like color
    type: ENEMY_TYPES.GEO_LANCER,
    // Sprite available in assets
    sprite: '@geo_lancer_enemy_type_2.png',
    // Spritesheet grid (cols x rows). Image is a 3x4 sheet (12 frames)
    spriteGrid: '3x4',
    // Current frame index (0-based). Renderer will pick sensible frames by state
    spriteIndex: 0,
    behavior: {
      active: false,
      detectionRange: 250,
      chargeTime: 1.5,
      chargeTimer: 0,
      fireRate: 2.0,
      lastShot: 0
    },
    health: 3,
    disguised: true // Appears as regular asteroid initially
  };
}

// Fabricator: Heavy unit that spawns smaller enemies
export function createFabricator(x, y) {
  return {
    tags: ['enemy', 'fabricator'],
    pos: { x, y },
    vel: { x: -60, y: 0 }, // Slow movement
    radius: 48,
    color: '#666666',
    type: ENEMY_TYPES.FABRICATOR,
    // Sprite available in assets
    sprite: '@the_fabricator_summoner_enemy_type_3.png',
    // Spritesheet layout based on provided image (3 columns x 3 rows)
    spriteGrid: '3x3',
    spriteIndex: 0,
    behavior: {
      spawnCycle: 3.0,
      spawnTimer: 0,
      maxMinions: 4,
      minionCount: 0,
      attackCycle: 2.0,
      attackTimer: 0,
      heavyWeapons: true
    },
    health: 8,
    size: 'large'
  };
}

// Basic Asteroid enemy (environmental hazard)
export function createAsteroid(x, y, size = 'medium') {
  const sizeConfig = {
    small: { radius: 15, health: 2, speed: -120 },
    medium: { radius: 25, health: 4, speed: -80 },
    large: { radius: 40, health: 8, speed: -50 }
  };
  
  const config = sizeConfig[size] || sizeConfig.medium;
  
  return {
    tags: ['enemy', 'asteroid'],
    pos: { x, y },
    vel: { x: config.speed + Math.random() * 40, y: (Math.random() - 0.5) * 30 },
    radius: config.radius,
    color: '#a0a0a0',
    type: ENEMY_TYPES.ASTEROID,
    // Sprite available in assets
    sprite: '@meteorite.png',
    behavior: {
      rotation: Math.random() * Math.PI * 2,
      rotationSpeed: (Math.random() - 0.5) * 2,
      drift: (Math.random() - 0.5) * 20
    },
    health: config.health,
    size: size
  };
}

// Minion enemy spawned by Fabricator
export function createMinion(x, y) {
  return {
    tags: ['enemy', 'minion'],
    pos: { x, y },
    vel: { x: -200 + Math.random() * 100, y: (Math.random() - 0.5) * 80 },
    radius: 12,
    color: '#ff8888',
    type: 'minion',
    // Sprite available in assets
    sprite: '@the_fabricator_minion_enemy_type_3.png',
    // Gnat sheet layout is 3 columns x 2 rows based on provided image
    spriteGrid: '3x2',
    // Animate flying using the first row frames
    spriteAnim: '0,1,2',
    spriteFps: 8,
    spriteIndex: 0,
    behavior: {
      swarm: true,
      lifetime: 15.0, // Auto-destruct after 15 seconds
      timer: 0
    },
    health: 1,
    scoreValue: 50
  };
}

// Bio-Mechanical Overmind Boss (Level 5)
export function createBioMechanicalOvermind(x, y) {
  return {
    tags: ['enemy', 'boss', 'bio-mechanical'],
    pos: { x, y },
    vel: { x: 0, y: 0 }, // Start stationary, will hover around center
    radius: 80, // Large boss
    color: '#8B0000', // Dark red
    type: ENEMY_TYPES.BOSS_BIO_MECHANICAL,
    sprite: 'boss_spaceship.png', // Use the specified sprite
    behavior: {
      // Simplified for 1-minute fight
      hoverCenterX: 0, // Will be set to screen center
      hoverCenterY: 0, // Will be set to screen center
      hoverRadius: 100, // How far from center to hover
      hoverAngle: 0, // Current angle around center
      hoverSpeed: 1.0, // Angular speed
      moveToCenter: true, // Initially move to center
      
      // Attack patterns - simplified
      attackTimer: 0,
      attackRate: 2.0, // Attack every 2 seconds
      attackType: 0, // Cycles through different attacks
      
      // Movement
      targetX: x,
      targetY: y,
      moveSpeed: 60
    },
    health: 300, // Level 5 boss HP
    maxHealth: 300,
    size: 'boss',
    scoreValue: 5000,
    isBoss: true
  };
}

// Sentinel Prime Final Boss (Level 10)
export function createSentinelPrime(x, y) {
  return {
    tags: ['enemy', 'boss', 'sentinel-prime'],
    pos: { x, y },
    vel: { x: 0, y: 0 }, // Start stationary, will hover around center
    radius: 120, // Massive boss
    color: '#FFD700', // Gold/orange
    type: ENEMY_TYPES.BOSS_SENTINEL_PRIME,
    sprite: 'final_boss_evil.png', // Use the specified sprite
    behavior: {
      // Simplified for manageable fight
      hoverCenterX: 0, // Will be set to screen center
      hoverCenterY: 0, // Will be set to screen center
      hoverRadius: 120, // How far from center to hover
      hoverAngle: 0, // Current angle around center
      hoverSpeed: 0.8, // Angular speed (slower than level 5 boss)
      moveToCenter: true, // Initially move to center
      
      // Attack patterns - simplified
      attackTimer: 0,
      attackRate: 1.8, // Attack every 1.8 seconds (slightly faster than level 5)
      attackType: 0, // Cycles through different attacks
      
      // Movement
      targetX: x,
      targetY: y,
      moveSpeed: 50
    },
    health: 450, // Level 10 boss HP
    maxHealth: 450,
    size: 'final_boss',
    scoreValue: 25000,
    isBoss: true,
    isFinalBoss: true
  };
}

// Bio-Tendril (spawned by Bio-Mechanical Overmind)
export function createBioTendril(x, y, parentId) {
  return {
    tags: ['enemy', 'bio-tendril'],
    pos: { x, y },
    vel: { x: 0, y: 0 },
    radius: 25,
    color: '#654321',
    type: 'bio-tendril',
    behavior: {
      parentId: parentId,
      regenerating: false,
      fireTimer: 0,
      fireRate: 2.0,
      waveOffset: Math.random() * Math.PI * 2,
      extensionLength: 60
    },
    health: 40,
    maxHealth: 40,
    scoreValue: 200
  };
}

// Phantom Core Drone (spawned by Sentinel Prime)
export function createPhantomDrone(x, y, parentId) {
  return {
    tags: ['enemy', 'phantom-drone'],
    pos: { x, y },
    vel: { x: 0, y: 0 },
    radius: 20,
    color: '#4169E1',
    type: 'phantom-drone',
    behavior: {
      parentId: parentId,
      orbitAngle: Math.random() * Math.PI * 2,
      orbitRadius: 150,
      orbitSpeed: 1.5,
      mimicTimer: 0,
      mimicRate: 1.8
    },
    health: 50,
    maxHealth: 50,
    scoreValue: 300
  };
}

export function createBullet(x, y, vx, vy, w, h) {
  return {
    tags: ['bullet'],
    pos: { x, y },
    vel: { x: vx, y: vy },
    rect: { w: Math.max(1, w), h: Math.max(1, h) },
    damage: 1
  };
}


