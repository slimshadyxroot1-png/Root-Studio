// editing tools: undo, tap tempo, metronome, recording, scale tools, chords, euclid, export

// undo and redo

const undoStack = [], redoStack = [];

function pushUndo() {
  undoStack.push(JSON.stringify(song));
  if (undoStack.length > 100) undoStack.shift();
  redoStack.length = 0;
}

function travel(from, to) {
  if (!from.length) return say('Nothing to ' + (from === undoStack ? 'undo' : 'redo') + '.');
  to.push(JSON.stringify(song));
  song = JSON.parse(from.pop());
  applySong();
}

// capture phase so the snapshot is taken before the edit
function watch(id, type, selector) {
  $(id).addEventListener(type, e => { if (e.target.closest(selector)) pushUndo(); }, true);
}
watch('rack', 'pointerdown', '.steps:not(.ro) b');
watch('grid', 'pointerdown', '.c');
watch('presets', 'click', 'button');

$('undo').addEventListener('click', () => travel(undoStack, redoStack));
$('redo').addEventListener('click', () => travel(redoStack, undoStack));
document.addEventListener('keydown', e => {
  if (!(e.ctrlKey || e.metaKey)) return;
  const k = e.key.toLowerCase();
  if (k === 'z') {
    e.preventDefault();
    if (e.shiftKey) travel(redoStack, undoStack); else travel(undoStack, redoStack);
  } else if (k === 'y') {
    e.preventDefault();
    travel(redoStack, undoStack);
  } else if (k === 's') {
    e.preventDefault();
    saveFile();
  }
});