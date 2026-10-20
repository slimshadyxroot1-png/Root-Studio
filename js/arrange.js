// playlist, patterns, loop, tracks and automation


function applySig() {
  const [n, d] = song.sig.split('/').map(Number);
  STEPS = Math.min(MAXSTEPS, n * 16 / d);
  BEAT = 16 / d;
  PSTEPS = Math.min(MAXSTEPS, STEPS * curPat().bars);
  buildRack();
  buildRoll();
}



// tracks


function selectTrack(i) {
  song.sel = i;
  $('wave').value = curTrack().wave;
  syncRack();
  paintRoll();
}