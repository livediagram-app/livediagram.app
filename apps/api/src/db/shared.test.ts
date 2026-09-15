import { describe, expect, it } from 'vitest';
import { fakeD1 } from '../test-d1';
import { dropSharedAccess, hasSharedAccess, listSharedWith, recordSharedAccess } from './shared';

// `shared_with` is what a visitor sees under "Shared with you", and it is also
// one leg of the access check the notify-action route runs (spec/68). Both
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
  ...over,
});

describe('recordSharedAccess (spec/65 first-visit signal)', () => {
  it('reports a first visit, and upserts the row', async () => {
    const db = fakeD1(({ sql }) => (sql.includes('SELECT 1') ? { first: null } : {}));
    expect(await recordSharedAccess(db.env, 'visitor-1', 'diag-1', 'edit')).toBe(true);
    const upsert = db.one('INSERT INTO shared_with');
    expect(upsert.bindings.slice(0, 3)).toEqual(['visitor-1', 'diag-1', 'edit']);
  });

  it('reports a repeat visit while still refreshing role and last_seen', async () => {
    // The email fires once per person (spec/65) but the row has to keep up
    // with a link that was re-issued at a different role.
    const db = fakeD1(({ sql }) => (sql.includes('SELECT 1') ? { first: { one: 1 } } : {}));
    expect(await recordSharedAccess(db.env, 'visitor-1', 'diag-1', 'view')).toBe(false);
    const upsert = db.one('INSERT INTO shared_with');
    expect(upsert.sql).toContain('ON CONFLICT (owner_id, diagram_id) DO UPDATE');
    expect(upsert.bindings[2]).toBe('view');
  });
});

describe('hasSharedAccess (spec/68 access leg)', () => {
  it('is true when a row exists and false when it does not', async () => {
    const present = fakeD1(() => ({ first: { one: 1 } }));
    expect(await hasSharedAccess(present.env, 'visitor-1', 'diag-1')).toBe(true);
    const absent = fakeD1(() => ({ first: null }));
    expect(await hasSharedAccess(absent.env, 'visitor-1', 'diag-1')).toBe(false);
  });

  it('asks about this visitor and this diagram only', async () => {
    const db = fakeD1(() => ({ first: null }));
    await hasSharedAccess(db.env, 'visitor-1', 'diag-1');
    expect(db.one('FROM shared_with').bindings).toEqual(['visitor-1', 'diag-1']);
  });
});

describe('listSharedWith (spec/09 Shared with you)', () => {
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
      },
    ]);
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

  it('excludes unshareable diagrams and orders by the visitor’s last look', async () => {
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
