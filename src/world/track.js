import * as THREE from 'three';
import { COLORS, FOG_NEAR, FOG_FAR } from './scene.js';
import { makePill } from './labels.js';

export const LANE_W = 3.2;
export const DECK_W = 12;
export const RAIL_Y = 4;
export const SEG = 115;
export const START = 45;

const UP = new THREE.Vector3(0, 1, 0);

export function buildTrack(nodeCount) {
  const needed = START + (nodeCount - 1) * SEG + 140;
  const pts = [];
  for (let i = 0; ; i++) {
    const x = 42 * Math.sin(i * 0.55) + 16 * Math.sin(i * 0.23 + 1.3);
    pts.push(new THREE.Vector3(x, RAIL_Y, -i * 48));
    if (i * 48 > needed + 60) break;
  }
  const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
  curve.arcLengthDivisions = 3000;
  const length = curve.getLength();

  const tmpT = new THREE.Vector3();
  function frame(s, out = {}) {
    const u = THREE.MathUtils.clamp(s / length, 0, 1);
    out.p = curve.getPointAt(u, out.p || new THREE.Vector3());
    out.t = curve.getTangentAt(u, out.t || new THREE.Vector3());
    tmpT.copy(out.t); tmpT.y = 0; tmpT.normalize();
    out.side = (out.side || new THREE.Vector3()).crossVectors(tmpT, UP).normalize();
    return out;
  }

  const stationS = Array.from({ length: nodeCount }, (_, i) => START + i * SEG);

  // samples for placement + ribbon geometry
  const samples = [];
  for (let s = 0; s <= length; s += 4) {
    const f = frame(s, {});
    samples.push({ s, p: f.p.clone(), side: f.side.clone() });
  }

  const group = new THREE.Group();
  const uniforms = { uTime: { value: 0 } };
  group.add(makeDeck(frame, length, uniforms));
  group.add(makeUnderBeam(frame, length));
  group.add(makeBarrier(frame, length, -1, COLORS.saffron));
  group.add(makeBarrier(frame, length, 1, COLORS.mint));
  group.add(makePillars(frame, length));

  return { curve, length, frame, stationS, samples, group, uniforms };
}

function ribbon(frame, length, step, fn) {
  const pos = [], uv = [], idx = [];
  let row = 0;
  const f = {};
  for (let s = 0; s <= length + 0.001; s += step) {
    frame(Math.min(s, length), f);
    const [a, b] = fn(f);
    pos.push(a.x, a.y, a.z, b.x, b.y, b.z);
    uv.push(0, s, 1, s);
    if (row > 0) {
      const i = row * 2;
      idx.push(i - 2, i, i - 1, i - 1, i, i + 1);
    }
    row++;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

function makeDeck(frame, length, uniforms) {
  const a = new THREE.Vector3(), b = new THREE.Vector3();
  const geo = ribbon(frame, length, 2, (f) => [
    a.copy(f.p).addScaledVector(f.side, -DECK_W / 2),
    b.copy(f.p).addScaledVector(f.side, DECK_W / 2),
  ]);
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      ...uniforms,
      uFog: { value: new THREE.Color(COLORS.fog) },
      uNear: { value: FOG_NEAR }, uFar: { value: FOG_FAR },
    },
    side: THREE.DoubleSide,
    vertexShader: `
      varying vec2 vUv; varying float vDepth;
      void main(){ vUv = uv; vec4 mv = modelViewMatrix * vec4(position,1.0); vDepth = -mv.z; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `
      uniform float uTime; uniform vec3 uFog; uniform float uNear; uniform float uFar;
      varying vec2 vUv; varying float vDepth;
      void main(){
        float x = (vUv.x - 0.5) * ${DECK_W.toFixed(1)};
        float s = vUv.y;
        float ax = abs(x);
        vec3 c = vec3(0.035, 0.045, 0.12);
        c += vec3(0.05, 0.06, 0.16) * (1.0 - smoothstep(0.0, 5.0, ax));
        float edge = smoothstep(0.45, 0.0, abs(ax - 5.55));
        vec3 edgeCol = x < 0.0 ? vec3(1.0, 0.6, 0.2) : vec3(0.1, 0.89, 0.69);
        c += edgeCol * edge * 1.3;
        float dv = smoothstep(0.1, 0.0, abs(ax - ${(LANE_W / 2).toFixed(2)}));
        float dash = step(0.45, fract(s / 5.0));
        c += vec3(0.55, 0.6, 0.95) * dv * dash * 0.6;
        float seam = smoothstep(0.03, 0.0, fract(s / 12.0)) * 0.15;
        c += vec3(0.4, 0.5, 1.0) * seam;
        float lane = clamp(floor((x + ${(LANE_W * 1.5).toFixed(2)}) / ${LANE_W.toFixed(2)}), 0.0, 2.0);
        float lc = (lane - 1.0) * ${LANE_W.toFixed(2)};
        float inLane = smoothstep(0.55, 0.0, abs(x - lc)) * step(ax, 4.8);
        float ph = fract((s - uTime * 48.0 + lane * 17.0) / 64.0);
        float pkt = smoothstep(0.0, 0.015, ph) * smoothstep(0.09, 0.015, ph);
        vec3 pc = lane < 0.5 ? vec3(1.0, 0.6, 0.2) : (lane < 1.5 ? vec3(1.0, 0.8, 0.3) : vec3(0.1, 0.89, 0.69));
        c += pc * pkt * inLane * 1.1;
        c = mix(c, uFog, smoothstep(uNear, uFar, vDepth));
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  return new THREE.Mesh(geo, mat);
}

function makeUnderBeam(frame, length) {
  const a = new THREE.Vector3(), b = new THREE.Vector3();
  const geo = ribbon(frame, length, 4, (f) => [
    a.copy(f.p).addScaledVector(f.side, -DECK_W / 2).setY(f.p.y - 0.01),
    b.copy(f.p).addScaledVector(f.side, -DECK_W / 2).setY(f.p.y - 1.1),
  ]);
  const geo2 = ribbon(frame, length, 4, (f) => [
    a.copy(f.p).addScaledVector(f.side, DECK_W / 2).setY(f.p.y - 0.01),
    b.copy(f.p).addScaledVector(f.side, DECK_W / 2).setY(f.p.y - 1.1),
  ]);
  const mat = new THREE.MeshLambertMaterial({ color: 0x151a3a, side: THREE.DoubleSide });
  const g = new THREE.Group();
  g.add(new THREE.Mesh(geo, mat), new THREE.Mesh(geo2, mat));
  return g;
}

function makeBarrier(frame, length, dir, color) {
  const a = new THREE.Vector3(), b = new THREE.Vector3();
  const geo = ribbon(frame, length, 3, (f) => [
    a.copy(f.p).addScaledVector(f.side, dir * (DECK_W / 2 - 0.1)),
    b.copy(f.p).addScaledVector(f.side, dir * (DECK_W / 2 - 0.1)).setY(f.p.y + 0.9),
  ]);
  const mat = new THREE.ShaderMaterial({
    uniforms: { uC: { value: new THREE.Color(color) } },
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
    vertexShader: `varying float vH; varying float vD; void main(){ vH = uv.x; vec4 mv = modelViewMatrix * vec4(position,1.0); vD = -mv.z; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform vec3 uC; varying float vH; varying float vD; void main(){ float a = (1.0 - vH) * 0.55 * (1.0 - smoothstep(60.0, 300.0, vD)); gl_FragColor = vec4(uC * a, a); }`,
  });
  return new THREE.Mesh(geo, mat);
}

function makePillars(frame, length) {
  const n = Math.floor(length / 16);
  const geo = new THREE.CylinderGeometry(0.7, 0.9, 1, 8);
  geo.translate(0, 0.5, 0);
  const mat = new THREE.MeshLambertMaterial({ color: 0x1c2250 });
  const mesh = new THREE.InstancedMesh(geo, mat, n);
  const m4 = new THREE.Matrix4();
  const f = {};
  for (let i = 0; i < n; i++) {
    frame(i * 16 + 8, f);
    m4.makeScale(1, f.p.y - 1.1, 1).setPosition(f.p.x, 0, f.p.z);
    mesh.setMatrixAt(i, m4);
  }
  return mesh;
}

// Portal gate at each node
export function makeGate(track, s, label, color) {
  const f = track.frame(s, {});
  const g = new THREE.Group();
  g.position.copy(f.p);
  g.lookAt(f.p.clone().add(f.t));
  const ringMat = new THREE.MeshBasicMaterial({ color });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(7.4, 0.28, 8, 56, Math.PI), ringMat);
  g.add(ring);
  const ring2 = new THREE.Mesh(new THREE.TorusGeometry(8.2, 0.08, 6, 56, Math.PI), new THREE.MeshBasicMaterial({ color: COLORS.white, transparent: true, opacity: 0.5 }));
  g.add(ring2);
  const feetMat = new THREE.MeshLambertMaterial({ color: 0x20285c, emissive: color, emissiveIntensity: 0.25 });
  for (const x of [-7.4, 7.4]) {
    const foot = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.2, 1.4), feetMat);
    foot.position.set(x, 0.3, 0);
    g.add(foot);
  }
  // scanner curtain
  const curtainMat = new THREE.ShaderMaterial({
    uniforms: { uC: { value: new THREE.Color(color) }, uA: { value: 0.12 } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    vertexShader: `varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `uniform vec3 uC; uniform float uA; varying vec2 vP; void main(){ float r = length(vP) / 7.4; if (r > 1.0) discard; float a = uA * (0.35 + 0.65 * smoothstep(0.6, 1.0, r)); gl_FragColor = vec4(uC * a, a); }`,
  });
  const curtain = new THREE.Mesh(new THREE.CircleGeometry(7.4, 40, 0, Math.PI), curtainMat);
  g.add(curtain);
  const pill = makePill(label, { color: '#' + new THREE.Color(color).getHexString(), height: 1.5 });
  pill.position.set(0, 9.4, 0);
  g.add(pill);
  return { group: g, curtainMat, ring };
}
