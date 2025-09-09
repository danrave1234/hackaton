// Sound Effects System: listens to bus events and plays audio

function resolveAsset(src) {
  const replaced = (src || '').replace(/^@asset\//, 'asset/');
  // If we're on a page under /pages/, prefix one level up so URLs work: ../asset/...
  const path = window.location.pathname || '';
  const needsUp = /\/pages\//.test(path);
  if (needsUp && replaced.startsWith('asset/')) return `../${replaced}`;
  return replaced;
}

export function createSfxSystem(canvas) {
  const laserSrc = resolveAsset(canvas?.dataset?.laserSfx || '@asset/sfx/laser_shoot.mp3');
  const explosionSrc = resolveAsset(canvas?.dataset?.explosionSfx || '@asset/sfx/explosion.mp3');

  const laserPool = Array.from({ length: 6 }, () => {
    const a = new Audio(laserSrc);
    a.volume = 0.35;
    return a;
  });
  let laserIdx = 0;

  const explosionPool = Array.from({ length: 5 }, () => {
    const a = new Audio(explosionSrc);
    a.volume = 0.5;
    return a;
  });
  let explosionIdx = 0;

  function playLaser() {
    const a = laserPool[laserIdx];
    laserIdx = (laserIdx + 1) % laserPool.length;
    try { a.currentTime = 0; const p = a.play(); if (p?.catch) p.catch(() => {}); } catch {}
  }
  function playExplosion() {
    const a = explosionPool[explosionIdx];
    explosionIdx = (explosionIdx + 1) % explosionPool.length;
    try { a.currentTime = 0; const p = a.play(); if (p?.catch) p.catch(() => {}); } catch {}
  }

  // No per-frame work needed; we just attach listeners once
  let attached = false;
  function attach(bus) {
    if (attached) return;
    attached = true;
    bus.on('sfx:laser', playLaser);
    bus.on('sfx:explosion', playExplosion);
  }

  return {
    system(dt, world, bus) {
      attach(bus);
    }
  };
}


