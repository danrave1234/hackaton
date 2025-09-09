export function RenderSystem(dt, world) {
  const { ctx, canvas } = world;
  // Background
  ctx.fillStyle = '#0b1220';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Simple parallax
  const layers = [
    { color: 'rgba(255,255,255,0.4)', speed: 50, size: 2 },
    { color: 'rgba(186,230,253,0.35)', speed: 90, size: 2.5 },
    { color: 'rgba(103,232,249,0.30)', speed: 140, size: 3 },
  ];
  layers.forEach((layer, idx) => {
    world.ctx.fillStyle = layer.color;
    for (let i = 0; i < 80; i++) {
      const x = ((i * 120 + (world.time * layer.speed)) % (canvas.width + 200)) - 100;
      const y = (i * 53 + idx * 37) % canvas.height;
      world.ctx.fillRect(canvas.width - x, y, layer.size, layer.size);
    }
  });

  // Draw entities
  for (const e of world.entities.values()) {
    if ((e.tags||[]).includes('player')) {
      ctx.save();
      ctx.translate(e.pos.x, e.pos.y);
      ctx.fillStyle = e.color || '#a7f3d0';
      ctx.beginPath();
      ctx.moveTo(18, 0);
      ctx.lineTo(-18, -10);
      ctx.lineTo(-18, 10);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    } else if ((e.tags||[]).includes('bullet')) {
      ctx.fillStyle = '#93c5fd';
      ctx.fillRect(e.pos.x, e.pos.y - e.rect.h / 2, e.rect.w, e.rect.h);
    } else if ((e.tags||[]).includes('enemy')) {
      ctx.fillStyle = e.color || '#fca5a5';
      ctx.beginPath();
      ctx.arc(e.pos.x, e.pos.y, e.radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}


