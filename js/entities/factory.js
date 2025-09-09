export function createPlayer(x, y) {
  return {
    tags: ['player'],
    pos: { x, y },
    vel: { x: 0, y: 0 },
    size: { w: 96, h: 48 },
    stats: { speed: 260 },
    color: '#a7f3d0',
    weapons: [{ rate: 0.12, speed: 520, w: 14, h: 4 }],
    lastShot: 0,
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
    rect: { w, h },
  };
}


