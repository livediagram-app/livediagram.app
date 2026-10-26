// Tests only: the WORKBENCH namespace in memory, one store per person over node:sqlite, ids shaped as the runtime
// shapes them (64 hex), each store's alarm as a plain number, and a count of the calls made to the stores (what a
// Durable Object round trip would be). Not a .test.ts file, so vitest doesn't collect it.
import { createHash } from 'node:crypto';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { assertD1Compound } from '@liveworkspace/api-kit/d1-compound-guard';
import {
  WorkbenchCore,
  type SqlExec,
  type WorkbenchNamespace,
  type WorkbenchStorage,
} from './store.ts';

function nodeSql(db: DatabaseSync): SqlExec {
  return {
    exec(query: string, ...bindings: unknown[]) {
      assertD1Compound(query);
      const statement = db.prepare(query);
      const args = bindings.map((b) => (typeof b === 'boolean' ? Number(b) : b) as SQLInputValue);
      if (statement.columns().length === 0) {
        statement.run(...args);
        return { toArray: () => [] };
      }
      const rows = statement.all(...args).map((row) => ({ ...row }));
      return { toArray: () => rows };
    },
  };
}

export type MemoryStorage = WorkbenchStorage & { alarmAt: number | null; dropped: number };

export function memoryStorage(): MemoryStorage {
  let db = new DatabaseSync(':memory:');
  const storage: MemoryStorage = {
    sql: nodeSql(db),
    alarmAt: null,
    dropped: 0,
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
      storage.dropped++;
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

export type MemoryWorkbench = WorkbenchNamespace & {
  stores: Map<string, { core: WorkbenchCore; storage: MemoryStorage }>;
  // Every method called on any store, in order.
  calls: string[];
  entryOf(personId: string): { core: WorkbenchCore; storage: MemoryStorage };
};

export function memoryWorkbench(): MemoryWorkbench {
  const stores = new Map<string, { core: WorkbenchCore; storage: MemoryStorage }>();
  const calls: string[] = [];
  const entry = (key: string) => {
    let found = stores.get(key);
    if (!found) {
      const storage = memoryStorage();
      found = { core: new WorkbenchCore(storage, key), storage };
      stores.set(key, found);
    }
    return found;
  };
  const ns: MemoryWorkbench = {
    stores,
    calls,
    idFromName: (name: string) =>
      idOf(createHash('sha256').update(name).digest('hex')) as unknown as DurableObjectId,
    idFromString: (hex: string) => {
      if (!/^[0-9a-f]{64}$/.test(hex)) throw new TypeError('Invalid Durable Object ID');
      return idOf(hex) as unknown as DurableObjectId;
    },
    get(id: DurableObjectId) {
      const { core } = entry(id.toString());
      // A stub: each method call is one round trip.
      return new Proxy(core, {
        get(target, prop) {
          const value = Reflect.get(target, prop, target) as unknown;
          if (typeof value !== 'function') return value;
          return (...args: unknown[]) => {
            calls.push(String(prop));
            return (value as (...a: unknown[]) => unknown).apply(target, args);
          };
        },
      });
    },
    entryOf(personId: string) {
      return entry(ns.idFromName(personId).toString());
    },
  };
  return ns;
}
