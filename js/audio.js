// sound

let headStep = -1, loopNo = 0, bar = 0;
let ctx, graph, timer, playing = false, step = 0, nextTime = 0, queued = [];
const secPerStep = () => 60 / song.bpm / 4;

function noiseBuf(c) {
  if (!c._noise) {
    const b = c.createBuffer(1, c.sampleRate, c.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    c._noise = b;
  }
  return c._noise;
}

// audio graph

function makeIR(c, secs) {
  const len = Math.floor(c.sampleRate * secs), b = c.createBuffer(2, len, c.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = b.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
  }
  return b;
}

function driveCurve(amt) {
  const n = 256, cv = new Float32Array(n), a = 1 + amt * 4;
  for (let i = 0; i < n; i++) {
    const x = i / (n - 1) * 2 - 1;
    cv[i] = amt > 0 ? Math.tanh(x * a) / Math.tanh(a) : x;
  }
  return cv;
}


function setStrip(s, m) {
  s.vol.gain.value = m.vol;
  s.pan.pan.value = m.pan;
  s.rs.gain.value = m.rev;
  s.ds.gain.value = m.del;
}

function mkStrip(c, g, key) {
  const s = {};
  s.in = c.createGain(); s.vol = c.createGain(); s.pan = c.createStereoPanner();
  s.an = c.createAnalyser(); s.an.fftSize = 256;
  s.rs = c.createGain(); s.ds = c.createGain();
  s.in.connect(s.vol); s.vol.connect(s.pan); s.pan.connect(s.an); s.an.connect(g.in);
  s.pan.connect(s.rs); s.rs.connect(g.rsend);
  s.pan.connect(s.ds); s.ds.connect(g.dsend);
  setStrip(s, stripOf(key));
  return (g.strips[key] = s);
}
const strip = (g, key) => g.strips[key] || mkStrip(g.c, g, key);

function buildGraph(c) {
  const g = { c, strips: {}, room: song.room, drv: song.drive, dirty: false };
  g.in = c.createGain();
  g.eq = [['lowshelf', 200, 'low'], ['peaking', 1000, 'mid'], ['highshelf', 5000, 'high']].map(([type, f, k]) => {
    const n = c.createBiquadFilter();
    n.type = type; n.frequency.value = f; n.gain.value = song.eq[k];
    return n;
  });
  g.shaper = c.createWaveShaper();
  g.shaper.curve = driveCurve(song.drive);
  g.master = c.createGain();
  const comp = c.createDynamicsCompressor();
  g.an = c.createAnalyser(); g.an.fftSize = 256;
  g.in.connect(g.eq[0]); g.eq[0].connect(g.eq[1]); g.eq[1].connect(g.eq[2]); g.eq[2].connect(g.shaper);
  g.shaper.connect(g.master); g.master.connect(comp); comp.connect(g.an); comp.connect(c.destination);

  g.rsend = c.createGain(); g.conv = c.createConvolver(); g.rev = c.createGain();
  g.conv.buffer = makeIR(c, song.room);
  g.rsend.connect(g.conv); g.conv.connect(g.rev); g.rev.connect(g.in);

  g.dsend = c.createGain(); g.delay = c.createDelay(2); g.wet = c.createGain();
  const fb = c.createGain();
  fb.gain.value = 0.35;
  g.dsend.connect(g.delay); g.delay.connect(fb); fb.connect(g.delay); g.delay.connect(g.wet); g.wet.connect(g.in);

  g.master.gain.value = song.master;
  g.wet.gain.value = song.delay;
  g.rev.gain.value = song.reverb;
  g.delay.delayTime.value = secPerStep() * 3;
  allKeys().forEach(k => mkStrip(c, g, k));
  return g;
}

// copy the song settings to the audio nodes
function syncGraph() {
  if (!graph) return;
  const g = graph;
  g.master.gain.value = song.master;
  g.wet.gain.value = song.delay;
  g.rev.gain.value = song.reverb;
  g.delay.delayTime.value = secPerStep() * 3;
  ['low', 'mid', 'high'].forEach((k, i) => { g.eq[i].gain.value = song.eq[k]; });
  if (g.drv !== song.drive) { g.shaper.curve = driveCurve(song.drive); g.drv = song.drive; }
  if (g.room !== song.room) { g.conv.buffer = makeIR(ctx, song.room); g.room = song.room; }
  allKeys().forEach(k => setStrip(strip(g, k), stripOf(k)));
}

function startAudio() {
  if (!ctx) { ctx = new AudioContext(); graph = buildGraph(ctx); }
  if (ctx.state === 'suspended') ctx.resume();
}


// instruments

function drum(c, out, name, t, vol) {
  if (vol < 0.01) return;
  const g = c.createGain();
  const kit = KITS[song.kit] || KITS.Retro;
  g.connect(out);
  const noise = (type, freq, q, len) => {
    const src = c.createBufferSource(), f = c.createBiquadFilter();
    src.buffer = noiseBuf(c);
    f.type = type; f.frequency.value = freq; f.Q.value = q;
    src.connect(f); f.connect(g);
    src.start(t); src.stop(t + len);
  };
  const tone = (type, from, to, len) => {
    const o = c.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(from, t);
    o.frequency.exponentialRampToValueAtTime(to, t + len);
    o.connect(g); o.start(t); o.stop(t + 0.5);
  };
  if (name === 'Kick') {
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + kit.kickLen);
    tone('sine', kit.kickFrom, kit.kickTo, 0.12);
  } else if (name === 'Snare') {
    g.gain.setValueAtTime(vol * 0.8, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + kit.snareLen);
    noise('highpass', 1800, 0.7, kit.snareLen + 0.05);
    tone('triangle', 220, 120, 0.1);
  } else if (name === 'Hi-hat') {
    g.gain.setValueAtTime(vol * 0.5, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
    noise('highpass', 7500, 0.5, 0.1);
  } else if (name === 'Open hat') {
    g.gain.setValueAtTime(vol * 0.4, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    noise('highpass', 7000, 0.5, 0.35);
  } else if (name === 'Tom') {
    g.gain.setValueAtTime(vol * 0.8, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
    tone('sine', 220, 90, 0.2);
  } else {
    g.gain.setValueAtTime(0.0001, t);
    [0, 0.012, 0.024].forEach(d => {
      g.gain.setValueAtTime(vol * 0.7, t + d);
      g.gain.exponentialRampToValueAtTime(0.05, t + d + 0.008);
    });
    g.gain.setValueAtTime(vol * 0.7, t + 0.036);
    g.gain.exponentialRampToValueAtTime(0.001, t + kit.clapLen);
    noise('bandpass', 1500, 1.2, kit.clapLen + 0.05);
  }
}

// scheduling

function drumHit(c, out, i, t, vel) {
  drum(c, out, song.drums[i].name, t, vel);
}



// s is the step in the bar, k is the bar of the pattern, tb is the bar on the timeline
function queueStep(c, g, s, t, p, b, lap, k = 0) {
  const ps = k * STEPS + s, tb = song.mode === 'song' ? b : lap;
  const fm = 1;
  if (p) {
    p.drums.forEach((row, i) => {
      if (row[ps] && audible('d' + i)) drumHit(c, strip(g, 'd' + i).in, i, t, row[ps] / 100);
    });
    song.tracks.forEach((tr, i) => {
      if (!audible('t' + i)) return;
      const out = strip(g, 't' + i).in, notes = p.notes[i];
      for (const key in notes) {
        const [ns, r] = key.split(':').map(Number);
        if (ns === ps) playNote(c, out, midiOf(r), t, notes[key].l * secPerStep() * 0.95, tr, notes[key].v, fm);
      }
    });
  }
}

function auditionNote(m, vel = 100) {
  startAudio();
  playNote(ctx, strip(graph, 't' + song.sel).in, m, ctx.currentTime, 0.25, curTrack(), vel, 1);
}

const startBar = () => 0;
const patternAt = () => curPat();

function sliceAt() {
  return 0;
}

function advanceBar() {
  loopNo++;
}

function tick() {
  while (nextTime < ctx.currentTime + 0.12) {
    const at = nextTime + (step % 2 ? secPerStep() * song.swing * 0.6 : 0);
    const p = patternAt(bar), k = p ? sliceAt(bar, loopNo) : 0;
    queueStep(ctx, graph, step, at, p, bar, loopNo, k);
    queued.push({ step: k * STEPS + step, sb: step, time: at, bar: song.mode === 'song' ? bar : loopNo, onCur: p === curPat() });
    nextTime += secPerStep();
    step = (step + 1) % STEPS;
    if (step === 0) advanceBar();
  }
}

function frame() {
  if (!playing) return;
  while (queued.length && queued[0].time <= ctx.currentTime) {
    const e = queued.shift();
    setHead(e.onCur ? e.step : -1, e.bar, e.sb);
  }
  requestAnimationFrame(frame);
}

function play() {
  if (playing) return pause();
  startAudio();
  playing = true;
  if (step === 0) bar = startBar();
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

function stop() { pause(); step = 0; loopNo = 0; bar = startBar(); }

function setHead(n, b, sb) {
  headStep = n;
  document.querySelectorAll('.now').forEach(e => e.classList.remove('now'));
  if (n >= 0) document.querySelectorAll('[data-s="' + n + '"]').forEach(e => e.classList.add('now'));
  const ph = $('playhead');
  ph.style.display = n < 0 ? 'none' : 'block';
  ph.style.left = (n * 100 / PSTEPS) + '%';
}