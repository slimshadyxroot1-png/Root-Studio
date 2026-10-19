// root studio

const $ = id => document.getElementById(id);
const range = n => [...Array(n).keys()];
const STEPS = 16;
const DRUMS = ['Kick', 'Snare', 'Hi-hat', 'Open hat', 'Clap', 'Tom'];

function blankSong() {
  return {
    bpm: 120,
    drums: DRUMS.map(name => ({ name, steps: Array(STEPS).fill(0) }))
  };
}
let song = blankSong();

// sound

let ctx, out, master, timer, noise, playing = false, step = 0, nextTime = 0, queued = [];
const secPerStep = () => 60 / song.bpm / 4;

function startAudio() {
  if (!ctx) {
    ctx = new AudioContext();
    out = ctx.createGain();          // every sound goes through here
    master = ctx.createGain();
    out.connect(master);
    master.connect(ctx.destination);
    master.gain.value = 0.8;
  }
  if (ctx.state === 'suspended') ctx.resume();
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

// sequencer

function queueStep(s, t) {
  song.drums.forEach(d => {
    if (!d.steps[s]) return;
    drum(d.name, t, 0.8);
  });
}

function tick() {
  while (nextTime < ctx.currentTime + 0.12) {
    const at = nextTime;
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
    `<button class="name" title="Click to preview">${name}</button>` +
    `<div class="steps${ro ? ' ro' : ''}">${cells()}</div></div>`;
  const rows = song.drums.map((d, i) => row(d.name, i, false));
  $('rack').innerHTML = rows.join('');
}


function syncRack() {
  document.querySelectorAll('#rack .row').forEach(row => {
    const id = row.dataset.i;
    row.querySelectorAll('.steps b').forEach((b, s) => {
      b.classList.toggle('on', !!song.drums[+id].steps[s]);
    });
  });
}

function setDrumStep(id, s, on) {
  song.drums[id].steps[s] = on;
  syncRack();
  if (on && !playing) {
    startAudio();
    drum(song.drums[id].name, ctx.currentTime, 0.8);
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
  if (e.target.closest('.name')) {
    startAudio();
    drum(song.drums[+id].name, ctx.currentTime, 0.8);
  }
});
window.addEventListener('pointerup', () => { drag = null; });

// controls

function say(text) {
  $('status').textContent = text;
}

function applySong() {
  $('bpm').value = song.bpm;
  syncRack();
}

$('play').addEventListener('click', play);
$('stop').addEventListener('click', stop);
$('bpm').addEventListener('change', e => {
  song.bpm = Math.min(220, Math.max(50, +e.target.value || 120));
  e.target.value = song.bpm;
});

document.addEventListener('keydown', e => {
  if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
  if (/^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName) && e.target.type !== 'range') return;
  if (e.code === 'Space') { e.preventDefault(); play(); return; }
});

buildRack();
applySong();
