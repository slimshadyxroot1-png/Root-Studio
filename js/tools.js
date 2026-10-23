// editing tools: undo, tap tempo, metronome, recording, scale tools, chords, euclid, export

// undo and redo

const undoStack = [], redoStack = [];

function pushUndo() {
  undoStack.push(JSON.stringify(song));
  if (undoStack.length > 100) undoStack.shift();
  redoStack.length = 0;
}

function travel(from, to) {
  if (!from.length) return say('Nothing to ' + (from === undoStack ? 'undo' : 'redo') + '.');
  to.push(JSON.stringify(song));
  song = JSON.parse(from.pop());
  applySong();
}

// capture phase so the snapshot is taken before the edit
function watch(id, type, selector) {
  $(id).addEventListener(type, e => { if (e.target.closest(selector)) pushUndo(); }, true);
}
watch('rack', 'pointerdown', '.steps:not(.ro) b');
watch('grid', 'pointerdown', '.c');
watch('presets', 'click', 'button');

$('undo').addEventListener('click', () => travel(undoStack, redoStack));
$('redo').addEventListener('click', () => travel(redoStack, undoStack));
document.addEventListener('keydown', e => {
  if (!(e.ctrlKey || e.metaKey)) return;
  const k = e.key.toLowerCase();
  if (k === 'z') {
    e.preventDefault();
    if (e.shiftKey) travel(redoStack, undoStack); else travel(undoStack, redoStack);
  } else if (k === 'y') {
    e.preventDefault();
    travel(redoStack, undoStack);
  } else if (k === 's') {
    e.preventDefault();
    saveFile();
  }
});

// tap tempo, metronome, recording

let taps = [];
$('tap').addEventListener('click', () => {
  const now = performance.now();
  if (taps.length && now - taps[taps.length - 1] > 2000) taps = [];
  taps.push(now);
  if (taps.length < 2) return;
  const avg = (now - taps[0]) / (taps.length - 1);
  song.bpm = Math.min(220, Math.max(50, Math.round(60000 / avg)));
  $('bpm').value = song.bpm;
  retime();
});

$('metro').addEventListener('click', e => {
  metro = !metro;
  e.currentTarget.classList.toggle('active', metro);
});

function click(c, out, t, accent) {
  const o = c.createOscillator(), g = c.createGain();
  o.type = 'square';
  o.frequency.value = accent ? 1500 : 1000;
  g.gain.setValueAtTime(0.15, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
  o.connect(g); g.connect(out);
  o.start(t); o.stop(t + 0.05);
}

let recording = false;
$('rec').addEventListener('click', e => {
  recording = !recording;
  e.currentTarget.classList.toggle('active', recording);
  say(recording ? 'Recording: start playback and play the keys or a MIDI keyboard.' : 'Recording off.');
});

// writes the note into the selected track at the playhead
function recordNote(midi, vel) {
  if (!recording || !playing || headStep < 0) return;
  const row = rowOf(midi);
  if (row < 0 || row >= ROWS) return;
  pushUndo();
  curNotes()[headStep + ':' + row] = note(song.len, vel);
  paintRoll();
  syncRack();
}

// scale tools

function remap(fn) {
  pushUndo();
  const out = {}, notes = curNotes();
  for (const k in notes) {
    const [s, r] = k.split(':').map(Number);
    const nr = fn(r);
    if (nr >= 0 && nr < ROWS && !((s + ':' + nr) in out)) out[s + ':' + nr] = notes[k];
  }
  curPat().notes[song.sel] = out;
  paintRoll();
  syncRack();
}

document.querySelectorAll('[data-tr]').forEach(b => {
  b.addEventListener('click', () => remap(r => r - +b.dataset.tr));
});

$('fit').addEventListener('click', () => {
  const ok = new Set(SCALES[song.scale].map(n => (n + song.root) % 12));
  remap(r => {
    let m = midiOf(r);
    for (let d = 0; d < 7; d++) {
      if (ok.has((m + d) % 12)) { m += d; break; }
      if (ok.has(((m - d) % 12 + 12) % 12)) { m -= d; break; }
    }
    return rowOf(m);
  });
});

// chords

// stored as scale degrees so it follows the key and scale
const PROGS = {
  'I V vi IV': [0, 4, 5, 3],
  'ii V I I': [1, 4, 0, 0],
  'I IV V I': [0, 3, 4, 0],
  'vi IV I V': [5, 3, 0, 4],
  'i VII VI V': [0, 6, 5, 4]
};
Object.keys(PROGS).forEach(name => $('prog').add(new Option(name, name)));

// four chords per bar
const chordGap = () => Math.max(1, Math.floor(STEPS / 4));

$('chord').addEventListener('click', () => {
  pushUndo();
  const sc = SCALES[song.scale].length === 7 ? SCALES[song.scale] : SCALES.Minor, gap = chordGap();
  const notes = {};
  PROGS[$('prog').value].forEach((degree, i) => {
    [0, 2, 4].forEach(offset => {
      const idx = degree + offset;
      let m = 48 + song.root + sc[idx % 7] + 12 * Math.floor(idx / 7);
      while (m > 71) m -= 12;
      notes[i * gap + ':' + rowOf(m)] = note(gap, song.vel);
    });
  });
  curPat().notes[song.sel] = notes;
  paintRoll();
  syncRack();
});

$('arp').addEventListener('click', () => {
  pushUndo();
  const notes = curNotes(), gap = chordGap();
  for (let i = 0; i < 4; i++) {
    const s0 = i * gap;
    const found = Object.keys(notes).map(k => k.split(':').map(Number)).filter(([s]) => s === s0);
    const rows = found.map(([, r]) => r).sort((a, b) => b - a);
    if (rows.length < 2) continue;
    const v = notes[s0 + ':' + rows[0]].v;
    rows.forEach(r => delete notes[s0 + ':' + r]);
    for (let j = 0; j < gap; j++) notes[(s0 + j) + ':' + rows[j % rows.length]] = note(1, v);
  }
  paintRoll();
  syncRack();
});