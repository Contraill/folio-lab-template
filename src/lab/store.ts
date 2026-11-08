/* Runs kept in this browser (IndexedDB), so a run survives a reload. Folio serves the app from its own site, so the
   runs are the same framed in Folio and opened in a tab; the database is named after the app's place in Folio, so
   two lab apps never share one. It can be cleared at any time: export a run to keep it. */
import type { Run } from './types.ts';

import { namespace } from './folio.ts';

const DB = `${namespace()}runs`;
const STORE = 'runs';

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' }).createIndex('experiment', 'experiment');
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, work: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  try {
    return await new Promise<T>((resolve, reject) => {
      const t = db.transaction(STORE, mode);
      const req = work(t.objectStore(STORE));
      t.oncomplete = () => resolve(req.result);
      t.onerror = t.onabort = () => reject(t.error ?? req.error);
    });
  } finally { db.close(); }
}

export const listRuns = <C, S>(experiment: string) =>
  tx<Run<C, S>[]>('readonly', (s) => s.index('experiment').getAll(experiment)).then((runs) => runs.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));
export const putRun = <C, S>(run: Run<C, S>) => tx('readwrite', (s) => s.put(run));
export const deleteRun = (id: string) => tx('readwrite', (s) => s.delete(id));
