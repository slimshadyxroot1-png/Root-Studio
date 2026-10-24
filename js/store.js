// storage helpers, indexeddb for autosave and base64 for the song file

const idb = new Promise(res => {
  try {
    const r = indexedDB.open('root-studio', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('kv');
    r.onsuccess = () => res(r.result);
    r.onerror = () => res(null);
  } catch (err) { res(null); }
});

async function kv(mode, key, val) {
  const d = await idb;
  if (!d) return undefined;
  return new Promise(res => {
    try {
      const st = d.transaction('kv', mode === 'get' ? 'readonly' : 'readwrite').objectStore('kv');
      const q = mode === 'get' ? st.get(key) : mode === 'put' ? st.put(val, key) : st.delete(key);
      q.onsuccess = () => res(q.result);
      q.onerror = () => res(undefined);
    } catch (err) { res(undefined); }
  });
}

const blobToB64 = blob => new Promise(res => {
  const f = new FileReader();
  f.onload = () => res(f.result.split(',')[1]);
  f.readAsDataURL(blob);
});

function b64ToBlob(s) {
  const bin = atob(s), u = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  return new Blob([u], { type: 'audio/wav' });
}

async function decodeBlob(blob) {
  const c = (typeof ctx !== 'undefined' && ctx) || new OfflineAudioContext(1, 1, 44100);
  return c.decodeAudioData(await blob.arrayBuffer());
}

// decoded audio for clips and drum samples
const clipBufs = {}, drumBufs = [];