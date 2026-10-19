// root studio

const $ = id => document.getElementById(id);
const range = n => [...Array(n).keys()];
const STEPS = 16;
const DRUMS = ['Kick', 'Snare', 'Hi-hat', 'Open hat', 'Clap', 'Tom'];
const ROWS = 60, LOW = 36;      // piano roll goes from C2 to B6
const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const BLACK = new Set([1, 3, 6, 8, 10]);
const SCALES = {
  Chromatic: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
  Major: [0, 2, 4, 5, 7, 9, 11],
  Minor: [0, 2, 3, 5, 7, 8, 10],
  'Minor pentatonic': [0, 3, 5, 7, 10]
};
const KEYMAP = 'zsxdcvgbhnjm,';
const midiOf = row => LOW + ROWS - 1 - row;
const rowOf = midi => LOW + ROWS - 1 - midi;

function blankSong() {
  return {
    bpm: 120,
    name: 'Untitled', swing: 0, master: 0.8, delay: 0.2,
    lead: { vol: 0.5, mute: false },
    wave: 'sawtooth', root: 0, scale: 'Minor', len: 1,
    notes: {},                       // "step:row" -> length in steps
    drums: DRUMS.map(name => ({ name, vol: 0.8, mute: false, steps: Array(STEPS).fill(0) }))
  };
}
let song = blankSong();

// sound

let ctx, out, master, timer, noise, playing = false, step = 0, nextTime = 0, queued = [];
let echo, wet;
const secPerStep = () => 60 / song.bpm / 4;

function startAudio() {
  if (!ctx) {
    ctx = new AudioContext();
    out = ctx.createGain();          // every sound goes through here
    master = ctx.createGain();
    out.connect(master);
    master.connect(ctx.destination);
    echo = ctx.createDelay(2);
    wet = ctx.createGain();
    const feedback = ctx.createGain();
    feedback.gain.value = 0.35;
    out.connect(echo);
    echo.connect(feedback);
    feedback.connect(echo);
    echo.connect(wet);
    wet.connect(master);
  }
  if (ctx.state === 'suspended') ctx.resume();
  applyMix();
}

function applyMix() {
  if (!ctx) return;
  master.gain.value = song.master;
  wet.gain.value = song.delay;
  echo.delayTime.value = secPerStep() * 3;
}

function noiseBuf() {
  if (!noise) {
    noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  return noise;
}

function drum(name, t, vol) {
  const g = ctx.createGain();
  g.connect(out);
  const hiss = (type, freq, len) => {
    const src = ctx.createBufferSource(), f = ctx.createBiquadFilter();
    src.buffer = noiseBuf();
    f.type = type;
    f.frequency.value = freq;
    src.connect(f);
    f.connect(g);
    src.start(t);
    src.stop(t + len);
  };
  const tone = (type, from, to, len) => {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(from, t);
    o.frequency.exponentialRampToValueAtTime(to, t + len);
    o.connect(g);
    o.start(t);
    o.stop(t + 0.5);
  };
  const decay = (peak, len) => {
    g.gain.setValueAtTime(vol * peak, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + len);
  };
  if (name === 'Kick') { decay(1, 0.45); tone('sine', 160, 42, 0.12); }
  else if (name === 'Snare') { decay(0.8, 0.2); hiss('highpass', 1800, 0.25); tone('triangle', 220, 120, 0.1); }
  else if (name === 'Hi-hat') { decay(0.5, 0.06); hiss('highpass', 7500, 0.1); }
  else if (name === 'Open hat') { decay(0.4, 0.3); hiss('highpass', 7000, 0.35); }
  else if (name === 'Tom') { decay(0.8, 0.35); tone('sine', 220, 90, 0.2); }
  else { decay(0.7, 0.2); hiss('bandpass', 1500, 0.25); }      // clap
}

function playNote(midi, t, dur) {
  const o = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  const level = song.lead.mute ? 0 : song.lead.vol;
  o.type = song.wave;
  o.frequency.value = 440 * Math.pow(2, (midi - 69) / 12);
  f.type = 'lowpass';
  f.frequency.value = 4200;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(0.35 * level * 2, t + 0.01);
  g.gain.setTargetAtTime(0, t + dur, 0.06);
  o.connect(f);
  f.connect(g);
  g.connect(out);
  o.start(t);
  o.stop(t + dur + 0.5);
}

function audition(midi) {
  startAudio();
  playNote(midi, ctx.currentTime, 0.25);
}

// sequencer

function queueStep(s, t) {
  song.drums.forEach(d => {
    if (!d.steps[s]) return;
    if (!d.mute) drum(d.name, t, d.vol);
  });
  for (const key in song.notes) {
    const [ns, r] = key.split(':').map(Number);
    if (ns === s) playNote(midiOf(r), t, song.notes[key] * secPerStep() * 0.95);
  }
}

function tick() {
  while (nextTime < ctx.currentTime + 0.12) {
    const at = nextTime + (step % 2 ? secPerStep() * song.swing * 0.6 : 0);      // swing pushes every other step late
    queueStep(step, at);
    queued.push({ step, time: at });
    nextTime += secPerStep();
    step = (step + 1) % STEPS;
  }
}

// moves the playhead when the sound actually reaches that step
function frame() {
  if (!playing) return;
  while (queued.length && queued[0].time <= ctx.currentTime) setHead(queued.shift().step);
  requestAnimationFrame(frame);
}

function play() {
  if (playing) return pause();
  startAudio();
  playing = true;
  nextTime = ctx.currentTime + 0.06;
  queued = [];
  $('play').classList.add('on');
  timer = setInterval(tick, 25);
  tick();
  requestAnimationFrame(frame);
}

function pause() {
  playing = false;
  clearInterval(timer);
  $('play').classList.remove('on');
  setHead(-1);
}

function stop() {
  pause();
  step = 0;
}

function setHead(n) {
  document.querySelectorAll('.now').forEach(e => e.classList.remove('now'));
  if (n >= 0) document.querySelectorAll('[data-s="' + n + '"]').forEach(e => e.classList.add('now'));
}

// drum rack

let drag = null;                     // the mouse is held down on the rack or the roll

function buildRack() {
  const cells = () => range(STEPS).map(s => `<b data-s="${s}"></b>`).join('');
  const row = (name, id, ro) => `<div class="row" data-i="${id}">` +
    `<button class="led" title="Mute"></button>` +
    `<button class="name" title="Click to preview">${name}</button>` +
    `<input class="vol" type="range" min="0" max="100" title="Volume">` +
    `<div class="steps${ro ? ' ro' : ''}">${cells()}</div></div>`;
  const rows = song.drums.map((d, i) => row(d.name, i, false));
  rows.push(row('Lead', 'lead', true));      // shows where the piano roll notes start
  $('rack').innerHTML = rows.join('');
}

const channel = id => (id === 'lead' ? song.lead : song.drums[+id]);
const hasStart = s => Object.keys(song.notes).some(k => +k.split(':')[0] === s);

function syncRack() {
  document.querySelectorAll('#rack .row').forEach(row => {
    const id = row.dataset.i;
    row.querySelectorAll('.steps b').forEach((b, s) => {
      b.classList.toggle('on', id === 'lead' ? hasStart(s) : !!song.drums[+id].steps[s]);
    });
    row.querySelector('.led').classList.toggle('lit', !channel(id).mute);
    row.querySelector('.vol').value = channel(id).vol * 100;
  });
}

function setDrumStep(id, s, on) {
  song.drums[id].steps[s] = on;
  syncRack();
  if (on && !playing) {
    startAudio();
    drum(song.drums[id].name, ctx.currentTime, song.drums[id].vol);
  }
}

$('rack').addEventListener('pointerdown', e => {
  const b = e.target.closest('.steps:not(.ro) b');
  if (!b) return;
  const id = +b.closest('.row').dataset.i, s = +b.dataset.s;
  drag = { kind: 'rack', on: song.drums[id].steps[s] ? 0 : 1 };
  setDrumStep(id, s, drag.on);
});
$('rack').addEventListener('pointerover', e => {
  const b = e.target.closest('.steps:not(.ro) b');
  if (drag && drag.kind === 'rack' && b) setDrumStep(+b.closest('.row').dataset.i, +b.dataset.s, drag.on);
});
$('rack').addEventListener('click', e => {
  const row = e.target.closest('.row');
  if (!row) return;
  const id = row.dataset.i;
  if (e.target.closest('.led')) {
    channel(id).mute = !channel(id).mute;
    syncRack();
    return;
  }
  if (e.target.closest('.name')) {
    startAudio();
    if (id === 'lead') return audition(60);
    drum(song.drums[+id].name, ctx.currentTime, song.drums[+id].vol);
  }
});
$('rack').addEventListener('input', e => {
  if (e.target.classList.contains('vol')) channel(e.target.closest('.row').dataset.i).vol = e.target.value / 100;
});
window.addEventListener('pointerup', () => { drag = null; });

// piano roll

const keyEls = [];
let cells = [];

function buildRoll() {
  range(ROWS).forEach(r => {
    const m = midiOf(r), k = document.createElement('div');
    k.className = 'key ' + (BLACK.has(m % 12) ? 'blk' : 'wht');
    k.dataset.m = m;
    if (m % 12 === 0) k.textContent = 'C' + (Math.floor(m / 12) - 1);
    $('keys').append(k);
    keyEls.push(k);
  });
  range(ROWS * STEPS).forEach(i => {
    const c = document.createElement('div');
    c.dataset.s = i % STEPS;
    c.dataset.r = Math.floor(i / STEPS);
    $('grid').append(c);
  });
  cells = [...$('grid').children];
  $('roll').scrollTop = rowOf(66) * 15;      // start around the middle of the range
}

function paintRoll() {
  const inScale = new Set(SCALES[song.scale].map(n => (n + song.root) % 12)), cover = {};
  for (const k in song.notes) {
    const [s, r] = k.split(':').map(Number);
    for (let i = 0; i < song.notes[k] && s + i < STEPS; i++) cover[(s + i) + ':' + r] = i ? 'tail' : 'head';
  }
  for (let r = 0; r < ROWS; r++) {
    const m = midiOf(r) % 12, inside = inScale.has(m);
    keyEls[r].classList.toggle('dim', !inside);
    keyEls[r].classList.toggle('root', m === song.root);
    for (let s = 0; s < STEPS; s++) {
      const cv = cover[s + ':' + r];
      cells[r * STEPS + s].className = 'c' + (BLACK.has(m) ? ' blk' : '') + (inside ? '' : ' out') +
        (s % 4 === 0 ? ' beat' : '') + (cv ? ' ' + cv : '');
    }
  }
}

// the step where the note covering this cell starts
function ownerOf(s, r) {
  for (let back = 0; back < STEPS; back++) {
    const o = s - back, len = song.notes[o + ':' + r];
    if (o >= 0 && len && len > back) return o;
  }
}

function editNote(s, r, mode) {
  if (mode === 'add') {
    if (song.notes[s + ':' + r]) return;
    song.notes[s + ':' + r] = song.len;
    audition(midiOf(r));
  } else {
    const o = ownerOf(s, r);
    if (o === undefined) return;
    delete song.notes[o + ':' + r];
  }
  paintRoll();
  syncRack();
}

$('grid').addEventListener('pointerdown', e => {
  const c = e.target.closest('.c');
  if (!c) return;
  const s = +c.dataset.s, r = +c.dataset.r;
  drag = { kind: 'roll', mode: ownerOf(s, r) === undefined ? 'add' : 'del' };
  editNote(s, r, drag.mode);
});
$('grid').addEventListener('pointerover', e => {
  const c = e.target.closest('.c');
  if (c && drag && drag.kind === 'roll') editNote(+c.dataset.s, +c.dataset.r, drag.mode);
});
$('keys').addEventListener('pointerdown', e => {
  const k = e.target.closest('.key');
  if (k) audition(+k.dataset.m);
});

// controls

function say(text) {
  $('status').textContent = text;
}

function applySong() {
  $('bpm').value = song.bpm;
  $('swing').value = song.swing * 100;
  $('master').value = song.master * 100;
  $('delay').value = song.delay * 100;
  $('title').value = song.name;
  $('wave').value = song.wave;
  $('root').value = song.root;
  $('scale').value = song.scale;
  $('len').value = song.len;
  syncRack();
  paintRoll();
  applyMix();
}

$('play').addEventListener('click', play);
$('stop').addEventListener('click', stop);
$('bpm').addEventListener('change', e => {
  song.bpm = Math.min(220, Math.max(50, +e.target.value || 120));
  e.target.value = song.bpm;
  applyMix();
});

const bind = (id, fn) => $(id).addEventListener('input', e => fn(e.target.value));
bind('wave', v => { song.wave = v; });
bind('len', v => { song.len = +v; });
bind('root', v => { song.root = +v; paintRoll(); });
bind('scale', v => { song.scale = v; paintRoll(); });

NAMES.forEach((n, i) => $('root').add(new Option(n, i)));
Object.keys(SCALES).forEach(s => $('scale').add(new Option(s, s)));

bind('swing', v => { song.swing = v / 100; });
bind('master', v => { song.master = v / 100; applyMix(); });
bind('delay', v => { song.delay = v / 100; applyMix(); });
bind('title', v => { song.name = v; });

// computer keyboard plays the lead, [ and ] change the octave
let octave = 4;
document.addEventListener('keydown', e => {
  if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
  if (/^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName) && e.target.type !== 'range') return;
  if (e.code === 'Space') { e.preventDefault(); play(); return; }
  if (e.key === '[' || e.key === ']') {
    octave = Math.min(6, Math.max(2, octave + (e.key === ']' ? 1 : -1)));
    say('Octave: C' + octave);
    return;
  }
  const i = KEYMAP.indexOf(e.key.toLowerCase());
  if (i >= 0) audition(12 * (octave + 1) + i);
});

// presets, saving and loading

function setDrums(s, ...rows) {
  rows.forEach((r, i) => { s.drums[i].steps = range(STEPS).map(k => (r && r[k] === 'x' ? 1 : 0)); });
}

const presets = {
  'Four on the floor'(s) {
    setDrums(s, 'x...x...x...x...', '....x.......x...', 'x.x.x.x.x.x.x.x.', '..x...x...x...x.', '....x.......x...');
    [[0, 48], [3, 48], [6, 51], [8, 48], [11, 55], [14, 51]].forEach(([st, m]) => { s.notes[st + ':' + rowOf(m)] = 1; });
  },
  'Hip hop'(s) {
    setDrums(s, 'x.....x.x.......', '....x.......x...', 'x.x.x.x.x.x.x.x.');
    s.bpm = 90;
    s.swing = 0.3;
  },
  'Empty'() {}
};

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

// mix a saved song into a blank one so missing fields get their defaults
function loadSong(data) {
  const base = blankSong();
  song = { ...base, ...data, lead: { ...base.lead, ...data.lead } };
  song.drums = base.drums.map((d, i) => {
    const saved = (data.drums || [])[i] || {};
    return { ...d, ...saved, steps: Array.isArray(saved.steps) ? saved.steps : d.steps };
  });
}

$('save').addEventListener('click', () => {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(song, null, 2)], { type: 'application/json' }));
  a.download = (song.name || 'root-studio').replace(/[^\w-]+/g, '-') + '.json';
  a.click();
  say('Saved ' + a.download);
});
$('open').addEventListener('click', () => $('file').click());
$('file').addEventListener('change', async e => {
  const f = e.target.files[0];
  e.target.value = '';
  if (!f) return;
  try {
    stop();
    loadSong(JSON.parse(await f.text()));
    applySong();
    say('Opened ' + f.name);
  } catch (err) {
    say('Could not open that file.');
  }
});

// the song is kept in the browser, so a reload does not lose it
try {
  const saved = localStorage.getItem('root-studio');
  if (saved) loadSong(JSON.parse(saved));
} catch (err) { /* nothing saved yet */ }
setInterval(() => {
  try { localStorage.setItem('root-studio', JSON.stringify(song)); }
  catch (err) { /* storage blocked */ }
}, 4000);

buildRack();
buildRoll();
applySong();
