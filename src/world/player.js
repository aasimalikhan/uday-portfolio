import * as THREE from 'three';
import { COLORS } from './scene.js';
import { makeGlow, glowTexture } from './labels.js';

function rupeeFace() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(100, 90, 10, 128, 128, 130);
  g.addColorStop(0, '#FFF1B8');
  g.addColorStop(0.55, '#FFC94D');
  g.addColorStop(1, '#C98A12');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 256, 256);
  ctx.strokeStyle = 'rgba(120,70,0,0.55)'; ctx.lineWidth = 10;
  ctx.beginPath(); ctx.arc(128, 128, 104, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = '#7A4A00';
  ctx.font = '900 150px Arial, sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('₹', 128, 138);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function createPlayer() {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  const faceTex = rupeeFace();
  const edgeMat = new THREE.MeshStandardMaterial({ color: COLORS.gold, metalness: 0.8, roughness: 0.3, emissive: 0x6b4300, emissiveIntensity: 0.6 });
  const faceMat = new THREE.MeshStandardMaterial({ map: faceTex, metalness: 0.5, roughness: 0.35, emissive: 0xffc94d, emissiveMap: faceTex, emissiveIntensity: 0.35 });
  const coin = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 0.26, 40), [edgeMat, faceMat, faceMat]);
  coin.rotation.x = Math.PI / 2; // faces point along ±z
  const spin = new THREE.Group();
  spin.add(coin);
  body.add(spin);

  const ringMat = new THREE.MeshBasicMaterial({ color: COLORS.mint, transparent: true, opacity: 0.9 });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.75, 0.06, 8, 48), ringMat);
  ring.rotation.x = Math.PI / 2;
  body.add(ring);
  const ring2 = new THREE.Mesh(new THREE.TorusGeometry(2.1, 0.035, 6, 48), new THREE.MeshBasicMaterial({ color: COLORS.saffron, transparent: true, opacity: 0.7 }));
  body.add(ring2);

  const glow = makeGlow(COLORS.gold, 6);
  body.add(glow);
  const under = makeGlow(COLORS.mint, 5);
  under.position.y = -1.3;
  under.scale.set(6, 2.2, 1);
  root.add(under);

  // trail of glowing points
  const TRAIL = 36;
  const trailPos = new Float32Array(TRAIL * 3);
  const trailCol = new Float32Array(TRAIL * 3);
  const cA = new THREE.Color(COLORS.gold), cB = new THREE.Color(COLORS.saffron);
  for (let i = 0; i < TRAIL; i++) {
    const k = 1 - i / TRAIL;
    const c = cA.clone().lerp(cB, i / TRAIL).multiplyScalar(k * k);
    trailCol.set([c.r, c.g, c.b], i * 3);
  }
  const trailGeo = new THREE.BufferGeometry();
  trailGeo.setAttribute('position', new THREE.BufferAttribute(trailPos, 3));
  trailGeo.setAttribute('color', new THREE.BufferAttribute(trailCol, 3));
  const trail = new THREE.Points(trailGeo, new THREE.PointsMaterial({
    size: 1.3, map: glowTexture(), vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  trail.frustumCulled = false;
  let trailInit = false;
  let trailAcc = 0;

  function update(t, dt, speed, lateralVel, worldPos) {
    spin.rotation.y += dt * (2 + speed * 0.12);
    ring.rotation.z += dt * 1.5;
    ring2.rotation.y -= dt * 0.9;
    ring2.rotation.x = Math.sin(t * 0.8) * 0.5;
    body.position.y = Math.sin(t * 3) * 0.18;
    body.rotation.z = THREE.MathUtils.lerp(body.rotation.z, -lateralVel * 0.06, 1 - Math.exp(-dt * 8));
    glow.material.opacity = 0.75 + Math.sin(t * 5) * 0.15;

    if (!trailInit) {
      for (let i = 0; i < TRAIL; i++) trailPos.set([worldPos.x, worldPos.y, worldPos.z], i * 3);
      trailInit = true;
    }
    trailAcc += dt;
    if (trailAcc > 0.016) {
      trailAcc = 0;
      trailPos.copyWithin(3, 0, (TRAIL - 1) * 3);
      trailPos[0] = worldPos.x; trailPos[1] = worldPos.y + body.position.y; trailPos[2] = worldPos.z;
      trailGeo.attributes.position.needsUpdate = true;
    }
  }

  function resetTrail() { trailInit = false; }

  return { root, trail, update, resetTrail };
}
