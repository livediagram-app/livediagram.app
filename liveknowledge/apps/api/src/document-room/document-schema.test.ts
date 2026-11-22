import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import { AUTOMATION_SCHEMA_STEPS } from '@liveworkspace/automations/room';
import { nodeItemSql } from '@liveworkspace/index-app/testing';
import { migrateDocumentSchema } from './document-schema';

// The document's schema holds every table the Automations engine reads: a room's restore reads `automation_wake`
// (and the rest) on every wake, so a step the package adds and this list misses fails every write with
// "no such table".

const tablesOf = (raw: DatabaseSync): Set<string> =>
  new Set(
    raw
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
      .all()
      .map((r) => String(r.name)),
  );

describe('the document schema', () => {
  it('makes every table the Automations engine has', () => {
    const engine = new DatabaseSync(':memory:');
    const engineExec = nodeItemSql(engine);
    for (const step of AUTOMATION_SCHEMA_STEPS) {
      if (typeof step.run === 'string') engine.exec(step.run);
      else step.run((q: string) => engineExec.exec(q));
    }
    const raw = new DatabaseSync(':memory:');
    const sql = nodeItemSql(raw);
    migrateDocumentSchema((q: string) => sql.exec(q));
    const ours = tablesOf(raw);
    const missing = [...tablesOf(engine)].filter((t) => !ours.has(t));
    expect(missing).toEqual([]);
    expect(ours.has('automation_wake')).toBe(true);
  });
});
