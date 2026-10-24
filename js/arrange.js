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
$('patBars').addEventListener('input', e => { pushUndo(); curPat().bars = +e.target.value; showPattern(); });
$('patNew').addEventListener('click', () => {
  pushUndo();
  song.patterns.push(blankPattern('Pattern ' + (song.patterns.length + 1), song.tracks.length));
  song.cur = song.patterns.length - 1;
  showPattern();
});
$('patClone').addEventListener('click', () => {
  pushUndo();
  const c = JSON.parse(JSON.stringify(curPat()));
  c.name += ' copy';
  song.patterns.push(c);
  song.cur = song.patterns.length - 1;
  showPattern();
});
$('patRename').addEventListener('click', () => {
  const name = prompt('Pattern name', curPat().name);
  if (name) { pushUndo(); curPat().name = name; fillPatterns(); }
});
$('patDel').addEventListener('click', () => {
  if (song.patterns.length < 2) return say('A song needs at least one pattern.');
  pushUndo();
  const i = song.cur;
  song.patterns.splice(i, 1);
  song.arr = song.arr.map(p => (p === i ? -1 : p > i ? p - 1 : p));
  song.cur = Math.min(song.cur, song.patterns.length - 1);
  showPattern();
  paintArr();
});

$('sig').addEventListener('input', e => {
  pushUndo();
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
  paintSauto();
}

function paintArrHead(b, sb) {
  moveAudioHead(b, sb);
  document.querySelectorAll('#arr b.now').forEach(e => e.classList.remove('now'));
  if (b >= 0 && song.mode === 'song' && $('arr').children[b]) $('arr').children[b].classList.add('now');
}

let arrDrag = null;
$('arr').addEventListener('pointerdown', e => {
  const b = e.target.closest('b');
  if (!b) return;
  pushUndo();
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

function fillTracks() {
  const sel = $('trackSel');
  sel.length = 0;
  song.tracks.forEach((t, i) => sel.add(new Option(t.name, i)));
  sel.value = song.sel;
  $('trackName').value = curTrack().name;
}

function selectTrack(i) {
  song.sel = i;
  $('trackSel').value = i;
  $('trackName').value = curTrack().name;
  $('wave').value = curTrack().wave;
  syncSynth();
  syncRack();
  paintRoll();
}

$('trackSel').addEventListener('input', e => selectTrack(+e.target.value));
$('trackName').addEventListener('input', e => {
  curTrack().name = e.target.value;
  $('trackSel').options[song.sel].text = e.target.value;
  syncRack();
  syncMixer();
  fillAutoTargets();
});
$('addTrack').addEventListener('click', () => {
  if (song.tracks.length >= 8) return say('Eight tonal tracks is the limit.');
  pushUndo();
  song.tracks.push(blankTrack('Track ' + (song.tracks.length + 1)));
  song.patterns.forEach(p => p.notes.push({}));
  song.sel = song.tracks.length - 1;
  applySong();
});
$('delTrack').addEventListener('click', () => {
  if (song.tracks.length < 2) return say('Keep at least one tonal track.');
  pushUndo();
  const i = song.sel;
  song.tracks.splice(i, 1);
  const remap = src => {                  // automation ids of later tracks move down by one
    const auto = {};
    for (const id in src) {
      const m = /^(vol|pan)(\d+)$/.exec(id);
      if (!m || +m[2] < i) auto[id] = src[id];
      else if (+m[2] > i) auto[m[1] + (+m[2] - 1)] = src[id];
    }
    return auto;
  };
  song.patterns.forEach(p => { p.notes.splice(i, 1); p.auto = remap(p.auto); });
  song.sauto = remap(song.sauto);
  song.sel = Math.min(i, song.tracks.length - 1);
  applySong();
});

// automation lane

function fillAutoTargets() {
  ['autoTarget', 'sTarget'].forEach(id => {
    const sel = $(id), cur = sel.value;
    sel.length = 0;
    autoTargets().forEach(t => sel.add(new Option(t.label, t.id)));
    if ([...sel.options].some(o => o.value === cur)) sel.value = cur;
  });
}

function paintAuto() {
  const id = $('autoTarget').value, T = autoTargets().find(t => t.id === id);
  const a = curPat().auto[id], lane = $('autolane');
  $('autoCurve').value = (curPat().curve || {})[id] || 'step';
  lane.style.gridTemplateColumns = `repeat(${PSTEPS}, 1fr)`;
  const base = T ? (T.base() - T.lo) / (T.hi - T.lo) : 0;
  lane.innerHTML = range(PSTEPS).map(s => {
    const v = a ? a[s] : null;
    return `<div data-s="${s}" class="ac${s % BEAT === 0 ? ' beat' : ''}">${v != null ? `<i style="height:${v * 100}%"></i>` : ''}</div>`;
  }).join('') + `<u style="bottom:${Math.min(1, Math.max(0, base)) * 100}%"></u>`;
}

let autoDrag = false;
function autoPoint(e) {
  const r = $('autolane').getBoundingClientRect(), id = $('autoTarget').value, p = curPat();
  const s = Math.min(PSTEPS - 1, Math.max(0, Math.floor((e.clientX - r.left) / r.width * PSTEPS)));
  if (!p.auto[id]) p.auto[id] = Array(MAXSTEPS).fill(null);
  p.auto[id][s] = e.shiftKey ? null : Math.min(1, Math.max(0, (r.bottom - e.clientY) / r.height));
  if (p.auto[id].every(v => v == null)) delete p.auto[id];
  paintAuto();
}
$('autolane').addEventListener('pointerdown', e => {
  pushUndo();
  autoDrag = true;
  $('autolane').setPointerCapture(e.pointerId);
  autoPoint(e);
});
$('autolane').addEventListener('pointermove', e => { if (autoDrag) autoPoint(e); });
$('autolane').addEventListener('pointerup', () => { autoDrag = false; });
$('autoTarget').addEventListener('input', paintAuto);
$('autoCurve').addEventListener('input', e => {
  const p = curPat();
  p.curve = p.curve || {};
  p.curve[$('autoTarget').value] = e.target.value;
});
$('autoClear').addEventListener('click', () => {
  pushUndo();
  delete curPat().auto[$('autoTarget').value];
  paintAuto();
});

// song automation

function paintSauto() {
  const a = song.sauto[$('sTarget').value];
  $('sauto').innerHTML = range(BARS).map(i =>
    `<b data-i="${i}">${a && a[i] != null ? `<i style="height:${a[i] * 100}%"></i>` : ''}</b>`).join('');
}

let sDrag = false;
function sautoPoint(e) {
  const r = $('sauto').getBoundingClientRect(), id = $('sTarget').value;
  const i = Math.min(BARS - 1, Math.max(0, Math.floor((e.clientX - r.left) / r.width * BARS)));
  if (!song.sauto[id]) song.sauto[id] = Array(BARS).fill(null);
  song.sauto[id][i] = e.shiftKey ? null : Math.min(1, Math.max(0, (r.bottom - e.clientY) / r.height));
  if (song.sauto[id].every(v => v == null)) delete song.sauto[id];
  paintSauto();
}
$('sauto').addEventListener('pointerdown', e => {
  pushUndo();
  sDrag = true;
  $('sauto').setPointerCapture(e.pointerId);
  sautoPoint(e);
});
$('sauto').addEventListener('pointermove', e => { if (sDrag) sautoPoint(e); });
$('sauto').addEventListener('pointerup', () => { sDrag = false; });
$('sTarget').addEventListener('input', paintSauto);
$('sClear').addEventListener('click', () => { pushUndo(); delete song.sauto[$('sTarget').value]; paintSauto(); });