// synth with two oscillators, a filter, an amp envelope and an lfo

const SYNTH_KNOBS = [
  ['mix', 'Osc mix', 0, 1, 0.01], ['detune', 'Detune', 0, 50, 1], ['octave', 'Osc 2 octave', -2, 2, 1],
  ['cutoff', 'Cutoff', 100, 12000, 10], ['res', 'Resonance', 0, 20, 0.1], ['envAmt', 'Filter env', 0, 8000, 50],
  ['a', 'Attack', 0.001, 1.5, 0.001], ['d', 'Decay', 0.01, 1.5, 0.01], ['s', 'Sustain', 0, 1, 0.01],
  ['r', 'Release', 0.01, 2, 0.01], ['lfoRate', 'LFO rate', 0.1, 12, 0.1], ['lfoDepth', 'LFO depth', 0, 100, 1],
];
const SHAPES = ['sawtooth', 'square', 'triangle', 'sine'];

const SYNTH_PRESETS = {
  Lead: { wave: 'sawtooth', osc2: 'square', mix: 0.35, detune: 7, octave: 0, cutoff: 4200, res: 1, envAmt: 0, a: 0.01, d: 0.3, s: 0.7, r: 0.2, lfoRate: 5, lfoDepth: 0 },
  Pad: { wave: 'sawtooth', osc2: 'triangle', mix: 0.5, detune: 12, octave: 0, cutoff: 1800, res: 1, envAmt: 600, a: 0.5, d: 0.6, s: 0.8, r: 1.2, lfoRate: 4, lfoDepth: 8 },
  Bass: { wave: 'square', osc2: 'sawtooth', mix: 0.4, detune: 4, octave: -1, cutoff: 700, res: 6, envAmt: 2500, a: 0.005, d: 0.18, s: 0.4, r: 0.1, lfoRate: 5, lfoDepth: 0 },
  Pluck: { wave: 'triangle', osc2: 'sawtooth', mix: 0.3, detune: 3, octave: 1, cutoff: 600, res: 3, envAmt: 5000, a: 0.002, d: 0.15, s: 0, r: 0.2, lfoRate: 5, lfoDepth: 0 },
};

function makeOsc(c, type, hz, cents, t, end, extra, p) {
  const o = c.createOscillator();
  o.frequency.value = hz;
  o.detune.value = cents;
  o.type = type;
  o.start(t); o.stop(end);
  return o;
}

// tr is the track, vel is 1-127, fm is the filter multiplier from automation
// dur null means the note is held until it is released
function playNote(c, out, midi, t, dur, tr, vel, fm = 1) {
  const p = tr.synth, hz = 440 * Math.pow(2, (midi - 69) / 12), hold = dur === null, extra = [], osc = [];
  const end = hold ? t + 120 : t + dur + p.r * 2 + 0.1;
  const f = c.createBiquadFilter(), amp = c.createGain(), n = 1;
  // osc 1 and osc 2, each with n unison voices
  const layer = (type, mult, cents, gain) => range(n).forEach(i => {
    const spread = n === 1 ? 0 : (i / (n - 1) - 0.5) * 2 * p.uniDet;
    const o = makeOsc(c, type, hz * mult, cents + spread, t, end, extra, p), g = c.createGain();
    g.gain.value = gain / Math.sqrt(n);
    o.connect(g); g.connect(f); osc.push(o);
  });
  layer(tr.wave, 1, -p.detune, 1 - p.mix);
  layer(p.osc2, Math.pow(2, p.octave), p.detune, p.mix);

  const cut = p.cutoff * fm;
  f.type = 'lowpass';
  f.Q.value = p.res;
  f.frequency.setValueAtTime(Math.min(18000, cut + p.envAmt), t);
  f.frequency.setTargetAtTime(cut, t, p.d / 3 + 0.01);

  const peak = 0.35 * vel / 100;
  amp.gain.setValueAtTime(0.0001, t);
  amp.gain.linearRampToValueAtTime(peak, t + p.a);
  amp.gain.setTargetAtTime(peak * p.s, t + p.a, p.d / 3 + 0.01);
  if (!hold) amp.gain.setTargetAtTime(0, t + dur, p.r / 3 + 0.005);
  f.connect(amp); amp.connect(out);

  if (p.lfoDepth > 0) {
    const lfo = c.createOscillator(), depth = c.createGain();
    lfo.frequency.value = p.lfoRate;
    depth.gain.value = p.lfoDepth;
    lfo.connect(depth); osc.forEach(o => depth.connect(o.detune));
    lfo.start(t); lfo.stop(end);
    extra.push(lfo);
  }
  if (hold) {
    return () => {
      const now = c.currentTime;
      amp.gain.cancelScheduledValues(now);
      amp.gain.setTargetAtTime(0, now, p.r / 3 + 0.005);
      [...osc, ...extra].forEach(o => { try { o.stop(now + p.r * 2 + 0.1); } catch (err) { /* already stopped */ } });
    };
  }
}

function buildSynth() {
  $('synth').innerHTML =
    `<label class="sk">Osc 2 shape<select id="osc2">${SHAPES.map(w => `<option value="${w}">${w}</option>`).join('')}</select></label>` +
    SYNTH_KNOBS.map(([k, label, min, max, step]) =>
      `<label class="sk">${label}<input type="range" data-k="${k}" min="${min}" max="${max}" step="${step}"><output></output></label>`).join('');
  Object.keys(SYNTH_PRESETS).forEach(n => $('synthPreset').add(new Option(n, n)));
}

function syncSynth() {
  const p = curTrack().synth;
  $('osc2').value = p.osc2;
  document.querySelectorAll('#synth input[data-k]').forEach(el => {
    el.value = p[el.dataset.k];
    el.nextElementSibling.textContent = +(+el.value).toFixed(2);
  });
}

$('synth').addEventListener('pointerdown', () => pushUndo(), true);
$('synth').addEventListener('input', e => {
  const p = curTrack().synth;
  if (e.target.id === 'osc2') p.osc2 = e.target.value;
  else if (e.target.dataset.k) {
    p[e.target.dataset.k] = +e.target.value;
    e.target.nextElementSibling.textContent = +(+e.target.value).toFixed(2);
  }
});
$('synth').addEventListener('change', () => auditionNote(60));   // hear the change when you let go

$('synthPreset').addEventListener('input', e => {
  const preset = SYNTH_PRESETS[e.target.value];
  e.target.value = '';
  if (!preset) return;
  pushUndo();
  const { wave, ...rest } = preset;
  curTrack().wave = wave;
  Object.assign(curTrack().synth, SYNTH_DEFAULT, rest);
  applySong();
  auditionNote(60);
});

buildSynth();