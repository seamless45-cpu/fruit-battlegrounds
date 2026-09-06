// ============================================================
//  Pre-rendered VFX / world textures (baked once on canvas).
//  Runtime effects reuse these sprites instead of allocating geometry.
// ============================================================
import * as THREE from 'three';

export function bakeTexture(size, draw, repeat = false) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  draw(ctx, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  if (repeat) { tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(8, 8); }
  return tex;
}

function zigzag(ctx, s, xs, width, alpha) {
  ctx.strokeStyle = `rgba(255,255,255,${alpha})`;
  ctx.lineWidth = width;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(xs[0] * s, 0.04 * s);
  for (let i = 1; i < xs.length; i++) ctx.lineTo(xs[i] * s, (i / (xs.length - 1)) * 0.96 * s);
  ctx.stroke();
}

export function bakeVfxAtlas() {
  const glow = bakeTexture(128, (ctx, s) => {
    const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.22, 'rgba(255,255,255,0.85)');
    g.addColorStop(0.55, 'rgba(255,255,255,0.22)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
  });

  const ring = bakeTexture(256, (ctx, s) => {
    ctx.clearRect(0, 0, s, s);
    ctx.strokeStyle = 'rgba(255,255,255,0.95)';
    ctx.lineWidth = s * 0.045;
    ctx.beginPath(); ctx.arc(s / 2, s / 2, s * 0.36, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.28)';
    ctx.lineWidth = s * 0.1;
    ctx.beginPath(); ctx.arc(s / 2, s / 2, s * 0.36, 0, Math.PI * 2); ctx.stroke();
  });

  const bolt = bakeTexture(128, (ctx, s) => {
    ctx.clearRect(0, 0, s, s);
    const xs = [0.50, 0.62, 0.38, 0.58, 0.34, 0.60, 0.44, 0.55, 0.50];
    zigzag(ctx, s, xs, 16, 0.22);
    zigzag(ctx, s, xs, 7, 0.85);
    zigzag(ctx, s, xs, 2.4, 1);
  });

  const slash = bakeTexture(256, (ctx, s) => {
    ctx.clearRect(0, 0, s, s);
    ctx.translate(s / 2, s / 2);
    ctx.rotate(-0.4);
    ctx.strokeStyle = 'rgba(255,255,255,0.95)';
    ctx.lineWidth = 18;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.32, -0.9, 1.6);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 36;
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.32, -0.9, 1.6);
    ctx.stroke();
  });

  const fire = bakeTexture(128, (ctx, s) => {
    const g = ctx.createRadialGradient(s / 2, s * 0.62, 2, s / 2, s * 0.45, s * 0.5);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.35, 'rgba(255,220,160,0.9)');
    g.addColorStop(0.7, 'rgba(255,255,255,0.25)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
  });

  const spark = bakeTexture(64, (ctx, s) => {
    const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.4, 'rgba(255,255,255,0.7)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
  });

  const ice = bakeTexture(128, (ctx, s) => {
    ctx.translate(s / 2, s / 2);
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.beginPath();
    ctx.moveTo(0, -s * 0.42);
    ctx.lineTo(s * 0.18, 0);
    ctx.lineTo(0, s * 0.42);
    ctx.lineTo(-s * 0.18, 0);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 0.45;
    ctx.beginPath();
    ctx.moveTo(0, -s * 0.28);
    ctx.lineTo(s * 0.32, 0);
    ctx.lineTo(0, s * 0.28);
    ctx.lineTo(-s * 0.32, 0);
    ctx.closePath();
    ctx.fill();
  });

  const water = bakeTexture(128, (ctx, s) => {
    const g = ctx.createLinearGradient(0, 0, 0, s);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.45, 'rgba(255,255,255,0.85)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(s * 0.15, 0, s * 0.7, s);
  });

  return { glow, ring, bolt, slash, fire, spark, ice, water };
}

export function bakeWaterTex() {
  return bakeTexture(256, (ctx, s) => {
    ctx.fillStyle = '#1a88b8';
    ctx.fillRect(0, 0, s, s);
    ctx.strokeStyle = 'rgba(230,250,255,0.28)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 16; i++) {
      ctx.beginPath();
      const y = (i / 16) * s;
      ctx.moveTo(0, y);
      for (let x = 0; x <= s; x += 8) ctx.lineTo(x, y + Math.sin((x + i * 18) * 0.08) * 5);
      ctx.stroke();
    }
  }, true);
}

export function bakeSandTex() {
  return bakeTexture(128, (ctx, s) => {
    ctx.fillStyle = '#3d5a3a';
    ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 80; i++) {
      ctx.fillStyle = i % 2 ? 'rgba(20,30,18,0.25)' : 'rgba(180,200,90,0.12)';
      ctx.fillRect(Math.random() * s, Math.random() * s, 3, 3);
    }
  }, true);
}
