// Tests only: an item's SQLite as its room hands it, on node:sqlite, with every Automations table made. Not a
// `.test.ts` file, so vitest does not collect it.
import { DatabaseSync } from 'node:sqlite';
import { nodeItemSql } from '@liveworkspace/index-app/testing';
import { AUTOMATION_SCHEMA_STEPS } from './automation-schema';
import type { Sql } from './sql';

export function bareSql(): Sql {
  return nodeItemSql(new DatabaseSync(':memory:')) as unknown as Sql;
}

export function migrate(sql: Sql): void {
  const exec = (query: string) =>
    sql.exec(query) as unknown as { toArray(): Record<string, unknown>[] };
  for (const step of AUTOMATION_SCHEMA_STEPS) {
    if (typeof step.run === 'string') exec(step.run);
    else step.run(exec);
  }
}

export function testSql(): Sql {
  const sql = bareSql();
  migrate(sql);
  return sql;
}

export const rowsOf = (sql: Sql, query: string, ...bindings: unknown[]) =>
  sql.exec(query, ...bindings).toArray() as Record<string, unknown>[];

// A rule as the store reads one: a kind of trigger, on or off, and when it was last edited.
export type TestRule = {
  id: string;
  name: string;
  enabled: boolean;
  trigger: { kind: string };
  timeZone: string;
  edited: { at: number };
  paused?: { reason: string; at: number; webhook?: string; gone?: unknown };
};

export const testRule = (id: string, over: Partial<TestRule> = {}): TestRule => ({
  id,
  name: `Rule ${id}`,
  enabled: true,
  trigger: { kind: 'tab_added' },
  timeZone: 'UTC',
  edited: { at: 1 },
  ...over,
});
