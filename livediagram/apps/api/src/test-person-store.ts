import { DatabaseSync } from 'node:sqlite';
import { PersonStore } from './person-store/person-store';
import { nodeItemSql, nodeTransaction } from '@liveworkspace/index-app/testing';
import type { Env } from './types';

// env.PERSON_STORE for node tests: one real PersonStore per person id, each on its own in-memory node:sqlite
// database, built the first time the id is reached. `deleteAll` starts that person's database over, as the
// runtime's does. Not a `.test.ts` file, so vitest doesn't collect it as a suite.
export function testPersonStores(): DurableObjectNamespace<PersonStore> & {
  databaseOf(personId: string): DatabaseSync | undefined;
} {
  const stores = new Map<string, { store: PersonStore; db: DatabaseSync }>();
  const storeOf = (name: string) => {
    let entry = stores.get(name);
    if (!entry) {
      const holder = { db: new DatabaseSync(':memory:') };
      const storage = {
        get sql() {
          return nodeItemSql(holder.db);
        },
        transactionSync: <T>(fn: () => T): T => nodeTransaction(holder.db)(fn),
        deleteAll: async () => {
          holder.db.close();
          holder.db = new DatabaseSync(':memory:');
        },
      };
      const store = new PersonStore(
        { storage } as unknown as DurableObjectState,
        {} as unknown as Env,
      );
      entry = {
        store,
        get db() {
          return holder.db;
        },
      };
      stores.set(name, entry);
    }
    return entry;
  };
  const ns = {
    idFromName: (name: string) => ({ name, toString: () => name }) as unknown as DurableObjectId,
    get: (id: DurableObjectId) => storeOf(String(id)).store,
    databaseOf: (personId: string) => stores.get(personId)?.db,
  };
  return ns as unknown as DurableObjectNamespace<PersonStore> & {
    databaseOf(personId: string): DatabaseSync | undefined;
  };
}
