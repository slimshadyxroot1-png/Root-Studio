// controls, files and keyboard

function say(text) {
  $('status').textContent = text;
}

function retime() { syncGraph(); }

function applySong() {
  $('title').value = song.name;
  $('bpm').value = song.bpm;
  $('swing').value = song.swing * 100;
  $('master').value = song.master * 100;
  $('delay').value = song.delay * 100;
  $('sig').value = song.sig;
  $('root').value = song.root;
  $('scale').value = song.scale;
  $('len').value = song.len;
  $('defVel').value = song.vel;
  $('wave').value = curTrack().wave;
  applySig();                    // rebuilds the rack and roll for the bar length
  fillTracks();
  fillPatterns();
  syncSynth();
  buildMixer();
  paintArr();
  syncGraph();
  syncRack();
  paintRoll();
}

function bind(id, fn) {
  $(id).addEventListener('input', e => fn(e.target.value));
}
bind('swing', v => { song.swing = v / 100; });
bind('master', v => { song.master = v / 100; syncGraph(); });
bind('delay', v => { song.delay = v / 100; syncGraph(); });
bind('wave', v => { curTrack().wave = v; });
bind('len', v => { song.len = +v; });
bind('defVel', v => { song.vel = +v; });
bind('root', v => { song.root = +v; paintRoll(); });
bind('scale', v => { song.scale = v; paintRoll(); });
bind('title', v => { song.name = v; });
$('bpm').addEventListener('change', e => {
  song.bpm = Math.min(220, Math.max(50, +e.target.value || 120));
  e.target.value = song.bpm;
  retime();
});

// reading and writing songs

const padRow = r => range(MAXSTEPS).map(i => (r && r[i] ? (r[i] === 1 ? 100 : r[i]) : 0));   // old songs stored 1 for a hit

// old songs had no tracks or patterns, make one of each
function migrate(d, base) {
  const s = { ...base, ...d };
  const p = blankPattern('Pattern 1', 1);
  p.drums = base.drums.map((_, i) => padRow(d.drums[i] && d.drums[i].steps));
  for (const k in d.notes || {}) p.notes[0][k] = note(d.notes[k], 100);
  s.drums = base.drums.map((x, i) => ({
    name: x.name, vol: d.drums[i] && d.drums[i].vol != null ? d.drums[i].vol : x.vol, mute: !!(d.drums[i] && d.drums[i].mute)
  }));
  s.tracks = [{ ...blankTrack('Track 1'), wave: d.wave || 'sawtooth', synth: { ...SYNTH_DEFAULT, ...d.synth },
    vol: d.lead && d.lead.vol != null ? d.lead.vol : 0.5, mute: !!(d.lead && d.lead.mute) }];
  s.patterns = [p];
  delete s.notes; delete s.wave; delete s.synth; delete s.lead;
  return s;
}

// returns the parsed file
function readSong(text) {
  const data = JSON.parse(text), base = blankSong();
  if (!Array.isArray(data.drums)) throw new Error('Not a Root Studio song');
  const s = data.patterns ? { ...base, ...data } : migrate(data, base);
  s.sig = SIGS.includes(s.sig) ? s.sig : '4/4';
  s.tracks = s.tracks.map(t => ({ ...blankTrack(), ...t, synth: { ...SYNTH_DEFAULT, ...t.synth } }));
  s.drums = base.drums.map((x, i) => ({ ...x, ...s.drums[i] }));
  s.patterns = s.patterns.map(p => ({
    name: p.name || 'Pattern',
    bars: [1, 2, 4].includes(p.bars) ? p.bars : 1,
    drums: base.drums.map((_, i) => padRow(p.drums && p.drums[i])),
    notes: s.tracks.map((_, i) => {
      const out = {};
      for (const k in (p.notes && p.notes[i]) || {}) {
        const n = p.notes[i][k];
        out[k] = typeof n === 'number' ? note(n, 100) : { l: n.l || 1, v: n.v || 100 };
      }
      return out;
    }),
    auto: p.auto || {}, curve: p.curve || {}
  }));
  s.eq = { ...base.eq, ...s.eq };
  s.loop = { ...base.loop, ...s.loop };
  s.arr = range(BARS).map(i => (s.arr && s.arr[i] != null && s.patterns[s.arr[i]] ? s.arr[i] : -1));
  s.sel = Math.min(Math.max(0, s.sel | 0), s.tracks.length - 1);
  s.cur = Math.min(Math.max(0, s.cur | 0), s.patterns.length - 1);
  delete s.voice; delete s.audio; delete s.mix; delete s.buffers; delete s.samples;
  song = s;
  return data;
}

// audio clips and drum samples are saved inside the file as base64
async function songJson(withMedia) {
  const data = { ...song };
  return JSON.stringify(data, null, withMedia ? 2 : 0);
}


async function saveFile() {
  const filename = (song.name || 'root-studio').replace(/[^\w-]+/g, '-') + '.json';
  const text = await songJson(true);
  const dl = window.claude ? await claude.use('downloads') : null;
  if (dl) {
    try { await dl.save({ filename, data: text }); say('Saved ' + filename); }
    catch (err) { say(err.code === 'declined' ? 'Save cancelled.' : 'Could not save the file.'); }
    return;
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  a.download = filename;
  a.click();
  say('Saved ' + filename + ' with its audio');
}

$('save').addEventListener('click', saveFile);
$('open').addEventListener('click', () => $('file').click());
$('file').addEventListener('change', async e => {
  const f = e.target.files[0];
  e.target.value = '';
  if (!f) return;
  try {
    stop();
    const data = readSong(await f.text());
    applySong();
    say('Opened ' + f.name);
  } catch (err) {
    say('Could not open that file: ' + err.message);
  }
});

$('play').addEventListener('click', play);
$('stop').addEventListener('click', stop);

let octave = 4;
document.addEventListener('keydown', e => {
  if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
  if (/^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName) && e.target.type !== 'range') return;
  if (e.code === 'Space') { e.preventDefault(); play(); return; }
  if (e.key === '[' || e.key === ']') {
    octave = Math.min(6, Math.max(2, octave + (e.key === ']' ? 1 : -1)));
    $('hint').textContent = 'Keys Z to M play the synth, [ and ] change octave (C' + octave + ')';
    return;
  }
  const i = KEYMAP.indexOf(e.key.toLowerCase());
  if (i >= 0) {
    const m = 12 * (octave + 1) + i;
    auditionNote(m);
    recordNote(m, 100);
  }
});

Object.keys(presets).forEach(name => {
  const b = document.createElement('button');
  b.textContent = name;
  b.addEventListener('click', () => {
    song = blankSong();
    presets[name](song);
    song.name = name;
    applySong();
    say('Loaded ' + name);
  });
  $('presets').append(b);
});
NAMES.forEach((n, i) => $('root').add(new Option(n, i)));
Object.keys(SCALES).forEach(s => $('scale').add(new Option(s, s)));
SIGS.forEach(s => $('sig').add(new Option(s, s)));

try {
  const saved = localStorage.getItem('root-studio');
  if (saved) readSong(saved);
} catch (err) { /* nothing saved yet */ }
applySong();


setInterval(() => {
  try { localStorage.setItem('root-studio', JSON.stringify(song)); }
  catch (err) { /* storage blocked */ }
}, 4000);

meters();
initMidi();