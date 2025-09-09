let nextId = 1;

export function createWorld(ctx, canvas) {
  // Get sector from URL parameters
  const params = new URLSearchParams(window.location.search);
  const sector = Math.max(1, Math.min(10, parseInt(params.get('round') || '1', 10) || 1));
  
  return {
    time: 0,
    ctx,
    canvas,
    entities: new Map(),
    byTag: new Map(),
    toRemove: new Set(),
    sector, // Current sector (1-10)
  };
}

export function addEntity(world, entity) {
  const id = entity.id ?? nextId++;
  entity.id = id;
  world.entities.set(id, entity);
  const tags = entity.tags || [];
  for (const t of tags) {
    if (!world.byTag.has(t)) world.byTag.set(t, new Set());
    world.byTag.get(t).add(id);
  }
  return id;
}

export function markForRemoval(world, id) {
  world.toRemove.add(id);
}

export function flushRemovals(world) {
  for (const id of world.toRemove) {
    const e = world.entities.get(id);
    if (!e) continue;
    const tags = e.tags || [];
    for (const t of tags) world.byTag.get(t)?.delete(id);
    world.entities.delete(id);
  }
  world.toRemove.clear();
}


