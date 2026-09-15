import { SHARE_LINK_EXPIRY_MS } from '@livediagram/api-schema';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fakeD1 } from '../test-d1';
import {
  createShareLink,
  deleteShareLink,
  extendShareLink,
  generateShareCode,
  getShareLink,
  getShareLinkIncludingExpired,
  listShareLinks,
} from './share';

// share_links is the enforcement choke point for every visitor who isn't the
// owner: `getShareLink` is what auth/diagram-access.ts, the WebSocket upgrade
// and GET /api/share/:code all ask. The expiry predicate living in ONE query
// is the reason an expired link stops working everywhere at once — and the
// reason a drift in that one query would quietly re-open every expired link
// ever issued.

const row = (over: Record<string, unknown> = {}) => ({
  code: 'ABCD2345',
  diagram_id: 'diag-1',
  role: 'edit',
  created_at: 1_000,
  expiry: null,
  expires_at: null,
  ...over,
});

afterEach(() => {
  vi.useRealTimers();
});

// Pins `Date.now()` so an expiry assertion is arithmetic rather than a race.
function atTime(now: number) {
  vi.useFakeTimers();
  vi.setSystemTime(now);
}

describe('generateShareCode', () => {
  it('is eight characters from an alphabet with no ambiguous glyphs', async () => {
    // Codes get read aloud and transcribed; 0/O and 1/I/l are the pairs that
    // turn a shared link into a support conversation.
    const code = generateShareCode();
    expect(code).toHaveLength(8);
    expect(code).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/);
  });

  it('honours a requested length', () => {
    expect(generateShareCode(12)).toHaveLength(12);
  });

  it('draws from the CSPRNG, not Math.random', () => {
    // A guessable share code is an unauthenticated read of someone's diagram.
    const spy = vi.spyOn(crypto, 'getRandomValues');
    generateShareCode();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe('listShareLinks (owner-facing, spec/34)', () => {
  it('returns expired links too, so the dialog can show Inactive', async () => {
    const db = fakeD1(() => ({
      all: [row(), row({ code: 'EXPIRED1', expiry: 'week', expires_at: 1 })],
    }));
    const links = await listShareLinks(db.env, 'diag-1');
    expect(links.map((l) => l.code)).toEqual(['ABCD2345', 'EXPIRED1']);
    expect(db.one('FROM share_links').sql).not.toContain('expires_at >');
  });

  it('is scoped to the diagram and ordered oldest first', async () => {
    const db = fakeD1(() => ({ all: [] }));
    await listShareLinks(db.env, 'diag-1');
    const query = db.one('FROM share_links');
    expect(query.bindings).toEqual(['diag-1']);
    expect(query.sql).toContain('ORDER BY created_at ASC');
  });

  it('survives a query that answers without results', async () => {
    const db = fakeD1(() => ({ all: undefined }));
    expect(await listShareLinks(db.env, 'diag-1')).toEqual([]);
  });
});

describe('getShareLink (the access gate, spec/34)', () => {
  it('resolves a live link to its DTO', async () => {
    const db = fakeD1(() => ({ first: row({ role: 'view' }) }));
    expect(await getShareLink(db.env, 'ABCD2345')).toEqual({
      code: 'ABCD2345',
      diagramId: 'diag-1',
      role: 'view',
      createdAt: 1_000,
      expiry: 'never',
      expiresAt: null,
    });
  });

  it('filters expiry in SQL, against now', async () => {
    // THE regression guard for spec/34: if this predicate is ever lost, every
    // expired link in the database silently starts authorising again.
    atTime(5_000);
    const db = fakeD1(() => ({ first: null }));
    await getShareLink(db.env, 'ABCD2345');
    const query = db.one('FROM share_links');
    expect(query.sql).toContain('expires_at IS NULL OR expires_at > ?');
    expect(query.bindings).toEqual(['ABCD2345', 5_000]);
  });

  it('answers null for a code that matched nothing', async () => {
    const db = fakeD1(() => ({ first: null }));
    expect(await getShareLink(db.env, 'NOPE')).toBeNull();
  });
});

describe('getShareLinkIncludingExpired (owner-side, spec/34)', () => {
  it('finds a link precisely because it has expired', async () => {
    const db = fakeD1(() => ({ first: row({ expiry: 'week', expires_at: 1 }) }));
    const link = await getShareLinkIncludingExpired(db.env, 'ABCD2345');
    expect(link?.expiresAt).toBe(1);
    expect(db.one('FROM share_links').sql).not.toContain('expires_at >');
  });

  it('answers null for a code that matched nothing', async () => {
    const db = fakeD1(() => ({ first: null }));
    expect(await getShareLinkIncludingExpired(db.env, 'NOPE')).toBeNull();
  });
});

describe('createShareLink (spec/34)', () => {
  it('stores a never-expiring link with NULL expiry columns', async () => {
    atTime(1_000);
    const db = fakeD1();
    const link = await createShareLink(db.env, 'diag-1', 'ABCD2345', 'edit');
    expect(link).toEqual({
      code: 'ABCD2345',
      diagramId: 'diag-1',
      role: 'edit',
      createdAt: 1_000,
      expiry: 'never',
      expiresAt: null,
    });
    expect(db.one('INSERT INTO share_links').bindings).toEqual([
      'ABCD2345',
      'diag-1',
      'edit',
      1_000,
      null,
      null,
    ]);
  });

  it('arms the deadline from creation time for a timed link', async () => {
    atTime(1_000);
    const db = fakeD1();
    const link = await createShareLink(db.env, 'diag-1', 'ABCD2345', 'view', 'week');
    expect(link.expiresAt).toBe(1_000 + SHARE_LINK_EXPIRY_MS.week);
    expect(db.one('INSERT INTO share_links').bindings[4]).toBe('week');
  });

  it('flips the diagram shareable, which is what opens the realtime room', async () => {
    const db = fakeD1();
    await createShareLink(db.env, 'diag-1', 'ABCD2345', 'edit');
    expect(db.one('UPDATE diagrams SET shareable = 1').bindings).toEqual(['diag-1']);
  });
});

describe('extendShareLink (spec/34)', () => {
  it('re-arms the original duration from now, not from the old deadline', async () => {
    // Extending a link that lapsed a month ago must give a full week from
    // today, not a week from a deadline already in the past.
    atTime(10_000);
    const db = fakeD1(() => ({ first: row({ expiry: 'week', expires_at: 2 }) }));
    const extended = await extendShareLink(db.env, 'ABCD2345');
    expect(extended?.expiresAt).toBe(10_000 + SHARE_LINK_EXPIRY_MS.week);
    expect(db.one('UPDATE share_links SET expires_at').bindings).toEqual([
      10_000 + SHARE_LINK_EXPIRY_MS.week,
      'ABCD2345',
    ]);
  });

  it('refuses a link that never expires, and writes nothing', async () => {
    const db = fakeD1(() => ({ first: row() }));
    expect(await extendShareLink(db.env, 'ABCD2345')).toBeNull();
    expect(db.matching('UPDATE share_links')).toEqual([]);
  });

  it('refuses a code that does not exist', async () => {
    const db = fakeD1(() => ({ first: null }));
    expect(await extendShareLink(db.env, 'NOPE')).toBeNull();
    expect(db.matching('UPDATE share_links')).toEqual([]);
  });
});

describe('deleteShareLink (spec/34)', () => {
  it('deletes the link and closes sharing when it was the last one', async () => {
    const db = fakeD1(({ sql }) => {
      if (sql.includes('SELECT'))
        return sql.includes('COUNT(*)') ? { first: { n: 0 } } : { first: row() };
      return {};
    });
    await deleteShareLink(db.env, 'ABCD2345');
    expect(db.one('DELETE FROM share_links').bindings).toEqual(['ABCD2345']);
    expect(db.one('UPDATE diagrams SET shareable = 0').bindings).toEqual(['diag-1']);
  });

  it('leaves sharing on while another link survives', async () => {
    // Revoking one of two links must not close the room on the people using
    // the other one.
    const db = fakeD1(({ sql }) => {
      if (sql.includes('SELECT'))
        return sql.includes('COUNT(*)') ? { first: { n: 1 } } : { first: row() };
      return {};
    });
    await deleteShareLink(db.env, 'ABCD2345');
    expect(db.matching('UPDATE diagrams SET shareable = 0')).toEqual([]);
  });

  it('closes sharing when the remaining-count query answers nothing at all', async () => {
    const db = fakeD1(({ sql }) => {
      if (sql.includes('COUNT(*)')) return { first: null };
      if (sql.includes('SELECT')) return { first: row() };
      return {};
    });
    await deleteShareLink(db.env, 'ABCD2345');
    expect(db.one('UPDATE diagrams SET shareable = 0')).toBeDefined();
  });

  it('is a no-op for a code that does not exist', async () => {
    const db = fakeD1(() => ({ first: null }));
    await deleteShareLink(db.env, 'NOPE');
    expect(db.matching('DELETE FROM share_links')).toEqual([]);
  });
});
