// IndexedDB: 'kv' trzyma cały stan aplikacji, 'photos' trzyma zdjęcia jako Bloby.
const DB_NAME = 'silownia';
let dbPromise;

function open() {
  dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore('kv');
      req.result.createObjectStore('photos');
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

async function run(store, mode, fn) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, mode);
    const req = fn(tx.objectStore(store));
    tx.oncomplete = () => resolve(req?.result);
    tx.onerror = () => reject(tx.error);
  });
}

export const kvGet = key => run('kv', 'readonly', s => s.get(key));
export const kvSet = (key, value) => run('kv', 'readwrite', s => s.put(value, key));

export const photoGet = id => run('photos', 'readonly', s => s.get(id));
export const photoSet = (id, blob) => run('photos', 'readwrite', s => s.put(blob, id));
export const photoDel = id => run('photos', 'readwrite', s => s.delete(id));
export const photoClear = () => run('photos', 'readwrite', s => s.clear());

/** Prosi przeglądarkę, żeby nie czyściła danych przy braku miejsca. */
export async function persist() {
  try { return await navigator.storage?.persist?.(); } catch { return false; }
}
