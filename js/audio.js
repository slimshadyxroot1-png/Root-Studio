// sound

let headStep = -1, metro = false, loopNo = 0, bar = 0;
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

// insert effect for a strip
function setFx(s, m) {
  const c = s.vol.context, amt = m.fxAmt;
  if (s.fxType !== m.fx) {
    s.fx.forEach(n => { try { n.disconnect(); if (n.stop) n.stop(); } catch (err) { /* already gone */ } });
    s.fxA.disconnect();
    s.fx = []; s.duck = null; s.fxp = null; s.fxType = m.fx;
    const add = n => { s.fx.push(n); return n; };
    const lfo = hz => { const o = add(c.createOscillator()); o.frequency.value = hz; o.start(); return o; };
    if (m.fx === 'sidechain') {
      s.duck = add(c.createGain());
      s.fxA.connect(s.duck); s.duck.connect(s.fxB);
    } else if (m.fx === 'chorus' || m.fx === 'flanger') {
      const d = add(c.createDelay(0.05)), wet = add(c.createGain()), depth = add(c.createGain());
      const o = lfo(m.fx === 'chorus' ? 0.8 : 0.25);
      d.delayTime.value = m.fx === 'chorus' ? 0.025 : 0.004;
      o.connect(depth); depth.connect(d.delayTime);
      s.fxA.connect(s.fxB); s.fxA.connect(d); d.connect(wet); wet.connect(s.fxB);
      if (m.fx === 'flanger') { const fb = add(c.createGain()); fb.gain.value = 0.5; d.connect(fb); fb.connect(d); }
      s.fxp = { wet, depth, k: m.fx === 'chorus' ? 0.006 : 0.003 };
    } else if (m.fx === 'phaser') {
      const wet = add(c.createGain()), depth = add(c.createGain()), o = lfo(0.5);
      let prev = s.fxA;
      for (let i = 0; i < 4; i++) {
        const ap = add(c.createBiquadFilter());
        ap.type = 'allpass'; ap.frequency.value = 800;
        depth.connect(ap.frequency); prev.connect(ap); prev = ap;
      }
      o.connect(depth); prev.connect(wet); wet.connect(s.fxB); s.fxA.connect(s.fxB);
      s.fxp = { wet, depth, k: 600 };
    } else {
      s.fxA.connect(s.fxB);
    }
  }
  if (s.fxp) { s.fxp.wet.gain.value = amt * 0.7; s.fxp.depth.gain.value = s.fxp.k * (0.3 + amt); }
}

// each kick ducks the sidechain strips
function duckAll(g, t) {
  allKeys().forEach(k => {
    const s = g.strips[k];
    if (!s || !s.duck) return;
    s.duck.gain.cancelScheduledValues(t);
    s.duck.gain.setValueAtTime(1 - stripOf(k).fxAmt * 0.9, t);
    s.duck.gain.linearRampToValueAtTime(1, t + 0.2);
  });
}

function setStrip(s, m) {
  s.vol.gain.value = m.vol;
  s.pan.pan.value = m.pan;
  s.rs.gain.value = m.rev;
  s.ds.gain.value = m.del;
  setFx(s, m);
}

function mkStrip(c, g, key) {
  const s = {};
  s.in = c.createGain(); s.vol = c.createGain(); s.pan = c.createStereoPanner();
  s.an = c.createAnalyser(); s.an.fftSize = 256;
  s.rs = c.createGain(); s.ds = c.createGain();
  s.fxA = c.createGain(); s.fxB = c.createGain(); s.fx = [];
  s.in.connect(s.fxA); s.fxB.connect(s.vol); s.vol.connect(s.pan); s.pan.connect(s.an); s.an.connect(g.in);
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

// automation, values 0 to 1 per step

function autoTargets() {
  const sm = param => (g, x, t, nx, t2) => {
    const p = param(g);
    if (nx == null) p.setTargetAtTime(x, t, 0.03);
    else { p.setValueAtTime(x, t); p.linearRampToValueAtTime(nx, t2); }   // smooth curve to the next step
  };
  const T = [
    { id: 'master', label: 'Master volume', lo: 0, hi: 1, base: () => song.master, set: sm(g => g.master.gain) },
    { id: 'reverb', label: 'Reverb return', lo: 0, hi: 1, base: () => song.reverb, set: sm(g => g.rev.gain) },
    { id: 'delay', label: 'Delay return', lo: 0, hi: 0.8, base: () => song.delay, set: sm(g => g.wet.gain) },
    { id: 'filter', label: 'Synth filter cutoff', lo: 0.05, hi: 1, base: () => song.cutMul }
  ];
  song.tracks.forEach((t, i) => {
    T.push({ id: 'vol' + i, label: t.name + ' volume', lo: 0, hi: 1, base: () => t.vol, set: sm(g => strip(g, 't' + i).vol.gain) });
    T.push({ id: 'pan' + i, label: t.name + ' pan', lo: -1, hi: 1, base: () => t.pan, set: sm(g => strip(g, 't' + i).pan.pan) });
  });
  return T;
}

// applies automation for this step, returns the filter multiplier
function applyAuto(c, g, p, s, t, tb) {
  const sa = song.mode === 'song' ? song.sauto : {};
  const has = Object.keys(p.auto).length > 0 || Object.keys(sa).length > 0;
  if (!has && !g.dirty) return song.cutMul;
  g.dirty = has;
  let fm = song.cutMul;
  autoTargets().forEach(T => {
    const span = T.hi - T.lo, a = p.auto[T.id], raw = a ? a[s] : null, sv = sa[T.id], bv = sv ? sv[tb] : null;
    let x = T.base(), nx = null;
    if (raw != null) {
      x = T.lo + raw * span;
      const nr = p.curve && p.curve[T.id] === 'smooth' ? a[s + 1] : null;
      if (nr != null) nx = T.lo + nr * span;
    } else if (bv != null) {               // song automation glides to the next bar
      const nb = sv[tb + 1] != null ? sv[tb + 1] : bv, f = (s % STEPS) / STEPS, d = 1 / STEPS;
      x = T.lo + (bv + (nb - bv) * f) * span;
      nx = T.lo + (bv + (nb - bv) * (f + d)) * span;
    }
    if (T.id === 'filter') fm = x; else T.set(g, x, t, nx, t + secPerStep());
  });
  return fm;
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

// play the loaded sample or the built-in sound
function drumHit(c, out, i, t, vel) {
  const buf = song.drums[i].sample ? drumBufs[i] : null;
  if (!buf) return drum(c, out, song.drums[i].name, t, vel);
  const src = c.createBufferSource(), g = c.createGain();
  src.buffer = buf;
  g.gain.value = vel;
  src.connect(g); g.connect(out);
  src.start(t);
}


const NOPAT = { auto: {}, curve: {} };

// s is the step in the bar, k is the bar of the pattern, tb is the bar on the timeline
function queueStep(c, g, s, t, p, b, lap, k = 0) {
  const ps = k * STEPS + s, tb = song.mode === 'song' ? b : lap;
  const fm = applyAuto(c, g, p || NOPAT, ps, t, tb);
  if (p) {
    if (p.drums[0][ps]) duckAll(g, t);
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
  if (metro && s % BEAT === 0) click(c, g.in, t, s === 0);
  if (s === 0) playClips(c, g, t, tb);
}

function auditionNote(m, vel = 100) {
  startAudio();
  playNote(ctx, strip(graph, 't' + song.sel).in, m, ctx.currentTime, 0.25, curTrack(), vel, 1);
}

const startBar = () => (song.mode === 'song' && song.loop.on ? song.loop.a : 0);
const patternAt = b => (song.mode === 'song' ? song.patterns[song.arr[b]] || null : curPat());

// which bar of a long pattern is playing
function sliceAt(b, lap) {
  if (song.mode !== 'song') return lap % curPat().bars;
  let n = 0;
  while (b - n - 1 >= 0 && song.arr[b - n - 1] === song.arr[b]) n++;
  return n % (patternAt(b) ? patternAt(b).bars : 1);
}

function advanceBar() {
  loopNo++;
  if (song.mode !== 'song') return;
  bar++;
  const end = song.loop.on ? song.loop.b : songEnd();
  if (bar >= end) bar = song.loop.on ? song.loop.a : 0;
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
  paintArrHead(b === undefined ? -1 : b, sb);
}