import { icons } from './icons.js';

const inr = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });
export const formatINR = (n) => '₹' + inr.format(Math.round(n || 0));

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const reduceMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

export function createHUD({ nodes = [], statuses = [], onTravel, onSound, onPassbook, onHelp } = {}) {
  const hud = $('hud');
  const route = $('route');
  const touch = $('touch');
  const stepper = $('stepper');
  const utrEl = $('utr');
  const scoreEl = $('score');
  const walletEl = $('wallet');
  const routeFill = $('route-fill');
  const routeMe = $('route-me');
  const stops = $('route-stops');
  const help = $('help');
  const toasts = $('toasts');
  const btnSound = $('btn-sound');
  const btnPassbook = $('btn-passbook');
  const btnHelp = $('btn-help');

  /* ---------- stepper ---------- */
  stepper.innerHTML = statuses.map((s) => `<li title="${esc(s)}">${esc(s)}</li>`).join('');
  stepper.setAttribute('aria-label', 'Payment status');
  const stepLis = [...stepper.children];

  /* ---------- route stops ---------- */
  stops.innerHTML = nodes
    .map((n, i) => `<li><button type="button" data-i="${i}" aria-label="Travel to ${esc(n.title)}" title="${esc(n.title)}"><i></i>${esc(n.short)}</button></li>`)
    .join('');
  const stopLis = [...stops.children];
  stops.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-i]');
    if (!b) return;
    onTravel?.(Number(b.dataset.i));
  });

  /* ---------- icon buttons ---------- */
  btnSound.innerHTML = icons.soundOff; // main.js syncs the real state via setSoundIcon()
  btnPassbook.innerHTML = icons.book;
  btnHelp.innerHTML = icons.help;
  btnHelp.setAttribute('aria-expanded', 'false');
  btnHelp.setAttribute('aria-controls', 'help');

  btnSound.addEventListener('click', () => onSound?.());
  btnPassbook.addEventListener('click', () => { toggleHelp(false); onPassbook?.(); });

  function toggleHelp(force) {
    const open = typeof force === 'boolean' ? force : help.hidden;
    help.hidden = !open;
    btnHelp.setAttribute('aria-expanded', String(open));
    return open;
  }
  btnHelp.addEventListener('click', (e) => {
    e.stopPropagation();
    const open = toggleHelp();
    onHelp?.(open);
  });
  document.addEventListener('pointerdown', (e) => {
    if (help.hidden) return;
    if (help.contains(e.target) || btnHelp.contains(e.target)) return;
    toggleHelp(false);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !help.hidden) toggleHelp(false);
  });

  /* ---------- score count-up ---------- */
  let shown = 0;
  let target = 0;
  let raf = 0;
  const bump = (el) => {
    const stat = el.closest('.stat');
    if (!stat) return;
    stat.classList.remove('bump');
    void stat.offsetWidth; // restart animation
    stat.classList.add('bump');
    clearTimeout(stat._bt);
    stat._bt = setTimeout(() => stat.classList.remove('bump'), 400);
  };

  function setScore(n) {
    n = Math.max(0, Math.round(Number(n) || 0));
    if (n === target) return;
    const up = n > target;
    target = n;
    if (up) bump(scoreEl);
    cancelAnimationFrame(raf);
    if (reduceMotion()) { shown = n; scoreEl.textContent = formatINR(n); return; }
    const from = shown;
    const t0 = performance.now();
    const dur = Math.min(900, 280 + Math.abs(n - from) / 20);
    const step = (t) => {
      const k = Math.min(1, (t - t0) / dur);
      const e = 1 - Math.pow(1 - k, 3);
      shown = from + (n - from) * e;
      scoreEl.textContent = formatINR(shown);
      if (k < 1) raf = requestAnimationFrame(step);
      else shown = n;
    };
    raf = requestAnimationFrame(step);
  }

  let wallet = 0;
  function setWallet(n) {
    n = Math.max(0, Math.round(Number(n) || 0));
    if (n > wallet) bump(walletEl);
    wallet = n;
    walletEl.textContent = String(n);
  }

  /* ---------- toasts ---------- */
  function toast(text, kind) {
    const t = document.createElement('div');
    t.className = 'toast' + (kind ? ' ' + kind : '');
    t.textContent = text;
    toasts.appendChild(t);
    while (toasts.children.length > 4) toasts.firstElementChild.remove();
    setTimeout(() => t.remove(), 2300);
    return t;
  }

  return {
    show() { [hud, route, touch].forEach((el) => el && el.classList.remove('hidden')); },
    hide() { [hud, route, touch].forEach((el) => el && el.classList.add('hidden')); toggleHelp(false); },

    setStatus(i) {
      stepLis.forEach((li, k) => {
        li.classList.toggle('done', k < i);
        li.classList.toggle('now', k === i);
        if (k === i) li.setAttribute('aria-current', 'step'); else li.removeAttribute('aria-current');
      });
    },

    setScore,
    setWallet,

    setProgress(frac) {
      const p = Math.max(0, Math.min(1, Number(frac) || 0)) * 100;
      routeFill.style.width = p + '%';
      routeMe.style.left = p + '%';
    },

    setNodes(currentIdx, visited = new Set()) {
      stopLis.forEach((li, i) => {
        const now = i === currentIdx;
        li.classList.toggle('now', now);
        li.classList.toggle('done', !now && visited.has(i));
        const b = li.firstElementChild;
        if (now) b.setAttribute('aria-current', 'location'); else b.removeAttribute('aria-current');
      });
    },

    toast,

    setUTR(str) {
      const s = String(str ?? '');
      utrEl.textContent = /^utr/i.test(s) ? s : `UTR ${s}`;
    },

    setSoundIcon(on) {
      btnSound.innerHTML = on ? icons.soundOn : icons.soundOff;
      btnSound.setAttribute('aria-pressed', String(!!on));
      btnSound.setAttribute('aria-label', on ? 'Mute sound' : 'Turn sound on');
    },

    /* extra (not in the original contract): lets keyboard 'H' reuse the same popover logic */
    toggleHelp,
  };
}
