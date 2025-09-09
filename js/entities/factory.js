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
  };
}

// Enemy type definitions based on ENEMY_TYPES.MD
export const ENEMY_TYPES = {
  BASIC: 'basic',
  HUNTER_SEEKER: 'hunter-seeker',
  GEO_LANCER: 'geo-lancer', 
  FABRICATOR: 'fabricator',
  ASTEROID: 'asteroid'
};

// Hunter-Seeker: High-speed ramming drone
export function createHunterSeeker(x, y) {
  return {
    tags: ['enemy', 'hunter-seeker'],
    pos: { x, y },
    vel: { x: -80, y: 0 }, // Slower initial movement
    radius: 12,
    color: '#ff4444',
    type: ENEMY_TYPES.HUNTER_SEEKER,
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
    radius: 35,
    color: '#666666',
    type: ENEMY_TYPES.FABRICATOR,
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
    radius: 8,
    color: '#ff8888',
    type: 'minion',
    behavior: {
      swarm: true,
      lifetime: 15.0, // Auto-destruct after 15 seconds
      timer: 0
    },
    health: 1,
    scoreValue: 50
  };
}

export function createBullet(x, y, vx, vy, w, h) {
  return {
    tags: ['bullet'],
    pos: { x, y },
    vel: { x: vx, y: vy },
    rect: { w: Math.max(48, w), h: Math.max(16, h) },
  };
}


