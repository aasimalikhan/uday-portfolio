// Dev-only harness for src/world/landmarks.js
// Usage: /test/landmarks.html            -> all landmarks in a grid
//        /test/landmarks.html?key=charminar[&d=40&el=16&az=0&t=3]
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { buildLandmark } from '../src/world/landmarks.js';

const KEYS = ['charminar', 'campus', 'chat', 'tower', 'bars', 'circulars', 'network', 'ziggurat', 'idcard', 'loop', 'sealink'];
const params = new URLSearchParams(location.search);
const key = params.get('key');
const freezeT = params.has('t') ? parseFloat(params.get('t')) : null;

const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.6));
renderer.setSize(innerWidth, innerHeight, false);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x070a18);
scene.fog = new THREE.Fog(0x0b0f2a, 70, 380);
scene.add(new THREE.HemisphereLight(0x9fb0ff, 0x1a1030, 1.4));
const sun = new THREE.DirectionalLight(0xffd2a0, 1.6);
sun.position.set(-60, 90, 40);
scene.add(sun);
const rim = new THREE.DirectionalLight(0x19e3b1, 0.6);
rim.position.set(80, 30, -60);
scene.add(rim);

const ground = new THREE.Mesh(new THREE.PlaneGeometry(2000, 2000).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x06081a }));
scene.add(ground);
const grid = new THREE.GridHelper(1200, 200, 0x2b3a8f, 0x151c48);
grid.position.y = 0.01;
scene.add(grid);

const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.5, 900);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;

const items = [];
const stats = [];
function countObjects(g) {
  let meshes = 0, draws = 0;
  g.traverse((o) => {
    if (o.isMesh) meshes++;
    if (o.isMesh || o.isSprite || o.isLine || o.isPoints) draws++;
  });
  return { meshes, draws };
}

function add(k, x, z) {
  const t0 = performance.now();
  const lm = buildLandmark(k);
  const ms = performance.now() - t0;
  lm.group.position.set(x, 0, z);
  scene.add(lm.group);
  items.push(lm);
  const c = countObjects(lm.group);
  stats.push(`${k.padEnd(10)} meshes ${String(c.meshes).padStart(3)}  drawables ${String(c.draws).padStart(3)}  h ${lm.height}  build ${ms.toFixed(1)}ms`);
  return lm;
}

if (key) {
  const lm = add(key, 0, 0);
  const isSea = key === 'sealink';
  const d = parseFloat(params.get('d') || (isSea ? 85 : 40));
  const el = parseFloat(params.get('el') || (isSea ? 26 : 14));
  const az = parseFloat(params.get('az') || 0) * Math.PI / 180;
  const ty = lm.height * 0.45;
  camera.position.set(Math.sin(az) * d, el + ty * 0.5, Math.cos(az) * d);
  controls.target.set(0, ty, 0);
} else {
  KEYS.forEach((k, i) => {
    if (k === 'sealink') add(k, 60, 150);
    else add(k, (i % 4) * 60 - 90, Math.floor(i / 4) * 60 - 60);
  });
  camera.position.set(0, 120, 220);
  controls.target.set(0, 10, 20);
}

const ui = document.getElementById('ui');
ui.innerHTML = `<a href="?" class="${key ? '' : 'on'}">all</a>` + KEYS.map((k) => `<a href="?key=${k}" class="${k === key ? 'on' : ''}">${k}</a>`).join('');
document.getElementById('stats').textContent = stats.join('\n');
console.log('[landmarks]\n' + stats.join('\n'));
window.__landmarks = { items, stats, renderer };

addEventListener('resize', () => {
  renderer.setSize(innerWidth, innerHeight, false);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
});

const timer = new THREE.Timer();
function frame(now) {
  timer.update(now);
  const dt = Math.min(timer.getDelta(), 0.05);
  const t = freezeT ?? timer.getElapsed();
  for (const it of items) it.update(t, dt);
  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
