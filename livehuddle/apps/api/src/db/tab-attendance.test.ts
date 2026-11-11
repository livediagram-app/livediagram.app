import { DatabaseSync } from 'node:sqlite';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  ATTENDANCE_REJOIN_GRACE_MS,
  ATTENDANCE_RETENTION_MS,
  ATTENDANCE_TAB_MAX,
} from '@livehuddle/api-schema';
import { nodeItemSql } from '@liveworkspace/index-app/testing';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import { migrateDocumentSchema } from '../document-room/document-schema';
import { sqliteD1 } from '../test-sqlite-d1';
import {
  closeStaleVisits,
  deleteOldVisits,
  hasAttendanceTable,
  joinVisit,
  leaveVisit,
  listVisits,
  touchOpenVisits,
  type AttendanceSql,
} from './tab-attendance';

// A tab's visits (docs/specs/012-collaboration/tab-attendance.md; blueprint "Behaviour and state"): a join opens one, a
// leave ends it, a return inside the grace carries it on, the cap and the retention bound what is kept, and a restart's
// sweep closes what it left open.

const ADA = { name: 'Ada', color: '#0ea5e9', picture: null, guest: true };
const T0 = 1_800_000_000_000;
let db: DatabaseSync;
let sql: AttendanceSql;

const rows = () =>
  db.prepare('SELECT * FROM tab_attendance ORDER BY id').all() as Record<string, unknown>[];

beforeEach(() => {
  db = new DatabaseSync(':memory:');
  const item = nodeItemSql(db);
  migrateDocumentSchema((q) => item.exec(q));
  sql = item;
});

describe('a visit', () => {
  it('opens on a join and ends on a leave, keeping no id', () => {
    expect(joinVisit(sql, 't1', 'k-ada', ADA, T0)).toBe('inserted');
    expect(rows()).toEqual([
      expect.objectContaining({
        tab_id: 't1',
        person_key: 'k-ada',
        name: 'Ada',
        color: '#0ea5e9',
        picture: null,
        guest: 1,
        joined_at: T0,
        left_at: null,
        seen_at: T0,
      }),
    ]);
    leaveVisit(sql, 't1', 'k-ada', T0 + 60_000);
    expect(rows()[0]).toMatchObject({ left_at: T0 + 60_000, closed_at: T0 + 60_000 });
  });

  it('carries on when the person is back inside the grace, with their latest name', () => {
    joinVisit(sql, 't1', 'k-ada', ADA, T0);
    leaveVisit(sql, 't1', 'k-ada', T0 + 1_000);
    expect(
      joinVisit(
        sql,
        't1',
        'k-ada',
        { ...ADA, name: 'Ada L' },
        T0 + 1_000 + ATTENDANCE_REJOIN_GRACE_MS,
      ),
    ).toBe('reopened');
    expect(rows()).toHaveLength(1);
    expect(rows()[0]).toMatchObject({ name: 'Ada L', left_at: null, closed_at: null });
  });

  it('starts a new visit after the grace', () => {
    joinVisit(sql, 't1', 'k-ada', ADA, T0);
    leaveVisit(sql, 't1', 'k-ada', T0 + 1_000);
    expect(joinVisit(sql, 't1', 'k-ada', ADA, T0 + 1_001 + ATTENDANCE_REJOIN_GRACE_MS)).toBe(
      'inserted',
    );
    expect(rows()).toHaveLength(2);
  });

  it('refreshes a visit still open rather than opening a second', () => {
    joinVisit(sql, 't1', 'k-ada', ADA, T0);
    expect(joinVisit(sql, 't1', 'k-ada', { ...ADA, color: '#f00' }, T0 + 5)).toBe('open');
    expect(rows()).toHaveLength(1);
    expect(rows()[0]).toMatchObject({ color: '#f00', seen_at: T0 + 5 });
  });

  it('keeps people and tabs apart', () => {
    joinVisit(sql, 't1', 'k-ada', ADA, T0);
    joinVisit(sql, 't1', 'k-bo', { ...ADA, name: 'Bo' }, T0);
    joinVisit(sql, 't2', 'k-ada', ADA, T0);
    leaveVisit(sql, 't1', 'k-ada', T0 + 10);
    expect(rows().map((r) => [r.tab_id, r.person_key, r.left_at])).toEqual([
      ['t1', 'k-ada', T0 + 10],
      ['t1', 'k-bo', null],
      ['t2', 'k-ada', null],
    ]);
  });

  it('marks every open visit seen, and never a closed one', () => {
    joinVisit(sql, 't1', 'k-ada', ADA, T0);
    joinVisit(sql, 't1', 'k-bo', ADA, T0);
    leaveVisit(sql, 't1', 'k-bo', T0 + 1);
    touchOpenVisits(sql, T0 + 99);
    expect(rows().map((r) => r.seen_at)).toEqual([T0 + 99, T0 + 1]);
  });
});

describe('what is kept', () => {
  it('keeps a tab to its cap, the oldest going first', () => {
    for (let i = 0; i < ATTENDANCE_TAB_MAX + 3; i++) joinVisit(sql, 't1', `k${i}`, ADA, T0 + i);
    joinVisit(sql, 't2', 'other', ADA, T0);
    const kept = rows().filter((r) => r.tab_id === 't1');
    expect(kept).toHaveLength(ATTENDANCE_TAB_MAX);
    expect(kept[0]!.person_key).toBe('k3');
    // Another tab keeps its own.
    expect(rows().filter((r) => r.tab_id === 't2')).toHaveLength(1);
  });

  it('drops a tab’s visits past retention on the next join, never an open one', () => {
    joinVisit(sql, 't1', 'old', ADA, T0);
    leaveVisit(sql, 't1', 'old', T0 + 1);
    joinVisit(sql, 't1', 'still-here', ADA, T0);
    joinVisit(sql, 't1', 'new', ADA, T0 + 2 + ATTENDANCE_RETENTION_MS);
    expect(rows().map((r) => r.person_key)).toEqual(['still-here', 'new']);
  });

  it('sweeps every tab’s old visits on the upkeep, and reads none past retention', async () => {
    const { env, sql: raw } = sqliteD1();
    const item = nodeItemSql(raw);
    joinVisit(item, 't1', 'old', ADA, T0);
    leaveVisit(item, 't1', 'old', T0 + 1);
    joinVisit(item, 't2', 'recent', ADA, T0);
    leaveVisit(item, 't2', 'recent', T0 + ATTENDANCE_RETENTION_MS);
    const now = T0 + 2 + ATTENDANCE_RETENTION_MS;
    expect((await listVisits(env.DOCUMENT_DB, 't1', now)).map((r) => r.person_key)).toEqual([]);
    expect(await deleteOldVisits(env.DOCUMENT_DB, now)).toBe(1);
    expect(await deleteOldVisits(env.DOCUMENT_DB, now)).toBe(0);
    expect((await listVisits(env.DOCUMENT_DB, 't2', now)).map((r) => r.person_key)).toEqual([
      'recent',
    ]);
  });

  it('lists a tab newest first', async () => {
    const { env, sql: raw } = sqliteD1();
    const item = nodeItemSql(raw);
    joinVisit(item, 't1', 'first', ADA, T0);
    joinVisit(item, 't1', 'second', ADA, T0 + 5);
    joinVisit(item, 't9', 'elsewhere', ADA, T0 + 9);
    expect((await listVisits(env.DOCUMENT_DB, 't1', T0 + 10)).map((r) => r.person_key)).toEqual([
      'second',
      'first',
    ]);
  });

  it('stays quick on a full tab', () => {
    for (let i = 0; i < ATTENDANCE_TAB_MAX; i++) joinVisit(sql, 't1', `k${i}`, ADA, T0 + i);
    // Each join on a full tab prunes it: 200 of them stay well inside a frame's budget each.
    const ms = cpuMsOf(() => {
      for (let i = 0; i < 200; i++) joinVisit(sql, 't1', `n${i}`, ADA, T0 + 10_000 + i);
    });
    expect(ms).toBeLessThan(cpuBudgetMs(400));
    expect(rows()).toHaveLength(ATTENDANCE_TAB_MAX);
  });
});

describe('a restart', () => {
  it('closes every open visit when the room last saw it, its grace running from now', () => {
    joinVisit(sql, 't1', 'k-ada', ADA, T0);
    touchOpenVisits(sql, T0 + 500);
    joinVisit(sql, 't1', 'k-bo', ADA, T0);
    leaveVisit(sql, 't1', 'k-bo', T0 + 10);
    expect(closeStaleVisits(sql, T0 + 9_999_999)).toBe(1);
    expect(rows()[0]).toMatchObject({ left_at: T0 + 500, closed_at: T0 + 9_999_999 });
    expect(rows()[1]).toMatchObject({ left_at: T0 + 10 });
    // Back inside the grace of the sweep: the same visit.
    expect(joinVisit(sql, 't1', 'k-ada', ADA, T0 + 9_999_999 + 1_000)).toBe('reopened');
  });

  it('knows whether the table is there yet', () => {
    expect(hasAttendanceTable(sql)).toBe(true);
    const bare = nodeItemSql(new DatabaseSync(':memory:'));
    expect(hasAttendanceTable(bare)).toBe(false);
  });
});
