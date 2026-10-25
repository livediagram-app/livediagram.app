import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DatabaseSync } from 'node:sqlite';
import { sqliteD1, type SqliteD1 } from '../test-sqlite-d1';
import { makeTestRouteContext } from './test-route-context';
import { handleDesigns } from './designs';

// Slide decks left livedesign on 25 October 2026 (docs/specs/012-collaboration/presentation-mode.md "Saved data"):
// the design row's `presentation` column stays, but nothing reads or writes it, and a `presentation` field an older
// editor still sends is ignored rather than refused.

const DECK = '{"version":1,"decks":[{"id":"d1","slides":[]}]}';

function call(db: SqliteD1, method: string, path: string, body?: unknown) {
  return handleDesigns(makeTestRouteContext(method, path, { env: db.env, owner: 'owner', body }));
}

function storedDeck(sql: DatabaseSync, id: string): unknown {
  return sql.prepare('SELECT presentation FROM design WHERE id = ?').get(id)?.presentation;
}

beforeEach(() => {
  vi.spyOn(console, 'info').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe('a design and its retired slide deck', () => {
  it('creates a design sent with a deck, and stores no deck', async () => {
    const db = sqliteD1();
    const res = await call(db, 'POST', '/api/designs', {
      id: 'D',
      name: 'Plan',
      presentation: DECK,
    });
    expect(res.status).toBe(201);
    expect(storedDeck(db.sql, 'D') ?? null).toBeNull();
    expect((await res.json<{ design: object }>()).design).not.toHaveProperty('presentation');
  });

  it('saves a design sent with a deck, however large, and leaves the column alone', async () => {
    const db = sqliteD1();
    await call(db, 'POST', '/api/designs', { id: 'D', name: 'Plan' });
    db.sql.prepare('UPDATE design SET presentation = ? WHERE id = ?').run(DECK, 'D');
    const res = await call(db, 'PUT', '/api/designs/D', {
      name: 'Renamed',
      presentation: 'x'.repeat(300 * 1024),
    });
    expect(res.status).toBe(200);
    expect(storedDeck(db.sql, 'D')).toBe(DECK);
  });

  it('opens a design that still holds a deck, without serving it', async () => {
    const db = sqliteD1();
    await call(db, 'POST', '/api/designs', { id: 'D', name: 'Plan' });
    db.sql.prepare('UPDATE design SET presentation = ? WHERE id = ?').run(DECK, 'D');
    const res = await call(db, 'GET', '/api/designs/D');
    expect(res.status).toBe(200);
    const { design } = await res.json<{ design: { name: string } }>();
    expect(design.name).toBe('Plan');
    expect(design).not.toHaveProperty('presentation');
  });
});
