// channel rack

const isTrk = ch => String(ch)[0] === 't';
const channel = ch => (isTrk(ch) ? song.tracks[+String(ch).slice(1)] : song.drums[+ch]);
const hasStart = (notes, s) => Object.keys(notes).some(k => +k.split(':')[0] === s);

function buildRack() {
  const cells = () => range(PSTEPS).map(s => `<b data-s="${s}" class="g${Math.floor(s / BEAT) % 2}"></b>`).join('');
  const rowHtml = (ch, ro) => `
    <div class="row" data-ch="${ch}">
      <button class="led" title="Mute" aria-label="Mute"></button>
      <button class="name" title="Click to preview"></button>
      <input class="vol" type="range" min="0" max="100" title="Volume">
      <div class="steps${ro ? ' ro' : ''}">${cells()}</div>
    </div>`;
  $('rack').innerHTML =
    `<div class="row ruler"><span></span><div class="steps">${range(PSTEPS).map(s =>
      `<i data-s="${s}">${s % BEAT === 0 ? s / BEAT + 1 : ''}</i>`).join('')}</div></div>` +
    song.drums.map((d, i) => rowHtml(i, false)).join('') +
    song.tracks.map((t, i) => rowHtml('t' + i, true)).join('');
}

function syncRack() {
  const p = curPat();
  document.querySelectorAll('#rack .row[data-ch]').forEach(row => {
    const ch = row.dataset.ch, t = channel(ch), tr = isTrk(ch);
    row.classList.toggle('sel', tr && +ch.slice(1) === song.sel);
    row.querySelector('.name').textContent = t.name;
    row.querySelector('.led').classList.toggle('lit', !t.mute);
    row.querySelector('.vol').value = t.vol * 100;
    const notes = tr ? p.notes[+ch.slice(1)] : null;
    row.querySelectorAll('.steps b').forEach((b, s) => {
      const v = tr ? 0 : p.drums[+ch][s];
      b.classList.toggle('on', tr ? hasStart(notes, s) : !!v);
      b.style.opacity = v ? 0.45 + 0.55 * v / 127 : '';
    });
  });
}

let drag = null;
window.addEventListener('pointerup', () => { drag = null; });

function setDrumStep(ch, s, v) {
  curPat().drums[ch][s] = v ? song.vel : 0;
  syncRack();
  if (v && !playing) {
    startAudio();
    drumHit(ctx, strip(graph, 'd' + ch).in, +ch, ctx.currentTime, 1);
  }
}

const rack = $('rack');
rack.addEventListener('pointerdown', e => {
  const b = e.target.closest('.steps:not(.ro) b');
  if (!b) return;
  const ch = +b.closest('.row').dataset.ch, s = +b.dataset.s;
  drag = { kind: 'rack', mode: curPat().drums[ch][s] ? 0 : 1 };
  setDrumStep(ch, s, drag.mode);
});
rack.addEventListener('pointerover', e => {
  if (!drag || drag.kind !== 'rack') return;
  const b = e.target.closest('.steps:not(.ro) b');
  if (b) setDrumStep(+b.closest('.row').dataset.ch, +b.dataset.s, drag.mode);
});
rack.addEventListener('click', e => {
  const row = e.target.closest('.row[data-ch]');
  if (!row) return;
  const ch = row.dataset.ch;
  if (e.target.closest('.led')) {
    channel(ch).mute = !channel(ch).mute;
    syncRack();
    syncMixer();
  } else if (e.target.closest('.name')) {
    startAudio();
    if (isTrk(ch)) { selectTrack(+ch.slice(1)); auditionNote(60); }
    else drumHit(ctx, strip(graph, 'd' + ch).in, +ch, ctx.currentTime, 1);
  }
});
rack.addEventListener('input', e => {
  if (!e.target.classList.contains('vol')) return;
  const ch = e.target.closest('.row').dataset.ch;
  channel(ch).vol = e.target.value / 100;
  syncMixer();
  syncGraph();
});