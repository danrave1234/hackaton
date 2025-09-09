export function createScoreSystem(hudScoreEl) {
  let score = 0;
  return {
    system(dt, world, bus) {
      // subscribe once
      if (!createScoreSystem._subscribed) {
        bus.on('score:add', (v) => { score += v; });
        createScoreSystem._subscribed = true;
      }
      if (hudScoreEl) hudScoreEl.textContent = `Score ${String(score).padStart(6, '0')}`;
    },
  };
}


