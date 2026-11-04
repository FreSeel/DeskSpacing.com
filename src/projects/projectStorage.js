export function createProjectStorage({
  getIndexedDB = () => globalThis.indexedDB,
} = {}) {
  const storeName = 'projects';

  async function transaction(mode, run) {
    let db;
    try {
      db = await new Promise((resolve, reject) => {
        const indexedDB = getIndexedDB();
        if (!indexedDB)
          throw new Error('IndexedDB is unavailable in this browser.');
        const request = indexedDB.open('deskspacing-local-projects', 1);
        let blocked = false;
        request.onupgradeneeded = () =>
          request.result.createObjectStore(storeName);
        request.onblocked = () => {
          blocked = true;
          reject(new Error('Close other DeskSpacing tabs and try again.'));
        };
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          if (blocked) request.result.close();
          else resolve(request.result);
        };
      });
      return await new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, mode);
        const request = run(tx.objectStore(storeName));
        tx.onabort = () => reject(request.error || tx.error);
        tx.oncomplete = () => resolve(request.result);
      });
    } catch (cause) {
      const detail =
        cause?.name === 'QuotaExceededError'
          ? 'Browser storage is full. Free up space and try again.'
          : cause?.message || 'Browser storage is unavailable.';
      throw new Error(`Could not access local projects. ${detail}`, { cause });
    } finally {
      db?.close();
    }
  }

  return {
    write: (id, project) =>
      transaction('readwrite', (store) => store.put(project, id)),
    read: (id) => transaction('readonly', (store) => store.get(id)),
    list: () => transaction('readonly', (store) => store.getAllKeys()),
    delete: (id) => transaction('readwrite', (store) => store.delete(id)),
  };
}
