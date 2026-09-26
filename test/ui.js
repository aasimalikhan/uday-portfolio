// Dev-only harness for src/ui/*. Open http://localhost:5173/test/ui.html
import { NODES, STATUSES } from '../src/data.js';
import { createHUD } from '../src/ui/hud.js';
import { createCard } from '../src/ui/cards.js';
import { createPassbook } from '../src/ui/passbook.js';
import { audio } from '../src/ui/audio.js';

const visited = new Set();
let score = 0;
let wallet = 0;
let cur = 0;

const hud = createHUD({
  nodes: NODES,
  statuses: STATUSES,
  onTravel: (i) => go(i),
  onSound: () => { audio.toggle(); hud.setSoundIcon(audio.enabled); audio.click(); },
  onPassbook: () => pb.open(),
  onHelp: () => audio.click(),
});
const card = createCard({
  onContinue: () => { card.close(); go(Math.min(cur + 1, NODES.length - 1)); },
  onReplay: () => { card.close(); visited.clear(); score = 0; wallet = 0; hud.setScore(0); hud.setWallet(0); go(0); },
  onPassbook: () => pb.open(),
});
const pb = createPassbook({ onClose: () => console.log('passbook closed') });

function go(i) {
  cur = i;
  visited.add(i);
  hud.setStatus(NODES[i].status);
  hud.setNodes(i, visited);
  hud.setProgress(i / (NODES.length - 1));
  score += 12450; wallet += 3;
  hud.setScore(score); hud.setWallet(wallet);
  card.open(NODES[i], i, { utr: 'UPI4096UDAY2026', score, wallet, visitedCount: visited.size, total: NODES.length, timeMs: 134000 });
}

hud.show();
hud.setUTR('UPI4096UDAY2026');
hud.setSoundIcon(audio.enabled);
hud.setStatus(0);
hud.setNodes(0, visited);
hud.setProgress(0);

const dev = document.getElementById('dev');
const add = (label, fn) => { const b = document.createElement('button'); b.textContent = label; b.onclick = fn; dev.appendChild(b); };
NODES.forEach((n, i) => add(`${i} ${n.short}`, () => go(i)));
add('close card', () => card.close());
add('passbook', () => pb.open());
add('toast good', () => hud.toast('+ Power BI', 'good'));
add('toast bad', () => hud.toast('− SCOPE CREEP', 'bad'));
add('toast gold', () => hud.toast('SIX! 🏏 +₹5,000', 'gold'));
add('toast plain', () => hud.toast('Docked at node'));
add('sfx all', () => {
  ['coin', 'skill', 'hit', 'dock', 'success', 'click'].forEach((s, k) => setTimeout(() => audio[s](), k * 700));
});

window.__ui = { hud, card, pb, audio, go };
const q = new URLSearchParams(location.search);
if (q.has('node')) go(Number(q.get('node')));
if (q.has('pb')) pb.open();
