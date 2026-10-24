// Tests only (`@liveworkspace/index-app/testing`): node:sqlite stand-ins for what the kit's Durable Objects run on.
import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { nodeItemSql, nodeSql, nodeTransaction } from './test-sqlite';
import {
  WorkbenchCore,
  type WorkbenchHooks,
  type WorkbenchNamespace,
  type WorkbenchStorage,
  type WorkbenchStoreApi,
} from './workbench';

export { nodeItemSql, nodeSql, nodeTransaction };

// A Durable Object's storage over a fresh in-memory database: its SQL, its alarm and deleteAll.
export function memoryStorage(): WorkbenchStorage & { alarmAt: number | null } {
  let db = new DatabaseSync(':memory:');
  const storage = {
    sql: nodeSql(db),
    alarmAt: null as number | null,
    async getAlarm() {
      return storage.alarmAt;
    },
    async setAlarm(at: number) {
      storage.alarmAt = at;
    },
    async deleteAlarm() {
      storage.alarmAt = null;
    },
    async deleteAll() {
      db.close();
      db = new DatabaseSync(':memory:');
      storage.sql = nodeSql(db);
      storage.alarmAt = null;
    },
  };
  return storage;
}

type FakeId = { name: string; toString(): string; equals(other: FakeId): boolean };

const idOf = (hex: string): FakeId => ({
  name: hex,
  toString: () => hex,
  equals: (other) => other.toString() === hex,
});

// WORKBENCH as a test binds it: one store per person, in memory, ids as the runtime shapes them (64 hex).
export function memoryWorkbenchNamespace<S extends string = string>(
  hooks: WorkbenchHooks,
): WorkbenchNamespace & {
  stores: Map<string, { core: WorkbenchCore<S>; storage: ReturnType<typeof memoryStorage> }>;
  storeOf(personId: string): WorkbenchCore<S>;
} {
  const stores = new Map<
    string,
    { core: WorkbenchCore<S>; storage: ReturnType<typeof memoryStorage> }
  >();
  const ns = {
    stores,
    idFromName: (name: string) =>
      idOf(createHash('sha256').update(name).digest('hex')) as unknown as DurableObjectId,
    idFromString: (hex: string) => {
      if (!/^[0-9a-f]{64}$/.test(hex)) throw new TypeError('Invalid Durable Object ID');
      return idOf(hex) as unknown as DurableObjectId;
    },
    get(id: DurableObjectId): WorkbenchStoreApi<S> {
      const key = id.toString();
      let entry = stores.get(key);
      if (!entry) {
        const storage = memoryStorage();
        entry = { core: new WorkbenchCore<S>(storage, key, hooks), storage };
        stores.set(key, entry);
      }
      return entry.core;
    },
    storeOf(personId: string): WorkbenchCore<S> {
      return ns.get(ns.idFromName(personId)) as WorkbenchCore<S>;
    },
  };
  return ns;
}
