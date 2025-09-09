// Background Music System: looped music that switches based on current sector

function resolveAsset(src) {
  const replaced = (src || '').replace(/^@asset\//, 'asset/');
  const path = window.location.pathname || '';
  const needsUp = /\/pages\//.test(path);
  if (needsUp && replaced.startsWith('asset/')) return `../${replaced}`;
  return replaced;
}

function selectTrackForSector(sector) {
  if (!Number.isFinite(sector) || sector < 1) sector = 1;
  if (sector <= 2) return '@asset/music/sector_1_2.mp3';
  if (sector <= 4) return '@asset/music/sector_3_4.mp3';
  if (sector <= 6) return '@asset/music/sector_5_6.mp3';
  if (sector <= 8) return '@asset/music/sector_7_8.mp3';
  return '@asset/music/sector_9_10.mp3';
}

export function createMusicSystem(canvas) {
  // Single HTMLAudio element for background track
  const audio = new Audio();
  audio.loop = true;
  audio.preload = 'auto';
  audio.volume = 0.35;
  audio.muted = true; // allow autoplay for priming, unmute on gesture

  let attached = false;
  let currentSector = 0;
  let currentSrc = '';

  function getSector() {
    if (window.spawnSystem && typeof window.spawnSystem.getCurrentSector === 'function') {
      return window.spawnSystem.getCurrentSector();
    }
    try {
      const params = new URLSearchParams(window.location.search);
      const round = Math.max(1, parseInt(params.get('round') || '1', 10) || 1);
      return round;
    } catch {
      return 1;
    }
  }

  async function ensurePlaying() {
    try {
      if (audio.paused && audio.src) {
        const p = audio.play();
        if (p && typeof p.then === 'function') {
          await p.catch(() => {});
        }
      }
    } catch {}
  }

  function switchTrackForSector(sector) {
    const wanted = resolveAsset(selectTrackForSector(sector));
    if (wanted === currentSrc) return;
    currentSrc = wanted;
    audio.src = wanted;
    // Try immediate play; browsers may block until user interaction
    try { audio.load(); } catch {}
    const onReady = () => {
      audio.removeEventListener('canplaythrough', onReady);
      ensurePlaying();
    };
    audio.addEventListener('canplaythrough', onReady, { once: true });
  }

  function attach() {
    if (attached) return;
    attached = true;

    // Initial selection
    currentSector = getSector();
    switchTrackForSector(currentSector);

    // Try to start on first user interaction (mobile/desktop autoplay policies)
    const unlockOnce = () => {
      document.removeEventListener('pointerdown', unlockOnce);
      document.removeEventListener('keydown', unlockOnce);
      document.removeEventListener('touchstart', unlockOnce);
      document.removeEventListener('click', unlockOnce);
      try { audio.muted = false; } catch {}
      ensurePlaying();
    };
    document.addEventListener('pointerdown', unlockOnce, { once: true });
    document.addEventListener('keydown', unlockOnce, { once: true });
    document.addEventListener('touchstart', unlockOnce, { once: true });
    document.addEventListener('click', unlockOnce, { once: true });

    // Pause when hidden, resume when visible
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        try { audio.pause(); } catch {}
      } else {
        ensurePlaying();
      }
    });
  }

  return {
    system(dt, world, bus) {
      if (!attached) attach();

      // Poll for sector changes and switch track accordingly
      const s = getSector();
      if (s !== currentSector) {
        currentSector = s;
        switchTrackForSector(s);
      }
    }
  };
}


