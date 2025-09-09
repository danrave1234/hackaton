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

export function createEnemy(x, y, r = 16) {
  return {
    tags: ['enemy'],
    pos: { x, y },
    vel: { x: -160, y: 0 },
    radius: r,
    color: '#fca5a5',
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


