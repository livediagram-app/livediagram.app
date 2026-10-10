import { describe, expect, it } from 'vitest';
import { fakeD1 } from '../test-d1';
import { dropSharedAccess, hasSharedAccess, listSharedWith, recordSharedAccess } from './shared';

// `shared_with` is what a visitor sees under "Shared with you", and it is also
// one leg of the access check the notify-action route runs (docs/specs/012-collaboration/assigned-actions.md). Both
// readings are security-adjacent: a row that shouldn't be there grants a
// stranger a listing entry, and a row that's missing locks a legitimate
// collaborator out of their own notification.

const sharedRow = (over: Record<string, unknown> = {}) => ({
  id: 'diag-1',
  name: 'Roadmap',
  saved_at: 42,
  role: 'edit',
  share_code: 'code-1',
  owner_name: 'Ada',
  owner_color: '#ff0000',
  tab_id: null,
  first_tab_count: 3,
  ...over,
});

describe('recordSharedAccess (docs/specs/014-identity/profile-and-email-notifications.md + docs/specs/017-telemetry/telemetry.md first-visit signal)', () => {
  it('reports a first visit when its insert creates the row, and writes nothing else', async () => {
    const db = fakeD1(({ sql }) => (sql.includes('INSERT OR IGNORE') ? { changes: 1 } : {}));
    expect(await recordSharedAccess(db.env, 'visitor-1', 'diag-1', 'edit', null, 'CODE2345')).toBe(
      true,
    );
    const insert = db.one('INSERT OR IGNORE INTO shared_with');
    expect(insert.bindings.slice(0, 3)).toEqual(['visitor-1', 'diag-1', 'edit']);
    expect(db.matching('UPDATE shared_with')).toHaveLength(0);
  });

  it('reports a repeat visit while still refreshing role and last_seen', async () => {
    // The email and the Document·Joined count fire once per person, but the
    // row has to keep up with a link that was re-issued at a different role.
    const db = fakeD1(({ sql }) => (sql.includes('INSERT OR IGNORE') ? { changes: 0 } : {}));
    expect(await recordSharedAccess(db.env, 'visitor-1', 'diag-1', 'view', null, 'CODE2345')).toBe(
      false,
    );
    const update = db.one('UPDATE shared_with');
    expect(update.bindings[0]).toBe('view');
    expect(update.bindings.slice(-2)).toEqual(['visitor-1', 'diag-1']);
  });

  // docs/specs/013-workspace/tab-scoped-share-links.md: the scope follows the same last-visit-wins rule as role.
  it('records the scope the visitor was granted, on first and repeat visits', async () => {
    const first = fakeD1(({ sql }) => (sql.includes('INSERT OR IGNORE') ? { changes: 1 } : {}));
    await recordSharedAccess(first.env, 'visitor-1', 'diag-1', 'view', 'tab-2', 'CODE2345');
    expect(first.one('INSERT OR IGNORE INTO shared_with').bindings).toContain('tab-2');
    const repeat = fakeD1(({ sql }) => (sql.includes('INSERT OR IGNORE') ? { changes: 0 } : {}));
    await recordSharedAccess(repeat.env, 'visitor-1', 'diag-1', 'edit', null, 'CODE2345');
    const update = repeat.one('UPDATE shared_with');
    expect(update.sql).toContain('tab_id = ?');
    expect(update.bindings).toEqual([
      'edit',
      null,
      null,
      expect.any(Number),
      'CODE2345',
      'visitor-1',
      'diag-1',
    ]);
  });

  // docs/specs/013-workspace/share-roles.md (migration 0080): a Participant's visit keeps view in the legacy column.
  it('records a Participant visit as role view with level participate', async () => {
    const db = fakeD1(({ sql }) => (sql.includes('INSERT OR IGNORE') ? { changes: 1 } : {}));
    await recordSharedAccess(db.env, 'visitor-1', 'diag-1', 'participate', null, 'CODE2345');
    expect(db.one('INSERT OR IGNORE INTO shared_with').bindings.slice(2, 4)).toEqual([
      'view',
      'participate',
    ]);
  });

  it('never reads first-ness from a separate SELECT (a race would double count)', async () => {
    const db = fakeD1(() => ({ changes: 1 }));
    await recordSharedAccess(db.env, 'visitor-1', 'diag-1', 'edit', null, 'CODE2345');
    expect(db.matching('SELECT')).toHaveLength(0);
  });
});

describe('hasSharedAccess (docs/specs/012-collaboration/assigned-actions.md access leg)', () => {
  it('is true when a row exists and false when it does not', async () => {
    const present = fakeD1(() => ({ first: { one: 1 } }));
    expect(await hasSharedAccess(present.env, 'visitor-1', 'diag-1')).toBe(true);
    const absent = fakeD1(() => ({ first: null }));
    expect(await hasSharedAccess(absent.env, 'visitor-1', 'diag-1')).toBe(false);
  });

  it('asks about this visitor and this document only', async () => {
    const db = fakeD1(() => ({ first: null }));
    await hasSharedAccess(db.env, 'visitor-1', 'diag-1');
    expect(db.one('FROM shared_with').bindings.slice(0, 2)).toEqual(['visitor-1', 'diag-1']);
  });
});

describe('listSharedWith (docs/specs/008-canvas/canvas-and-palette.md Shared with you)', () => {
  it('maps a row to the DTO the Explorer renders', async () => {
    const db = fakeD1(() => ({ all: [sharedRow()] }));
    expect(await listSharedWith(db.env, 'visitor-1')).toEqual([
      {
        id: 'diag-1',
        name: 'Roadmap',
        savedAt: 42,
        role: 'edit',
        shareCode: 'code-1',
        ownerName: 'Ada',
        ownerColor: '#ff0000',
        tabId: null,
        empty: false,
      },
    ]);
  });

  // docs/specs/013-workspace/tab-scoped-share-links.md: the code handed back must carry exactly the scope the
  // visitor was given. An All-tabs code for a visitor who was shown one tab
  // would open the rest of the document to them.
  it('hands back a code of the granted scope, never a broader one', async () => {
    const db = fakeD1(() => ({ all: [sharedRow({ tab_id: 'tab-2' })] }));
    const [item] = await listSharedWith(db.env, 'visitor-1');
    expect(item!.tabId).toBe('tab-2');
    const sql = db.one('FROM shared_with s').sql;
    expect(sql).toContain('sl.tab_id IS s.tab_id');
    expect(sql).toContain('COALESCE(sl.level, sl.role) = COALESCE(s.level, s.role)');
  });

  it('drops rows whose share has since been revoked', async () => {
    // No live code at the granted role means the link would 404 on click; a
    // listing entry the visitor cannot open is worse than no entry.
    const db = fakeD1(() => ({
      all: [sharedRow(), sharedRow({ id: 'diag-2', share_code: null })],
    }));
    const listed = await listSharedWith(db.env, 'visitor-1');
    expect(listed.map((d) => d.id)).toEqual(['diag-1']);
  });

  it('returns nothing when the query yields no results at all', async () => {
    const db = fakeD1(() => ({ all: undefined }));
    expect(await listSharedWith(db.env, 'visitor-1')).toEqual([]);
  });

  it('excludes unshareable documents and orders by the visitor’s last look', async () => {
    const db = fakeD1(() => ({ all: [] }));
    await listSharedWith(db.env, 'visitor-1');
    const query = db.one('FROM shared_with s');
    expect(query.sql).toContain('d.shareable = 1');
    expect(query.sql).toContain('ORDER BY s.last_seen DESC');
    expect(query.bindings[1]).toBe('visitor-1');
  });
});

describe('dropSharedAccess', () => {
  it('deletes exactly this visitor’s reference', async () => {
    const db = fakeD1();
    await dropSharedAccess(db.env, 'visitor-1', 'diag-1');
    const del = db.one('DELETE FROM shared_with');
    expect(del.bindings).toEqual(['visitor-1', 'diag-1']);
  });
});
