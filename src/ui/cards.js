import { icons } from './icons.js';
import { audio } from './audio.js';
import { PROFILE } from '../data.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const inr = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });
const rupees = (n) => '₹' + inr.format(Math.round(Number(n) || 0));

function fmtTime(ms) {
  const s = Math.max(0, Math.round((Number(ms) || 0) / 1000));
  const m = Math.floor(s / 60);
  return m ? `${m}m ${String(s % 60).padStart(2, '0')}s` : `${s}s`;
}

/* ------------------------------------------------------------------ */
/* Widgets. Each returns { html, mount(root, later) }.                  */
/* `later(fn, ms)` is a timer that is auto-cancelled when the card goes. */
/* ------------------------------------------------------------------ */

const widgets = {
  /* Power BI scheduled refresh with failure alerting */
  refresh() {
    const steps = ['Team APIs', 'Merge', 'Model', 'Refresh', 'Publish'];
    const html = `
      <div class="wg wg-refresh" role="group" aria-label="Scheduled refresh simulator">
        <div class="wg-h"><b>Refresh simulator</b><button type="button" class="wg-btn" data-run>Run scheduled refresh</button></div>
        <div class="pipe" aria-hidden="true">${steps.map((s, i) => `${i ? '<em>→</em>' : ''}<span data-step="${i}">${esc(s)}</span>`).join('')}</div>
        <div class="wg-log" aria-live="polite"><div>Idle. Next scheduled run is waiting for you.</div></div>
      </div>`;

    function mount(root, later) {
      const btn = root.querySelector('[data-run]');
      const spans = [...root.querySelectorAll('.pipe span')];
      const log = root.querySelector('.wg-log');
      let runs = 0;
      let firstFailed = null;

      const line = (text, cls = '') => {
        const d = document.createElement('div');
        if (cls) d.className = cls;
        d.textContent = text;
        log.appendChild(d);
      };

      btn.addEventListener('click', () => {
        runs += 1;
        let fail;
        if (runs === 1) fail = Math.random() < 0.35;
        else if (runs === 2) fail = !firstFailed; // guarantee the visitor sees both outcomes
        else fail = Math.random() < 0.35;
        if (runs === 1) firstFailed = fail;
        const failAt = fail ? 1 + Math.floor(Math.random() * 3) : -1; // Merge | Model | Refresh

        btn.disabled = true;
        audio.click();
        spans.forEach((s) => s.classList.remove('ok', 'bad', 'run'));
        log.innerHTML = '';
        line(`▶ Run #${runs} started · pulling team endpoints…`);

        const STEP = 420;
        const last = fail ? failAt : steps.length - 1;
        for (let i = 0; i <= last; i++) {
          later(() => spans[i].classList.add('run'), i * STEP);
          later(() => {
            spans[i].classList.remove('run');
            if (i === failAt) {
              spans[i].classList.add('bad');
              audio.hit();
            } else {
              spans[i].classList.add('ok');
              audio.click();
            }
          }, i * STEP + STEP * 0.8);
        }

        const end = last * STEP + STEP;
        if (fail) {
          const out = [
            [`✗ Refresh failed at ${steps[failAt]}`, 'bad'],
            ['→ Alert sent · Email ✓', 'warn'],
            ['→ Alert sent · MS Teams ✓', 'warn'],
            ['Owner notified, fix → re-run', ''],
          ];
          out.forEach(([t, c], k) => later(() => line(t, c), end + k * 380));
          later(() => { btn.disabled = false; btn.textContent = 'Re-run refresh'; }, end + out.length * 380);
        } else {
          later(() => { line('✓ Dashboard live · HR notified', 'ok'); audio.success(); }, end);
          later(() => { btn.disabled = false; btn.textContent = 'Run again'; }, end + 300);
        }
      });
    }
    return { html, mount };
  },

  /* COMP1 → COMP4 compliance escalation ladder */
  escalation() {
    const levels = [
      'Branch & deputy managers submit questionnaire',
      'Branch manager reviews deviations',
      'Regional Head review',
      'Zonal Head review',
    ];
    const html = `
      <div class="wg wg-escalation" role="group" aria-label="Compliance escalation simulator">
        <div class="wg-h"><b>Monthly certificate · live sim</b><button type="button" class="wg-btn" data-reset>Reset</button></div>
        <div class="ladder">${levels.map((t, i) => `<div data-lvl="${i}"><b>COMP ${i + 1}</b><span>${esc(t)}</span><i>waiting</i></div>`).join('')}</div>
        <div class="wg-row">
          <button type="button" class="wg-btn" data-clean>Submit clean ✓</button>
          <button type="button" class="wg-btn wg-btn-warn" data-dev>Flag a deviation ⚠</button>
        </div>
        <div class="wg-log" aria-live="polite"></div>
      </div>`;

    function mount(root) {
      const rows = [...root.querySelectorAll('.ladder > div')];
      const bClean = root.querySelector('[data-clean]');
      const bDev = root.querySelector('[data-dev]');
      const log = root.querySelector('.wg-log');
      let lvl = 0;

      const setRow = (i, cls, status) => {
        rows[i].classList.remove('at', 'pass', 'dev');
        if (cls) rows[i].classList.add(cls);
        rows[i].querySelector('i').textContent = status;
      };
      const say = (text, cls = '') => { log.innerHTML = `<div class="${cls}">${esc(text)}</div>`; };
      const labels = () => {
        bClean.textContent = lvl === 0 ? 'Submit clean ✓' : 'Resolve & certify ✓';
        bDev.textContent = lvl === 0 ? 'Flag a deviation ⚠' : lvl === 3 ? 'Deviation persists ⚠' : 'Escalate further ⚠';
      };
      const finish = () => { bClean.disabled = true; bDev.disabled = true; };

      function reset() {
        lvl = 0;
        rows.forEach((_, i) => setRow(i, '', 'waiting'));
        setRow(0, 'at', 'pending');
        bClean.disabled = false; bDev.disabled = false;
        labels();
        say('Month opened: questionnaire due in the first 2–3 working days.');
      }

      bClean.addEventListener('click', () => {
        setRow(lvl, 'pass', 'certified');
        for (let k = lvl + 1; k < rows.length; k++) setRow(k, '', 'not needed');
        say(`✓ Certificate closed at COMP ${lvl + 1}`, 'ok');
        audio.success();
        finish();
      });

      bDev.addEventListener('click', () => {
        setRow(lvl, 'dev', 'deviation');
        audio.hit();
        if (lvl >= rows.length - 1) {
          say('⚠ Escalated to Zonal Head, tracked quarterly', 'warn');
          finish();
          return;
        }
        lvl += 1;
        setRow(lvl, 'at', 'reviewing');
        say(`⚠ Deviation logged → escalated to COMP ${lvl + 1}`, 'warn');
        labels();
      });

      root.querySelector('[data-reset]').addEventListener('click', () => { audio.click(); reset(); });
      reset();
    }
    return { html, mount };
  },

  /* HR4U new-joiner onboarding */
  onboarding() {
    const steps = ['Declarations', 'Nominations', 'Salary account', 'Payroll live'];
    const logs = ['✓ Declarations submitted', '✓ Nominations filed', '✓ Salary account activated'];
    const html = `
      <div class="wg wg-onboarding" role="group" aria-label="Onboarding flow simulator">
        <div class="wg-h"><b>Day-one onboarding · try it</b><button type="button" class="wg-btn" data-reset>Reset</button></div>
        <div class="flow">${steps.map((s, i) => `<button type="button" data-i="${i}"><span>${i + 1}</span>${esc(s)}</button>`).join('')}</div>
        <div class="wg-log" aria-live="polite"></div>
      </div>`;

    function mount(root) {
      const btns = [...root.querySelectorAll('.flow button')];
      const log = root.querySelector('.wg-log');
      let at = 0;

      function paint() {
        btns.forEach((b, i) => {
          b.classList.toggle('done', i < at);
          b.classList.toggle('next', i === at);
          b.disabled = i !== at;
          b.querySelector('span').textContent = i < at ? '✓' : String(i + 1);
          b.setAttribute('aria-label', `${steps[i]}: ${i < at ? 'done' : i === at ? 'tap to complete' : 'locked'}`);
        });
      }
      function reset() {
        at = 0;
        log.innerHTML = '<div>New joiner! Tap the highlighted step to onboard.</div>';
        paint();
      }

      root.querySelector('.flow').addEventListener('click', (e) => {
        const b = e.target.closest('button[data-i]');
        if (!b || Number(b.dataset.i) !== at) return;
        at += 1;
        paint();
        if (at >= steps.length) {
          log.innerHTML = '<div class="ok">✓ Welcome aboard, payslips, PF, gratuity &amp; tax now visible</div>';
          audio.success();
        } else {
          log.innerHTML = `<div class="ok">${esc(logs[at - 1])}</div>`;
          audio.skill();
          // keep keyboard users on the flow
          btns[at].focus({ preventScroll: true });
        }
      });
      root.querySelector('[data-reset]').addEventListener('click', () => { audio.click(); reset(); });
      reset();
    }
    return { html, mount };
  },
};

/* ------------------------------------------------------------------ */

function renderNode(node, index) {
  const settled = node.status >= 4;
  const meta = (node.meta || []).map((m) => `<span>${esc(m)}</span>`).join('');
  const stats = node.stats?.length
    ? `<div class="rc-stats">${node.stats.map((s) => `<div><b>${esc(s.k)}</b><small>${esc(s.v)}</small></div>`).join('')}</div>`
    : '';
  const sections = (node.sections || [])
    .map((s) => `<section class="rc-sec"><h4>${esc(s.heading)}</h4><ul>${(s.items || []).map((it) => `<li>${esc(it)}</li>`).join('')}</ul></section>`)
    .join('');
  const links = node.links?.length
    ? `<div class="rc-links">${node.links.map((l) => `<a href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.label)} ${icons.external}</a>`).join('')}</div>`
    : '';
  const tags = node.tags?.length
    ? `<div class="rc-tags" aria-label="Skills">${node.tags.map((t) => `<span>${esc(t)}</span>`).join('')}</div>`
    : '';
  const w = node.widget && widgets[node.widget] ? widgets[node.widget]() : null;
  const goLabel = index === 0 ? 'Start the rail' : 'Continue route';

  const html = `
    <div class="rc-head"><span class="rc-code">${esc(node.code)}</span><span class="rc-ok">✓ ${settled ? 'SETTLED' : 'VERIFIED'}</span></div>
    <h2 id="card-title">${esc(node.title)}</h2>
    ${node.subtitle ? `<p class="rc-sub">${esc(node.subtitle)}</p>` : ''}
    ${meta ? `<div class="rc-meta">${meta}</div>` : ''}
    ${node.intro ? `<p class="rc-intro">${esc(node.intro)}</p>` : ''}
    ${stats}
    ${sections}
    ${w ? w.html : ''}
    ${links}
    ${tags}
    <div class="rc-foot"><button type="button" class="btn-go" data-go>${goLabel} <kbd>Enter</kbd></button></div>`;
  return { html, widget: w };
}

function renderFinal(node, ctx = {}) {
  const phone = PROFILE.phone
    ? `<a class="btn-link" href="tel:${esc(String(PROFILE.phone).replace(/[^\d+]/g, ''))}">Call ${esc(PROFILE.phone)}</a>`
    : '';
  const rows = [
    ['UTR', ctx.utr || '—'],
    ['From', PROFILE.name || 'Uday Kiran Bokka'],
    ['To', 'Your Team'],
    ['Nodes settled', `${ctx.visitedCount ?? 0}/${ctx.total ?? 0}`],
    ['Skills credited', String(ctx.wallet ?? 0)],
    ['Time', fmtTime(ctx.timeMs)],
    ['Status', 'SETTLED'],
  ];
  return `
    <div class="rc-head"><span class="rc-code">${esc(node.code)}</span><span class="rc-ok">✓ SETTLED</span></div>
    <div class="receipt">
      <div class="tick">${icons.check}</div>
      <h2 id="card-title">Payment Successful</h2>
      <p class="rc-sub">${esc(node.subtitle || '')}</p>
      <div class="big mono" aria-label="Value settled">${rupees(ctx.score)}</div>
      <div class="rlines">${rows.map(([k, v]) => `<div><span>${esc(k)}</span><b class="${k === 'Status' ? 'ok' : ''}">${esc(v)}</b></div>`).join('')}</div>
      ${node.intro ? `<p class="rc-intro">${esc(node.intro)}</p>` : ''}
      <div class="contact">
        <a class="btn-link primary" href="mailto:${esc(PROFILE.email)}">${icons.mail} Email ${esc(PROFILE.short || 'Uday')}</a>
        <a class="btn-link" href="${esc(PROFILE.linkedin)}" target="_blank" rel="noopener">${icons.linkedin} LinkedIn</a>
        ${phone}
        <button type="button" class="btn-link" data-passbook>${icons.book} Open Passbook (résumé)</button>
        <button type="button" class="btn-link btn-link-ghost" data-replay>${icons.replay} Replay journey</button>
      </div>
      <p class="rc-built mono">Built by Uday with Three.js · no models downloaded, all geometry is code</p>
    </div>`;
}

export function createCard({ onContinue, onReplay, onPassbook } = {}) {
  const card = document.getElementById('card');
  const inner = document.getElementById('card-inner');
  let open = false;
  let hideTimer = 0;
  let raf = 0;
  let timers = [];

  const clearTimers = () => { timers.forEach(clearTimeout); timers = []; };
  const later = (fn, ms) => { timers.push(setTimeout(fn, ms)); };

  inner.addEventListener('click', (e) => {
    const t = e.target.closest('button');
    if (!t || !inner.contains(t)) return;
    if (t.hasAttribute('data-go')) { audio.click(); onContinue?.(); }
    else if (t.hasAttribute('data-replay')) { audio.click(); onReplay?.(); }
    else if (t.hasAttribute('data-passbook')) { audio.click(); onPassbook?.(); }
  });

  // Enter/Space on a focused control inside the card should only activate that control,
  // not also bubble up to the global "Enter = continue" shortcut.
  card.addEventListener('keydown', (e) => {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.closest('button, a, input, select, textarea')) {
      e.stopPropagation();
    }
  });

  return {
    open(node, index = 0, ctx = {}) {
      if (!node) return;
      clearTimeout(hideTimer);
      cancelAnimationFrame(raf);
      clearTimers();

      card.classList.toggle('is-final', !!node.final);
      if (node.final) {
        inner.innerHTML = renderFinal(node, ctx);
      } else {
        const { html, widget } = renderNode(node, index);
        inner.innerHTML = html;
        if (widget) widget.mount(inner.querySelector('.wg'), later);
      }
      inner.scrollTop = 0;
      card.hidden = false;
      open = true;
      // double rAF so the browser commits the off-screen state before transitioning in
      raf = requestAnimationFrame(() => {
        raf = requestAnimationFrame(() => card.classList.add('show'));
      });
    },

    close() {
      if (!open && card.hidden) return;
      open = false;
      cancelAnimationFrame(raf);
      card.classList.remove('show');
      clearTimeout(hideTimer);
      hideTimer = setTimeout(() => {
        if (open) return;
        card.hidden = true;
        clearTimers();
        inner.innerHTML = '';
      }, 450);
    },

    get isOpen() { return open; },
  };
}
