document.addEventListener('DOMContentLoaded', () => {
  console.log('Project Chimera: Landing page ready.');

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  const startBtn = $('#startBtn');
  const leaderboardBtn = $('#leaderboardBtn');
  const toast = $('#toast');
  const openButtons = $$('button[data-open]');
  const modals = {
    how: $('#modal-how'),
    blueprints: $('#modal-blueprints'),
    credits: $('#modal-credits'),
  };

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
      showToast('Starting run... (placeholder)');
    });
  }
  if (leaderboardBtn) {
    leaderboardBtn.addEventListener('click', () => {
      showToast('Leaderboard coming soon...');
    });
  }

  // Hover updates selection (mouse users)
  menuItems.forEach((el, i) => {
    el.addEventListener('mouseenter', () => {
      if (!el.classList.contains('disabled')) updateSelection(i);
    });
  });
});
