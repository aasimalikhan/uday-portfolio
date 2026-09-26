import './style.css';
import * as THREE from 'three';
import { PROFILE, STATUSES, NODES, SKILL_POOL, OBSTACLES } from './data.js';
import { createScene, makeCity, COLORS } from './world/scene.js';
import { buildTrack, makeGate, LANE_W } from './world/track.js';
import { buildLandmark } from './world/landmarks.js';
import { makeSign, glowTexture } from './world/labels.js';
import { createPlayer } from './world/player.js';
import { createPickups } from './world/pickups.js';
import { createInput } from './ui/input.js';
import { createHUD } from './ui/hud.js';
import { createCard } from './ui/cards.js';
import { createPassbook } from './ui/passbook.js';
import { audio } from './ui/audio.js';

const $ = (id) => document.getElementById(id);
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const params = new URLSearchParams(location.search);
const N = NODES.length;
const UTR = String(Math.floor(1e11 + Math.random() * 9e11));
const STATUS_COLORS = [COLORS.saffron, COLORS.mint, COLORS.violet, COLORS.gold, COLORS.mint];
const hex = (c) => '#' + new THREE.Color(c).getHexString();
const nextFrame = () => new Promise((r) => setTimeout(r, 0)); // not rAF: background tabs throttle it
const fmtINR = (n) => '₹' + Math.round(n).toLocaleString('en-IN');

// ---------- UI that works without WebGL ----------
const passbook = createPassbook({ onClose: () => {} });
$('btn-passbook-boot').addEventListener('click', () => passbook.open());
$('utr-boot').textContent = 'UTR ' + UTR;

const payBtn = $('btn-pay');
const setPct = (p) => { const el = $('load-pct'); if (el) el.textContent = Math.round(p) + '%'; };

boot().catch((err) => {
  console.error(err);
  payBtn.disabled = false;
  payBtn.innerHTML = '<span class="lbl">3D unavailable. Open the Passbook</span>';
  payBtn.onclick = () => passbook.open();
});

async function boot() {
  await Promise.race([
    Promise.all([
      document.fonts.load('700 64px Unbounded'),
      document.fonts.load('600 28px "JetBrains Mono"'),
      document.fonts.load('700 44px "Space Grotesk"'),
    ]),
    new Promise((r) => setTimeout(r, 2500)),
  ]).catch(() => {});
  setPct(18);
  await nextFrame();

  const { renderer, scene, camera, isMobile } = createScene($('world'));
  setPct(30);
  await nextFrame();

  // ---------- world ----------
  const track = buildTrack(N);
  scene.add(track.group);
  const UP = new THREE.Vector3(0, 1, 0);

  const gates = [];
  const landmarks = [];
  const avoid = [];
  for (let i = 0; i < N; i++) {
    const node = NODES[i];
    const color = STATUS_COLORS[node.status];
    const s = track.stationS[i];
    const gate = makeGate(track, s, `${String(i).padStart(2, '0')} · ${node.short}`, color);
    scene.add(gate.group);
    gates.push(gate);

    const f = track.frame(s, {});
    const lat = node.landmark === 'sealink' ? 36 : 27;
    const pos = f.p.clone().addScaledVector(f.side, node.side * lat).setY(0);
    const lm = buildLandmark(node.landmark);
    lm.group.position.copy(pos);
    lm.group.lookAt(f.p.x, 0, f.p.z);
    scene.add(lm.group);

    const sign = makeSign(node.code, node.title, hex(color), isMobile ? 4.6 : 4.2);
    sign.position.copy(pos).setY(lm.height + 5.5);
    scene.add(sign);

    const pool = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ map: glowTexture(), color, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    const pr = node.landmark === 'sealink' ? 110 : 46;
    pool.scale.set(pr, 1, pr);
    pool.position.copy(pos).setY(0.06);
    scene.add(pool);

    landmarks.push({ ...lm, pos, sign, node, s, f });
    const a = pos.clone(); a.r = node.landmark === 'sealink' ? 58 : 24;
    avoid.push(a);
    setPct(30 + ((i + 1) / N) * 50);
    if (i % 3 === 2) await nextFrame();
  }

  scene.add(makeCity(track.samples, avoid));
  setPct(90);
  await nextFrame();

  const player = createPlayer();
  scene.add(player.root, player.trail);
  const pickups = createPickups(track, SKILL_POOL, OBSTACLES);
  scene.add(pickups.group);
  setPct(100);

  // ---------- state ----------
  const G = {
    mode: 'boot', s: 6, v: 0, lane: 0, x: 0, xv: 0, next: 0, current: -1,
    visited: new Set(), score: 0, wallet: 0, walletSet: new Set(), streak: 0,
    shake: 0, startT: 0, snap: false,
  };

  const hud = createHUD({
    nodes: NODES, statuses: STATUSES,
    onTravel: (j) => travel(j),
    onSound: () => { audio.unlock(); audio.toggle(); hud.setSoundIcon(audio.enabled); audio.click(); },
    onPassbook: () => passbook.open(),
    onHelp: () => {},
  });
  hud.setUTR('UTR ' + UTR + ' · ' + PROFILE.name.toUpperCase());
  hud.setSoundIcon(audio.enabled);
  hud.setStatus(0);
  hud.setNodes(-1, G.visited);

  const card = createCard({
    onContinue: () => cont(),
    onReplay: () => replay(),
    onPassbook: () => passbook.open(),
  });

  const input = createInput({
    onLeft: () => { if (G.mode === 'run') G.lane = Math.max(-1, G.lane - 1); },
    onRight: () => { if (G.mode === 'run') G.lane = Math.min(1, G.lane + 1); },
    onEnter: () => { if (G.mode === 'dock') cont(); },
    onKey: (k) => {
      if (k === 'p') passbook.isOpen ? passbook.close() : passbook.open();
      else if (k === 's') { audio.unlock(); audio.toggle(); hud.setSoundIcon(audio.enabled); }
      else if (k === 'h') hud.toggleHelp();
      else if (k === 'escape') { if (passbook.isOpen) passbook.close(); else hud.toggleHelp(false); }
    },
  });

  // ---------- flow ----------
  function flash() {
    const el = $('flash');
    el.classList.add('on');
    setTimeout(() => el.classList.remove('on'), 60);
  }

  function dock(i) {
    const node = NODES[i];
    G.mode = 'dock';
    G.v = 0;
    G.current = i;
    const first = !G.visited.has(i);
    G.visited.add(i);
    if (first) {
      G.score += 2500;
      hud.setScore(G.score);
      hud.toast(`${node.short} settled · +₹2,500`, 'good');
    }
    hud.setStatus(node.final ? STATUSES.length : node.status);
    hud.setNodes(i, G.visited);
    if (node.final) audio.success(); else audio.dock();
    card.open(node, i, {
      score: G.score, wallet: G.wallet, visitedCount: G.visited.size, total: N,
      timeMs: performance.now() - G.startT, utr: UTR,
    });
  }

  function cont() {
    if (G.mode !== 'dock') return;
    const node = NODES[G.current];
    if (node.final) return;
    card.close();
    G.mode = 'run';
    G.next = G.current + 1;
    input.enabled = true;
    hud.setNodes(G.current, G.visited);
  }

  function travel(j) {
    if (G.mode === 'boot') return;
    if (G.mode === 'dock' && G.current === j) return;
    card.close();
    G.mode = 'run';
    G.next = j;
    G.s = Math.max(4, track.stationS[j] - 34);
    G.v = 26;
    G.lane = 0; G.x = 0;
    G.snap = true;
    player.resetTrail();
    flash();
    audio.click();
  }

  function replay() {
    card.close();
    pickups.reset();
    Object.assign(G, { mode: 'run', s: 6, v: 0, lane: 0, x: 0, next: 0, current: -1, score: 0, wallet: 0, streak: 0, startT: performance.now(), snap: true });
    G.visited = new Set();
    G.walletSet = new Set();
    hud.setScore(0); hud.setWallet(0); hud.setStatus(0); hud.setNodes(-1, G.visited);
    player.resetTrail();
  }

  function onHit(it) {
    if (it.type === 'coin') {
      G.score += 100; G.streak++;
      audio.coin();
    } else if (it.type === 'skill') {
      G.score += 1000; G.streak++;
      if (!G.walletSet.has(it.label)) { G.walletSet.add(it.label); G.wallet++; hud.setWallet(G.wallet); }
      hud.toast(`+ ${it.label} credited`, 'good');
      audio.skill();
    } else {
      G.score = Math.max(0, G.score - 500); G.streak = 0;
      hud.toast(`⚠ ${it.label}! −₹500`, 'bad');
      audio.hit();
      if (!reduceMotion) G.shake = 1;
      flash();
    }
    if (it.type !== 'bad' && G.streak > 0 && G.streak % 6 === 0) {
      G.score += 600;
      hud.toast('SIX! 🏏 +₹600 streak bonus', 'gold');
    }
    hud.setScore(G.score);
  }

  async function start() {
    audio.unlock();
    payBtn.disabled = true;
    const dots = [...document.querySelectorAll('#pin i')];
    for (const d of dots) { d.classList.add('on'); audio.click(); await new Promise((r) => setTimeout(r, 140)); }
    payBtn.innerHTML = '<span class="lbl">Processing… ✓</span>';
    await new Promise((r) => setTimeout(r, 260));
    $('boot').classList.add('leaving');
    setTimeout(() => { $('boot').hidden = true; $('boot').style.display = 'none'; }, 800);
    hud.show();
    G.mode = 'run';
    G.snap = false;
    G.startT = performance.now();
    input.enabled = true;
  }

  payBtn.disabled = false;
  payBtn.innerHTML = '<span class="lbl">PAY ₹∞ · Start the journey</span>';
  payBtn.onclick = start;
  if (params.has('start')) start();

  // ---------- loop ----------
  const timer = new THREE.Timer();
  const fP = {}, fL = {};
  const camPos = new THREE.Vector3();
  const camLook = new THREE.Vector3();
  const want = new THREE.Vector3();
  const wantLook = new THREE.Vector3();
  const tmp = new THREE.Vector3();
  const playerPos = new THREE.Vector3();
  let lastProg = -1;

  // initial camera: orbit the origin landmark
  const L0 = landmarks[0];
  camPos.copy(L0.pos).add(new THREE.Vector3(40, 30, 50));
  camLook.copy(L0.pos).setY(10);

  function computeDockCam(i, t) {
    const lm = landmarks[i];
    const P = lm.f.p;
    const center = tmp.copy(lm.pos).setY(lm.height * 0.62);
    const away = new THREE.Vector3().subVectors(P, lm.pos).setY(0).normalize();
    const isSea = lm.node.landmark === 'sealink';
    const narrow = innerWidth <= 860;
    const back = (isSea ? 40 : 24) + (narrow ? (isSea ? 30 : 16) : 0);
    const orbit = reduceMotion ? 0 : Math.sin(t * 0.22) * 0.18;
    away.applyAxisAngle(UP, orbit);
    want.copy(P).addScaledVector(away, back).addScaledVector(lm.f.t, isSea ? -18 : -9);
    want.y = lm.height * 0.45 + (isSea ? 16 : 9);
    wantLook.copy(P).lerp(center, 0.68);
    // offset so the landmark isn't hidden behind the card
    const fwd = new THREE.Vector3().subVectors(wantLook, want);
    const dist = fwd.length();
    fwd.normalize();
    if (innerWidth > 860) {
      const right = new THREE.Vector3().crossVectors(fwd, UP).normalize();
      wantLook.addScaledVector(right, dist * 0.3);
    } else {
      wantLook.addScaledVector(UP, -dist * 0.28);
    }
  }

  function frame(ts) {
    timer.update(ts);
    const dt = Math.min(timer.getDelta(), 0.05);
    const t = timer.getElapsed();
    const paused = passbook.isOpen;
    track.uniforms.uTime.value = t;

    if (G.mode === 'run' && !paused) {
      let target = input.boost ? 60 : 30;
      if (G.next < N) {
        const d = track.stationS[G.next] - G.s;
        if (d < 34) target = Math.min(target, 6 + d * 1.5);
      }
      G.v += (target - G.v) * (1 - Math.exp(-dt * 2.6));
      G.s = Math.min(G.s + G.v * dt, track.length - 1);
      if (G.next < N && G.s >= track.stationS[G.next]) {
        G.s = track.stationS[G.next];
        dock(G.next);
      }
    }
    const prevX = G.x;
    G.x += (G.lane * LANE_W - G.x) * (1 - Math.exp(-dt * 12));
    G.xv = (G.x - prevX) / Math.max(dt, 1e-4);

    track.frame(G.s, fP);
    playerPos.copy(fP.p).addScaledVector(fP.side, G.x).setY(fP.p.y + 1.5);
    player.root.position.copy(playerPos);
    tmp.copy(playerPos).add(fP.t);
    player.root.lookAt(tmp);
    player.update(t, dt, G.v, G.xv, playerPos);

    if (G.mode === 'run' || G.mode === 'dock') pickups.update(t, dt, G.s, G.x, onHit);

    // camera target
    let k = 5;
    if (G.mode === 'boot') {
      const a = t * 0.07;
      want.copy(L0.pos).add(tmp.set(Math.cos(a) * 58, 26 + Math.sin(t * 0.2) * 4, Math.sin(a) * 58));
      wantLook.copy(L0.pos).setY(12);
      k = 1.5;
    } else if (G.mode === 'dock') {
      computeDockCam(G.current, t);
      k = 2.2;
    } else {
      track.frame(G.s + 18, fL);
      want.copy(fP.p).addScaledVector(fP.side, G.x * 0.55).addScaledVector(fP.t, -12.5).setY(fP.p.y + 6.2);
      wantLook.copy(fL.p).addScaledVector(fL.side, G.x * 0.3).setY(fL.p.y + 1.2);
      k = 6;
    }
    if (G.snap) { camPos.copy(want); camLook.copy(wantLook); G.snap = false; }
    const a1 = 1 - Math.exp(-dt * k);
    camPos.lerp(want, a1);
    camLook.lerp(wantLook, 1 - Math.exp(-dt * (k + 2)));
    camera.position.copy(camPos);
    if (G.shake > 0) {
      camera.position.x += (Math.random() - 0.5) * G.shake * 0.8;
      camera.position.y += (Math.random() - 0.5) * G.shake * 0.8;
      G.shake = Math.max(0, G.shake - dt * 3);
    }
    camera.lookAt(camLook);
    // speed FOV kick
    const baseFov = innerWidth < 760 ? 70 : 60;
    const fov = baseFov + (G.mode === 'run' ? Math.max(0, G.v - 30) * 0.25 : 0);
    if (Math.abs(camera.fov - fov) > 0.05) { camera.fov += (fov - camera.fov) * (1 - Math.exp(-dt * 4)); camera.updateProjectionMatrix(); }

    // landmarks + gates
    for (let i = 0; i < N; i++) {
      const lm = landmarks[i];
      const d = lm.pos.distanceTo(camPos);
      if (d < 280) lm.update(t, dt);
      lm.sign.position.y = lm.height + 5.5 + Math.sin(t * 1.3 + i) * 0.35;
      const g = gates[i];
      const near = Math.abs(track.stationS[i] - G.s);
      const docked = G.mode === 'dock' && G.current === i;
      g.curtainMat.uniforms.uA.value = docked ? 0.3 + Math.sin(t * 4) * 0.08 : near < 40 ? 0.22 : 0.1;
      g.ring.scale.setScalar(docked ? 1 + Math.sin(t * 4) * 0.02 : 1);
    }

    // HUD progress
    if (G.mode !== 'boot') {
      const s0 = track.stationS[0], s1 = track.stationS[N - 1];
      const prog = THREE.MathUtils.clamp((G.s - s0) / (s1 - s0), 0, 1);
      if (Math.abs(prog - lastProg) > 0.0005) { hud.setProgress(prog); lastProg = prog; }
    }

    renderer.render(scene, camera);
  }
  renderer.setAnimationLoop(frame);

  if (import.meta.env.DEV) window.__game = { G, travel, dock, track, camera, scene, renderer };
}
