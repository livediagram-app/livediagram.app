import { describe, expect, it } from 'vitest';
import { fakeD1 } from '../test-d1';
import { deleteChangeLogEntry, listChangeLog } from './change-log';

// docs/specs/013-workspace/tab-scoped-share-links.md: a tab-scoped visitor reads and removes log entries of
// their own tab only. Filtered in SQL, so the list still carries the latest
// entries of THAT tab rather than whatever survived a diagram-wide cap.
describe('listChangeLog', () => {
  it('lists the whole diagram when unscoped', async () => {
    const db = fakeD1(() => ({ all: [] }));
    await listChangeLog(db.env, 'd1');
    const query = db.one('FROM change_log cl');
    expect(query.sql).not.toContain('cl.tab_id = ?');
    expect(query.bindings[0]).toBe('d1');
  });

  it('lists one tab when scoped', async () => {
    const db = fakeD1(() => ({ all: [] }));
    await listChangeLog(db.env, 'd1', 't2');
    const query = db.one('FROM change_log cl');
    expect(query.sql).toContain('cl.tab_id = ?');
    expect(query.bindings.slice(0, 2)).toEqual(['d1', 't2']);
  });
});

describe('deleteChangeLogEntry', () => {
  it('deletes within the diagram when unscoped', async () => {
    const db = fakeD1();
    await deleteChangeLogEntry(db.env, 'd1', 'e1');
    expect(db.one('DELETE FROM change_log').bindings).toEqual(['e1', 'd1']);
  });

  it('deletes only on the scoped tab when scoped', async () => {
    const db = fakeD1();
    await deleteChangeLogEntry(db.env, 'd1', 'e1', 't2');
    const del = db.one('DELETE FROM change_log');
    expect(del.sql).toContain('AND tab_id = ?');
    expect(del.bindings).toEqual(['e1', 'd1', 't2']);
  });
});
