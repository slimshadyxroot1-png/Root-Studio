// midi keyboard input, needs web midi (chrome, edge, opera)
// notes play on the selected track and get written into the roll when rec is on

const held = {};

function midiOn(n, v) {
  startAudio();
  if (held[n]) held[n]();
  held[n] = playNote(ctx, strip(graph, 't' + song.sel).in, n, ctx.currentTime, null, curTrack(), v, 1);
  recordNote(n, v);
}

function midiOff(n) {
  if (held[n]) { held[n](); delete held[n]; }
}

function onMidi(e) {
  const [status, n, v] = e.data, cmd = status & 0xF0;
  if (cmd === 0x90 && v > 0) midiOn(n, v);
  else if (cmd === 0x80 || (cmd === 0x90 && v === 0)) midiOff(n);
  else if (cmd === 0xB0 && n === 123) Object.keys(held).forEach(k => midiOff(+k));   // all notes off
  else if (cmd === 0xB0) onCC(n, v);
}

function initMidi() {
  const label = $('midi');
  if (!navigator.requestMIDIAccess) { label.textContent = 'MIDI: not supported in this browser'; return; }
  navigator.requestMIDIAccess().then(access => {
    const hook = () => {
      const names = [];
      access.inputs.forEach(input => { input.onmidimessage = onMidi; names.push(input.name); });
      label.textContent = 'MIDI: ' + (names.length ? names.join(', ') : 'no keyboard found');
    };
    hook();
    access.onstatechange = hook;
  }).catch(() => { label.textContent = 'MIDI: access blocked'; });
}

// midi knobs and faders

let learning = false;

function liveSet(id, x) {
  if (id === 'master') song.master = x;
  else if (id === 'reverb') song.reverb = x;
  else if (id === 'delay') song.delay = x;
  else if (id === 'filter') song.cutMul = x;
  else {
    const m = /^(vol|pan)(\d+)$/.exec(id);
    if (m && song.tracks[+m[2]]) song.tracks[+m[2]][m[1]] = x;
  }
  $('master').value = song.master * 100;
  $('delay').value = song.delay * 100;
  syncGraph();
  syncMixer();
  syncRack();
}

function onCC(cc, v) {
  if (learning) {
    const id = $('autoTarget').value, T = autoTargets().find(t => t.id === id);
    song.ccmap[cc] = id;
    learning = false;
    $('ccLearn').classList.remove('active');
    say('CC ' + cc + ' now controls ' + (T ? T.label : id) + '.');
    return;
  }
  const id = song.ccmap[cc], T = id && autoTargets().find(t => t.id === id);
  if (!T) return;
  liveSet(id, T.lo + v / 127 * (T.hi - T.lo));
  if (recording && playing && headStep >= 0) {      // with Rec on, moving the knob draws the automation
    const p = curPat();
    if (!p.auto[id]) p.auto[id] = Array(MAXSTEPS).fill(null);
    p.auto[id][headStep] = v / 127;
    paintAuto();
  }
}

$('ccLearn').addEventListener('click', e => {
  learning = !learning;
  e.currentTarget.classList.toggle('active', learning);
  say(learning ? 'Move a knob or fader on your MIDI controller. It will control the parameter chosen in Automation.' : 'MIDI learn off.');
});
$('ccClear').addEventListener('click', () => { song.ccmap = {}; say('MIDI mappings cleared.'); });