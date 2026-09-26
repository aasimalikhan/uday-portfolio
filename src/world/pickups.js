import * as THREE from 'three';
import { COLORS } from './scene.js';
import { makePill, makeGlow } from './labels.js';
import { LANE_W } from './track.js';

const HOVER = 1.5;

export function createPickups(track, skillPool, obstacles) {
  const group = new THREE.Group();
  const items = [];
  const { stationS } = track;

  // --- layout ---
  const rand = mulberry(20240626);
  const plan = [];
  const addSeg = (from, to, pool, withBad) => {
    let lane = (rand() * 3 | 0) - 1;
    const slots = [];
    for (let s = from; s < to; s += 7) slots.push(s);
    const skillSlots = new Set();
    let picks = [];
    if (pool && pool.length) {
      picks = [...pool].sort(() => rand() - 0.5).slice(0, Math.min(pool.length, 3));
      for (let k = 0; k < picks.length; k++) skillSlots.add(Math.floor(((k + 0.5) / picks.length) * slots.length));
    }
    let skillK = 0;
    let badLeft = withBad ? 2 : 0;
    slots.forEach((s, idx) => {
      if (rand() < 0.3) lane = THREE.MathUtils.clamp(lane + (rand() < 0.5 ? -1 : 1), -1, 1);
      if (skillSlots.has(idx)) {
        plan.push({ s, lane, type: 'skill', label: picks[skillK++] });
        return;
      }
      if (badLeft > 0 && idx > 2 && idx % 4 === 2 && rand() < 0.75) {
        const badLane = [-1, 0, 1].filter((l) => l !== lane)[rand() * 2 | 0];
        plan.push({ s, lane: badLane, type: 'bad', label: obstacles[(rand() * obstacles.length) | 0] });
        badLeft--;
      }
      plan.push({ s, lane, type: 'coin' });
    });
  };
  addSeg(14, stationS[0] - 12, null, false);
  for (let i = 0; i < stationS.length - 1; i++) {
    addSeg(stationS[i] + 22, stationS[i + 1] - 24, skillPool[i + 1], i > 0);
  }
  const coins = plan.filter((p) => p.type === 'coin');

  // --- small ₹ coins (instanced) ---
  const coinGeo = new THREE.CylinderGeometry(0.55, 0.55, 0.14, 20);
  coinGeo.rotateX(Math.PI / 2);
  const coinMat = new THREE.MeshStandardMaterial({ color: COLORS.gold, metalness: 0.7, roughness: 0.3, emissive: 0xb07a10, emissiveIntensity: 0.8 });
  const coinMesh = new THREE.InstancedMesh(coinGeo, coinMat, coins.length);
  coinMesh.frustumCulled = false;
  group.add(coinMesh);

  const f = {};
  const pos = (s, lane, out = new THREE.Vector3()) => {
    track.frame(s, f);
    return out.copy(f.p).addScaledVector(f.side, lane * LANE_W).setY(f.p.y + HOVER);
  };

  let ci = 0;
  for (const p of plan) {
    const it = { ...p, taken: false, pos: pos(p.s, p.lane), anim: 0 };
    if (p.type === 'coin') {
      it.idx = ci++;
    } else if (p.type === 'skill') {
      const g = new THREE.Group();
      const skillCoin = new THREE.Mesh(new THREE.OctahedronGeometry(0.9, 0), new THREE.MeshStandardMaterial({ color: COLORS.mint, emissive: COLORS.mint, emissiveIntensity: 0.6, flatShading: true, metalness: 0.3, roughness: 0.3 }));
      g.add(skillCoin);
      g.add(makeGlow(COLORS.mint, 4.5));
      const pill = makePill('+ ' + p.label, { color: '#19E3B1', height: 1.05 });
      pill.position.y = 1.9;
      g.add(pill);
      g.position.copy(it.pos);
      it.obj = g; it.spinner = skillCoin;
      group.add(g);
    } else {
      const g = new THREE.Group();
      const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.95, 0), new THREE.MeshStandardMaterial({ color: 0x3a0616, emissive: COLORS.pink, emissiveIntensity: 0.7, flatShading: true }));
      const cage = new THREE.Mesh(new THREE.IcosahedronGeometry(1.35, 0), new THREE.MeshBasicMaterial({ color: COLORS.pink, wireframe: true, transparent: true, opacity: 0.8 }));
      g.add(core, cage);
      g.add(makeGlow(COLORS.pink, 4));
      const pill = makePill('⚠ ' + p.label, { color: '#FF3D71', height: 1.0, fg: '#FFD0DC' });
      pill.position.y = 2.1;
      g.add(pill);
      g.position.copy(it.pos);
      it.obj = g; it.spinner = cage;
      group.add(g);
    }
    items.push(it);
  }

  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const one = new THREE.Vector3(1, 1, 1);
  const zero = new THREE.Vector3(0, 0, 0);

  function writeCoin(it, t) {
    if (it.taken) { m4.compose(it.pos, q.identity(), zero); }
    else {
      e.set(0, t * 3 + it.s * 0.3, 0);
      q.setFromEuler(e);
      m4.compose(it.pos, q, one);
    }
    coinMesh.setMatrixAt(it.idx, m4);
  }

  function update(t, dt, ps, px, onHit) {
    for (const it of items) {
      const near = Math.abs(it.s - ps) < 140;
      if (it.type === 'coin') {
        if (near || it.taken) writeCoin(it, t);
      } else if (it.obj) {
        if (it.taken) {
          it.anim += dt * 3;
          const k = 1 + it.anim * 2;
          it.obj.scale.setScalar(Math.max(0.001, k * (1 - it.anim)));
          if (it.anim >= 1) it.obj.visible = false;
        } else if (near) {
          it.spinner.rotation.y += dt * 2;
          it.spinner.rotation.x += dt * 0.7;
          it.obj.position.y = it.pos.y + Math.sin(t * 2.4 + it.s) * 0.2;
        }
      }
      if (!it.taken && Math.abs(it.s - ps) < 1.7) {
        const lx = it.lane * LANE_W;
        if (Math.abs(lx - px) < 1.55) {
          it.taken = true;
          it.anim = 0;
          onHit(it);
        }
      }
    }
    coinMesh.instanceMatrix.needsUpdate = true;
  }

  function reset() {
    for (const it of items) {
      it.taken = false; it.anim = 0;
      if (it.obj) { it.obj.visible = true; it.obj.scale.setScalar(1); }
    }
  }

  // initial matrices
  for (const it of items) if (it.type === 'coin') writeCoin(it, 0);

  return { group, items, update, reset };
}

function mulberry(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
