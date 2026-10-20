// piano roll

const keyEls = [], cells = [];

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
  const inScale = new Set(SCALES[song.scale].map(n => (n + song.root) % 12));
  const cover = {}, notes = curNotes();
  for (const k in notes) {
    const [s, r] = k.split(':').map(Number), n = notes[k];
    for (let i = 0; i < n.l && s + i < PSTEPS; i++) cover[(s + i) + ':' + r] = { t: i ? 'tail' : 'head', v: n.v };
  }
  for (let r = 0; r < ROWS; r++) {
    const m = midiOf(r) % 12, inside = inScale.has(m);
    keyEls[r].classList.toggle('dim', !inside);
    keyEls[r].classList.toggle('root', m === song.root);
    for (let s = 0; s < PSTEPS; s++) {
      const cv = cover[s + ':' + r], cell = cells[r * PSTEPS + s];
      cell.className = 'c' + (BLACK.has(m) ? ' blk' : '') + (inside ? '' : ' out') +
        (s % BEAT === 0 ? ' beat' : '') + (cv ? ' ' + cv.t : '');
      cell.style.opacity = cv ? 0.35 + 0.65 * cv.v / 127 : '';
    }
  }
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
  drag = { kind: 'roll', mode: o === undefined ? 'add' : 'del' };
  editNote(s, r, drag.mode);
});
grid.addEventListener('pointerover', e => {
  const c = e.target.closest('.c');
  if (!c) return;
  const s = +c.dataset.s, r = +c.dataset.r;
  if (drag && drag.kind === 'roll') editNote(s, r, drag.mode);
});

$('keys').addEventListener('pointerdown', e => {
  const k = e.target.closest('.key');
  if (k) auditionNote(+k.dataset.m);
});