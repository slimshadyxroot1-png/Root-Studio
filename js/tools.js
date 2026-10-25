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

// drums

$('kit').addEventListener('input', e => { song.kit = e.target.value; });
blankSong().drums.forEach(d => $('eucPiece').add(new Option(d.name)));

$('euc').addEventListener('click', () => {
  const hits = Math.min(STEPS, Math.max(0, +$('eucHits').value || 0));
  const rot = Math.min(STEPS - 1, Math.max(0, +$('eucRot').value || 0));
  pushUndo();
  curPat().drums[$('eucPiece').selectedIndex] =
    range(MAXSTEPS).map(i => (i < PSTEPS && ((((i % STEPS) - rot + STEPS) % STEPS) * hits) % STEPS < hits ? song.vel : 0));
  syncRack();
});

// rows are: kick, snare, hi-hat, open hat, clap, tom
Object.assign(presets, {
  'Rock'(s) {
    setDrums(s, 'x.......x.x.....', '....x.......x...', 'x.x.x.x.x.x.x.x.');
    s.bpm = 110;
  },
  'Techno'(s) {
    setDrums(s, 'x...x...x...x...', '', 'x.x.x.x.x.x.x.x.', '..x...x...x...x.', '....x.......x...');
    s.bpm = 130;
  },
  'Funk'(s) {
    setDrums(s, 'x.....x..x.x....', '....x..x.x..x...', 'xxxxxxxxxxxxxxxx');
    s.bpm = 100; s.swing = 0.2;
  },
  'Trap'(s) {
    setDrums(s, 'x.......x..x....', '', 'x.x.x.xxx.x.x.xx', '', '........x.......');
    s.bpm = 140;
  },
  'Bossa nova'(s) {
    setDrums(s, 'x.....x.x.....x.', '', 'x.x.x.x.x.x.x.x.', '', '', 'x..x..x...x...x.');
    s.bpm = 120;
  },
  'Reggae'(s) {
    setDrums(s, '........x.......', '........x.......', 'x.x.x.x.x.x.x.x.', '..x...x...x...x.');
    s.bpm = 75;
  }
});

// export

function download(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
const fileName = ext => (song.name || 'root-studio').replace(/[^\w-]+/g, '-') + ext;

// 16-bit wav from an audio buffer
function toWav(buf) {
  const n = buf.length, ch = buf.numberOfChannels, bytes = ch * 2;
  const out = new DataView(new ArrayBuffer(44 + n * bytes));
  const text = (at, str) => [...str].forEach((c, i) => out.setUint8(at + i, c.charCodeAt(0)));
  text(0, 'RIFF'); out.setUint32(4, 36 + n * bytes, true); text(8, 'WAVEfmt ');
  out.setUint32(16, 16, true); out.setUint16(20, 1, true); out.setUint16(22, ch, true);
  out.setUint32(24, buf.sampleRate, true); out.setUint32(28, buf.sampleRate * bytes, true);
  out.setUint16(32, bytes, true); out.setUint16(34, 16, true);
  text(36, 'data'); out.setUint32(40, n * bytes, true);
  const data = range(ch).map(c => buf.getChannelData(c));
  const clip = v => Math.max(-1, Math.min(1, v)) * 32767;
  for (let i = 0; i < n; i++) {
    for (let c = 0; c < ch; c++) out.setInt16(44 + (i * ch + c) * 2, clip(data[c][i]), true);
  }
  return new Blob([out], { type: 'audio/wav' });
}

// bars to export, the playlist in song mode or two laps of the pattern
function exportBars() {
  if (song.mode !== 'song') {
    const n = 2 * curPat().bars;
    return range(n).map(lap => ({ p: curPat(), bar: lap, lap, k: lap % curPat().bars }));
  }
  const a = song.loop.on ? song.loop.a : 0, b = song.loop.on ? song.loop.b : songEnd();
  return range(b - a).map(i => {
    const p = song.patterns[song.arr[a + i]] || null;
    return { p, bar: a + i, lap: i, k: p ? sliceAt(a + i, i) : 0 };
  });
}

async function renderSong(only) {
  const bars = exportBars(), sps = secPerStep(), rate = 44100, len = STEPS * sps;
  const oc = new OfflineAudioContext(2, Math.ceil((bars.length * len + 4) * rate), rate);   // 4 s for reverb tails
  const g = buildGraph(oc);
  const wasOn = metro;
  metro = false;                       // the click never goes into the file
  stemOnly = only || null;             // a stem plays just one strip
  bars.forEach((b, i) => {
    for (let s = 0; s < STEPS; s++) {
      queueStep(oc, g, s, i * len + s * sps + (s % 2 ? sps * song.swing * 0.6 : 0), b.p, b.bar, b.lap, b.k);
    }
  });
  metro = wasOn;
  stemOnly = null;
  return oc.startRendering();
}

async function exportWav() {
  say('Rendering...');
  download(toWav(await renderSong()), fileName('.wav'));
  say('Exported ' + fileName('.wav'));
}

async function exportMp3() {
  if (typeof lamejs === 'undefined') return say('MP3 needs the lamejs script from the internet, and it did not load. Use WAV instead.');
  say('Rendering...');
  const buf = await renderSong(), enc = new lamejs.Mp3Encoder(2, buf.sampleRate, 192), out = [];
  const pcm = ch => Int16Array.from(buf.getChannelData(ch), v => Math.max(-1, Math.min(1, v)) * 32767);
  const l = pcm(0), r = pcm(1);
  for (let i = 0; i < l.length; i += 1152) {
    const chunk = enc.encodeBuffer(l.subarray(i, i + 1152), r.subarray(i, i + 1152));
    if (chunk.length) out.push(chunk);
  }
  out.push(enc.flush());
  download(new Blob(out, { type: 'audio/mpeg' }), fileName('.mp3'));
  say('Exported ' + fileName('.mp3'));
}

// stems, one wav per strip in a zip

const CRC = (() => {
  const t = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
const crc32 = u => { let c = -1; for (let i = 0; i < u.length; i++) c = CRC[(c ^ u[i]) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; };

function makeZip(files) {                       // stored (uncompressed) zip
  const u16 = n => [n & 255, (n >> 8) & 255], u32 = n => [n & 255, (n >> 8) & 255, (n >> 16) & 255, (n >>> 24) & 255];
  const parts = [], central = [];
  let offset = 0, centralSize = 0;
  files.forEach(f => {
    const name = new TextEncoder().encode(f.name), crc = crc32(f.data), size = f.data.length;
    const common = [...u16(20), ...u16(0), ...u16(0), ...u16(0), ...u16(0x21), ...u32(crc), ...u32(size), ...u32(size), ...u16(name.length), ...u16(0)];
    const local = new Uint8Array([0x50, 0x4B, 3, 4, ...common]);
    const cd = new Uint8Array([0x50, 0x4B, 1, 2, ...u16(20), ...common, ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(offset)]);
    parts.push(local, name, f.data);
    central.push(cd, name);
    offset += local.length + name.length + size;
    centralSize += cd.length + name.length;
  });
  const end = new Uint8Array([0x50, 0x4B, 5, 6, 0, 0, 0, 0, ...u16(files.length), ...u16(files.length), ...u32(centralSize), ...u32(offset), 0, 0]);
  return new Blob([...parts, ...central, end], { type: 'application/zip' });
}

async function exportStems() {
  const files = [], loud = (buf, ch) => buf.getChannelData(ch).some(v => Math.abs(v) > 0.0005);
  for (const k of allKeys()) {
    say('Rendering stem: ' + stripName(k) + '...');
    const buf = await renderSong(k);
    if (!loud(buf, 0) && !loud(buf, 1)) continue;          // nothing plays on this strip
    files.push({ name: (files.length + 1) + '-' + stripName(k).replace(/[^\w-]+/g, '-') + '.wav', data: new Uint8Array(await toWav(buf).arrayBuffer()) });
  }
  if (!files.length) return say('Nothing to export yet.');
  download(makeZip(files), fileName('-stems.zip'));
  say('Exported ' + files.length + ' stems.');
}

// save as and share

let fileHandle = null;
async function writeHandle() {
  const w = await fileHandle.createWritable();
  await w.write(await songJson(true));
  await w.close();
  say('Saved to ' + fileHandle.name);
}

async function saveAs() {
  if (!window.showSaveFilePicker) return say('Save as needs Chrome or Edge. Use Save instead.');
  try {
    fileHandle = await showSaveFilePicker({ suggestedName: fileName('.json'), types: [{ description: 'Root Studio song', accept: { 'application/json': ['.json'] } }] });
    await writeHandle();
  } catch (err) {
    if (err.name !== 'AbortError') say('Could not save: ' + err.message);
  }
}

async function shareSong() {
  say('Rendering...');
  const file = new File([toWav(await renderSong())], fileName('.wav'), { type: 'audio/wav' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: song.name }); say('Shared.'); } catch (err) { say('Share cancelled.'); }
  } else {
    download(file, file.name);
    say('Sharing is not supported in this browser, so the WAV was downloaded instead.');
  }
}

// midi export, drums on channel 10 and one track per tonal track
function exportMidi() {
  const tick = 24, barTicks = STEPS * tick;          // 96 ticks per beat, so a step is 24
  const bars = song.mode === 'song'
    ? range(songEnd()).map(i => { const p = song.patterns[song.arr[i]] || null; return { p, k: p ? sliceAt(i, i) : 0 }; })
    : range(curPat().bars).map(k => ({ p: curPat(), k }));
  const gm = { 'Kick': 36, 'Snare': 38, 'Hi-hat': 42, 'Open hat': 46, 'Clap': 39, 'Tom': 45 };
  const varLen = n => { const b = [n & 127]; while ((n >>= 7)) b.unshift((n & 127) | 128); return b; };
  const mtrk = events => {
    events.sort((a, b) => a[0] - b[0] || a[1][0] - b[1][0]);
    const tr = [];
    let last = 0;
    events.forEach(([t, bytes]) => { tr.push(...varLen(t - last), ...bytes); last = t; });
    tr.push(0, 0xFF, 0x2F, 0);
    const n = tr.length;
    return [0x4D, 0x54, 0x72, 0x6B, (n >> 24) & 255, (n >> 16) & 255, (n >> 8) & 255, n & 255, ...tr];
  };
  const [num, den] = song.sig.split('/').map(Number), mpq = Math.round(60000000 / song.bpm);
  const tracks = [mtrk([
    [0, [0xFF, 0x51, 3, (mpq >> 16) & 255, (mpq >> 8) & 255, mpq & 255]],
    [0, [0xFF, 0x58, 4, num, Math.log2(den), 24, 8]]
  ])];
  const drums = [];
  bars.forEach(({ p, k }, bi) => p && p.drums.forEach((row, i) => range(STEPS).forEach(s => {
    const v = row[k * STEPS + s];
    if (!v) return;
    const t = bi * barTicks + s * tick;
    drums.push([t, [0x99, gm[song.drums[i].name], v]], [t + 12, [0x89, gm[song.drums[i].name], 0]]);
  })));
  tracks.push(mtrk(drums));
  song.tracks.forEach((tr, ti) => {
    const ev = [];
    bars.forEach(({ p, k }, bi) => {
      if (!p) return;
      for (const key in p.notes[ti]) {
        const [s0, r] = key.split(':').map(Number), n = p.notes[ti][key], s = s0 - k * STEPS, m = midiOf(r);
        if (s < 0 || s >= STEPS) continue;
        ev.push([bi * barTicks + s * tick, [0x90, m, n.v]], [bi * barTicks + (s + n.l) * tick, [0x80, m, 0]]);
      }
    });
    tracks.push(mtrk(ev));
  });
  const file = [0x4D, 0x54, 0x68, 0x64, 0, 0, 0, 6, 0, 1, 0, tracks.length, 0, 96, ...tracks.flat()];
  download(new Blob([new Uint8Array(file)], { type: 'audio/midi' }), fileName('.mid'));
  say('Exported ' + fileName('.mid'));
}

$('wav').addEventListener('click', exportWav);
$('mid').addEventListener('click', exportMidi);
$('mp3').addEventListener('click', exportMp3);
$('stems').addEventListener('click', exportStems);
$('saveas').addEventListener('click', saveAs);
$('share').addEventListener('click', shareSong);