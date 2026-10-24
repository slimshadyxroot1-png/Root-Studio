const MAXSTEPS = 128, ROWS = 60, LOW = 36, BARS = 32;   // piano roll covers C2 to B6
let STEPS = 16, BEAT = 4, PSTEPS = 16;   // steps per bar, steps per beat, steps in the open pattern
const SIGS = ['2/4', '3/4', '4/4', '5/4', '6/8', '7/8', '12/8'];
const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const BLACK = new Set([1, 3, 6, 8, 10]);
const SCALES = {
  Chromatic: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
  Major: [0, 2, 4, 5, 7, 9, 11],
  Minor: [0, 2, 3, 5, 7, 8, 10],
  'Minor pentatonic': [0, 3, 5, 7, 10]
};
const KEYMAP = 'zsxdcvgbhnjm,';

const $ = id => document.getElementById(id);
const range = n => [...Array(n).keys()];
const midiOf = row => LOW + ROWS - 1 - row;
const rowOf = midi => LOW + ROWS - 1 - midi;
const pat = str => range(MAXSTEPS).map(i => (str[i] === 'x' ? 100 : 0));
const note = (l = 1, v = 100) => ({ l, v });     // length in steps, velocity 1-127

const SYNTH_DEFAULT = {
  osc2: 'square', mix: 0.35, detune: 7, octave: 0, cutoff: 4200, res: 1, envAmt: 0,
  a: 0.01, d: 0.3, s: 0.7, r: 0.2, lfoRate: 5, lfoDepth: 0,
};

const blankTrack = name => ({
  name: name || 'Track 1', wave: 'sawtooth', synth: { ...SYNTH_DEFAULT },
  vol: 0.5, pan: 0, mute: false, solo: false, rev: 0.4, del: 1, fx: 'none', fxAmt: 0.5
});
// a pattern has drum steps, notes per track as step:row, and automation
const blankPattern = (name, tracks) => ({
  name, bars: 1, drums: range(6).map(() => Array(MAXSTEPS).fill(0)),
  notes: range(tracks).map(() => ({})), auto: {}, curve: {}
});

function blankSong() {
  return {
    name: 'Untitled', bpm: 128, swing: 0, master: 0.8, delay: 0.2, reverb: 0.25, room: 2, drive: 0,
    eq: { low: 0, mid: 0, high: 0 }, kit: 'Retro', len: 1, vel: 100, root: 0, scale: 'Minor',
    sig: '4/4', mode: 'pattern', loop: { on: false, a: 0, b: 4 }, sel: 0, cur: 0,
    drums: ['Kick', 'Snare', 'Hi-hat', 'Open hat', 'Clap', 'Tom'].map(name => ({ name, vol: 0.8, pan: 0, mute: false, solo: false, rev: 0.15, del: 1, fx: 'none', fxAmt: 0.5, sample: '' })),
    sauto: {}, ccmap: {}, cutMul: 1,
    tracks: [blankTrack('Track 1')],
    patterns: [blankPattern('Pattern 1', 1)],
    arr: range(BARS).map(i => (i < 4 ? 0 : -1))      // playlist: pattern index per bar, -1 = empty
  };
}

const curPat = () => song.patterns[song.cur];
const curTrack = () => song.tracks[song.sel];
const curNotes = () => curPat().notes[song.sel];
// strip keys: t0 is a track, d0 a drum, a0 an audio track
const stripOf = key => ({ t: song.tracks, d: song.drums }[key[0]] || [])[+key.slice(1)];
const allKeys = () => [...song.tracks.map((_, i) => 't' + i), ...song.drums.map((_, i) => 'd' + i)];
function songEnd() {
  let e = 0;
  song.arr.forEach((p, i) => { if (p >= 0) e = i + 1; });
  return Math.max(1, e);
}
function audible(key) {
  const any = allKeys().some(k => stripOf(k).solo);
  return any ? !!stripOf(key).solo : !stripOf(key).mute;
}

function setDrums(s, ...rows) {
  rows.forEach((r, i) => { s.patterns[0].drums[i] = pat(r || ''); });
}

const presets = {
  'Four on the floor'(s) {
    setDrums(s, 'x...x...x...x...', '....x.......x...', 'x.x.x.x.x.x.x.x.', '..x...x...x...x.', '....x.......x...');
    [[0, 48], [3, 48], [6, 51], [8, 48], [11, 55], [14, 51]].forEach(([st, m]) => {
      s.patterns[0].notes[0][st + ':' + rowOf(m)] = note();
    });
  },
  'Hip hop'(s) {
    setDrums(s, 'x.....x.x.......', '....x.......x...', 'x.x.x.x.x.x.x.x.', '');
    s.bpm = 90; s.swing = 0.3;
  },
  'Empty'() {}
};

let song = blankSong();
presets['Four on the floor'](song);


const KITS = {
  Retro:    { kickFrom: 160, kickTo: 42, kickLen: 0.45, snareLen: 0.2,  clapLen: 0.2 },
  '80s':    { kickFrom: 200, kickTo: 48, kickLen: 0.5,  snareLen: 0.45, clapLen: 0.35 },
  Acoustic: { kickFrom: 120, kickTo: 55, kickLen: 0.6,  snareLen: 0.25, clapLen: 0.2 }
};