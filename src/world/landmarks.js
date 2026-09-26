// Procedural low-poly landmarks, one per career node.
// buildLandmark(key) -> { group, height, update(t, dt) }
// Local frame: origin = ground centre, y = 0 ground, +Z faces the track / viewer.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { COLORS } from './scene.js';
import { makeGlow, makePill, glowTexture } from './labels.js';

const V2 = THREE.Vector2;
const V3 = THREE.Vector3;
const PI = Math.PI;
const TAU = PI * 2;

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

const _m4 = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _up = new V3(0, 1, 0);

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// transform a geometry in place: scale, rotate (XYZ euler), then translate
function xf(geo, { x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, s = 1, sx, sy, sz } = {}) {
  _e.set(rx, ry, rz);
  _q.setFromEuler(_e);
  _m4.compose(new V3(x, y, z), _q, new V3(sx ?? s, sy ?? s, sz ?? s));
  return geo.applyMatrix4(_m4);
}

// merge a list of geometries (handles indexed / non-indexed mixes)
function merge(list) {
  const anyNon = list.some((g) => !g.index);
  const gs = list.map((g) => (anyNon && g.index ? g.toNonIndexed() : g));
  const withColor = gs.every((g) => g.attributes.color);
  for (const g of gs) {
    for (const n of Object.keys(g.attributes)) {
      if (n === 'position' || n === 'normal' || n === 'uv') continue;
      if (n === 'color' && withColor) continue;
      g.deleteAttribute(n);
    }
    g.clearGroups();
  }
  const out = mergeGeometries(gs, false);
  return out;
}

// add a flat vertex colour to a geometry
function tint(geo, hex, k = 1) {
  const c = new THREE.Color(hex).multiplyScalar(k);
  const n = geo.attributes.position.count;
  const a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
  geo.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return geo;
}

// cylinder between two points
function beam(a, b, r0, r1 = r0, seg = 6) {
  const d = new V3().subVectors(b, a);
  const len = d.length();
  const g = new THREE.CylinderGeometry(r1, r0, len, seg, 1).translate(0, len / 2, 0);
  _q.setFromUnitVectors(_up, d.normalize());
  _m4.compose(a, _q, new V3(1, 1, 1));
  return g.applyMatrix4(_m4);
}

// rectangular outline (w along x, d along z), bar thickness t, bar height h, centred at origin
function frameGeo(w, d, t, h) {
  return merge([
    new THREE.BoxGeometry(w + t, h, t).translate(0, 0, d / 2),
    new THREE.BoxGeometry(w + t, h, t).translate(0, 0, -d / 2),
    new THREE.BoxGeometry(t, h, d - t).translate(w / 2, 0, 0),
    new THREE.BoxGeometry(t, h, d - t).translate(-w / 2, 0, 0),
  ]);
}

// square tapered prism (half widths at bottom / top), base at y = 0
function prism(hwB, hwT, h) {
  return new THREE.CylinderGeometry(hwT * Math.SQRT2, hwB * Math.SQRT2, h, 4, 1).rotateY(PI / 4).translate(0, h / 2, 0);
}

function polyTube(points, r, radial = 6, closed = false) {
  const path = new THREE.CurvePath();
  const n = points.length;
  for (let i = 0; i < n - 1; i++) path.add(new THREE.LineCurve3(points[i], points[i + 1]));
  if (closed) path.add(new THREE.LineCurve3(points[n - 1], points[0]));
  return new THREE.TubeGeometry(path, Math.max(8, n * 6), r, radial, closed);
}

const _mats = new Map();
function std(color, o = {}) {
  const k = 'S' + color + JSON.stringify(o);
  let m = _mats.get(k);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.72, metalness: 0.08, ...o });
    _mats.set(k, m);
  }
  return m;
}
function neon(color, o = {}) {
  const k = 'N' + color + JSON.stringify(o);
  let m = _mats.get(k);
  if (!m) {
    m = new THREE.MeshBasicMaterial({ color, toneMapped: false, ...o });
    _mats.set(k, m);
  }
  return m;
}
function additive(color, opacity = 1, extra = {}) {
  return new THREE.MeshBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, ...extra });
}

function mesh(geo, mat, parent) {
  const m = new THREE.Mesh(geo, mat);
  if (parent) parent.add(m);
  return m;
}

function glow(color, size, opacity = 1, parent, x = 0, y = 0, z = 0) {
  const s = makeGlow(color, size);
  s.material.opacity = opacity;
  s.position.set(x, y, z);
  if (parent) parent.add(s);
  return s;
}

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function rrect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// soft additive pool of light lying on the ground
function lightPool(r, color, opacity = 0.45) {
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(r * 2.8, r * 2.8).rotateX(-PI / 2),
    new THREE.MeshBasicMaterial({ map: glowTexture(), color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }),
  );
  m.position.y = 0.05;
  m.renderOrder = 1;
  return m;
}

// octagonal plinth with a neon edge, top at y = 0.7
const PLINTH_H = 0.7;
function plinth(r, color, parent) {
  parent.add(lightPool(r, color, 0.42));
  mesh(new THREE.CylinderGeometry(r, r + 0.6, PLINTH_H, 8).rotateY(PI / 8).translate(0, PLINTH_H / 2, 0), std(0x151a38, { roughness: 0.55, metalness: 0.35 }), parent);
  mesh(merge([
    new THREE.TorusGeometry(r + 0.03, 0.1, 4, 8).rotateX(PI / 2).rotateY(PI / 8).translate(0, PLINTH_H, 0),
    new THREE.TorusGeometry(r * 0.86, 0.045, 3, 8).rotateX(PI / 2).rotateY(PI / 8).translate(0, PLINTH_H + 0.01, 0),
  ]), neon(color), parent);
}

// rounded rectangle Shape, optional speech-bubble tail (side -1 left, 1 right)
function bubbleShape(w, h, r, tail = 0) {
  const s = new THREE.Shape();
  const x0 = -w / 2, x1 = w / 2, y0 = -h / 2, y1 = h / 2;
  if (tail === 0) {
    s.moveTo(x0 + r, y0);
  } else {
    const sx = tail; // mirror helper
    const X = (v) => v * sx;
    // start on the bottom edge, go to the tail, then around
    s.moveTo(X(x1 - r - 2.2 - 0.001), y0);
    s.lineTo(X(x1 - 0.2), y0 - 2.4);
    s.lineTo(X(x1 - r), y0);
    s.quadraticCurveTo(X(x1), y0, X(x1), y0 + r);
    s.lineTo(X(x1), y1 - r);
    s.quadraticCurveTo(X(x1), y1, X(x1 - r), y1);
    s.lineTo(X(x0 + r), y1);
    s.quadraticCurveTo(X(x0), y1, X(x0), y1 - r);
    s.lineTo(X(x0), y0 + r);
    s.quadraticCurveTo(X(x0), y0, X(x0 + r), y0);
    s.lineTo(X(x1 - r - 2.2 - 0.001), y0);
    return s;
  }
  s.lineTo(x1 - r, y0);
  s.quadraticCurveTo(x1, y0, x1, y0 + r);
  s.lineTo(x1, y1 - r);
  s.quadraticCurveTo(x1, y1, x1 - r, y1);
  s.lineTo(x0 + r, y1);
  s.quadraticCurveTo(x0, y1, x0, y1 - r);
  s.lineTo(x0, y0 + r);
  s.quadraticCurveTo(x0, y0, x0 + r, y0);
  return s;
}

/* ------------------------------------------------------------------ */
/* 1. Charminar                                                        */
/* ------------------------------------------------------------------ */

// pointed (Indo-Islamic) arch outline: from bottom-right, over the apex, to bottom-left
function archPts(w, hs, ha, n = 8) {
  const hw = w / 2;
  const c1 = new THREE.QuadraticBezierCurve(new V2(hw, hs), new V2(hw, hs + (ha - hs) * 0.62), new V2(0, ha));
  const c2 = new THREE.QuadraticBezierCurve(new V2(0, ha), new V2(-hw, hs + (ha - hs) * 0.62), new V2(-hw, hs));
  return [new V2(hw, 0), ...c1.getPoints(n), ...c2.getPoints(n).slice(1), new V2(-hw, 0)];
}
function archGeo(w, hs, ha) {
  return new THREE.ShapeGeometry(new THREE.Shape(archPts(w, hs, ha)));
}
function archFrameGeo(w, hs, ha, t) {
  const outer = archPts(w + 2 * t, hs, ha + t * 1.5);
  const inner = archPts(w, hs, ha).reverse();
  return new THREE.ShapeGeometry(new THREE.Shape([...outer, ...inner]));
}
function onion(k = 1) {
  const p = [[0, 0], [0.88, 0], [1.2, 0.42], [1.32, 0.95], [1.16, 1.5], [0.8, 2.0], [0.42, 2.42], [0.14, 2.74], [0, 2.9]];
  return new THREE.LatheGeometry(p.map(([x, y]) => new V2(x * k, y * k)), 8);
}
function colorByY(geo, y0, y1, cBot, cTop) {
  const a = new THREE.Color(cBot), b = new THREE.Color(cTop), c = new THREE.Color();
  const pos = geo.attributes.position;
  const col = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const f = THREE.MathUtils.clamp((pos.getY(i) - y0) / (y1 - y0), 0, 1);
    c.copy(a).lerp(b, Math.pow(f, 0.8));
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return geo;
}

function charminar() {
  const g = new THREE.Group();
  const B = PLINTH_H;
  plinth(12.6, COLORS.saffron, g);
  const S = 5.5;
  const sand = [], dark = [], recess = [], neonS = [], domes = [], gold = [];

  // core body and stacked galleries
  dark.push(new THREE.BoxGeometry(2 * S + 1.8, 0.6, 2 * S + 1.8).translate(0, B + 0.3, 0));
  sand.push(new THREE.BoxGeometry(2 * S, 10, 2 * S).translate(0, B + 5.6, 0));
  dark.push(new THREE.BoxGeometry(2 * S + 0.9, 0.5, 2 * S + 0.9).translate(0, B + 10.8, 0));
  sand.push(new THREE.BoxGeometry(2 * S - 0.6, 2.4, 2 * S - 0.6).translate(0, B + 12.25, 0));
  dark.push(new THREE.BoxGeometry(2 * S + 1.5, 0.4, 2 * S + 1.5).translate(0, B + 13.65, 0));
  sand.push(new THREE.BoxGeometry(2 * S - 1.6, 2.1, 2 * S - 1.6).translate(0, B + 14.9, 0));
  dark.push(new THREE.BoxGeometry(2 * S - 0.8, 0.4, 2 * S - 0.8).translate(0, B + 16.15, 0));
  // small parapet merlons on top
  for (let i = 0; i < 4; i++) {
    for (let k = -3; k <= 3; k++) {
      dark.push(new THREE.BoxGeometry(0.5, 0.55, 0.5).translate(k * 1.35, B + 16.6, S - 0.55).rotateY(i * PI / 2));
    }
  }
  neonS.push(frameGeo(2 * S + 0.95, 2 * S + 0.95, 0.12, 0.12).translate(0, B + 11.07, 0));
  neonS.push(frameGeo(2 * S + 1.55, 2 * S + 1.55, 0.14, 0.14).translate(0, B + 13.9, 0));
  neonS.push(frameGeo(2 * S - 0.75, 2 * S - 0.75, 0.12, 0.12).translate(0, B + 16.37, 0));

  // arches on each face: one grand arch + rows of small gallery arches
  for (let f = 0; f < 4; f++) {
    const ry = f * PI / 2;
    recess.push(archGeo(7.0, 5.6, 8.9).translate(0, B + 0.6, S + 0.03).rotateY(ry));
    neonS.push(archFrameGeo(7.0, 5.6, 8.9, 0.3).translate(0, B + 0.6, S + 0.06).rotateY(ry));
    // frame around the arch spandrel
    dark.push(new THREE.BoxGeometry(8.2, 0.35, 0.3).translate(0, B + 10.1, S + 0.1).rotateY(ry));
    for (let k = -3; k <= 3; k++) recess.push(archGeo(0.85, 0.95, 1.65).translate(k * 1.3, B + 11.4, S - 0.27).rotateY(ry));
    for (let k = -2.5; k <= 2.5; k++) recess.push(archGeo(0.8, 0.85, 1.5).translate(k * 1.3, B + 14.15, S - 0.77).rotateY(ry));
  }

  // four minarets
  for (const [mx, mz] of [[S, S], [-S, S], [S, -S], [-S, -S]]) {
    const P = (geo) => geo.translate(mx, 0, mz);
    sand.push(P(new THREE.CylinderGeometry(1.25, 1.55, 16.6, 8).translate(0, B + 8.3, 0)));
    for (const y of [3.2, 7.2, 11.2]) dark.push(P(new THREE.CylinderGeometry(1.52 - y * 0.012, 1.52 - y * 0.012, 0.3, 8).translate(0, B + y, 0)));
    dark.push(P(new THREE.CylinderGeometry(2.05, 1.35, 0.6, 8).translate(0, B + 16.9, 0)));
    neonS.push(P(new THREE.TorusGeometry(2.07, 0.1, 4, 8).rotateX(PI / 2).translate(0, B + 17.2, 0)));
    sand.push(P(new THREE.CylinderGeometry(1.0, 1.15, 5, 8).translate(0, B + 19.7, 0)));
    dark.push(P(new THREE.CylinderGeometry(1.7, 1.1, 0.5, 8).translate(0, B + 22.35, 0)));
    neonS.push(P(new THREE.TorusGeometry(1.72, 0.09, 4, 8).rotateX(PI / 2).translate(0, B + 22.6, 0)));
    sand.push(P(new THREE.CylinderGeometry(0.82, 0.95, 2.8, 8).translate(0, B + 24.0, 0)));
    dark.push(P(new THREE.CylinderGeometry(1.08, 0.86, 0.35, 8).translate(0, B + 25.55, 0)));
    domes.push(P(onion(0.95).translate(0, B + 25.7, 0)));
    gold.push(P(new THREE.ConeGeometry(0.13, 1.9, 6).translate(0, B + 29.3, 0)));
    gold.push(P(new THREE.SphereGeometry(0.22, 6, 4).translate(0, B + 28.5, 0)));
  }

  const sandMat = std(0xe9c38c, { roughness: 0.86, emissive: 0x3a1e0a });
  mesh(merge(sand), sandMat, g);
  mesh(merge(dark), std(0xc08b54, { roughness: 0.9, emissive: 0x1e0f05 }), g);
  mesh(merge(domes), std(0xf3d7a8, { roughness: 0.6, emissive: 0x3a2410 }), g);
  mesh(merge(gold), neon(COLORS.gold), g);
  const rec = merge(recess);
  colorByY(rec, B, B + 10, 0x7a2f14, 0x12081e);
  mesh(rec, new THREE.MeshBasicMaterial({ vertexColors: true }), g);
  const neonMat = neon(COLORS.saffron);
  mesh(merge(neonS), neonMat, g);

  const glows = [];
  for (const [mx, mz] of [[S, S], [-S, S], [S, -S], [-S, -S]]) {
    glows.push(glow(COLORS.saffron, 4.2, 0.9, g, mx, B + 17.3, mz));
    glow(COLORS.gold, 2.2, 0.9, g, mx, B + 30.2, mz);
  }
  const archGlow = glow(0xff7a2a, 9, 0.55, g, 0, B + 3.5, S + 1.2);

  return {
    group: g,
    height: 31,
    update(t) {
      const p = 0.8 + 0.2 * Math.sin(t * 2.2);
      for (let i = 0; i < glows.length; i++) glows[i].material.opacity = 0.65 + 0.35 * Math.sin(t * 2.2 + i * 1.3);
      archGlow.material.opacity = 0.45 * p;
    },
  };
}

/* ------------------------------------------------------------------ */
/* 2. Campus                                                           */
/* ------------------------------------------------------------------ */

function campus() {
  const g = new THREE.Group();
  const B = PLINTH_H;
  plinth(12.6, COLORS.mint, g);
  const r = rng(7);
  const conc = [], light = [], panes = [], mintN = [], goldN = [];

  // main block
  conc.push(new THREE.BoxGeometry(17, 9.6, 8).translate(2, B + 4.8, -1));
  for (const y of [0.25, 3.35, 6.45, 9.75]) light.push(new THREE.BoxGeometry(17.8, 0.42, 8.8).translate(2, B + y, -1));
  for (let i = 0; i <= 8; i++) light.push(new THREE.BoxGeometry(0.3, 9.4, 0.7).translate(2 - 8.5 + i * (17 / 8), B + 4.9, 3.15));
  const floors = [1.85, 4.95, 8.1];
  for (let fl = 0; fl < 3; fl++) {
    for (let i = 0; i < 8; i++) {
      const x = 2 - 8.5 + (i + 0.5) * (17 / 8);
      if (fl === 0 && (i === 3 || i === 4)) continue;
      const q = r();
      const col = q < 0.14 ? COLORS.gold : q < 0.22 ? 0x0c2233 : COLORS.mint;
      panes.push(tint(new THREE.PlaneGeometry(1.8, 2.45).translate(x, B + floors[fl], 3.03), col, col === COLORS.mint ? 0.35 + r() * 0.5 : 0.8));
    }
    for (let i = 0; i < 3; i++) {
      const q = r();
      const col = q < 0.2 ? COLORS.gold : COLORS.mint;
      panes.push(tint(new THREE.PlaneGeometry(2.1, 2.45).rotateY(PI / 2).translate(10.53, B + floors[fl], -1 - 2.6 + i * 2.6), col, 0.3 + r() * 0.4));
    }
  }
  // warm entrance
  panes.push(tint(new THREE.PlaneGeometry(3.9, 2.6).translate(2, B + 1.75, 3.03), COLORS.gold, 1));
  mintN.push(frameGeo(17.9, 8.9, 0.14, 0.14).translate(2, B + 10.03, -1));

  // side tower
  conc.push(new THREE.BoxGeometry(5.4, 15.4, 6.4).translate(-9, B + 7.7, -0.4));
  light.push(new THREE.BoxGeometry(6.0, 0.5, 7.0).translate(-9, B + 15.6, -0.4));
  panes.push(tint(new THREE.PlaneGeometry(1.3, 12.6).translate(-9, B + 8, 2.82), COLORS.mint, 0.9));
  for (let k = 0; k < 6; k++) panes.push(tint(new THREE.PlaneGeometry(0.6, 1.4).translate(-10.9, B + 3 + k * 2, 2.82), COLORS.mint, 0.3 + r() * 0.3));
  for (let k = 0; k < 6; k++) panes.push(tint(new THREE.PlaneGeometry(0.6, 1.4).translate(-7.1, B + 3 + k * 2, 2.82), r() < 0.3 ? COLORS.gold : COLORS.mint, 0.3 + r() * 0.3));
  goldN.push(frameGeo(6.05, 7.05, 0.13, 0.13).translate(-9, B + 15.9, -0.4));

  // portico
  for (const x of [-0.6, 1.3, 2.7, 4.6]) light.push(new THREE.CylinderGeometry(0.3, 0.34, 3.2, 8).translate(x, B + 1.85, 5.1));
  light.push(new THREE.BoxGeometry(7.6, 0.45, 3.0).translate(2, B + 3.65, 4.6));
  goldN.push(new THREE.BoxGeometry(7.7, 0.1, 0.1).translate(2, B + 3.4, 6.12));
  light.push(new THREE.BoxGeometry(8.6, 0.25, 1.2).translate(2, B + 0.12, 6.4));
  // rooftop plant boxes
  conc.push(new THREE.BoxGeometry(3, 1.1, 2.4).translate(6.5, B + 10.5, -2));
  conc.push(new THREE.BoxGeometry(2, 0.8, 2).translate(-1.5, B + 10.35, -2.5));

  mesh(merge(conc), std(0x39426e, { roughness: 0.8, emissive: 0x080a18 }), g);
  mesh(merge(light), std(0xd9ddf2, { roughness: 0.7, emissive: 0x15182a }), g);
  mesh(merge(panes), new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }), g);
  mesh(merge(mintN), neon(COLORS.mint), g);
  mesh(merge(goldN), neon(COLORS.gold), g);

  // floating mortarboard
  const capRoot = new THREE.Group();
  capRoot.position.set(1.5, 21, 0.5);
  g.add(capRoot);
  const cap = new THREE.Group();
  cap.rotation.set(0.32, 0, 0.12);
  capRoot.add(cap);
  const navy = std(0x1c2150, { roughness: 0.5, metalness: 0.2, emissive: 0x05061a });
  mesh(merge([
    new THREE.BoxGeometry(7.4, 0.36, 7.4),
    new THREE.CylinderGeometry(2.35, 2.6, 1.9, 8).translate(0, -1.1, 0),
  ]), navy, cap);
  const tasselPts = [new V3(0, 0.3, 0), new V3(1.9, 0.26, 1.9), new V3(3.55, 0.2, 3.55), new V3(3.62, -1.5, 3.62)];
  mesh(merge([
    frameGeo(7.42, 7.42, 0.1, 0.42),
    new THREE.CylinderGeometry(0.42, 0.42, 0.28, 8).translate(0, 0.3, 0),
    new THREE.TubeGeometry(new THREE.CatmullRomCurve3(tasselPts), 16, 0.08, 4),
    new THREE.CylinderGeometry(0.12, 0.55, 1.7, 8).translate(3.62, -2.35, 3.62),
    new THREE.SphereGeometry(0.22, 6, 4).translate(3.62, -1.45, 3.62),
  ]), neon(COLORS.gold), cap);
  const halo = mesh(new THREE.TorusGeometry(5.3, 0.07, 3, 64).rotateX(PI / 2), neon(COLORS.gold), capRoot);
  halo.position.y = -3.4;
  const halo2 = mesh(new THREE.TorusGeometry(4.2, 0.05, 3, 64).rotateX(PI / 2), neon(COLORS.mint), capRoot);
  halo2.position.y = -3.9;
  glow(COLORS.gold, 13, 0.45, capRoot, 0, -0.5, 0);
  glow(COLORS.mint, 7, 0.5, g, -9, B + 16.5, 1);

  return {
    group: g,
    height: 26,
    update(t) {
      capRoot.position.y = 21 + Math.sin(t * 1.3) * 0.7;
      cap.rotation.y = t * 0.45;
      cap.rotation.x = 0.32 + Math.sin(t * 0.9) * 0.06;
      halo.rotation.z = Math.sin(t * 0.8) * 0.08;
      halo2.scale.setScalar(1 + 0.06 * Math.sin(t * 2));
    },
  };
}

/* ------------------------------------------------------------------ */
/* 3. Chat (internships, WhatsApp scheduler)                           */
/* ------------------------------------------------------------------ */

function chat() {
  const g = new THREE.Group();
  const B = PLINTH_H;
  plinth(12.6, COLORS.mint, g);
  const ext = { depth: 1.2, bevelEnabled: true, bevelThickness: 0.35, bevelSize: 0.35, bevelSegments: 1, curveSegments: 4 };

  // main bubble
  const main = new THREE.Group();
  main.position.set(-1.4, 11.8, 0.5);
  g.add(main);
  mesh(new THREE.ExtrudeGeometry(bubbleShape(13, 8.4, 2.4, -1), ext).translate(0, 0, -0.6), std(COLORS.mint, { roughness: 0.4, metalness: 0.1, emissive: 0x0a5c48 }), main);
  mesh(new THREE.ShapeGeometry(bubbleShape(14.2, 9.6, 3, -1), 6).translate(0, 0, -1.1), additive(COLORS.mint, 0.55), main);
  mesh(new THREE.ShapeGeometry(bubbleShape(10.2, 4.6, 2.2), 6).translate(0, 0.1, 1.0), std(0x07231f, { roughness: 0.4, emissive: 0x020c0b }), main);
  const dotGeo = new THREE.IcosahedronGeometry(0.72, 1);
  const dotMat = neon(COLORS.white);
  const dots = [-2.4, 0, 2.4].map((x) => {
    const d = mesh(dotGeo, dotMat, main);
    d.position.set(x, 0.1, 1.5);
    return d;
  });
  glow(COLORS.mint, 22, 0.35, main, 0, 0, -2);

  // reply bubble (violet)
  const reply = new THREE.Group();
  reply.position.set(5.2, 19.3, -2.6);
  g.add(reply);
  mesh(new THREE.ExtrudeGeometry(bubbleShape(7.6, 4.4, 1.6, 1), { ...ext, depth: 0.9 }).translate(0, 0, -0.45), std(COLORS.violet, { roughness: 0.45, emissive: 0x24165e }), reply);
  mesh(new THREE.ShapeGeometry(bubbleShape(8.5, 5.3, 2.0, 1), 6).translate(0, 0, -0.9), additive(COLORS.violet, 0.6), reply);
  mesh(merge([
    new THREE.BoxGeometry(4.8, 0.5, 0.1).translate(-0.6, 0.8, 0.85),
    new THREE.BoxGeometry(3.2, 0.5, 0.1).translate(-1.4, -0.3, 0.85),
    // double tick
    beam(new V3(1.4, -0.9, 0.85), new V3(1.8, -1.3, 0.85), 0.09, 0.09, 4),
    beam(new V3(1.8, -1.3, 0.85), new V3(2.6, -0.4, 0.85), 0.09, 0.09, 4),
    beam(new V3(2.1, -0.9, 0.85), new V3(2.5, -1.3, 0.85), 0.09, 0.09, 4),
    beam(new V3(2.5, -1.3, 0.85), new V3(3.3, -0.4, 0.85), 0.09, 0.09, 4),
  ]), neon(COLORS.white), reply);

  // scheduler alarm clock
  const clock = new THREE.Group();
  clock.position.set(8.4, 6.6, 3.2);
  clock.rotation.y = -0.35;
  g.add(clock);
  mesh(new THREE.CylinderGeometry(3.1, 3.1, 0.7, 24).rotateX(PI / 2), std(0x121838, { roughness: 0.5, emissive: 0x04060f }), clock);
  mesh(new THREE.TorusGeometry(3.15, 0.34, 6, 24), neon(COLORS.saffron), clock);
  const ticks = [];
  for (let i = 0; i < 12; i++) {
    const big = i % 3 === 0;
    ticks.push(new THREE.BoxGeometry(big ? 0.3 : 0.16, big ? 0.85 : 0.5, 0.1).translate(0, 2.35, 0.4).rotateZ(i * TAU / 12));
  }
  mesh(merge(ticks), neon(COLORS.white), clock);
  const handMat = neon(COLORS.gold);
  const minute = mesh(new THREE.BoxGeometry(0.2, 2.5, 0.12).translate(0, 1.05, 0.5), handMat, clock);
  const hour = mesh(new THREE.BoxGeometry(0.32, 1.6, 0.12).translate(0, 0.62, 0.45), handMat, clock);
  mesh(merge([
    new THREE.CylinderGeometry(0.35, 0.35, 0.3, 8).rotateX(PI / 2).translate(0, 0, 0.6),
    new THREE.SphereGeometry(1.05, 8, 4, 0, TAU, 0, PI / 2).translate(0, 3.1, -0.1).rotateZ(0.7),
    new THREE.SphereGeometry(1.05, 8, 4, 0, TAU, 0, PI / 2).translate(0, 3.1, -0.1).rotateZ(-0.7),
    new THREE.BoxGeometry(0.25, 1.0, 0.25).translate(0, 3.45, -0.1),
    beam(new V3(-1.8, -2.4, 0), new V3(-2.6, -5.9, 0), 0.22, 0.18, 6),
    beam(new V3(1.8, -2.4, 0), new V3(2.6, -5.9, 0), 0.22, 0.18, 6),
  ]), std(COLORS.gold, { roughness: 0.35, metalness: 0.6, emissive: 0x3a2600 }), clock);
  glow(COLORS.saffron, 10, 0.4, clock, 0, 0, -0.5);

  // code pill
  const code = makePill('</>', { color: '#19E3B1', height: 2.6 });
  code.position.set(-9.4, 18.2, 1.5);
  g.add(code);
  const code2 = makePill('{ }', { color: '#7C5CFF', height: 1.8 });
  code2.position.set(-10.2, 5.4, 4.5);
  g.add(code2);

  return {
    group: g,
    height: 23,
    update(t) {
      main.position.y = 11.8 + Math.sin(t * 1.1) * 0.35;
      main.rotation.y = Math.sin(t * 0.5) * 0.06;
      reply.position.y = 19.3 + Math.sin(t * 1.1 + 1.4) * 0.4;
      for (let i = 0; i < 3; i++) {
        const k = Math.max(0, Math.sin(t * 5 - i * 0.9));
        dots[i].position.y = 0.1 + k * 0.7;
        dots[i].scale.setScalar(0.85 + k * 0.3);
      }
      minute.rotation.z = -t * 1.4;
      hour.rotation.z = -t * 0.12;
      code.position.y = 18.2 + Math.sin(t * 1.6) * 0.5;
      code2.position.y = 5.4 + Math.sin(t * 1.9 + 2) * 0.35;
    },
  };
}

/* ------------------------------------------------------------------ */
/* 4. Tower + vault                                                    */
/* ------------------------------------------------------------------ */

function towerWindows() {
  const r = rng(11);
  return canvasTex(256, 512, (ctx, w, h) => {
    ctx.fillStyle = '#02030a';
    ctx.fillRect(0, 0, w, h);
    const faces = 4, cols = 7, rows = 34;
    const fw = w / faces, cw = fw / cols, rh = h / rows;
    for (let f = 0; f < faces; f++) {
      for (let y = 0; y < rows; y++) {
        // floor slab line
        ctx.globalAlpha = 0.5;
        ctx.fillStyle = '#6a5a3a';
        ctx.fillRect(f * fw, y * rh, fw, 1.5);
        for (let x = 0; x < cols; x++) {
          const q = r();
          ctx.globalAlpha = q < 0.62 ? 0.45 + r() * 0.55 : 0.12;
          ctx.fillStyle = q < 0.1 ? '#ffd48a' : q < 0.62 ? (r() < 0.5 ? '#bcd4ff' : '#e8efff') : '#3a5a9a';
          ctx.fillRect(f * fw + x * cw + 1.5, y * rh + 3, cw - 3, rh - 5);
        }
      }
    }
    ctx.globalAlpha = 1;
  });
}

function tower() {
  const g = new THREE.Group();
  const B = PLINTH_H;
  plinth(12.6, COLORS.gold, g);
  const H = 27;
  const hwB = 4.6, hwT = 3.2;
  const TZ = -2.2; // tower sits behind the vault podium

  const winTex = towerWindows();
  const glass = new THREE.MeshStandardMaterial({ color: 0x22346e, roughness: 0.25, metalness: 0.2, flatShading: true, emissive: 0xffffff, emissiveMap: winTex, emissiveIntensity: 0.85 });
  const capMat = std(0x141a36, { roughness: 0.5, metalness: 0.4 });
  mesh(prism(hwB, hwT, H).translate(0, B, TZ), [glass, capMat, capMat], g);

  const goldL = [];
  for (let y = 9; y < H; y += 3) {
    const hw = hwB + (hwT - hwB) * (y / H) + 0.06;
    goldL.push(frameGeo(hw * 2, hw * 2, 0.13, 0.15).translate(0, B + y, TZ));
  }
  for (const [sx, sz] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
    goldL.push(beam(new V3(sx * (hwB + 0.05), B, TZ + sz * (hwB + 0.05)), new V3(sx * (hwT + 0.05), B + H, TZ + sz * (hwT + 0.05)), 0.13, 0.13, 4));
  }

  // podium: banking hall with pilasters
  const PH = 8.6, PZ = 0.4, PD = 7;
  const podium = [new THREE.BoxGeometry(16, PH, PD).translate(0, B + PH / 2, PZ)];
  podium.push(new THREE.BoxGeometry(16.8, 0.6, PD + 0.8).translate(0, B + PH + 0.3, PZ));
  podium.push(new THREE.BoxGeometry(17.2, 0.5, PD + 1.2).translate(0, B + 0.25, PZ));
  mesh(merge(podium), std(0x1d2548, { roughness: 0.55, metalness: 0.35, emissive: 0x05071a }), g);
  const pil = [];
  for (const x of [-7.2, -5.8, 5.8, 7.2]) pil.push(new THREE.BoxGeometry(0.7, PH - 0.6, 0.5).translate(x, B + PH / 2, PZ + PD / 2 + 0.2));
  mesh(merge(pil), std(0xd9ddf2, { roughness: 0.6, emissive: 0x1a1c2c }), g);
  goldL.push(frameGeo(16.85, PD + 0.85, 0.12, 0.12).translate(0, B + PH + 0.62, PZ));
  goldL.push(new THREE.BoxGeometry(16.1, 0.12, 0.12).translate(0, B + 0.55, PZ + PD / 2 + 0.62));

  // crown
  const crownMat = std(0x2a3160, { roughness: 0.4, metalness: 0.5, emissive: 0x0a0c20 });
  mesh(merge([
    prism(hwT + 0.3, hwT + 0.1, 1.1).translate(0, B + H, TZ),
    prism(hwT - 0.4, hwT - 0.6, 1.4).translate(0, B + H + 1.1, TZ),
  ]), crownMat, g);
  mesh(new THREE.ConeGeometry((hwT - 0.6) * Math.SQRT2, 4.2, 4).rotateY(PI / 4).translate(0, B + H + 2.5 + 2.1, TZ),
    std(0x3a4a8a, { roughness: 0.25, metalness: 0.3, emissive: 0x4a3510 }), g);
  goldL.push(frameGeo((hwT + 0.3) * 2, (hwT + 0.3) * 2, 0.16, 0.18).translate(0, B + H + 1.1, TZ));
  goldL.push(frameGeo((hwT - 0.4) * 2, (hwT - 0.4) * 2, 0.14, 0.16).translate(0, B + H + 2.5, TZ));
  for (const [sx, sz] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
    goldL.push(new THREE.ConeGeometry(0.34, 2.6, 4).translate(sx * (hwT + 0.1), B + H + 1.1 + 1.3, TZ + sz * (hwT + 0.1)));
    goldL.push(beam(new V3(sx * (hwT - 0.4), B + H + 2.5, TZ + sz * (hwT - 0.4)), new V3(0, B + H + 6.7, TZ), 0.07, 0.07, 3));
  }
  goldL.push(beam(new V3(0, B + H + 6.2, TZ), new V3(0, B + H + 9.5, TZ), 0.14, 0.05, 4));
  mesh(merge(goldL), neon(COLORS.gold), g);
  const beacon = glow(COLORS.saffron, 4.5, 1, g, 0, B + H + 9.5, TZ);
  glow(COLORS.gold, 11, 0.35, g, 0, B + H + 3.5, TZ);

  // vault door set into the podium face
  const VY = B + 4.4, VZ = PZ + PD / 2;
  const steel = std(0x9aa4bd, { roughness: 0.32, metalness: 0.75, emissive: 0x111522 });
  const goldM = std(COLORS.gold, { roughness: 0.3, metalness: 0.7, emissive: 0x4a3000 });
  mesh(new THREE.CylinderGeometry(4.3, 4.3, 0.2, 32).rotateX(PI / 2).translate(0, VY, VZ + 0.05), neon(0x04050c), g);
  mesh(new THREE.TorusGeometry(4.35, 0.5, 6, 32).translate(0, VY, VZ + 0.15), std(0x3a4266, { roughness: 0.35, metalness: 0.8, emissive: 0x080a14 }), g);
  mesh(new THREE.TorusGeometry(4.95, 0.1, 3, 48).translate(0, VY, VZ + 0.3), neon(COLORS.gold), g);
  const vault = new THREE.Group();
  vault.position.set(0, VY, VZ + 0.2);
  g.add(vault);
  mesh(new THREE.CylinderGeometry(3.8, 3.8, 0.8, 24).rotateX(PI / 2).translate(0, 0, 0.4), steel, vault);
  mesh(new THREE.TorusGeometry(3.85, 0.34, 6, 32).translate(0, 0, 0.55), goldM, vault);
  const bolts = [];
  for (let i = 0; i < 16; i++) {
    const a = i * TAU / 16;
    bolts.push(new THREE.CylinderGeometry(0.2, 0.2, 0.3, 6).rotateX(PI / 2).translate(Math.cos(a) * 3.2, Math.sin(a) * 3.2, 0.88));
  }
  bolts.push(new THREE.TorusGeometry(2.45, 0.13, 4, 32).translate(0, 0, 0.86));
  mesh(merge(bolts), goldM, vault);
  const wheel = new THREE.Group();
  wheel.position.z = 1.05;
  vault.add(wheel);
  const spokes = [new THREE.CylinderGeometry(0.75, 0.75, 0.7, 10).rotateX(PI / 2)];
  for (let i = 0; i < 3; i++) spokes.push(new THREE.BoxGeometry(5.2, 0.3, 0.3).rotateZ(i * PI / 3));
  for (let i = 0; i < 6; i++) {
    const a = i * PI / 3;
    spokes.push(new THREE.SphereGeometry(0.36, 8, 6).translate(Math.cos(a) * 2.6, Math.sin(a) * 2.6, 0));
  }
  mesh(merge(spokes), goldM, wheel);
  const lockRing = mesh(new THREE.TorusGeometry(1.15, 0.1, 4, 24).translate(0, 0, 0.3), neon(COLORS.mint, { transparent: true }), wheel);
  glow(COLORS.gold, 15, 0.32, g, 0, VY, VZ + 1);

  return {
    group: g,
    height: 37,
    update(t) {
      vault.rotation.z = t * 0.12;
      wheel.rotation.z = Math.sin(t * 0.7) * 1.6;
      lockRing.material.opacity = 0.55 + 0.45 * Math.sin(t * 3);
      beacon.material.opacity = 0.4 + 0.6 * Math.max(0, Math.sin(t * 2.4));
    },
  };
}

/* ------------------------------------------------------------------ */
/* 5. Bars (dashboard)                                                 */
/* ------------------------------------------------------------------ */

function bars() {
  const g = new THREE.Group();
  g.add(lightPool(13, COLORS.gold, 0.35));
  mesh(new THREE.BoxGeometry(23, 1, 11).translate(0, 0.5, 0), std(0x151a38, { roughness: 0.55, metalness: 0.35 }), g);
  mesh(frameGeo(23.1, 11.1, 0.16, 0.16).translate(0, 1.0, 0), neon(COLORS.mint), g);

  // backboard with grid
  mesh(new THREE.PlaneGeometry(22, 21).translate(0, 11.5, -4.6), new THREE.MeshBasicMaterial({ color: 0x0a0f2e, transparent: true, opacity: 0.82, side: THREE.DoubleSide }), g);
  const gl = [];
  for (let y = 3; y <= 21; y += 2) gl.push(-11, y, -4.55, 11, y, -4.55);
  for (let x = -11 + 2.75; x < 11; x += 2.75) gl.push(x, 1, -4.55, x, 22, -4.55);
  const lg = new THREE.BufferGeometry();
  lg.setAttribute('position', new THREE.Float32BufferAttribute(gl, 3));
  g.add(new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: COLORS.mint, transparent: true, opacity: 0.16, toneMapped: false })));
  mesh(frameGeo(22, 21, 0.16, 0.16).rotateX(PI / 2).translate(0, 11.5, -4.5), neon(COLORS.violet), g);

  // bars
  const base = [4, 7, 6, 10, 12, 15];
  const stops = [new THREE.Color(COLORS.saffron), new THREE.Color(COLORS.gold), new THREE.Color(COLORS.mint)];
  const barGeo = new THREE.BoxGeometry(1.9, 1, 1.9).translate(0, 0.5, 0);
  const capGeo = new THREE.BoxGeometry(2.05, 0.16, 2.05);
  const xs = base.map((_, i) => -9.6 + i * 2.55);
  const barMeshes = [], caps = [];
  base.forEach((h, i) => {
    const f = i / (base.length - 1);
    const c = f < 0.5 ? stops[0].clone().lerp(stops[1], f * 2) : stops[1].clone().lerp(stops[2], (f - 0.5) * 2);
    const m = mesh(barGeo, new THREE.MeshStandardMaterial({ color: c, flatShading: true, roughness: 0.35, metalness: 0.2, emissive: c, emissiveIntensity: 0.32 }), g);
    m.position.set(xs[i], 1, 0.5);
    barMeshes.push(m);
    const cp = mesh(capGeo, new THREE.MeshBasicMaterial({ color: c.clone().lerp(new THREE.Color(0xffffff), 0.35), toneMapped: false }), g);
    cp.position.set(xs[i], 1 + h, 0.5);
    caps.push(cp);
  });

  // line chart on the board
  const pts = base.map((h, i) => new V3(xs[i], 1 + h + 4.4, -3.6));
  mesh(polyTube(pts, 0.16, 5), neon(COLORS.gold), g);
  const area = new THREE.Shape([new V2(xs[0], 1.2), ...pts.map((p) => new V2(p.x, p.y)), new V2(xs[5], 1.2)]);
  mesh(new THREE.ShapeGeometry(area).translate(0, 0, -3.9), additive(COLORS.gold, 0.13, { side: THREE.DoubleSide }), g);
  const nodeGeo = new THREE.IcosahedronGeometry(0.48, 1);
  const nodes = pts.map((p) => {
    const n = mesh(nodeGeo, neon(COLORS.white), g);
    n.position.copy(p);
    return n;
  });
  const nodeGlow = glow(COLORS.gold, 3.2, 0.9, g);

  // donut
  const donut = new THREE.Group();
  donut.position.set(8.3, 10, 0.2);
  g.add(donut);
  mesh(beam(new V3(8.3, 1, 0.2), new V3(8.3, 6.0, 0.2), 0.28, 0.2, 6), std(0x2a3160, { metalness: 0.5, roughness: 0.4 }), g);
  const fr = [0.38, 0.27, 0.2, 0.15];
  const dc = [COLORS.mint, COLORS.gold, COLORS.saffron, COLORS.violet];
  let a0 = 0;
  const gap = 0.07;
  fr.forEach((f, i) => {
    const arc = f * TAU - gap;
    const c = new THREE.Color(dc[i]);
    mesh(new THREE.TorusGeometry(3.3, 1.0, 6, Math.max(6, Math.round(f * 40)), arc).rotateZ(a0), new THREE.MeshStandardMaterial({ color: c, flatShading: true, roughness: 0.35, metalness: 0.2, emissive: c, emissiveIntensity: 0.35 }), donut);
    a0 += f * TAU;
  });
  mesh(new THREE.TorusGeometry(4.75, 0.05, 3, 48), neon(COLORS.white), donut);
  glow(COLORS.mint, 11, 0.35, donut, 0, 0, -1);
  glow(COLORS.gold, 20, 0.22, g, -3, 12, -4);

  return {
    group: g,
    height: 23,
    update(t) {
      for (let i = 0; i < 6; i++) {
        const h = base[i] * (1 + 0.1 * Math.sin(t * 1.4 + i * 0.9));
        barMeshes[i].scale.y = h;
        caps[i].position.y = 1 + h;
      }
      const k = Math.floor(t * 1.5) % 6;
      for (let i = 0; i < 6; i++) nodes[i].scale.setScalar(i === k ? 1.5 : 1);
      nodeGlow.position.copy(nodes[k].position);
      donut.rotation.z = t * 0.35;
      donut.rotation.y = Math.sin(t * 0.6) * 0.25;
    },
  };
}

/* ------------------------------------------------------------------ */
/* 6. Circulars (bell + orbiting documents)                           */
/* ------------------------------------------------------------------ */

function circulars() {
  const g = new THREE.Group();
  const B = PLINTH_H;
  plinth(12.6, COLORS.gold, g);

  // pedestal
  mesh(new THREE.CylinderGeometry(1.5, 2.3, 3.4, 6).translate(0, B + 1.7, 0), std(0x1b2146, { roughness: 0.5, metalness: 0.4 }), g);
  mesh(new THREE.TorusGeometry(1.52, 0.08, 3, 6).rotateX(PI / 2).translate(0, B + 3.4, 0), neon(COLORS.gold), g);
  glow(COLORS.gold, 7, 0.6, g, 0, B + 3.6, 0);

  // bell (pivot at top)
  const pivot = new THREE.Group();
  pivot.position.set(0, 18.2, 0);
  g.add(pivot);
  const prof = [[0, 5.1], [0.6, 5.05], [1.3, 4.8], [1.8, 4.25], [2.0, 3.4], [2.15, 2.4], [2.45, 1.4], [2.9, 0.7], [3.35, 0.3], [3.45, 0], [3.1, 0.05], [2.7, 0.4]];
  const bellGeo = new THREE.LatheGeometry(prof.map(([x, y]) => new V2(x, y)), 12).translate(0, -5.4, 0);
  pivot.scale.setScalar(1.35);
  const bellMat = new THREE.MeshStandardMaterial({ color: COLORS.gold, flatShading: true, roughness: 0.28, metalness: 0.75, emissive: 0x5a3800, side: THREE.DoubleSide });
  mesh(bellGeo, bellMat, pivot);
  mesh(merge([
    new THREE.TorusGeometry(0.62, 0.2, 6, 12).translate(0, 0.1, 0),
    new THREE.TorusGeometry(3.47, 0.12, 4, 12).rotateX(PI / 2).translate(0, -5.4, 0),
  ]), neon(COLORS.gold), pivot);
  const clapper = new THREE.Group();
  clapper.position.y = -1.5;
  pivot.add(clapper);
  mesh(merge([
    beam(new V3(0, 0, 0), new V3(0, -4.2, 0), 0.1, 0.1, 4),
    new THREE.IcosahedronGeometry(0.62, 0).translate(0, -4.5, 0),
  ]), std(0xb98a2a, { metalness: 0.6, roughness: 0.3 }), clapper);
  const badge = mesh(new THREE.IcosahedronGeometry(0.85, 1), neon(COLORS.pink), pivot);
  badge.position.set(2.3, -1.2, 1.2);
  glow(COLORS.pink, 3.5, 0.9, badge);
  glow(COLORS.gold, 16, 0.4, pivot, 0, -2.6, -0.5);
  const newPill = makePill('NEW', { color: '#FF3D71', height: 1.3 });
  newPill.position.set(3.6, 0.2, 1.4);
  pivot.add(newPill);

  // ripple rings
  const ripples = [0, 1].map(() => {
    const m = mesh(new THREE.TorusGeometry(1, 0.035, 3, 48), additive(COLORS.gold, 0.8), g);
    m.position.set(0, 14.6, 0);
    return m;
  });

  // documents
  const docParts = [
    tint(new THREE.PlaneGeometry(2.6, 3.4), 0xf4f6ff).translate(0, 0, -0.01),
    tint(new THREE.PlaneGeometry(1.7, 0.26).translate(-0.25, 1.15, 0.02), 0x2b3a8f),
  ];
  for (let i = 0; i < 5; i++) docParts.push(tint(new THREE.PlaneGeometry(i === 4 ? 1.1 : 1.9, 0.13).translate(i === 4 ? -0.55 : -0.1, 0.62 - i * 0.36, 0.02), 0x9aa0b8));
  docParts.push(tint(new THREE.CircleGeometry(0.36, 10).translate(0.72, -1.15, 0.03), COLORS.saffron));
  docParts.push(tint(new THREE.RingGeometry(0.42, 0.5, 10).translate(0.72, -1.15, 0.03), COLORS.saffron));
  const docGeo = merge(docParts).scale(1.25, 1.25, 1);
  const docMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, emissive: 0x3a3f58, side: THREE.DoubleSide, flatShading: true });
  const docs = [];
  for (let i = 0; i < 10; i++) {
    const d = mesh(docGeo, docMat, g);
    docs.push({ m: d, r: 7.6 + (i % 3) * 1.1, y: 3.8 + i * 1.45, sp: 0.32 + (i % 4) * 0.05, ph: i * 2.39 });
  }

  return {
    group: g,
    height: 22,
    update(t) {
      pivot.rotation.z = Math.sin(t * 1.7) * 0.16;
      pivot.rotation.x = Math.sin(t * 1.3) * 0.05;
      clapper.rotation.z = Math.sin(t * 1.7 - 0.9) * 0.28;
      badge.scale.setScalar(1 + 0.15 * Math.max(0, Math.sin(t * 4)));
      for (let i = 0; i < 2; i++) {
        const s = (t * 0.45 + i * 0.5) % 1;
        ripples[i].scale.setScalar(5.2 + s * 5.5);
        ripples[i].material.opacity = (1 - s) * (1 - s) * 0.7;
      }
      for (const d of docs) {
        const a = d.ph + t * d.sp;
        d.m.position.set(Math.cos(a) * d.r, d.y + Math.sin(t * 1.2 + d.ph) * 0.45, Math.sin(a) * d.r);
        d.m.rotation.set(0, PI / 2 - a, Math.sin(t + d.ph) * 0.12);
      }
    },
  };
}

/* ------------------------------------------------------------------ */
/* 7. Network (branch API)                                             */
/* ------------------------------------------------------------------ */

function mapTexture() {
  const r = rng(21);
  return canvasTex(512, 512, (ctx, w) => {
    const c = w / 2;
    ctx.clearRect(0, 0, w, w);
    ctx.strokeStyle = 'rgba(25,227,177,0.35)';
    ctx.lineWidth = 2;
    for (const rr of [70, 140, 210]) { ctx.beginPath(); ctx.arc(c, c, rr, 0, TAU); ctx.stroke(); }
    ctx.strokeStyle = 'rgba(25,227,177,0.18)';
    for (let i = 0; i < 12; i++) {
      const a = i * TAU / 12;
      ctx.beginPath(); ctx.moveTo(c, c); ctx.lineTo(c + Math.cos(a) * 250, c + Math.sin(a) * 250); ctx.stroke();
    }
    ctx.fillStyle = 'rgba(160,180,255,0.35)';
    for (let y = 8; y < w; y += 16) {
      for (let x = 8; x < w; x += 16) {
        const d = Math.hypot(x - c, y - c);
        if (d < 245) ctx.fillRect(x - 1, y - 1, 2, 2);
      }
    }
    // faint "roads"
    ctx.strokeStyle = 'rgba(255,153,51,0.25)';
    ctx.lineWidth = 3;
    for (let i = 0; i < 9; i++) {
      ctx.beginPath();
      let x = c + (r() - 0.5) * 380, y = c + (r() - 0.5) * 380;
      ctx.moveTo(x, y);
      for (let k = 0; k < 4; k++) {
        x += (r() - 0.5) * 160; y += (r() - 0.5) * 160;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  });
}

function network() {
  const g = new THREE.Group();
  const B = PLINTH_H;
  g.add(lightPool(12.5, COLORS.mint, 0.35));
  mesh(new THREE.CylinderGeometry(12, 12.6, B, 48).translate(0, B / 2, 0), std(0x10152e, { roughness: 0.5, metalness: 0.4 }), g);
  mesh(new THREE.TorusGeometry(12.02, 0.1, 4, 64).rotateX(PI / 2).translate(0, B, 0), neon(COLORS.mint), g);
  mesh(new THREE.CircleGeometry(11.8, 48).rotateX(-PI / 2).translate(0, B + 0.02, 0), new THREE.MeshBasicMaterial({ map: mapTexture(), transparent: true, depthWrite: false, toneMapped: false }), g);

  const CORE = new V3(0, 13.5, 0);
  const pinGeo = new THREE.LatheGeometry([[0, 0], [0.28, 0.5], [0.62, 1.2], [0.92, 1.85], [1.05, 2.4], [0.98, 2.85], [0.72, 3.2], [0.38, 3.42], [0, 3.5]].map(([x, y]) => new V2(x, y)), 10);
  const pinMat = std(COLORS.saffron, { roughness: 0.4, emissive: 0x6a2d00 });
  const holeGeo = new THREE.TorusGeometry(0.42, 0.15, 4, 10);
  const holeMat = neon(COLORS.white);
  const pins = [], lines = [], rings = [], tops = [];
  for (let i = 0; i < 10; i++) {
    const a = i * TAU / 10 + 0.35 * Math.sin(i * 1.7) + 0.2;
    const rr = 6.3 + ((i * 7) % 4) * 1.05;
    const x = Math.cos(a) * rr, z = Math.sin(a) * rr;
    const pin = new THREE.Group();
    pin.position.set(x, B + 0.3, z);
    g.add(pin);
    mesh(pinGeo, pinMat, pin);
    const h = mesh(holeGeo, holeMat, pin);
    h.position.set(0, 2.5, 0.95);
    pins.push(pin);
    const top = new V3(x, B + 3.9, z);
    tops.push(top);
    lines.push(beam(top, CORE, 0.06, 0.06, 3));
    rings.push(new THREE.RingGeometry(1.1, 1.35, 16).rotateX(-PI / 2).translate(x, B + 0.05, z));
  }
  mesh(merge(lines), additive(COLORS.mint, 0.55), g);
  mesh(merge(rings), additive(COLORS.saffron, 0.7), g);

  // API core
  const core = new THREE.Group();
  core.position.copy(CORE);
  g.add(core);
  const wire = mesh(new THREE.IcosahedronGeometry(3.2, 1), neon(COLORS.mint, { wireframe: true }), core);
  const inner = mesh(new THREE.IcosahedronGeometry(1.95, 0), std(COLORS.violet, { roughness: 0.3, metalness: 0.3, emissive: 0x3a2890 }), core);
  const o1 = mesh(new THREE.TorusGeometry(4.4, 0.06, 3, 64), neon(COLORS.mint), core);
  const o2 = mesh(new THREE.TorusGeometry(4.9, 0.05, 3, 64), neon(COLORS.violet), core);
  glow(COLORS.violet, 14, 0.7, core);
  glow(COLORS.mint, 7, 0.8, core);
  mesh(beam(new V3(0, B, 0), new V3(0, CORE.y - 2, 0), 0.18, 0.1, 6), additive(COLORS.mint, 0.4), g);
  glow(COLORS.mint, 6, 0.6, g, 0, B + 0.5, 0);

  // pulses
  const pulseGeo = new THREE.IcosahedronGeometry(0.3, 0);
  const pulses = tops.map((_, i) => mesh(pulseGeo, neon(i % 2 ? COLORS.mint : COLORS.gold), g));
  const _p = new V3();

  return {
    group: g,
    height: 19,
    update(t) {
      for (let i = 0; i < 10; i++) {
        pins[i].position.y = B + 0.3 + Math.sin(t * 2 + i) * 0.22;
        let s = (t * 0.5 + i * 0.173) % 1;
        if (i % 2) s = 1 - s;
        _p.lerpVectors(tops[i], CORE, s);
        pulses[i].position.copy(_p);
      }
      wire.rotation.y = t * 0.4;
      wire.rotation.x = t * 0.15;
      inner.rotation.y = -t * 0.7;
      inner.rotation.z = t * 0.3;
      o1.rotation.set(1.2 + Math.sin(t * 0.5) * 0.2, t * 0.6, 0);
      o2.rotation.set(0.4, -t * 0.45, 0.6);
      core.position.y = CORE.y + Math.sin(t * 1.3) * 0.3;
    },
  };
}

/* ------------------------------------------------------------------ */
/* 8. Ziggurat (COMP1 -> COMP4)                                        */
/* ------------------------------------------------------------------ */

function ziggurat() {
  const g = new THREE.Group();
  g.add(lightPool(12.5, COLORS.violet, 0.4));
  const TH = 3.4;
  const hwB = [9.0, 6.9, 4.9, 3.1];
  const cols = [COLORS.mint, COLORS.gold, COLORS.saffron, COLORS.pink];
  const css = ['#19E3B1', '#FFC94D', '#FF9933', '#FF3D71'];
  const stone = [], caps = [];
  const strips = [];
  for (let i = 0; i < 4; i++) {
    const y0 = i * TH;
    const hwT = hwB[i] - 0.6;
    stone.push(prism(hwB[i], hwT, TH - 0.3).translate(0, y0, 0));
    caps.push(prism(hwT + 0.15, hwT + 0.05, 0.3).translate(0, y0 + TH - 0.3, 0));
    const mat = new THREE.MeshBasicMaterial({ color: cols[i], toneMapped: false });
    strips.push({ m: mesh(frameGeo((hwT + 0.12) * 2, (hwT + 0.12) * 2, 0.2, 0.2).translate(0, y0 + TH, 0), mat, g), base: new THREE.Color(cols[i]) });
    // front stair accent: vertical neon tick
    const pill = makePill(`COMP ${i + 1}`, { color: css[i], height: 1.45 });
    pill.position.set(0, y0 + TH * 0.5, (hwB[i] + hwT) / 2 + 0.9);
    g.add(pill);
  }
  // steps up the front
  for (let i = 0; i < 4; i++) {
    for (let k = 0; k < 4; k++) {
      stone.push(new THREE.BoxGeometry(2.6, 0.85, 0.7).translate(0, i * TH + k * 0.85 + 0.42, hwB[i] - 0.35 - k * 0.15 + 0.3));
    }
  }
  mesh(merge(stone), std(0x444c94, { roughness: 0.75, emissive: 0x0d1030 }), g);
  mesh(merge(caps), std(0x7478b8, { roughness: 0.6, emissive: 0x141633 }), g);

  // shield on top
  const top = 4 * TH;
  mesh(prism(1.9, 1.6, 0.8).translate(0, top, 0), std(0x7478b8, { roughness: 0.6, emissive: 0x141633 }), g);
  const shieldRoot = new THREE.Group();
  shieldRoot.position.set(0, top + 5.2, 0);
  g.add(shieldRoot);
  const sh = new THREE.Shape();
  sh.moveTo(0, 2.8);
  sh.quadraticCurveTo(1.3, 3.5, 2.5, 3.0);
  sh.lineTo(2.5, 0.8);
  sh.quadraticCurveTo(2.4, -1.8, 0, -3.3);
  sh.quadraticCurveTo(-2.4, -1.8, -2.5, 0.8);
  sh.lineTo(-2.5, 3.0);
  sh.quadraticCurveTo(-1.3, 3.5, 0, 2.8);
  mesh(new THREE.ExtrudeGeometry(sh, { depth: 0.5, bevelEnabled: true, bevelThickness: 0.2, bevelSize: 0.2, bevelSegments: 1, curveSegments: 5 }).translate(0, 0, -0.25), std(COLORS.mint, { roughness: 0.3, metalness: 0.35, emissive: 0x0a6a52 }), shieldRoot);
  const rimPts = sh.getSpacedPoints(48).map((p) => new V3(p.x * 1.1, p.y * 1.08 + 0.02, 0));
  const chk = (z) => [new V3(-1.35, 0.25, z), new V3(-0.3, -0.9, z), new V3(1.5, 1.3, z)];
  mesh(merge([
    new THREE.TubeGeometry(new THREE.CatmullRomCurve3(rimPts, true), 64, 0.13, 4, true),
  ]), neon(COLORS.gold), shieldRoot);
  mesh(merge([polyTube(chk(0.55), 0.28, 5), polyTube(chk(-0.55), 0.28, 5)]), neon(COLORS.white), shieldRoot);
  glow(COLORS.mint, 12, 0.55, shieldRoot);

  // climbing ring
  const ring = mesh(frameGeo(1, 1, 0.014, 0.16), additive(0xffffff, 1), g);

  return {
    group: g,
    height: top + 9,
    update(t) {
      shieldRoot.rotation.y = t * 0.8;
      shieldRoot.position.y = top + 5.2 + Math.sin(t * 1.5) * 0.35;
      const P = 7;
      const s = (t % P) / P;
      const lv = s * 4.6;
      const li = Math.min(Math.floor(lv), 4);
      const f = THREE.MathUtils.smoothstep(lv - li, 0.35, 1);
      const yl = Math.min(li + f, 4);
      const y = yl * TH;
      const tier = Math.min(Math.floor(yl), 3);
      const hwT = hwB[tier] - 0.6;
      const hw = yl >= 4 ? 2.0 : THREE.MathUtils.lerp(hwB[tier], hwT, (yl - tier)) + 0.45;
      ring.position.y = y + 0.15;
      ring.scale.set(hw * 2, 1, hw * 2);
      ring.material.opacity = s > 0.9 ? (1 - s) * 10 : 1;
      for (let i = 0; i < 4; i++) {
        const boost = Math.max(0, 1 - Math.abs(yl - (i + 1)) * 1.4);
        strips[i].m.material.color.copy(strips[i].base).multiplyScalar(1 + boost * 1.6);
      }
    },
  };
}

/* ------------------------------------------------------------------ */
/* 9. ID card (HR4U)                                                   */
/* ------------------------------------------------------------------ */

function cardFace() {
  return canvasTex(420, 516, (ctx, w, h) => {
    ctx.fillStyle = '#f4f6ff';
    ctx.fillRect(0, 0, w, h);
    const grd = ctx.createLinearGradient(0, 0, w, 0);
    grd.addColorStop(0, '#7c5cff');
    grd.addColorStop(1, '#5b3fe0');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, w, 120);
    ctx.fillStyle = '#ffffff';
    ctx.font = '700 58px "Space Grotesk", Arial, sans-serif';
    ctx.textBaseline = 'middle';
    ctx.fillText('HR4U', 28, 58);
    ctx.font = '600 18px "JetBrains Mono", monospace';
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.fillText('EMPLOYEE ID', 30, 100);
    // chip
    ctx.fillStyle = '#ffc94d';
    rrect(ctx, 318, 34, 70, 52, 10); ctx.fill();
    ctx.strokeStyle = '#b8862a'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(318, 60); ctx.lineTo(388, 60); ctx.moveTo(353, 34); ctx.lineTo(353, 86); ctx.stroke();
    // avatar
    ctx.fillStyle = '#ff9933';
    ctx.beginPath(); ctx.arc(w / 2, 226, 72, 0, TAU); ctx.fill();
    ctx.save();
    ctx.beginPath(); ctx.arc(w / 2, 226, 72, 0, TAU); ctx.clip();
    ctx.fillStyle = '#2a1b4a';
    ctx.beginPath(); ctx.arc(w / 2, 206, 28, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(w / 2, 292, 56, 46, 0, 0, TAU); ctx.fill();
    ctx.restore();
    ctx.lineWidth = 6; ctx.strokeStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(w / 2, 226, 74, 0, TAU); ctx.stroke();
    // text bars
    ctx.fillStyle = '#23284f'; rrect(ctx, 90, 322, 240, 24, 12); ctx.fill();
    ctx.fillStyle = '#9aa0b8'; rrect(ctx, 120, 360, 180, 15, 7); ctx.fill();
    ctx.fillStyle = '#b9bfd4'; rrect(ctx, 105, 386, 210, 15, 7); ctx.fill();
    // status chip
    ctx.fillStyle = '#19e3b1'; rrect(ctx, 150, 412, 120, 26, 13); ctx.fill();
    // barcode
    ctx.fillStyle = '#1a1d3a';
    let x = 96;
    const r = rng(5);
    while (x < 324) { const bw = 2 + Math.floor(r() * 5); ctx.fillRect(x, 452, bw, 42); x += bw + 2 + Math.floor(r() * 4); }
  });
}
function coinFace() {
  return canvasTex(256, 256, (ctx, w) => {
    const c = w / 2;
    const grd = ctx.createRadialGradient(c * 0.8, c * 0.7, 10, c, c, c);
    grd.addColorStop(0, '#ffe39a');
    grd.addColorStop(1, '#e8a922');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, w, w);
    ctx.strokeStyle = '#b87a10'; ctx.lineWidth = 10;
    ctx.beginPath(); ctx.arc(c, c, c - 22, 0, TAU); ctx.stroke();
    ctx.fillStyle = '#9a6208';
    ctx.font = '800 150px Arial, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('₹', c, c + 8);
  });
}

function idcard() {
  const g = new THREE.Group();
  const B = PLINTH_H;
  plinth(12.6, COLORS.violet, g);

  // gantry
  const metal = std(0x6a70a8, { roughness: 0.35, metalness: 0.55, emissive: 0x10122a });
  mesh(merge([
    beam(new V3(-7, B, -0.5), new V3(-7, 25.8, -0.5), 0.7, 0.5, 6),
    beam(new V3(-7.4, 25.35, -0.5), new V3(1.0, 25.35, -0.5), 0.42, 0.42, 6),
    new THREE.CylinderGeometry(1.3, 1.7, 0.7, 6).translate(-7, B + 0.35, -0.5),
  ]), metal, g);
  mesh(merge([
    new THREE.BoxGeometry(0.16, 23.5, 0.16).translate(-7, B + 12.5, 0.12),
    new THREE.BoxGeometry(7.8, 0.14, 0.14).translate(-3.2, 25.35, -0.02),
  ]), neon(COLORS.violet), g);
  glow(COLORS.violet, 4, 0.9, g, 1.0, 25.35, -0.5);

  const pivot = new THREE.Group();
  pivot.position.set(0, 24.8, -0.5);
  g.add(pivot);
  mesh(new THREE.TorusGeometry(0.45, 0.12, 4, 12), neon(COLORS.gold), pivot);
  // lanyard
  mesh(merge([
    beam(new V3(-0.2, -0.3, 0), new V3(-1.15, -6.2, 0.1), 0.24, 0.24, 4),
    beam(new V3(0.2, -0.3, 0), new V3(1.15, -6.2, 0.1), 0.24, 0.24, 4),
  ]), std(COLORS.saffron, { roughness: 0.6, emissive: 0x4a1f00 }), pivot);
  mesh(merge([
    new THREE.BoxGeometry(2.8, 0.9, 0.5).translate(0, -6.3, 0.1),
    new THREE.BoxGeometry(0.8, 1.2, 0.3).translate(0, -7.0, 0.1),
  ]), std(COLORS.gold, { roughness: 0.3, metalness: 0.7, emissive: 0x3a2600 }), pivot);

  // card
  const card = new THREE.Group();
  card.position.y = -13.9;
  pivot.add(card);
  const cs = bubbleShape(9, 12.5, 0.9);
  const slot = new THREE.Path();
  slot.absarc(-0.8, 5.25, 0.3, PI / 2, PI * 1.5, false);
  slot.absarc(0.8, 5.25, 0.3, PI * 1.5, PI * 2.5, false);
  cs.holes.push(slot);
  mesh(new THREE.ExtrudeGeometry(cs, { depth: 0.3, bevelEnabled: true, bevelThickness: 0.12, bevelSize: 0.12, bevelSegments: 1, curveSegments: 4 }).translate(0, 0, -0.15),
    std(0xeef0fb, { roughness: 0.45, emissive: 0x262a44 }), card);
  const faceTex = cardFace();
  mesh(new THREE.PlaneGeometry(8.3, 10.2).translate(0, -0.95, 0.29), new THREE.MeshStandardMaterial({ map: faceTex, emissiveMap: faceTex, emissive: 0x9a9ab0, roughness: 0.5 }), card);
  mesh(new THREE.ShapeGeometry(bubbleShape(9.9, 13.4, 1.3), 4).translate(0, 0, -0.5), additive(COLORS.violet, 0.5), card);
  glow(COLORS.violet, 22, 0.3, card, 0, 0, -1.5);

  // coins
  const coinGeo = new THREE.CylinderGeometry(1.45, 1.45, 0.42, 14);
  const r = rng(3);
  const stacks = [[6.9, 3.4, 9], [9.4, 0.4, 6], [5.0, 6.4, 4]];
  const coinParts = [];
  for (const [cx, cz, n] of stacks) {
    for (let i = 0; i < n; i++) coinParts.push(coinGeo.clone().translate(cx + (r() - 0.5) * 0.25, B + 0.21 + i * 0.43, cz + (r() - 0.5) * 0.25));
  }
  const goldM = std(COLORS.gold, { roughness: 0.3, metalness: 0.7, emissive: 0x4a3000 });
  mesh(merge(coinParts), goldM, g);
  const face = coinFace();
  const faceMat = new THREE.MeshStandardMaterial({ map: face, roughness: 0.3, metalness: 0.5, emissive: 0x5a3a00, emissiveMap: face, emissiveIntensity: 0.6 });
  const flip = mesh(new THREE.CylinderGeometry(1.45, 1.45, 0.42, 20), [goldM, faceMat, faceMat], g);
  const flipBase = B + 0.21 + 9 * 0.43;
  flip.position.set(6.9, flipBase, 3.4);
  const coinGlow = glow(COLORS.gold, 8, 0.5, g, 6.9, flipBase + 1, 3.4);

  return {
    group: g,
    height: 27,
    update(t) {
      pivot.rotation.z = Math.sin(t * 1.1) * 0.06;
      pivot.rotation.y = Math.sin(t * 0.6) * 0.16;
      const P = 2.4;
      const s = (t % P) / P;
      if (s < 0.6) {
        const p = s / 0.6;
        flip.position.y = flipBase + Math.sin(p * PI) * 4.5;
        flip.rotation.x = p * TAU * 2;
      } else {
        flip.position.y = flipBase;
        flip.rotation.x = 0;
      }
      coinGlow.position.y = flip.position.y + 0.5;
    },
  };
}

/* ------------------------------------------------------------------ */
/* 10. Loop (Agile / Scrum)                                            */
/* ------------------------------------------------------------------ */

function loop() {
  const g = new THREE.Group();
  const B = PLINTH_H;
  plinth(12.6, COLORS.mint, g);

  // kanban board
  const BZ = 2.4;
  const metal = std(0x2a2f55, { roughness: 0.4, metalness: 0.6 });
  mesh(merge([
    beam(new V3(-6.6, B, BZ - 0.3), new V3(-6.6, 5.2, BZ - 0.3), 0.25, 0.25, 6),
    beam(new V3(6.6, B, BZ - 0.3), new V3(6.6, 5.2, BZ - 0.3), 0.25, 0.25, 6),
    new THREE.BoxGeometry(14.4, 9.4, 0.5).translate(0, 9.4, BZ - 0.3),
  ]), std(0x141a3a, { roughness: 0.5, metalness: 0.3 }), g);
  mesh(frameGeo(14.4, 9.4, 0.14, 0.14).rotateX(PI / 2).translate(0, 9.4, BZ), neon(COLORS.gold), g);
  mesh(merge([
    new THREE.BoxGeometry(0.1, 8.4, 0.05).translate(-2.4, 9.2, BZ),
    new THREE.BoxGeometry(0.1, 8.4, 0.05).translate(2.4, 9.2, BZ),
  ]), neon(COLORS.mint, { transparent: true, opacity: 0.6 }), g);
  const colX = [-4.75, 0, 4.75];
  const heads = ['TO DO', 'DOING', 'DONE'];
  const headC = ['#FF9933', '#FFC94D', '#19E3B1'];
  heads.forEach((txt, i) => {
    const p = makePill(txt, { color: headC[i], height: 1.05 });
    p.position.set(colX[i], 13.0, BZ + 0.4);
    g.add(p);
  });

  // sticky notes
  const noteGeo = new THREE.BoxGeometry(3.4, 1.55, 0.16);
  const nc = [COLORS.pink, COLORS.gold, COLORS.violet, COLORS.mint, COLORS.saffron, 0x4fc3ff, COLORS.gold, COLORS.pink, COLORS.mint];
  const notes = nc.map((c) => ({
    m: mesh(noteGeo, std(c, { roughness: 0.6, emissive: c, emissiveIntensity: 0.25 }), g),
    from: new V3(), to: new V3(), t0: -10, hop: 0,
  }));
  const cols = [[], [], []];
  notes.forEach((n, i) => cols[i % 3].push(n));
  const slotY = (k) => 11.6 - k * 1.95;
  function layout(now, mover) {
    cols.forEach((col, c) => col.forEach((n, k) => {
      const tgt = new V3(colX[c], slotY(k), BZ + 0.2);
      if (!n.to.equals(tgt)) {
        n.from.copy(now < 0 ? tgt : n.m.position);
        n.to.copy(tgt);
        n.t0 = now;
        n.hop = n === mover ? 1 : 0;
      }
    }));
  }
  layout(-1, null);
  notes.forEach((n) => n.m.position.copy(n.to));
  const seq = [[1, 2], [0, 1], [2, 0]];
  let step = 0, next = 1.2;

  // sprint arrow
  const arrowRoot = new THREE.Group();
  arrowRoot.position.set(0, 20.8, -1.5);
  g.add(arrowRoot);
  const arrow = new THREE.Group();
  arrowRoot.add(arrow);
  const R = 6.3, ARC = TAU * 0.83;
  const arrowMat = std(COLORS.mint, { roughness: 0.35, metalness: 0.2, emissive: 0x0b7a5f });
  mesh(new THREE.TorusGeometry(R, 0.75, 6, 36, ARC), arrowMat, arrow);
  const head = mesh(new THREE.ConeGeometry(1.7, 2.8, 6), arrowMat, arrow);
  head.position.set(Math.cos(ARC) * R, Math.sin(ARC) * R, 0);
  head.rotation.z = ARC;
  head.position.add(new V3(-Math.sin(ARC), Math.cos(ARC), 0).multiplyScalar(1.2));
  mesh(new THREE.TorusGeometry(R, 0.06, 3, 64), neon(COLORS.violet), arrowRoot).position.z = -0.9;
  const dotsG = [];
  for (let i = 0; i < 4; i++) {
    const a = i * TAU / 4 + PI / 4;
    dotsG.push(new THREE.IcosahedronGeometry(0.45, 0).translate(Math.cos(a) * (R - 2.1), Math.sin(a) * (R - 2.1), 0));
  }
  const ceremonies = mesh(merge(dotsG), neon(COLORS.gold), arrowRoot);
  const sprint = makePill('SPRINT', { color: '#19E3B1', height: 1.6 });
  arrowRoot.add(sprint);
  glow(COLORS.mint, 18, 0.35, arrowRoot, 0, 0, -1.5);

  const ease = (x) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2);

  return {
    group: g,
    height: 29,
    update(t) {
      arrow.rotation.z = t * 0.7;
      ceremonies.rotation.z = -t * 0.3;
      arrowRoot.position.y = 20.8 + Math.sin(t * 1.2) * 0.3;
      if (t < next - 5) next = t + 1.2; // time jumped backwards (restart)
      if (t >= next) {
        const [a, b] = seq[step % 3];
        step++;
        next = t + 1.5;
        const n = cols[a].shift();
        if (n) { cols[b].push(n); layout(t, n); }
      }
      for (const n of notes) {
        const s = THREE.MathUtils.clamp((t - n.t0) / 0.95, 0, 1);
        const e = ease(s);
        n.m.position.lerpVectors(n.from, n.to, e);
        if (n.hop) {
          const k = Math.sin(PI * s);
          n.m.position.z += k * 1.6;
          n.m.position.y += k * 1.1;
          n.m.rotation.z = k * 0.25;
        } else n.m.rotation.z = 0;
      }
    },
  };
}

/* ------------------------------------------------------------------ */
/* 11. Sea link (Mumbai finale)                                        */
/* ------------------------------------------------------------------ */

function sealink() {
  const g = new THREE.Group();
  const DY = 7; // deck top

  // water
  const water = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: { uT: { value: 0 } },
    vertexShader: `varying vec3 vL; varying vec2 vUv; void main(){ vL = position; vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `
      uniform float uT; varying vec3 vL; varying vec2 vUv;
      void main(){
        vec2 p = vL.xz;
        float edge = smoothstep(0.0,0.1,vUv.x)*smoothstep(1.0,0.9,vUv.x)*smoothstep(0.0,0.3,vUv.y)*smoothstep(1.0,0.7,vUv.y);
        float w1 = sin(p.x*0.8 + uT*1.1 + sin(p.y*1.3 + uT)*1.6);
        float w2 = sin(p.y*2.1 - uT*1.4 + p.x*0.3);
        float rip = 0.5 + 0.25*w1 + 0.25*w2;
        vec3 c = vec3(0.015,0.035,0.09) + vec3(0.03,0.08,0.16)*rip;
        float shim = pow(max(0.0, sin(p.y*5.0 + uT*2.6 + w1*1.4)), 6.0);
        float py = smoothstep(16.0, 1.0, abs(p.y));
        float s1 = exp(-pow((abs(p.x)-15.0)/1.3, 2.0));
        c += vec3(1.0,0.72,0.3) * s1 * (0.15 + 0.85*shim) * py * 0.55;
        float deck = exp(-pow(p.y/3.2, 2.0));
        c += vec3(1.0,0.78,0.42) * deck * 0.10 * (0.6 + 0.4*sin(p.x*2.2 + uT*1.5));
        float chk = exp(-(p.x*p.x)/30.0) * py;
        c += vec3(0.1,0.9,0.7) * chk * (0.1 + 0.6*shim);
        gl_FragColor = vec4(c, edge*0.96);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const wm = mesh(new THREE.PlaneGeometry(96, 32, 1, 1).rotateX(-PI / 2).translate(0, 0.06, 0), water, g);
  wm.renderOrder = 1;

  // deck
  const concrete = std(0x3a4262, { roughness: 0.7, metalness: 0.2, emissive: 0x0a0c1a });
  const deckParts = [
    new THREE.BoxGeometry(88, 0.9, 4.4).translate(0, DY - 0.45, 0),
    new THREE.BoxGeometry(88, 0.5, 0.25).translate(0, DY + 0.25, 2.1),
    new THREE.BoxGeometry(88, 0.5, 0.25).translate(0, DY + 0.25, -2.1),
  ];
  for (let x = -40; x <= 40; x += 8) {
    if (Math.abs(Math.abs(x) - 15) < 3) continue;
    deckParts.push(new THREE.BoxGeometry(0.9, DY - 0.9, 1.6).translate(x, (DY - 0.9) / 2, 0));
    deckParts.push(new THREE.BoxGeometry(1.2, 0.5, 4.0).translate(x, DY - 1.1, 0));
  }
  deckParts.push(new THREE.BoxGeometry(2.4, DY, 5.2).translate(44, DY / 2, 0));
  deckParts.push(new THREE.BoxGeometry(2.4, DY, 5.2).translate(-44, DY / 2, 0));
  mesh(merge(deckParts), concrete, g);
  mesh(merge([
    new THREE.BoxGeometry(88, 0.12, 0.06).translate(0, DY - 0.55, 2.23),
    new THREE.BoxGeometry(88, 0.12, 0.06).translate(0, DY - 0.55, -2.23),
  ]), neon(COLORS.mint), g);
  const lp = [];
  for (let x = -43; x <= 43; x += 2) { lp.push(x, DY + 0.7, 2.1, x + 1, DY + 0.7, -2.1); }
  const lg = new THREE.BufferGeometry();
  lg.setAttribute('position', new THREE.Float32BufferAttribute(lp, 3));
  g.add(new THREE.Points(lg, new THREE.PointsMaterial({ size: 1.3, map: glowTexture(), color: COLORS.gold, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false })));

  // pylons (inverted Y) + cables
  const pyl = [], cablesG = [], cablesW = [];
  for (const px of [-15, 15]) {
    const J = 17.5; // junction height
    pyl.push(beam(new V3(px, 0, 4.8), new V3(px, J, 0.3), 1.2, 0.75, 6));
    pyl.push(beam(new V3(px, 0, -4.8), new V3(px, J, -0.3), 1.2, 0.75, 6));
    pyl.push(new THREE.BoxGeometry(1.2, 0.9, 7.2).translate(px, DY - 1.2, 0));
    pyl.push(new THREE.CylinderGeometry(0.55, 1.15, 12.5, 6).translate(px, J + 6.25 - 0.3, 0));
    pyl.push(new THREE.ConeGeometry(0.55, 1.8, 6).translate(px, J + 12.2 + 0.9, 0));
    pyl.push(new THREE.CylinderGeometry(1.4, 1.6, 0.6, 6).translate(px, 0.3, 4.6));
    pyl.push(new THREE.CylinderGeometry(1.4, 1.6, 0.6, 6).translate(px, 0.3, -4.6));
    for (let k = 0; k < 9; k++) {
      const ay = J + 1.4 + k * 1.15;
      const d = 3.4 + k * 1.4;
      for (const side of [-1, 1]) {
        for (const ez of [-1.95, 1.95]) {
          const cb = beam(new V3(px, ay, ez * 0.08), new V3(px + side * d, DY + 0.1, ez), 0.06, 0.06, 3);
          (k % 2 ? cablesW : cablesG).push(cb);
        }
      }
    }
  }
  mesh(merge(pyl), std(0xd5d9ec, { roughness: 0.6, emissive: 0x2a2c3e }), g);
  mesh(merge(cablesG), neon(COLORS.gold), g);
  mesh(merge(cablesW), neon(0xdfe6ff), g);
  mesh(merge([
    new THREE.BoxGeometry(0.12, 12, 0.12).translate(-15, 23.5, 0.86),
    new THREE.BoxGeometry(0.12, 12, 0.12).translate(15, 23.5, 0.86),
    ...Array.from({ length: 22 }, (_, i) => new THREE.BoxGeometry(1.6, 0.05, 0.14).translate(-42 + i * 4, DY + 0.03, 0)),
  ]), neon(COLORS.saffron), g);
  const beacons = [glow(COLORS.saffron, 5, 1, g, -15, 31.5, 0), glow(COLORS.saffron, 5, 1, g, 15, 31.5, 0)];
  glow(COLORS.gold, 14, 0.25, g, -15, 20, 0);
  glow(COLORS.gold, 14, 0.25, g, 15, 20, 0);

  // floating check inside a ring
  const check = new THREE.Group();
  check.position.set(0, 37, 0);
  g.add(check);
  mesh(new THREE.TorusGeometry(6.2, 0.38, 6, 48), neon(COLORS.mint), check);
  mesh(new THREE.TorusGeometry(7.1, 0.08, 3, 64), neon(COLORS.gold), check);
  mesh(polyTube([new V3(-3.1, 0.2, 0), new V3(-0.9, -2.3, 0), new V3(3.6, 2.9, 0)], 0.75, 8), neon(0xc9fff0), check);
  const cGlow = glow(COLORS.mint, 26, 0.5, check, 0, 0, 0);

  return {
    group: g,
    height: 45,
    update(t) {
      water.uniforms.uT.value = t;
      check.rotation.y = t * 0.45;
      check.position.y = 37 + Math.sin(t * 1.1) * 0.6;
      cGlow.material.opacity = 0.4 + 0.15 * Math.sin(t * 2);
      const b = 0.35 + 0.65 * Math.max(0, Math.sin(t * 2.2));
      beacons[0].material.opacity = b;
      beacons[1].material.opacity = b;
    },
  };
}

/* ------------------------------------------------------------------ */

const BUILDERS = { charminar, campus, chat, tower, bars, circulars, network, ziggurat, idcard, loop, sealink };

export function buildLandmark(key) {
  const fn = BUILDERS[key];
  if (!fn) {
    console.warn('[landmarks] unknown key', key);
    const g = new THREE.Group();
    return { group: g, height: 10, update() {} };
  }
  const lm = fn();
  lm.group.name = 'landmark:' + key;
  return lm;
}
