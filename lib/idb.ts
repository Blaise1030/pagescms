import { openDB, type IDBPDatabase } from "idb";

const DB_NAME = "pagescms";
const DB_VERSION = 2;
const DRAFT_STORE = "file-drafts";

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDb(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(DRAFT_STORE)) db.createObjectStore(DRAFT_STORE);
      },
    });
  }
  return dbPromise;
}

async function idbGet(store: string, key: string): Promise<Record<string, unknown> | undefined> {
  try { return (await getDb()).get(store, key); } catch { return undefined; }
}

async function idbSet(store: string, key: string, value: Record<string, unknown>): Promise<void> {
  try { await (await getDb()).put(store, value, key); } catch { /* non-fatal */ }
}

async function idbDel(store: string, key: string): Promise<void> {
  try { await (await getDb()).delete(store, key); } catch { /* non-fatal */ }
}

export function idbCacheKey(owner: string, repo: string, branch: string, path: string): string {
  return `${owner.toLowerCase()}/${repo.toLowerCase()}/${branch}/${path}`;
}

export const getFileDraft = (key: string) => idbGet(DRAFT_STORE, key);
export const setFileDraft = (key: string, value: Record<string, unknown>) => idbSet(DRAFT_STORE, key, value);
export const deleteFileDraft = (key: string) => idbDel(DRAFT_STORE, key);
