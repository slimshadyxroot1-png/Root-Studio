// synth with two oscillators, a filter, an amp envelope and an lfo





// a plain voice: one oscillator and a short envelope
function playNote(c, out, midi, t, dur, tr, vel) {
  const o = c.createOscillator(), g = c.createGain(), peak = 0.35 * vel / 100;
  o.type = tr.wave;
  o.frequency.value = 440 * Math.pow(2, (midi - 69) / 12);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(peak, t + 0.01);
  g.gain.setTargetAtTime(0, t + dur, 0.06);
  o.connect(g); g.connect(out);
  o.start(t); o.stop(t + dur + 0.5);
}
