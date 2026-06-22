import { openDB } from "idb";
import type { PersistedClient, Persister } from "@tanstack/react-query-persist-client";

const DB_NAME = "pagescms-query-cache-db";
const STORE = "cache";

function getDb() {
  return openDB(DB_NAME, 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    },
  });
}

export function createIDBPersister(key: string): Persister {
  return {
    persistClient: async (client: PersistedClient) => {
      const db = await getDb();
      await db.put(STORE, client, key);
    },
    restoreClient: async () => {
      const db = await getDb();
      return (await db.get(STORE, key)) as PersistedClient | undefined;
    },
    removeClient: async () => {
      const db = await getDb();
      await db.delete(STORE, key);
    },
  };
}
