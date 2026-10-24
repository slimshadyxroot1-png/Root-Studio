// audio tracks: record or load clips, then move, trim, cut and stretch them

const PXBAR = 64, RULER = 18, LANE = 52;      // pixels per bar, ruler height, track height
let recorder = null, micStream = null, takeChunks = [], asel = 0, aDrag = null, latency = 0, bufCount = 0;
const peaks = {};                             // loudest sample of each block, by buffer id

const recordingNow = () => recorder && recorder.state === 'recording';
const newBufId = () => 'b' + Date.now().toString(36) + (bufCount++);
const clipSteps = c => c.dur / c.rate / secPerStep();      // clip length in steps

function addClipBuffer(buf) {
  const id = newBufId();
  clipBufs[id] = buf;
  kv('put', 'buf:' + id, toWav(buf));
  return id;
}

function peaksOf(id) {
  if (peaks[id]) return peaks[id];
  const buf = clipBufs[id];
  if (!buf) return null;
  const d = buf.getChannelData(0), out = new Float32Array(Math.ceil(d.length / 256));
  for (let i = 0; i < d.length; i++) {
    const v = Math.abs(d[i]);
    if (v > out[i >> 8]) out[i >> 8] = v;
  }
  return (peaks[id] = out);
}

// playback, called at the start of every bar

function playClips(c, g, t, tb) {
  const sps = secPerStep(), bs = tb * STEPS, be = bs + STEPS;
  song.audioTracks.forEach((at, i) => {
    if (!audible('a' + i)) return;
    at.clips.forEach(cl => {
      const buf = clipBufs[cl.buf];
      if (!buf) return;
      const t0 = Math.max(cl.start, bs), t1 = Math.min(cl.start + clipSteps(cl), be);
      if (t1 <= t0) return;
      const src = c.createBufferSource();
      src.buffer = buf;
      src.playbackRate.value = cl.rate;
      src.connect(strip(g, 'a' + i).in);
      src.start(t + (t0 - bs) * sps, cl.off + (t0 - cl.start) * sps * cl.rate, (t1 - t0) * sps * cl.rate);
    });
  });
}

// drawing

function buildAudio() {
  asel = Math.min(asel, song.audioTracks.length - 1);
  const labels = $('alabels');
  labels.innerHTML = '';
  song.audioTracks.forEach((t, i) => {
    const d = document.createElement('div');
    d.className = 'alabel' + (i === asel ? ' sel' : '');
    d.textContent = t.name;
    d.title = 'Click to select. Double-click to rename.';
    d.addEventListener('click', () => { asel = i; buildAudio(); });
    d.addEventListener('dblclick', () => {
      const n = prompt('Track name', t.name);
      if (n) { pushUndo(); t.name = n; buildAudio(); syncMixer(); }
    });
    labels.append(d);
  });
  drawAudio();
}

function drawAudio() {
  const cv = $('aview'), w = BARS * PXBAR, h = RULER + song.audioTracks.length * LANE;
  if (cv.width !== w) cv.width = w;
  if (cv.height !== h) cv.height = h;
  const g = cv.getContext('2d'), px = PXBAR / STEPS;
  g.fillStyle = '#1b1f22';
  g.fillRect(0, 0, w, h);
  g.font = '10px sans-serif';
  for (let b = 0; b < BARS; b++) {
    g.fillStyle = '#2d3337';
    g.fillRect(b * PXBAR, 0, 1, h);
    g.fillStyle = '#808a91';
    g.fillText(b + 1, b * PXBAR + 3, 12);
  }
  song.audioTracks.forEach((t, i) => {
    const y = RULER + i * LANE;
    g.fillStyle = '#14171a';
    g.fillRect(0, y + LANE - 1, w, 1);
    t.clips.forEach(c => {
      const x = c.start * px, cw = Math.max(2, clipSteps(c) * px), buf = clipBufs[c.buf];
      g.fillStyle = '#2f3d22';
      g.fillRect(x, y + 2, cw, LANE - 5);
      g.strokeStyle = '#9ccc3c';
      g.strokeRect(x + 0.5, y + 2.5, cw - 1, LANE - 6);
      if (!buf) return;
      const pk = peaksOf(c.buf), bps = buf.sampleRate / 256;
      g.fillStyle = '#ff8c1a';
      for (let j = 0; j < cw; j++) {
        const b0 = Math.floor((c.off + j / cw * c.dur) * bps), b1 = Math.max(b0, Math.floor((c.off + (j + 1) / cw * c.dur) * bps));
        let m = 0;
        for (let q = b0; q <= b1 && q < pk.length; q++) m = Math.max(m, pk[q]);
        const bh = Math.max(1, m * (LANE - 9));
        g.fillRect(x + j, y + LANE / 2 - bh / 2, 1, bh);
      }
    });
  });
}

function moveAudioHead(b, sb) {
  const el = $('aplayhead');
  if (b < 0 || sb === undefined) { el.style.display = 'none'; return; }
  el.style.display = 'block';
  el.style.left = ((b + sb / STEPS) * PXBAR) + 'px';
}

// mouse editing

const snapStep = x => {
  const q = { bar: STEPS, beat: BEAT, step: 1 }[$('asnap').value];
  return Math.round(x / q) * q;
};

function aPoint(e) {
  const r = $('aview').getBoundingClientRect();
  return { x: (e.clientX - r.left) / PXBAR * STEPS, ti: Math.floor((e.clientY - r.top - RULER) / LANE) };
}

function cutClip(tr, c, at) {
  const rel = at - c.start;
  if (rel < 1 || rel > clipSteps(c) - 1) return say('Click inside the clip, away from its ends, to cut it.');
  const d1 = rel * secPerStep() * c.rate;
  tr.clips.push({ ...c, start: at, off: c.off + d1, dur: c.dur - d1 });
  c.dur = d1;
}

$('aview').addEventListener('pointerdown', e => {
  const { x, ti } = aPoint(e);
  if (ti < 0 || ti >= song.audioTracks.length) return;
  if (asel !== ti) { asel = ti; buildAudio(); }
  const tr = song.audioTracks[ti], c = tr.clips.find(k => x >= k.start && x < k.start + clipSteps(k));
  if (!c) return;
  const tool = $('atool').value, len = clipSteps(c), rel = x - c.start, edge = 6 / (PXBAR / STEPS);
  pushUndo();
  if (tool === 'delete') { tr.clips.splice(tr.clips.indexOf(c), 1); return drawAudio(); }
  if (tool === 'cut') { cutClip(tr, c, snapStep(x)); return drawAudio(); }
  const mode = tool === 'stretch' ? 'stretch' : rel < edge ? 'trimL' : rel > len - edge ? 'trimR' : 'move';
  aDrag = { c, tr, mode, x0: x, start0: c.start, off0: c.off, dur0: c.dur, len0: len };
  $('aview').setPointerCapture(e.pointerId);
});

$('aview').addEventListener('pointermove', e => {
  const d = aDrag;
  if (!d) return;
  const { x, ti } = aPoint(e), sps = secPerStep(), c = d.c, buf = clipBufs[c.buf], dx = x - d.x0;
  const newLen = () => Math.max(1, snapStep(d.start0 + d.len0 + dx) - d.start0);
  if (d.mode === 'move') {
    c.start = Math.max(0, snapStep(d.start0 + dx));
    if (ti >= 0 && ti < song.audioTracks.length && song.audioTracks[ti] !== d.tr) {   // dragged onto another track
      d.tr.clips.splice(d.tr.clips.indexOf(c), 1);
      d.tr = song.audioTracks[ti];
      d.tr.clips.push(c);
      asel = ti;
    }
  } else if (d.mode === 'trimR') {
    c.dur = Math.max(0.02, Math.min(newLen() * sps * c.rate, buf.duration - c.off));
  } else if (d.mode === 'trimL') {
    const k = sps * c.rate;
    let delta = snapStep(d.start0 + dx) - d.start0;
    delta = Math.max(delta, -d.start0, -d.off0 / k);
    delta = Math.min(delta, (d.dur0 - 0.02) / k);
    c.start = d.start0 + delta;
    c.off = d.off0 + delta * k;
    c.dur = d.dur0 - delta * k;
  } else {                       // stretch, the pitch changes too
    c.rate = Math.min(4, Math.max(0.25, d.dur0 / (newLen() * sps)));
  }
  drawAudio();
});

$('aview').addEventListener('pointerup', () => { if (aDrag) { aDrag = null; buildAudio(); } });

// tracks, loading and recording

$('aadd').addEventListener('click', () => {
  if (song.audioTracks.length >= 8) return say('Eight audio tracks is the limit.');
  pushUndo();
  song.audioTracks.push(blankAudio('Audio ' + (song.audioTracks.length + 1)));
  asel = song.audioTracks.length - 1;
  applySong();
});
$('adel').addEventListener('click', () => {
  if (song.audioTracks.length < 2) return say('Keep at least one audio track.');
  pushUndo();
  song.audioTracks.splice(asel, 1);
  asel = Math.min(asel, song.audioTracks.length - 1);
  applySong();
});

const startStep = () => (song.mode === 'song' ? startBar() : 0) * STEPS;

async function loadAudio(file) {
  startAudio();
  try {
    const buf = await ctx.decodeAudioData(await file.arrayBuffer());
    pushUndo();
    song.audioTracks[asel].clips.push({ buf: addClipBuffer(buf), start: startStep(), off: 0, dur: buf.duration, rate: 1 });
    drawAudio();
    say('Loaded ' + file.name + ' into ' + song.audioTracks[asel].name + '. Drag it to move it.');
  } catch (err) {
    say('Could not read that audio file.');
  }
}

async function startVoiceRecord() {
  try {
    micStream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }
    });
  } catch (err) {
    say('Microphone is blocked. Allow access in the browser to record.');
    return;
  }
  startAudio();
  takeChunks = [];
  recorder = new MediaRecorder(micStream);
  const target = song.audioTracks[asel], start = startStep();
  recorder.ondataavailable = e => takeChunks.push(e.data);
  recorder.onstop = async () => {
    micStream.getTracks().forEach(t => t.stop());
    $('vrec').classList.remove('active');
    $('vrec').textContent = 'Record';
    const buf = await ctx.decodeAudioData(await new Blob(takeChunks).arrayBuffer());
    const off = Math.min(latency / 1000, buf.duration / 2);        // cut the latency off the start
    pushUndo();
    target.clips.push({ buf: addClipBuffer(buf), start, off, dur: buf.duration - off, rate: 1 });
    drawAudio();
    say('Recorded ' + buf.duration.toFixed(1) + ' seconds onto ' + target.name + '.');
  };
  stop();
  recorder.start();
  play();
  $('vrec').classList.add('active');
  $('vrec').textContent = 'Stop recording';
  say('Recording onto ' + target.name + '. Use headphones so the song does not leak into the take.');
}

function stopVoiceRecord() {
  if (recordingNow()) recorder.stop();
}

// load saved clips and drum samples from the browser
async function ensureBuffers() {
  for (const id of new Set(song.audioTracks.flatMap(t => t.clips.map(c => c.buf)))) {
    if (clipBufs[id]) continue;
    const blob = await kv('get', 'buf:' + id);
    if (blob) { try { clipBufs[id] = await decodeBlob(blob); } catch (err) { /* unreadable */ } }
  }
  for (let i = 0; i < song.drums.length; i++) {
    if (!song.drums[i].sample || drumBufs[i]) continue;
    const blob = await kv('get', 'drum' + i);
    if (blob) { try { drumBufs[i] = await decodeBlob(blob); } catch (err) { /* unreadable */ } }
  }
  drawAudio();
}

$('vrec').addEventListener('click', () => (recordingNow() ? stopVoiceRecord() : startVoiceRecord()));
$('stop').addEventListener('click', stopVoiceRecord);
$('aopen').addEventListener('click', () => $('afile').click());
$('afile').addEventListener('change', e => { if (e.target.files[0]) loadAudio(e.target.files[0]); e.target.value = ''; });
$('vlat').addEventListener('input', e => { latency = +e.target.value || 0; });
$('bpm').addEventListener('change', drawAudio);