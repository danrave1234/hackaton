document.addEventListener('DOMContentLoaded', () => {
  console.log('Project Chimera: Landing page ready.');

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  const startBtn = $('#startBtn');
  const leaderboardBtn = $('#leaderboardBtn');
  const creditsBtn = $('#creditsBtn');
  const toast = $('#toast');
  const openButtons = $$('button[data-open]');
  const modals = {
    how: $('#modal-how'),
    blueprints: $('#modal-blueprints'),
    credits: $('#modal-credits'),
  };

  // Background music (menu)
  const defaultMenuMusic = '@asset/music/menu_music.mp3';
  const menuMusicSrcRaw = document.body?.dataset?.menuMusic || defaultMenuMusic;
  const menuMusicSrc = menuMusicSrcRaw.replace(/^@asset\//, 'asset/');
  /** @type {HTMLAudioElement | null} */
  let bgm = null;
  function initMenuMusic() {
    if (bgm) return;
    bgm = new Audio(menuMusicSrc);
    bgm.loop = true;
    bgm.volume = 0.4;
    bgm.preload = 'auto';
    try { bgm.load(); } catch {}
    // Attempt to start when the audio can play through without buffering
    const onCanPlay = () => {
      bgm && bgm.removeEventListener('canplaythrough', onCanPlay);
      tryPlayBgm();
    };
    bgm.addEventListener('canplaythrough', onCanPlay, { once: true });
  }
  function tryPlayBgm() {
    if (!bgm) initMenuMusic();
    if (!bgm) return;
    const p = bgm.play();
    if (p && typeof p.then === 'function') {
      p.catch(() => {
        // Autoplay blocked; wait for first user interaction
        const once = () => {
          document.removeEventListener('pointerdown', once);
          document.removeEventListener('keydown', once);
          document.removeEventListener('touchstart', once);
          document.removeEventListener('click', once);
          try { bgm && bgm.play(); } catch {}
        };
        document.addEventListener('pointerdown', once, { once: true });
        document.addEventListener('keydown', once, { once: true });
        document.addEventListener('touchstart', once, { once: true });
        document.addEventListener('click', once, { once: true });
      });
    }
  }
  initMenuMusic();
  tryPlayBgm();

  function openModal(name) {
    const modal = modals[name];
    if (!modal) return;
    modal.classList.remove('tw-hidden');
    modal.classList.add('tw-flex');
  }

  function closeModal(modal) {
    modal.classList.add('tw-hidden');
    modal.classList.remove('tw-flex');
  }

  openButtons.forEach((btn) => {
    btn.addEventListener('click', () => openModal(btn.getAttribute('data-open')));
  });

  $$('.modal-close').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const modal = e.target.closest('section');
      if (modal) closeModal(modal);
    });
  });

  Object.values(modals).forEach((modal) => {
    if (!modal) return;
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal(modal); // click on backdrop
    });
  });

  // Menu selection helpers
  const menuItems = $$('#menu .item');
  const activeBar = document.getElementById('menuActiveBar');
  let selectedIndex = Math.max(0, menuItems.findIndex((el) => el.classList.contains('selected')));
  function updateSelection(newIndex) {
    if (!menuItems.length) return;
    if (newIndex < 0) newIndex = 0;
    if (newIndex > menuItems.length - 1) newIndex = menuItems.length - 1;
    menuItems.forEach((el, i) => {
      if (i === newIndex) {
        el.classList.add('selected');
        el.setAttribute('tabindex', '0');
      } else {
        el.classList.remove('selected');
        el.setAttribute('tabindex', '-1');
      }
    });
    selectedIndex = newIndex;
    if (activeBar) {
      const target = menuItems[selectedIndex];
      const parentRect = target.parentElement.getBoundingClientRect();
      const rect = target.getBoundingClientRect();
      activeBar.style.top = (rect.top - parentRect.top) + 'px';
      activeBar.style.height = rect.height + 'px';
      activeBar.style.opacity = '1';
    }
  }

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      Object.values(modals).forEach((m) => {
        if (m && !m.classList.contains('tw-hidden')) closeModal(m);
      });
      return;
    }

    if (!menuItems.length) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      updateSelection(Math.min(menuItems.length - 1, selectedIndex + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      updateSelection(Math.max(0, selectedIndex - 1));
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      const el = menuItems[selectedIndex];
      if (el) el.click();
    }
  });

  function showToast(message, duration = 1400) {
    if (!toast) return;
    const box = toast.querySelector('div') || toast;
    const prev = box.textContent;
    box.textContent = message;
    toast.classList.remove('tw-hidden');
    setTimeout(() => {
      toast.classList.add('tw-hidden');
      box.textContent = prev;
    }, duration);
  }

  if (startBtn) {
    startBtn.addEventListener('click', () => {
      window.location.href = 'pages/game.html?round=1';
    });
  }
  if (leaderboardBtn) {
    leaderboardBtn.addEventListener('click', () => {
      window.location.href = 'pages/leaderboard.html';
    });
  }
  if (creditsBtn) {
    creditsBtn.addEventListener('click', () => {
      const modal = modals.credits;
      if (modal) {
        modal.classList.remove('tw-hidden');
        modal.classList.add('tw-flex');
      }
    });
  }

  // Hover updates selection (mouse users)
  menuItems.forEach((el, i) => {
    el.addEventListener('mouseenter', () => {
      if (!el.classList.contains('disabled')) updateSelection(i);
    });
    el.addEventListener('click', () => updateSelection(i));
  });

  // Initial position after layout
  window.requestAnimationFrame(() => updateSelection(selectedIndex));
});
