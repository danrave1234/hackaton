// Internal cache for spritesheet and meta
let playerSpriteCache = null;

function resolveSpriteSrc(raw) {
  if (!raw) return undefined;
  let out = raw;
  if (out.startsWith('@asset/')) out = out.replace(/^@asset\//, 'asset/');
  else if (out.startsWith('@')) out = 'asset/spritesheet/' + out.slice(1);
  // If path starts with asset/ and page is served from /pages/, prefix ../
  if (out.startsWith('asset/')) {
    const inPages = /\/pages\//.test(location.pathname);
    if (inPages) out = '../' + out;
  }
  return out;
}

function ensurePlayerSprite(canvas) {
  if (playerSpriteCache && playerSpriteCache.img) return playerSpriteCache;
  const src = resolveSpriteSrc(canvas?.dataset?.playerSprite);
  if (!src) return null;
  const img = new Image();
  img.src = src;
  const gridStr = canvas?.dataset?.playerSpriteGrid || '';
  const animStr = canvas?.dataset?.playerSpriteAnim || '';
  const fpsStr = canvas?.dataset?.playerAnimFps || '10';
  const m = /^(\d+)x(\d+)$/i.exec(gridStr.trim());
  const cols = m ? parseInt(m[1], 10) : 1;
  const rows = m ? parseInt(m[2], 10) : 1;
  const anim = animStr
    ? animStr.split(',').map((s) => parseInt(s.trim(), 10)).filter((n) => Number.isFinite(n))
    : [];
  const fps = Math.max(1, parseInt(fpsStr, 10) || 10);
  playerSpriteCache = { img, cols, rows, anim, fps, t: 0, idx: 0 };
  return playerSpriteCache;
}

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

  const playerSheet = ensurePlayerSprite(canvas);
  if (playerSheet && playerSheet.anim.length > 0) {
    playerSheet.t += dt;
    const frame = Math.floor(playerSheet.t * playerSheet.fps) % playerSheet.anim.length;
    playerSheet.idx = playerSheet.anim[frame];
  }

  // Draw entities
  for (const e of world.entities.values()) {
    if ((e.tags||[]).includes('player')) {
      const sizeW = e.size?.w || 96;
      const sizeH = e.size?.h || 48;
      const img = playerSheet?.img;
      if (img && img.complete && img.naturalWidth > 0 && playerSheet) {
        const colW = Math.floor(img.naturalWidth / Math.max(1, playerSheet.cols));
        const rowH = Math.floor(img.naturalHeight / Math.max(1, playerSheet.rows));
        const idx = playerSheet.idx || 0;
        const cx = idx % playerSheet.cols;
        const cy = Math.floor(idx / playerSheet.cols) % playerSheet.rows;
        const sx = cx * colW;
        const sy = cy * rowH;
        // Anchor support via dataset (ax,ay from 0..1). Default center.
        let ax = 0.5, ay = 0.5;
        const anchorStr = canvas.dataset?.playerAnchor || '';
        if (anchorStr) {
          const parts = anchorStr.split(',').map((v) => parseFloat(v.trim())).filter((n) => Number.isFinite(n));
          if (parts.length === 2) { ax = parts[0]; ay = parts[1]; }
        }
        ctx.drawImage(img, sx, sy, colW, rowH, e.pos.x - sizeW * ax, e.pos.y - sizeH * ay, sizeW, sizeH);
      } else {
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
      }
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


