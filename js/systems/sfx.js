// Sound Effects System: low-latency Web Audio with HTMLAudio fallback

function resolveAsset(src) {
  const replaced = (src || '').replace(/^@asset\//, 'asset/');
  const path = window.location.pathname || '';
  const needsUp = /\/pages\//.test(path);
  if (needsUp && replaced.startsWith('asset/')) return `../${replaced}`;
  return replaced;
}

export function createSfxSystem(canvas) {
  const laserSrc = resolveAsset(canvas?.dataset?.laserSfx || '@asset/sfx/laser_shoot.mp3');
  const explosionSrc = resolveAsset(canvas?.dataset?.explosionSfx || '@asset/sfx/explosion.mp3');

  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  const canUseWebAudio = typeof AudioCtx === 'function';

  let ctx = null;
  let laserBuffer = null;
  let explosionBuffer = null;
  let laserGain = null;
  let explosionGain = null;

  // Fallback pools
  const laserPool = Array.from({ length: 6 }, () => Object.assign(new Audio(laserSrc), { preload: 'auto', volume: 0.35 }));
  let laserIdx = 0;
  const explosionPool = Array.from({ length: 5 }, () => Object.assign(new Audio(explosionSrc), { preload: 'auto', volume: 0.5 }));
  let explosionIdx = 0;

  async function fetchArrayBuffer(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.arrayBuffer();
  }

  async function loadBuffers() {
    if (!canUseWebAudio) return;
    try {
      ctx = ctx || new AudioCtx({ latencyHint: 'interactive' });
      const [laserAb, explosionAb] = await Promise.all([
        fetchArrayBuffer(laserSrc),
        fetchArrayBuffer(explosionSrc),
      ]);
      // decodeAudioData may be promise-based or callback-based depending on browser
      const decode = (ab) => new Promise((resolve, reject) => {
        ctx.decodeAudioData(ab.slice(0), resolve, reject);
      });
      [laserBuffer, explosionBuffer] = await Promise.all([decode(laserAb), decode(explosionAb)]);
      laserGain = ctx.createGain();
      explosionGain = ctx.createGain();
      laserGain.gain.value = 0.35;
      explosionGain.gain.value = 0.5;
      laserGain.connect(ctx.destination);
      explosionGain.connect(ctx.destination);
      if (window.DEBUG_SFX) console.log('[SFX] WebAudio buffers loaded');
    } catch (err) {
      if (window.DEBUG_SFX) console.warn('[SFX] WebAudio load failed, using HTMLAudio fallback', err);
    }
  }

  function playWithWebAudio(buffer, gainNode, when = 0) {
    if (!ctx || !buffer || !gainNode) return false;
    try {
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.connect(gainNode);
      // Schedule immediately or at specified time
      const startTime = when > 0 ? when : ctx.currentTime;
      src.start(startTime);
      return true;
    } catch {
      return false;
    }
  }

  function playLaser() {
    // If audio context is suspended, try to resume but don't queue sounds
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().catch(() => {}); // Just try to resume, don't queue the sound
      // Fall through to HTMLAudio fallback instead of queueing
    }
    
    // Try Web Audio first
    let played = false;
    if (ctx && laserBuffer && laserGain && ctx.state === 'running') {
      try {
        const src = ctx.createBufferSource();
        src.buffer = laserBuffer;
        src.connect(laserGain);
        src.start(0);
        played = true;
        if (window.DEBUG_SFX) console.log('[SFX] laser WebAudio success');
      } catch (err) {
        if (window.DEBUG_SFX) console.warn('[SFX] WebAudio laser failed:', err);
      }
    }
    
    // HTMLAudio fallback
    if (!played) {
      const a = laserPool[laserIdx];
      laserIdx = (laserIdx + 1) % laserPool.length;
      try {
        a.currentTime = 0;
        a.volume = 0.35; // Ensure volume is set
        const promise = a.play();
        if (promise) {
          promise.catch((err) => {
            if (window.DEBUG_SFX) console.warn('[SFX] HTMLAudio laser failed:', err);
          });
        }
        played = true;
        if (window.DEBUG_SFX) console.log('[SFX] laser HTMLAudio success');
      } catch (err) {
        if (window.DEBUG_SFX) console.warn('[SFX] HTMLAudio laser error:', err);
      }
    }
  }
  
  function playExplosion() {
    // If audio context is suspended, try to resume but don't queue sounds
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().catch(() => {}); // Just try to resume, don't queue the sound
      // Fall through to HTMLAudio fallback instead of queueing
    }
    
    // Try Web Audio first, fallback to HTMLAudio only if needed
    let played = false;
    
    // First try Web Audio if available and running
    if (ctx && explosionBuffer && explosionGain && ctx.state === 'running') {
      try {
        const src = ctx.createBufferSource();
        src.buffer = explosionBuffer;
        src.connect(explosionGain);
        src.start(0);
        played = true;
        if (window.DEBUG_SFX) console.log('[SFX] explosion WebAudio success');
      } catch (err) {
        if (window.DEBUG_SFX) console.warn('[SFX] WebAudio explosion failed:', err);
      }
    }
    
    // Only use HTMLAudio if WebAudio failed
    if (!played) {
      const a = explosionPool[explosionIdx];
      explosionIdx = (explosionIdx + 1) % explosionPool.length;
      try {
        a.currentTime = 0;
        a.volume = 0.5; // Ensure volume is set
        const promise = a.play();
        if (promise) {
          promise.then(() => {
            if (window.DEBUG_SFX) console.log('[SFX] explosion HTMLAudio success');
          }).catch((err) => {
            if (window.DEBUG_SFX) console.warn('[SFX] HTMLAudio explosion failed:', err);
          });
        }
        played = true;
      } catch (err) {
        if (window.DEBUG_SFX) console.warn('[SFX] HTMLAudio explosion error:', err);
      }
    }
    
    if (window.DEBUG_SFX && !played) {
      console.error('[SFX] All explosion playback methods failed!');
    }
  }

  // One-time attach + unlock
  let attached = false;
  let unlocked = false;
  async function tryUnlockAudio() {
    if (unlocked) return;
    unlocked = true;
    if (canUseWebAudio) {
      try {
        ctx = ctx || new AudioCtx({ latencyHint: 'interactive' });
        await ctx.resume();
        await loadBuffers();
      } catch {}
    } else {
      // Prime HTMLAudio pool more reliably
      const toPrime = [...laserPool, ...explosionPool];
      for (const a of toPrime) {
        try { 
          a.muted = true; 
          a.volume = 0; 
          const p = a.play(); 
          if (p?.then) {
            await p.then(() => {
              a.pause(); 
              a.currentTime = 0; 
              a.muted = false; 
              a.volume = laserPool.includes(a) ? 0.35 : 0.5;
            }).catch(() => {
              a.pause(); 
              a.currentTime = 0; 
              a.muted = false; 
              a.volume = laserPool.includes(a) ? 0.35 : 0.5;
            });
          } else {
            a.pause(); 
            a.currentTime = 0; 
            a.muted = false; 
            a.volume = laserPool.includes(a) ? 0.35 : 0.5;
          }
        } catch {}
      }
    }
    if (window.DEBUG_SFX) console.log('[SFX] audio unlocked (ctx:', !!ctx, 'buffers:', !!laserBuffer, !!explosionBuffer, ')');
  }
  
  function attach(bus) {
    if (attached) return;
    attached = true;
    
    if (window.DEBUG_SFX) console.log('[SFX] Attaching event listeners to bus');
    
    // Simple immediate playback for consistent audio
    bus.on('sfx:laser', () => {
      if (window.DEBUG_SFX) console.log('[SFX] Laser event received');
      playLaser();
    });
    
    bus.on('sfx:explosion', (data) => {
      if (window.DEBUG_SFX) {
        console.log('[SFX] Explosion event received', data);
        console.log('[SFX] Audio context state:', ctx?.state);
        console.log('[SFX] Buffers loaded:', !!laserBuffer, !!explosionBuffer);
      }
      playExplosion();
    });
    
    // Try to unlock audio immediately on any user interaction
    const unlockOnce = () => { 
      document.removeEventListener('pointerdown', unlockOnce); 
      document.removeEventListener('keydown', unlockOnce); 
      document.removeEventListener('touchstart', unlockOnce);
      document.removeEventListener('click', unlockOnce);
      tryUnlockAudio(); 
    };
    document.addEventListener('pointerdown', unlockOnce, { once: true });
    document.addEventListener('keydown', unlockOnce, { once: true });
    document.addEventListener('touchstart', unlockOnce, { once: true });
    document.addEventListener('click', unlockOnce, { once: true });
    
    // Also try to unlock when the page becomes visible (in case user switched tabs)
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && ctx && ctx.state === 'suspended') {
        tryUnlockAudio();
      }
    });
    
    // Start buffer loading and try initial unlock immediately
    loadBuffers();
    
    // Try to unlock immediately if possible (some browsers allow it)
    setTimeout(() => {
      if (!unlocked) {
        tryUnlockAudio();
      }
    }, 100);
  }

  return {
    system(dt, world, bus) {
      // Only attach once, then do nothing
      if (!attached) {
        attach(bus);
      }
      // No need to do anything else in subsequent frames
    }
  };
}


