import { icons } from './icons.js';
import { PROFILE, NODES, SKILL_POOL } from '../data.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const byId = (id) => NODES.find((n) => n.id === id);
const city = (loc) => String(loc || '').split(',')[0].trim();

/* ---------- small data helpers (everything derives from data.js) ---------- */

// Vocabulary of known skills: all node tags + skill pool + a few tech words that appear in the copy.
const VOCAB = (() => {
  const extra = ['HTML', 'CSS', 'JUnit', 'Ruby on Rails', 'React Testing Library', 'WhatsApp Business API'];
  const all = [...NODES.flatMap((n) => n.tags || []), ...SKILL_POOL.flat(), ...extra];
  return [...new Set(all)].sort((a, b) => b.length - a.length);
})();
const reEsc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Tech terms found in a block of text, longest-first, without substrings of already-picked terms. */
function skillsIn(text) {
  const picked = [];
  for (const w of VOCAB) {
    if (picked.some((p) => p.includes(w))) continue;
    if (new RegExp(`(^|[^\\w.])${reEsc(w)}(?![\\w])`).test(text)) picked.push(w);
  }
  // keep original reading order
  return picked.sort((a, b) => text.indexOf(a) - text.indexOf(b));
}

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const parenthetical = (s) => (String(s).match(/\(([^)]+)\)\s*$/) || [])[1] || '';

/** "Company · Role · Mon – Mon YYYY · City" → parts */
function parseJob(heading) {
  const parts = heading.split('·').map((s) => s.trim()).filter(Boolean);
  const dateIdx = parts.findIndex((p) => /\d{4}/.test(p));
  const date = dateIdx >= 0 ? parts[dateIdx] : '';
  const [company = '', role = ''] = parts;
  const rest = parts.filter((_, i) => i > 1 && i !== dateIdx);
  return { company, role, date, place: rest.join(' · ') };
}

function uniqCI(list) {
  const seen = new Set();
  return list.filter((x) => {
    const k = String(x).toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/* ---------- row builders ---------- */

const secRow = (label) => `<tr class="pb-sec"><td colspan="4">${esc(label)}</td></tr>`;

function row({ date, title, sub, body, sections, ref, credit }) {
  const secs = (sections || [])
    .map((s, _, arr) => `${arr.length > 1 && s.heading ? `<p class="pb-h">${esc(s.heading)}</p>` : ''}<ul>${(s.items || []).map((i) => `<li>${esc(i)}</li>`).join('')}</ul>`)
    .join('');
  return `<tr>
    <td data-label="Date">${esc(date || '—')}</td>
    <td data-label="Particulars"><b>${title}</b>${sub ? `<span class="pb-sub">${esc(sub)}</span>` : ''}${body ? `<p class="pb-body">${esc(body)}</p>` : ''}${secs}</td>
    <td data-label="Ref" class="pb-ref">${esc(ref || '')}</td>
    <td data-label="Credit" class="cr">${esc(credit || '')}</td>
  </tr>`;
}

function buildStatement() {
  const icici = byId('icici');
  const dev = byId('dev');
  const iit = byId('iit');
  const agile = byId('agile');
  const hyd = byId('hyd');

  const rows = [];

  /* CURRENT ACCOUNT */
  if (icici) {
    rows.push(secRow(`CURRENT ACCOUNT · ${String(PROFILE.company || icici.title).toUpperCase()}`));
    rows.push(row({
      date: icici.meta?.[0],
      title: esc(icici.subtitle || PROFILE.role),
      sub: [icici.title, icici.meta?.[1]].filter(Boolean).join(' · '),
      body: icici.intro,
      sections: icici.sections,
      ref: icici.short,
      credit: (icici.tags || []).join(', '),
    }));
  }
  ['dash', 'circ', 'branch', 'comp', 'hr4u'].map(byId).filter(Boolean).forEach((n) => {
    rows.push(row({
      date: 'Current',
      title: esc(n.title),
      sub: n.subtitle,
      sections: n.sections,
      ref: n.short,
      credit: (n.tags || []).join(', '),
    }));
  });

  /* WAYS OF WORKING */
  if (agile) {
    rows.push(secRow('WAYS OF WORKING'));
    rows.push(row({
      date: 'Ongoing',
      title: esc(agile.title),
      sub: agile.subtitle,
      body: agile.intro,
      sections: agile.sections,
      ref: agile.short,
      credit: (agile.tags || []).join(', '),
    }));
  }

  /* PREVIOUS ACCOUNTS */
  const jobs = (dev?.sections || []).map((s) => ({ ...parseJob(s.heading), items: s.items || [] }));
  if (jobs.length) {
    rows.push(secRow('PREVIOUS ACCOUNTS'));
    jobs.forEach((j) => {
      const text = j.items.join(' ');
      rows.push(row({
        date: j.date,
        title: esc(j.company),
        sub: [j.role, j.place].filter(Boolean).join(' · '),
        sections: [{ items: j.items }],
        ref: j.company.split(/\s+/)[0].toUpperCase(),
        credit: skillsIn(text).join(', ') || '—',
      }));
    });
  }

  /* EDUCATION · KYC */
  if (iit) {
    rows.push(secRow('EDUCATION · KYC'));
    rows.push(row({
      date: iit.meta?.[0],
      title: esc(iit.title),
      sub: [iit.subtitle, iit.meta?.[1]].filter(Boolean).join(' · '),
      body: iit.intro,
      sections: iit.sections,
      ref: 'KYC ✓',
      credit: (iit.tags || []).join(', '),
    }));
  }

  /* SIDE BUILDS */
  const builds = [];
  (dev?.links || []).forEach((l) => builds.push(row({
    date: '—',
    title: `<a href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.label.replace(/\s*\([^)]*\)\s*$/, ''))} ${icons.external}</a>`,
    sub: l.url.replace(/^https?:\/\//, '').replace(/\/$/, ''),
    ref: 'WEB',
    credit: parenthetical(l.label).toUpperCase() || 'LIVE',
  })));
  jobs.forEach((j) => j.items.forEach((it) => {
    const m = it.match(/^([^:]+):\s*(.+)$/);
    if (!m || !/scheduler/i.test(m[1])) return;
    builds.push(row({
      date: j.date,
      title: esc(m[1].trim()),
      sub: `Built at ${j.company}`,
      body: cap(m[2].replace(/\s*\([^)]*\)\s*$/, '')),
      ref: 'API',
      credit: parenthetical(it) || skillsIn(it).join(', '),
    }));
  }));
  if (builds.length) {
    rows.push(secRow('SIDE BUILDS'));
    rows.push(...builds);
  }

  /* SKILLS LEDGER */
  const personal = new Set((hyd?.tags || []).map((t) => t.toLowerCase()));
  const tech = uniqCI(NODES.filter((n) => !n.final && n.id !== 'hyd').flatMap((n) => n.tags || []))
    .filter((t) => !personal.has(t.toLowerCase()));
  const industries = PROFILE.industries || [];
  const chips = (list) => `<div class="pb-chips">${list.map((t) => `<span>${esc(t)}</span>`).join('')}</div>`;
  rows.push(secRow('SKILLS LEDGER'));
  rows.push(`<tr><td data-label="Date">Balance</td><td data-label="Particulars"><b>Product &amp; tech</b>${chips(tech)}</td><td data-label="Ref" class="pb-ref">SKL</td><td data-label="Credit" class="cr">${tech.length} skills</td></tr>`);
  if (industries.length) rows.push(`<tr><td data-label="Date">Balance</td><td data-label="Particulars"><b>Industries</b>${chips(industries)}</td><td data-label="Ref" class="pb-ref">IND</td><td data-label="Credit" class="cr">${industries.length} sectors</td></tr>`);
  if (hyd?.tags?.length) rows.push(`<tr><td data-label="Date">Balance</td><td data-label="Particulars"><b>Off the clock</b>${chips(hyd.tags)}</td><td data-label="Ref" class="pb-ref">LIFE</td><td data-label="Credit" class="cr">∞</td></tr>`);

  return rows.join('');
}

function render() {
  const today = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  const home = city(PROFILE.hometown);
  const here = city(PROFILE.location);
  const liHandle = String(PROFILE.linkedin || '').replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');
  return `
    <div class="pb-top">
      <div>
        <p class="pb-eyebrow">PASSBOOK · STATEMENT OF ACCOUNT</p>
        <h2 id="pb-title">${esc(PROFILE.name)}</h2>
        <p>${esc(PROFILE.role)} · ${esc(PROFILE.company)} · ${esc(here)}</p>
        ${PROFILE.tagline ? `<p class="pb-tag">${esc(PROFILE.tagline)}</p>` : ''}
      </div>
      <div class="pb-actions">
        <button type="button" data-print aria-label="Print or save as PDF">${icons.print}<span>Print / Save PDF</span></button>
        <a href="mailto:${esc(PROFILE.email)}" aria-label="Email ${esc(PROFILE.short || PROFILE.name)}">${icons.mail}<span>Email</span></a>
        <a href="${esc(PROFILE.linkedin)}" target="_blank" rel="noopener" aria-label="LinkedIn profile (opens in a new tab)">${icons.linkedin}<span>LinkedIn</span></a>
        <button type="button" data-close aria-label="Close passbook">${icons.close}</button>
      </div>
    </div>
    <div class="pb-acct">
      <div><small>Account holder</small><b>${esc(PROFILE.name)}</b></div>
      <div><small>Branch</small><b>${esc(here)} · from ${esc(home)}</b></div>
      <div><small>IFSC</small><b class="mono">IITDH-CSE-2023</b></div>
      <div><small>Email</small><b><a href="mailto:${esc(PROFILE.email)}">${esc(PROFILE.email)}</a></b></div>
      <div><small>LinkedIn</small><b><a href="${esc(PROFILE.linkedin)}" target="_blank" rel="noopener">${esc(liHandle)}</a></b></div>
      ${PROFILE.phone ? `<div><small>Phone</small><b><a href="tel:${esc(String(PROFILE.phone).replace(/[^\d+]/g, ''))}">${esc(PROFILE.phone)}</a></b></div>` : ''}
    </div>
    <div class="pb-scroll">
      <table class="pb-table">
        <thead><tr><th scope="col">Date</th><th scope="col">Particulars</th><th scope="col">Ref</th><th scope="col">Credit</th></tr></thead>
        <tbody>${buildStatement()}</tbody>
      </table>
    </div>
    <div class="pb-foot"><span>Closing balance: <b>Ready for the next role</b></span><span>Statement generated ${esc(today)}</span></div>`;
}

export function createPassbook({ onClose } = {}) {
  const root = document.getElementById('passbook');
  const sheet = document.getElementById('pb-sheet');
  let open = false;
  let lastFocus = null;

  root.setAttribute('aria-labelledby', 'pb-title');
  root.removeAttribute('aria-label');
  sheet.tabIndex = -1; // keep focus inside the dialog when clicking plain text

  function close() {
    if (!open) return;
    open = false;
    root.hidden = true;
    if (lastFocus && typeof lastFocus.focus === 'function' && document.contains(lastFocus)) {
      lastFocus.focus({ preventScroll: true });
    }
    lastFocus = null;
    onClose?.();
  }

  sheet.addEventListener('click', (e) => {
    if (e.target.closest('[data-close]')) close();
    else if (e.target.closest('[data-print]')) window.print();
  });

  // backdrop click (the #passbook overlay itself, not the sheet)
  root.addEventListener('click', (e) => { if (e.target === root) close(); });

  root.addEventListener('keydown', (e) => {
    const plainP = (e.key === 'p' || e.key === 'P') && !e.ctrlKey && !e.metaKey && !e.altKey;
    if (e.key === 'Escape' || plainP) {
      e.preventDefault();
      e.stopPropagation();
      close();
      return;
    }
    if (e.key === 'Tab') {
      // simple focus trap
      const f = [...sheet.querySelectorAll('a[href], button:not([disabled])')];
      if (!f.length) return;
      const first = f[0];
      const last = f[f.length - 1];
      if (e.shiftKey && (document.activeElement === first || document.activeElement === sheet)) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
    // stop game shortcuts (P / S / H / Enter / arrows) from firing underneath
    e.stopPropagation();
  });

  return {
    open() {
      if (open) return;
      lastFocus = document.activeElement;
      sheet.innerHTML = render();
      root.hidden = false;
      root.scrollTop = 0;
      open = true;
      const btn = sheet.querySelector('[data-close]');
      btn?.focus({ preventScroll: true });
    },
    close,
    get isOpen() { return open; },
  };
}
