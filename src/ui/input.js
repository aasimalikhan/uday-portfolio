// Keyboard, swipe and on-screen touch controls
export function createInput({ onLeft, onRight, onEnter, onKey }) {
  const state = { boost: false, enabled: false };
  const boostKeys = new Set();

  const isField = (el) => el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
  const isControl = (el) => el && (el.tagName === 'BUTTON' || el.tagName === 'A');

  addEventListener('keydown', (e) => {
    if (isField(e.target) || e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key;
    if (k === 'Escape' || k === 'p' || k === 'P' || k === 's' || k === 'S' || k === 'h' || k === 'H') {
      onKey(k.toLowerCase());
      return;
    }
    if (!state.enabled) return;
    if (k === 'ArrowLeft' || k === 'a' || k === 'A') { e.preventDefault(); if (!e.repeat) onLeft(); }
    else if (k === 'ArrowRight' || k === 'd' || k === 'D') { e.preventDefault(); if (!e.repeat) onRight(); }
    else if (k === ' ' || k === 'ArrowUp' || k === 'w' || k === 'W') {
      e.preventDefault();
      boostKeys.add(k.toLowerCase());
      state.boost = true;
    } else if (k === 'Enter' && !isControl(e.target)) { e.preventDefault(); onEnter(); }
  });
  addEventListener('keyup', (e) => {
    boostKeys.delete(e.key.toLowerCase());
    if (boostKeys.size === 0) state.boost = false;
  });
  addEventListener('blur', () => { boostKeys.clear(); state.boost = false; });

  // swipe on the canvas
  const canvas = document.getElementById('world');
  let sx = 0, sy = 0, st = 0;
  canvas.addEventListener('touchstart', (e) => {
    const t = e.changedTouches[0]; sx = t.clientX; sy = t.clientY; st = performance.now();
  }, { passive: true });
  canvas.addEventListener('touchend', (e) => {
    if (!state.enabled) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - sx, dy = t.clientY - sy;
    if (performance.now() - st < 600 && Math.abs(dx) > 30 && Math.abs(dx) > Math.abs(dy)) {
      dx < 0 ? onLeft() : onRight();
    }
  }, { passive: true });

  // on-screen buttons
  document.querySelectorAll('#touch button').forEach((b) => {
    const act = b.dataset.act;
    b.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      if (!state.enabled) return;
      b.classList.add('on');
      if (act === 'left') onLeft();
      else if (act === 'right') onRight();
      else if (act === 'boost') state.boost = true;
    });
    const up = () => { b.classList.remove('on'); if (act === 'boost') state.boost = false; };
    b.addEventListener('pointerup', up);
    b.addEventListener('pointercancel', up);
    b.addEventListener('pointerleave', up);
    b.addEventListener('contextmenu', (e) => e.preventDefault());
  });

  return state;
}
