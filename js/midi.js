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