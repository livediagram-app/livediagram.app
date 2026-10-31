// A PLAN_ROOM namespace for tests (docs/specs/015-api/api.md "Storage"): one real PlanRoom per name, each on its own
// in-memory SQLite (node:sqlite behind the SqlStorage surface), with the RPC calls the worker made. Not a `.test.ts`
// file, so vitest does not collect it; only tests import it.

import { DatabaseSync } from 'node:sqlite';
import { nodeItemSql, nodeTransaction } from '@liveworkspace/index-app/testing';
import type { Env } from '../types';
import { PlanRoom } from './plan-room';

export type Plan = { room: PlanRoom; db: DatabaseSync; transactions: number };

// The PLAN_ROOM namespace: one PlanRoom per name, each on its own database, with the calls the worker made.
export function planNamespace(envOf: () => Env) {
  const plans = new Map<string, Plan>();
  const calls: string[] = [];
  const open = (name: string): Plan => {
    const existing = plans.get(name);
    if (existing) return existing;
    const db = new DatabaseSync(':memory:');
    db.exec('PRAGMA foreign_keys = ON');
    const store = new Map<string, unknown>();
    const transaction = nodeTransaction(db);
    const plan = { db, transactions: 0 } as Plan;
    const id = {
      name,
      equals: (other: { name?: string }) => other?.name === name,
      toString: () => name,
    };
    const state = {
      id,
      storage: {
        sql: nodeItemSql(db),
        transactionSync: <T>(fn: () => T): T => {
          plan.transactions += 1;
          return transaction(fn);
        },
        get: async (key: string) => store.get(key),
        put: async (key: string, value: unknown) => void store.set(key, value),
        delete: async (key: string) => store.delete(key),
        list: async ({ prefix }: { prefix: string }) =>
          new Map([...store].filter(([key]) => key.startsWith(prefix))),
        setAlarm: async () => {},
        deleteAlarm: async () => {},
        // The runtime's deleteAll drops the SQLite database with the key-value pairs.
        deleteAll: async () => {
          store.clear();
          db.exec('PRAGMA foreign_keys = OFF');
          const tables = db
            .prepare(
              "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'",
            )
            .all();
          for (const t of tables) db.exec(`DROP TABLE IF EXISTS "${String(t.name)}"`);
          db.exec('PRAGMA foreign_keys = ON');
        },
      },
      sockets: [] as WebSocket[],
      acceptWebSocket(ws: WebSocket) {
        state.sockets.push(ws);
      },
      getWebSockets: () => [...state.sockets],
      blockConcurrencyWhile: async (fn: () => Promise<void>) => fn(),
      waitUntil: () => {},
    };
    plan.room = new PlanRoom(state as unknown as DurableObjectState, envOf());
    plans.set(name, plan);
    return plan;
  };
  const ns = {
    idFromName: (name: string) => ({ name, equals: (o: { name?: string }) => o?.name === name }),
    get: (id: { name: string }) => {
      const { room } = open(id.name);
      return new Proxy(room, {
        get(target, prop, receiver) {
          const value: unknown = Reflect.get(target, prop, receiver);
          if (typeof value !== 'function') return value;
          return (...args: unknown[]) => {
            calls.push(String(prop));
            return (value as (...a: unknown[]) => unknown).apply(target, args);
          };
        },
      });
    },
  };
  return { ns, plans, calls, open };
}
