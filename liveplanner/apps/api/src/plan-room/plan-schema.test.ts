import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import { nodeItemSql } from '@liveworkspace/index-app/testing';
import { migratePlanSchema, PLAN_SCHEMA_VERSION } from './plan-schema';

// A step, once shipped, is never edited (plan-schema.ts): a plan that already ran it would never see the change.
// The tab-shares tables were once written into V1, so plans made before then failed every write and preview with
// "no such table: share_outbox". These pin that a plan at any earlier version gains them.
describe('migratePlanSchema', () => {
  const tables = (sql: DatabaseSync) =>
    sql
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
      .all()
      .map((r) => r.name as string);

  it('gives a plan made at version 4, without the tab-shares tables, both of them', () => {
    const sql = new DatabaseSync(':memory:');
    const exec = nodeItemSql(sql);
    migratePlanSchema((q) => exec.exec(q));
    // As a plan from before: its tables gone and its version back at 4.
    sql.exec('DROP TABLE share_outbox; DROP TABLE tab_shares; UPDATE _plan_schema SET version = 4');
    expect(tables(sql)).not.toContain('share_outbox');

    migratePlanSchema((q) => exec.exec(q));
    expect(tables(sql)).toEqual(expect.arrayContaining(['share_outbox', 'tab_shares']));
    const version = sql.prepare('SELECT version FROM _plan_schema').get()!.version;
    expect(version).toBe(PLAN_SCHEMA_VERSION);
  });

  it('runs again harmlessly on a plan that already has them', () => {
    const sql = new DatabaseSync(':memory:');
    const exec = nodeItemSql(sql);
    migratePlanSchema((q) => exec.exec(q));
    sql.exec('UPDATE _plan_schema SET version = 4');
    expect(() => migratePlanSchema((q) => exec.exec(q))).not.toThrow();
  });
});
