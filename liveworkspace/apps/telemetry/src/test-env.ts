// A test Env: an in-memory stand-in for D1 that records every insert and answers the summary's
// query from what was inserted, plus the assets binding.

import { assertD1Compound } from '@liveworkspace/api-kit/d1-compound-guard';
import type { Env } from './env';

export type Row = {
  app: string;
  category: string;
  action: string;
  type: string | null;
  ts: number;
};

export function testEnv(overrides: Partial<Env> = {}): Env & { rows: Row[] } {
  const rows: Row[] = [];
  const run = (sql: string, args: unknown[]) => {
    if (sql.startsWith('INSERT')) {
      const [app, category, action, type, ts] = args as [
        string,
        string,
        string,
        string | null,
        number,
      ];
      rows.push({ app, category, action, type, ts });
      return { meta: { changes: 1 }, results: [] };
    }
    if (sql.startsWith('DELETE')) {
      const cutoff = args[0] as number;
      const before = rows.length;
      for (let i = rows.length - 1; i >= 0; i--) if (rows[i]!.ts < cutoff) rows.splice(i, 1);
      return { meta: { changes: before - rows.length }, results: [] };
    }
    // The grouped per-day query.
    const [app, since] = (args.length === 2 ? args : [null, args[0]]) as [string | null, number];
    const groups = new Map<string, Record<string, unknown>>();
    for (const r of rows) {
      if (r.ts < since || (app && r.app !== app)) continue;
      const day = new Date(r.ts).toISOString().slice(0, 10);
      const key = [day, r.app, r.category, r.action, r.type].join('|');
      const g = groups.get(key) ?? {
        day,
        app: r.app,
        category: r.category,
        action: r.action,
        type: r.type,
        count: 0,
      };
      g.count = (g.count as number) + 1;
      groups.set(key, g);
    }
    return { meta: { changes: 0 }, results: [...groups.values()] };
  };
  type Stmt = { sql: string; args: unknown[] };
  const db = {
    // D1 refuses a compound SELECT of more than five terms; this stand-in runs no SQL, so it checks the text.
    prepare: (sql: string) => {
      assertD1Compound(sql);
      const bound = (args: unknown[]) => ({
        sql,
        args,
        all: async () => run(sql, args),
        run: async () => run(sql, args),
      });
      return { ...bound([]), bind: (...args: unknown[]) => bound(args) };
    },
    batch: async (stmts: Stmt[]) => stmts.map((s) => run(s.sql, s.args)),
  };
  return {
    ENVIRONMENT: 'development',
    TELEMETRY_ENABLED: 'true',
    TELEMETRY_DB: db as unknown as D1Database,
    TELEMETRY_KEY_LIVEDIAGRAM: 'ld-key',
    TELEMETRY_KEY_LIVEPLANNER: 'lp-key',
    ...overrides,
    rows,
  };
}
