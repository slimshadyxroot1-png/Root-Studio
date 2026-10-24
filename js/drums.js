// drum sounds, load your own sample and edit the velocity of each hit

blankSong().drums.forEach((d, i) => $('drumSel').add(new Option(d.name, i)));
const drumIdx = () => +$('drumSel').value || 0;

function syncDrumUi() {
  $('dlabel').textContent = song.drums[drumIdx()].sample || 'built-in sound';
  paintDVel();
}

function paintDVel() {
  const el = $('dvel'), row = curPat().drums[drumIdx()];
  el.style.width = PSTEPS * 24 + 'px';
  el.style.gridTemplateColumns = `repeat(${PSTEPS}, 1fr)`;
  el.innerHTML = range(PSTEPS).map(s =>
    `<div data-s="${s}">${row[s] ? `<i style="height:${row[s] / 127 * 100}%"></i>` : ''}</div>`).join('');
}

let dvDrag = false;
function dvPoint(e) {
  const el = $('dvel'), r = el.getBoundingClientRect(), row = curPat().drums[drumIdx()];
  const s = Math.min(PSTEPS - 1, Math.max(0, Math.floor((e.clientX - r.left) / r.width * PSTEPS)));
  if (!row[s]) return;                           // only existing hits have a velocity
  row[s] = Math.round(Math.min(127, Math.max(1, (r.bottom - e.clientY) / r.height * 127)));
  syncRack();
}
$('dvel').addEventListener('pointerdown', e => {
  pushUndo();
  dvDrag = true;
  $('dvel').setPointerCapture(e.pointerId);
  dvPoint(e);
});
$('dvel').addEventListener('pointermove', e => { if (dvDrag) dvPoint(e); });
$('dvel').addEventListener('pointerup', () => { dvDrag = false; });
$('drumSel').addEventListener('input', syncDrumUi);

$('dload').addEventListener('click', () => $('dfile').click());
$('dfile').addEventListener('change', async e => {
  const f = e.target.files[0], i = drumIdx();
  e.target.value = '';
  if (!f) return;
  try {
    startAudio();
    const buf = await ctx.decodeAudioData(await f.arrayBuffer());
    pushUndo();
    drumBufs[i] = buf;
    song.drums[i].sample = f.name;
    kv('put', 'drum' + i, toWav(buf));
    syncDrumUi();
    drumHit(ctx, strip(graph, 'd' + i).in, i, ctx.currentTime, 1);
    say(song.drums[i].name + ' now plays ' + f.name + '. It is saved with the song.');
  } catch (err) {
    say('Could not read that audio file.');
  }
});
$('dclear').addEventListener('click', () => {
  pushUndo();
  song.drums[drumIdx()].sample = '';
  kv('del', 'drum' + drumIdx());
  syncDrumUi();
});
// load saved drum samples from the browser
async function ensureBuffers() {
  for (let i = 0; i < song.drums.length; i++) {
    if (!song.drums[i].sample || drumBufs[i]) continue;
    const blob = await kv('get', 'drum' + i);
    if (blob) { try { drumBufs[i] = await decodeBlob(blob); } catch (err) { /* unreadable */ } }
  }
}