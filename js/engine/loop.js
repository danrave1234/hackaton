// Simple game loop orchestrator that runs systems in order
// Systems must be functions with signature: (dt, world, bus)

export function createLoop(systems, world, bus) {
  let last = performance.now();

  function frame(now) {
    const dt = Math.min(0.033, (now - last) / 1000);
    last = now;
    world.time += dt;

    for (const sys of systems) sys(dt, world, bus);

    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
}


