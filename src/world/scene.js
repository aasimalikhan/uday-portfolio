import * as THREE from 'three';

export const COLORS = {
  night: 0x070a18,
  fog: 0x0b0f2a,
  saffron: 0xff9933,
  mint: 0x19e3b1,
  gold: 0xffc94d,
  pink: 0xff3d71,
  violet: 0x7c5cff,
  white: 0xf4f6ff,
};

export const FOG_NEAR = 70;
export const FOG_FAR = 380;

export function createScene(canvas) {
  const isMobile = matchMedia('(pointer: coarse)').matches || innerWidth < 760;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !isMobile || devicePixelRatio < 2, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, isMobile ? 1.35 : 1.6));
  renderer.setSize(innerWidth, innerHeight, false);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(COLORS.night);
  scene.fog = new THREE.Fog(COLORS.fog, FOG_NEAR, FOG_FAR);

  const camera = new THREE.PerspectiveCamera(isMobile ? 70 : 60, innerWidth / innerHeight, 0.5, 900);
  camera.position.set(0, 30, 60);

  scene.add(new THREE.HemisphereLight(0x9fb0ff, 0x1a1030, 1.4));
  const sun = new THREE.DirectionalLight(0xffd2a0, 1.6);
  sun.position.set(-60, 90, 40);
  scene.add(sun);
  const rim = new THREE.DirectionalLight(0x19e3b1, 0.6);
  rim.position.set(80, 30, -60);
  scene.add(rim);

  scene.add(makeSky());
  const ground = makeGround();
  scene.add(ground);
  const stars = makeStars();
  scene.add(stars);

  function resize() {
    renderer.setSize(innerWidth, innerHeight, false);
    camera.aspect = innerWidth / innerHeight;
    camera.fov = innerWidth < 760 ? 70 : 60;
    camera.updateProjectionMatrix();
  }
  addEventListener('resize', resize);

  return { renderer, scene, camera, ground, stars, isMobile };
}

function makeSky() {
  const geo = new THREE.SphereGeometry(800, 32, 16);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {},
    vertexShader: `varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `
      varying vec3 vP;
      void main(){
        float h = vP.y;
        vec3 top = vec3(0.02,0.03,0.09);
        vec3 mid = vec3(0.10,0.06,0.22);
        vec3 hor = vec3(0.55,0.22,0.18);
        vec3 c = mix(mid, top, smoothstep(0.05, 0.6, h));
        c = mix(hor, c, smoothstep(-0.02, 0.16, h));
        float band = exp(-abs(h - 0.02) * 40.0);
        c += vec3(1.0,0.55,0.2) * band * 0.25;
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  const m = new THREE.Mesh(geo, mat);
  m.renderOrder = -10;
  m.frustumCulled = false;
  m.onBeforeRender = (r, s, cam) => m.position.copy(cam.position);
  return m;
}

function makeGround() {
  const geo = new THREE.PlaneGeometry(1400, 1400, 1, 1);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uBg: { value: new THREE.Color(COLORS.fog) },
      uA: { value: new THREE.Color(0x2b3a8f) },
      uB: { value: new THREE.Color(0x19e3b1) },
      uCam: { value: new THREE.Vector3() },
    },
    vertexShader: `varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `
      uniform vec3 uBg; uniform vec3 uA; uniform vec3 uB; uniform vec3 uCam;
      varying vec3 vW;
      float grid(vec2 p, float s, float w){ vec2 q = p / s; vec2 g = abs(fract(q - 0.5) - 0.5) / (fwidth(q) * w); return 1.0 - min(min(g.x, g.y), 1.0); }
      void main(){
        float d = length(vW.xz - uCam.xz);
        float g1 = grid(vW.xz, 6.0, 1.0);
        float g2 = grid(vW.xz, 48.0, 1.6);
        float fade = 1.0 - smoothstep(40.0, 360.0, d);
        vec3 base = vec3(0.025,0.03,0.075);
        vec3 c = base + uA * g1 * 0.35 * fade + uB * g2 * 0.22 * fade;
        c = mix(c, uBg, smoothstep(120.0, 420.0, d));
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  const m = new THREE.Mesh(geo, mat);
  m.onBeforeRender = (r, s, cam) => {
    mat.uniforms.uCam.value.copy(cam.position);
    m.position.set(Math.round(cam.position.x / 48) * 48, 0, Math.round(cam.position.z / 48) * 48);
  };
  m.frustumCulled = false;
  return m;
}

function makeStars() {
  const n = 1400;
  const pos = new Float32Array(n * 3);
  const col = new Float32Array(n * 3);
  const palette = [new THREE.Color(0xffffff), new THREE.Color(COLORS.gold), new THREE.Color(COLORS.mint), new THREE.Color(0xa9b4ff)];
  for (let i = 0; i < n; i++) {
    const th = Math.random() * Math.PI * 2;
    const ph = Math.random() * 0.45 * Math.PI + 0.08;
    const r = 600;
    pos[i * 3] = Math.cos(th) * Math.cos(ph) * r;
    pos[i * 3 + 1] = Math.sin(ph) * r * 0.7 + 30;
    pos[i * 3 + 2] = Math.sin(th) * Math.cos(ph) * r;
    const c = palette[(Math.random() * palette.length) | 0];
    col.set([c.r, c.g, c.b], i * 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const m = new THREE.PointsMaterial({ size: 2, sizeAttenuation: false, vertexColors: true, transparent: true, opacity: 0.85, fog: false, depthWrite: false });
  const p = new THREE.Points(g, m);
  p.frustumCulled = false;
  p.onBeforeRender = (r, s, cam) => p.position.copy(cam.position);
  return p;
}

// Instanced night city along the track, avoiding the rail and landmark plots
export function makeCity(samples, avoid) {
  const count = 900;
  const geo = new THREE.BoxGeometry(1, 1, 1);
  geo.translate(0, 0.5, 0);
  const winTex = windowTexture();
  const mat = new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0xffc98a, emissiveMap: winTex, emissiveIntensity: 0.9 });
  const mesh = new THREE.InstancedMesh(geo, mat, count);
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const tints = [0x141a3d, 0x1b1f4a, 0x221a45, 0x10213a, 0x1e2550, 0x2a1f3f].map((c) => new THREE.Color(c));
  const p = new THREE.Vector3();
  let placed = 0, tries = 0;
  while (placed < count && tries < count * 12) {
    tries++;
    const s = samples[(Math.random() * samples.length) | 0];
    const side = Math.random() < 0.5 ? -1 : 1;
    const lat = 24 + Math.pow(Math.random(), 0.8) * 120;
    p.copy(s.p).addScaledVector(s.side, side * lat);
    p.y = 0;
    let ok = true;
    for (const smp of samples) { if (Math.abs(smp.p.x - p.x) < 16 && Math.abs(smp.p.z - p.z) < 16 && smp.p.distanceTo(p) < 16) { ok = false; break; } }
    if (!ok) continue;
    for (const a of avoid) { if (a.distanceTo(p) < a.r) { ok = false; break; } }
    if (!ok) continue;
    const w = 5 + Math.random() * 9;
    const d = 5 + Math.random() * 9;
    const far = lat > 60 ? 1.6 : 1;
    const h = (6 + Math.pow(Math.random(), 2.2) * 55) * far;
    q.setFromAxisAngle(up, Math.random() * Math.PI);
    m4.compose(p, q, new THREE.Vector3(w, h, d));
    mesh.setMatrixAt(placed, m4);
    mesh.setColorAt(placed, tints[(Math.random() * tints.length) | 0]);
    placed++;
  }
  mesh.count = placed;
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  return mesh;
}

function windowTexture() {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 128;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, 64, 128);
  for (let y = 6; y < 124; y += 8) {
    for (let x = 4; x < 60; x += 8) {
      const r = Math.random();
      if (r < 0.28) { ctx.fillStyle = r < 0.06 ? '#9ff5e0' : r < 0.12 ? '#ffffff' : '#ffb35c'; ctx.globalAlpha = 0.5 + Math.random() * 0.5; ctx.fillRect(x, y, 4, 4); }
    }
  }
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, 64, 4);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.magFilter = THREE.NearestFilter;
  return t;
}
