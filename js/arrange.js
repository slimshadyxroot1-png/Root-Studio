// playlist, patterns, loop, tracks and automation

const hue = i => `hsl(${(i * 67) % 360} 45% 36%)`;

function applySig() {
  const [n, d] = song.sig.split('/').map(Number);
  STEPS = Math.min(MAXSTEPS, n * 16 / d);
  BEAT = 16 / d;
  PSTEPS = Math.min(MAXSTEPS, STEPS * curPat().bars);
  buildRack();
  buildRoll();
}

// patterns

function fillPatterns() {
  const sel = $('patSel');
  sel.length = 0;
  song.patterns.forEach((p, i) => sel.add(new Option((i + 1) + ': ' + p.name, i)));
  sel.value = song.cur;
  $('patBars').value = curPat().bars;
  $('mode').textContent = song.mode === 'song' ? 'Song mode' : 'Pattern mode';
  $('mode').classList.toggle('active', song.mode === 'song');
  $('loopOn').classList.toggle('active', song.loop.on);
  $('loopA').value = song.loop.a + 1;
  $('loopB').value = song.loop.b;
}

function showPattern() { applySig(); fillPatterns(); syncRack(); paintRoll(); }

$('mode').addEventListener('click', () => {
  song.mode = song.mode === 'song' ? 'pattern' : 'song';
  if (!playing) stop();
  fillPatterns();
});
$('patSel').addEventListener('input', e => { song.cur = +e.target.value; showPattern(); });
$('patBars').addEventListener('input', e => { curPat().bars = +e.target.value; showPattern(); });
$('patNew').addEventListener('click', () => {
  song.patterns.push(blankPattern('Pattern ' + (song.patterns.length + 1), song.tracks.length));
  song.cur = song.patterns.length - 1;
  showPattern();
});
$('patClone').addEventListener('click', () => {
  const c = JSON.parse(JSON.stringify(curPat()));
  c.name += ' copy';
  song.patterns.push(c);
  song.cur = song.patterns.length - 1;
  showPattern();
});
$('patRename').addEventListener('click', () => {
  const name = prompt('Pattern name', curPat().name);
  if (name) { curPat().name = name; fillPatterns(); }
});
$('patDel').addEventListener('click', () => {
  if (song.patterns.length < 2) return say('A song needs at least one pattern.');
  const i = song.cur;
  song.patterns.splice(i, 1);
  song.arr = song.arr.map(p => (p === i ? -1 : p > i ? p - 1 : p));
  song.cur = Math.min(song.cur, song.patterns.length - 1);
  showPattern();
  paintArr();
});

$('sig').addEventListener('input', e => {
  stop();
  song.sig = e.target.value;
  applySig();
  syncRack();
  paintRoll();
});

$('loopOn').addEventListener('click', () => { song.loop.on = !song.loop.on; fillPatterns(); paintArr(); });
$('loopA').addEventListener('change', e => {
  song.loop.a = Math.min(BARS - 1, Math.max(0, (+e.target.value || 1) - 1));
  song.loop.b = Math.max(song.loop.b, song.loop.a + 1);
  fillPatterns(); paintArr();
});
$('loopB').addEventListener('change', e => {
  song.loop.b = Math.min(BARS, Math.max(song.loop.a + 1, +e.target.value || 1));
  fillPatterns(); paintArr();
});

// playlist

function paintBar(i) {
  const b = $('arr').children[i], p = song.arr[i];
  b.textContent = p >= 0 ? p + 1 : '';
  b.style.background = p >= 0 ? hue(p) : '';
}

function paintArr() {
  $('arrruler').innerHTML = range(BARS).map(i => `<i data-i="${i}" title="Click: loop start. Shift+click: loop end">${i + 1}</i>`).join('');
  $('arr').innerHTML = range(BARS).map(i => `<b data-i="${i}"></b>`).join('');
  range(BARS).forEach(paintBar);
  [...$('arr').children].forEach((b, i) =>
    b.classList.toggle('lp', song.loop.on && i >= song.loop.a && i < song.loop.b));
}

function paintArrHead(b, sb) {
  document.querySelectorAll('#arr b.now').forEach(e => e.classList.remove('now'));
  if (b >= 0 && song.mode === 'song' && $('arr').children[b]) $('arr').children[b].classList.add('now');
}

let arrDrag = null;
$('arr').addEventListener('pointerdown', e => {
  const b = e.target.closest('b');
  if (!b) return;
  const i = +b.dataset.i;
  arrDrag = song.arr[i] === song.cur ? -1 : song.cur;
  const n = arrDrag < 0 ? 1 : curPat().bars;       // a long pattern fills as many bars as it is long
  for (let j = 0; j < n && i + j < BARS; j++) { song.arr[i + j] = arrDrag; paintBar(i + j); }
});
$('arr').addEventListener('pointerover', e => {
  const b = e.target.closest('b');
  if (arrDrag === null || !b) return;
  song.arr[+b.dataset.i] = arrDrag;
  paintBar(+b.dataset.i);
});
window.addEventListener('pointerup', () => { arrDrag = null; });

$('arrruler').addEventListener('click', e => {
  const el = e.target.closest('i');
  if (!el) return;
  const n = +el.dataset.i;
  if (e.shiftKey) song.loop.b = Math.max(n + 1, song.loop.a + 1);
  else { song.loop.a = n; song.loop.b = Math.max(song.loop.b, n + 1); }
  song.loop.on = true;
  fillPatterns();
  paintArr();
});

// tracks


function selectTrack(i) {
  song.sel = i;
  $('wave').value = curTrack().wave;
  syncRack();
  paintRoll();
}