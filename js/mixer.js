// mixer

const FXS = ['none', 'chorus', 'flanger', 'phaser', 'sidechain'];
const stripName = k => stripOf(k).name;

// master controls: key, label, min, max
const MFX = [['low', 'EQ low', -12, 12], ['mid', 'EQ mid', -12, 12], ['high', 'EQ high', -12, 12],
  ['reverb', 'Reverb', 0, 100], ['room', 'Room size', 5, 40], ['drive', 'Drive', 0, 100]];
const EQK = new Set(['low', 'mid', 'high']);
const getM = k => (EQK.has(k) ? song.eq[k] : k === 'reverb' ? song.reverb * 100 : k === 'room' ? song.room * 10 : song.drive * 100);
function setM(k, v) {
  if (EQK.has(k)) song.eq[k] = v;
  else if (k === 'reverb') song.reverb = v / 100;
  else if (k === 'room') song.room = v / 10;
  else song.drive = v / 100;
}

function buildMixer() {
  const knob = (f, label, min, max) =>
    `<label>${label}<input type="range" data-f="${f}" min="${min}" max="${max}"></label>`;
  const keys = allKeys();
  $('mixer').innerHTML = keys.map(k => `
    <div class="mx" data-k="${k}"><div class="mn"></div>
      <div class="mf"><input class="fader" type="range" min="0" max="100" data-f="vol" title="Volume"><div class="meter"><i></i></div></div>
      ${knob('pan', 'Pan', -100, 100)}${knob('rev', 'Reverb', 0, 100)}${knob('del', 'Delay', 0, 100)}
      <select data-f="fx" title="Insert effect">${FXS.map(x => `<option>${x}</option>`).join('')}</select>${knob('fxAmt', 'FX amount', 0, 100)}
      <div class="mb"><button data-b="mute" title="Mute">M</button><button data-b="solo" title="Solo">S</button></div>
    </div>`).join('') + `
    <div class="mx master" data-k="master"><div class="mn">Master</div>
      <div class="mf"><div class="meter"><i></i></div></div>
      ${MFX.map(([k, label, min, max]) =>
        `<label>${label}<input type="range" data-m="${k}" min="${min}" max="${max}"></label>`).join('')}
    </div>`;
  syncMixer();
}

function syncMixer() {
  document.querySelectorAll('#mixer .mx:not(.master)').forEach(el => {
    const k = el.dataset.k;
    if (!stripOf(k)) return;
    const m = stripOf(k);
    el.querySelector('.mn').textContent = stripName(k);
    el.querySelectorAll('input[data-f]').forEach(i => { i.value = m[i.dataset.f] * 100; });
    el.querySelector('select[data-f]').value = m.fx;
    ['mute', 'solo'].forEach(b => el.querySelector(`[data-b=${b}]`).classList.toggle('active', !!m[b]));
  });
  document.querySelectorAll('#mixer [data-m]').forEach(i => { i.value = getM(i.dataset.m); });
}

$('mixer').addEventListener('pointerdown', () => pushUndo(), true);
$('mixer').addEventListener('input', e => {
  const el = e.target, mx = el.closest('.mx');
  if (el.dataset.f === 'fx') stripOf(mx.dataset.k).fx = el.value;
  else if (el.dataset.f) { stripOf(mx.dataset.k)[el.dataset.f] = +el.value / 100; syncRack(); }
  else if (el.dataset.m) setM(el.dataset.m, +el.value);
  syncGraph();
});
$('mixer').addEventListener('click', e => {
  const b = e.target.closest('[data-b]');
  if (!b) return;
  const m = stripOf(b.closest('.mx').dataset.k);
  m[b.dataset.b] = !m[b.dataset.b];
  syncMixer();
  syncRack();
});

// meters

const mbuf = new Uint8Array(256), levels = {};
function peakOf(an) {
  an.getByteTimeDomainData(mbuf);
  let p = 0;
  for (let i = 0; i < mbuf.length; i++) p = Math.max(p, Math.abs(mbuf[i] - 128));
  return p / 128;
}

function meters() {
  if (graph) {
    document.querySelectorAll('#mixer .mx').forEach(el => {
      const k = el.dataset.k, an = k === 'master' ? graph.an : graph.strips[k] && graph.strips[k].an;
      if (!an) return;
      levels[k] = Math.max(peakOf(an), (levels[k] || 0) * 0.9);
      const bar = el.querySelector('.meter i'), v = Math.min(1, levels[k] * 1.2);
      bar.style.height = v * 100 + '%';
      bar.classList.toggle('hot', v > 0.9);
    });
  }
  requestAnimationFrame(meters);
}