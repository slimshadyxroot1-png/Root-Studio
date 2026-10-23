// piano roll

const keyEls = [], cells = [];
const sel = new Set();                  // selected notes, "step:row"
let clip = [], lastStep = 0, moving = null, selFor = null;

function buildRoll() {
  $('rollruler').innerHTML = range(PSTEPS).map(s =>
    `<i data-s="${s}">${s % BEAT === 0 ? s / BEAT + 1 : ''}</i>`).join('');
  if (!keyEls.length) {
    range(ROWS).forEach(r => {
      const m = midiOf(r), k = document.createElement('div');
      k.className = 'key ' + (BLACK.has(m % 12) ? 'blk' : 'wht');
      k.dataset.m = m;
      if (m % 12 === 0) k.textContent = 'C' + (Math.floor(m / 12) - 1);
      $('keys').append(k);
      keyEls.push(k);
    });
    $('roll').scrollTop = rowOf(66) * 15;   // open around the middle of the range
  }
  const g = $('grid');
  g.querySelectorAll('.c').forEach(c => c.remove());
  cells.length = 0;
  g.style.gridTemplateColumns = `repeat(${PSTEPS}, 1fr)`;
  $('roll').style.setProperty('--rw', (56 + PSTEPS * 22) + 'px');   // long patterns scroll sideways
  $('playhead').style.width = (100 / PSTEPS) + '%';
  range(ROWS * PSTEPS).forEach(i => {
    const c = document.createElement('div');
    c.dataset.s = i % PSTEPS;
    c.dataset.r = Math.floor(i / PSTEPS);
    g.insertBefore(c, $('playhead'));
    cells.push(c);
  });
}

function paintRoll() {
  if (selFor !== curNotes()) { sel.clear(); selFor = curNotes(); }
  const inScale = new Set(SCALES[song.scale].map(n => (n + song.root) % 12));
  const cover = {}, notes = curNotes();
  for (const k in notes) {
    const [s, r] = k.split(':').map(Number), n = notes[k];
    for (let i = 0; i < n.l && s + i < PSTEPS; i++) cover[(s + i) + ':' + r] = { t: i ? 'tail' : 'head', v: n.v, sel: sel.has(k) };
  }
  for (let r = 0; r < ROWS; r++) {
    const m = midiOf(r) % 12, inside = inScale.has(m);
    keyEls[r].classList.toggle('dim', !inside);
    keyEls[r].classList.toggle('root', m === song.root);
    for (let s = 0; s < PSTEPS; s++) {
      const cv = cover[s + ':' + r], cell = cells[r * PSTEPS + s];
      cell.className = 'c' + (BLACK.has(m) ? ' blk' : '') + (inside ? '' : ' out') +
        (s % BEAT === 0 ? ' beat' : '') + (cv ? ' ' + cv.t + (cv.sel ? ' sel' : '') : '');
      cell.style.opacity = cv ? 0.35 + 0.65 * cv.v / 127 : '';
    }
  }
  paintVel();
}

function ownerOf(s, r) {
  const notes = curNotes();
  for (let back = 0; back < MAXSTEPS; back++) {
    const o = s - back, n = notes[o + ':' + r];
    if (o >= 0 && n && n.l > back) return o;
  }
}

function editNote(s, r, mode) {
  const notes = curNotes();
  if (mode === 'add') {
    s -= s % +$('snap').value;          // snap to the grid
    if (notes[s + ':' + r]) return;
    notes[s + ':' + r] = note(song.len, song.vel);
    auditionNote(midiOf(r), song.vel);
  } else {
    const o = ownerOf(s, r);
    if (o === undefined) return;
    delete notes[o + ':' + r];
  }
  paintRoll();
  syncRack();
}

const grid = $('grid');
grid.addEventListener('pointerdown', e => {
  const c = e.target.closest('.c');
  if (!c) return;
  const s = +c.dataset.s, r = +c.dataset.r, o = ownerOf(s, r);
  if ($('tool').value === 'select') {
    lastStep = s;
    if (o === undefined) { if (!e.shiftKey) sel.clear(); paintRoll(); return; }
    const key = o + ':' + r, notes = curNotes();
    if (e.shiftKey && sel.has(key)) sel.delete(key);
    else if (!sel.has(key)) { if (!e.shiftKey) sel.clear(); sel.add(key); }
    moving = {
      s, r, resize: notes[key].l > 1 && s === o + notes[key].l - 1,     // grab a note's last cell to resize it
      from: [...sel].filter(k => notes[k]).map(k => { const [ks, kr] = k.split(':').map(Number); return { ks, kr, n: { ...notes[k] } }; })
    };
    paintRoll();
    return;
  }
  drag = { kind: 'roll', mode: o === undefined ? 'add' : 'del' };
  editNote(s, r, drag.mode);
});
grid.addEventListener('pointerover', e => {
  const c = e.target.closest('.c');
  if (!c) return;
  const s = +c.dataset.s, r = +c.dataset.r;
  if (moving) dragNotes(s, r);
  else if (drag && drag.kind === 'roll') editNote(s, r, drag.mode);
});
window.addEventListener('pointerup', () => { moving = null; });

// select tool

const snap = () => +$('snap').value;

function dragNotes(s, r) {
  const m = moving, notes = curNotes(), q = snap();
  m.from.forEach(f => delete notes[f.ks + ':' + f.kr]);
  sel.clear();
  let ds = Math.round((s - m.s) / q) * q, dr = r - m.r;
  if (!m.resize) {
    const ss = m.from.map(f => f.ks), rr = m.from.map(f => f.kr);
    ds = Math.max(-Math.min(...ss), Math.min(PSTEPS - 1 - Math.max(...ss), ds));
    dr = Math.max(-Math.min(...rr), Math.min(ROWS - 1 - Math.max(...rr), dr));
  }
  m.from.forEach(f => {
    const ns = m.resize ? f.ks : f.ks + ds, nr = m.resize ? f.kr : f.kr + dr;
    const l = m.resize ? Math.max(1, Math.min(PSTEPS - f.ks, f.n.l + s - m.s)) : f.n.l;
    notes[ns + ':' + nr] = { ...f.n, l };
    sel.add(ns + ':' + nr);
  });
  paintRoll();
  syncRack();
}

function copyNotes() {
  const notes = curNotes();
  const list = [...sel].filter(k => notes[k]).map(k => { const [s, r] = k.split(':').map(Number); return { s, r, n: { ...notes[k] } }; });
  if (!list.length) return say('Set Tool to Select, then click the notes you want to copy.');
  const base = Math.min(...list.map(x => x.s));
  clip = list.map(x => ({ ...x, s: x.s - base }));
  say('Copied ' + clip.length + ' notes. Click an empty cell to choose where to paste.');
}

function pasteNotes() {
  if (!clip.length) return say('Nothing copied yet.');
  pushUndo();
  const notes = curNotes();
  sel.clear();
  clip.forEach(x => {
    const s = lastStep + x.s;
    if (s < PSTEPS) { notes[s + ':' + x.r] = { ...x.n }; sel.add(s + ':' + x.r); }
  });
  paintRoll();
  syncRack();
}

function deleteSel() {
  if (!sel.size) return;
  pushUndo();
  sel.forEach(k => delete curNotes()[k]);
  sel.clear();
  paintRoll();
  syncRack();
}

function quantize() {
  pushUndo();
  const notes = curNotes(), out = {}, q = snap(), had = sel.size > 0, keys = had ? new Set(sel) : new Set(Object.keys(notes));
  sel.clear();
  for (const k in notes) {
    const [s, r] = k.split(':').map(Number);
    const ns = keys.has(k) ? Math.min(PSTEPS - 1, Math.round(s / q) * q) : s, nk = ns + ':' + r;
    out[nk] = notes[k];
    if (had && keys.has(k)) sel.add(nk);
  }
  curPat().notes[song.sel] = out;
  selFor = out;
  paintRoll();
  syncRack();
}

$('ncopy').addEventListener('click', copyNotes);
$('npaste').addEventListener('click', pasteNotes);
$('ndel').addEventListener('click', deleteSel);
$('quant').addEventListener('click', quantize);
document.addEventListener('keydown', e => {
  if (/^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName)) return;
  const mod = e.ctrlKey || e.metaKey, k = e.key.toLowerCase();
  if (mod && k === 'c') copyNotes();
  else if (mod && k === 'v') pasteNotes();
  else if (mod && k === 'a') { e.preventDefault(); sel.clear(); Object.keys(curNotes()).forEach(n => sel.add(n)); paintRoll(); }
  else if (e.key === 'Delete' || e.key === 'Backspace') deleteSel();
});
$('keys').addEventListener('pointerdown', e => {
  const k = e.target.closest('.key');
  if (k) auditionNote(+k.dataset.m);
});

// velocity lane

function paintVel() {
  const by = {}, notes = curNotes();
  for (const k in notes) by[+k.split(':')[0]] = notes[k].v;
  const el = $('vel');
  el.style.gridTemplateColumns = `repeat(${PSTEPS}, 1fr)`;
  el.innerHTML = range(PSTEPS).map(s =>
    `<div data-s="${s}"${s % BEAT === 0 ? ' class="beat"' : ''}>${s in by ? `<i style="height:${by[s] / 127 * 100}%"></i>` : ''}</div>`).join('');
}

let velDrag = false;
function velPoint(e) {
  const r = $('vel').getBoundingClientRect(), notes = curNotes();
  const s = Math.min(PSTEPS - 1, Math.max(0, Math.floor((e.clientX - r.left) / r.width * PSTEPS)));
  const v = Math.round(Math.min(127, Math.max(1, (r.bottom - e.clientY) / r.height * 127)));
  for (const k in notes) if (+k.split(':')[0] === s) notes[k].v = v;
  paintRoll();
}
$('vel').addEventListener('pointerdown', e => {
  pushUndo();
  velDrag = true;
  $('vel').setPointerCapture(e.pointerId);
  velPoint(e);
});
$('vel').addEventListener('pointermove', e => { if (velDrag) velPoint(e); });
$('vel').addEventListener('pointerup', () => { velDrag = false; });