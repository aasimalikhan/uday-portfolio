import * as THREE from 'three';

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function toSprite(canvas, worldHeight) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, fog: false });
  const s = new THREE.Sprite(mat);
  s.scale.set(worldHeight * (canvas.width / canvas.height), worldHeight, 1);
  return s;
}

// Two-line floating sign: small mono code + big display title
export function makeSign(code, title, color = '#19E3B1', worldHeight = 5) {
  const c = document.createElement('canvas');
  const ctx = c.getContext('2d');
  const titleFont = '700 64px Unbounded, sans-serif';
  const codeFont = '600 28px "JetBrains Mono", monospace';
  ctx.font = titleFont;
  const tw = ctx.measureText(title).width;
  ctx.font = codeFont;
  const cw = ctx.measureText(code).width;
  const W = Math.ceil(Math.max(tw, cw) + 96);
  const H = 170;
  c.width = W; c.height = H;
  roundRect(ctx, 6, 6, W - 12, H - 12, 34);
  ctx.fillStyle = 'rgba(8,11,30,0.82)';
  ctx.fill();
  ctx.lineWidth = 5;
  ctx.strokeStyle = color;
  ctx.stroke();
  ctx.textAlign = 'center';
  ctx.fillStyle = color;
  ctx.font = codeFont;
  ctx.fillText(code, W / 2, 56);
  ctx.fillStyle = '#F4F6FF';
  ctx.font = titleFont;
  ctx.fillText(title, W / 2, 132);
  return toSprite(c, worldHeight);
}

// Single-line pill label (skill coins, obstacles)
export function makePill(text, { color = '#FFC94D', bg = 'rgba(8,11,30,0.85)', height = 1.2, fg = '#F4F6FF' } = {}) {
  const c = document.createElement('canvas');
  const ctx = c.getContext('2d');
  const font = '700 44px "Space Grotesk", sans-serif';
  ctx.font = font;
  const w = Math.ceil(ctx.measureText(text).width + 56);
  c.width = w; c.height = 76;
  roundRect(ctx, 3, 3, w - 6, 70, 35);
  ctx.fillStyle = bg; ctx.fill();
  ctx.lineWidth = 4; ctx.strokeStyle = color; ctx.stroke();
  ctx.font = font; ctx.fillStyle = fg; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, w / 2, 40);
  return toSprite(c, height);
}

// Flat texture for gate signs / surfaces
export function textPlaneTexture(lines, { w = 512, h = 128, bg = '#0B1030', color = '#FFC94D' } = {}) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = color; ctx.lineWidth = 6; ctx.strokeRect(3, 3, w - 6, h - 6);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  lines.forEach((ln, i) => {
    ctx.font = ln.font;
    ctx.fillStyle = ln.color || '#F4F6FF';
    ctx.fillText(ln.text, w / 2, ln.y);
  });
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

let glowTex = null;
export function glowTexture() {
  if (glowTex) return glowTex;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.25, 'rgba(255,255,255,0.55)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 128);
  glowTex = new THREE.CanvasTexture(c);
  return glowTex;
}

export function makeGlow(color, size) {
  const m = new THREE.SpriteMaterial({ map: glowTexture(), color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
  const s = new THREE.Sprite(m);
  s.scale.set(size, size, 1);
  return s;
}
