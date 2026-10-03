import { describe, expect, it, vi } from 'vitest';
import type { Tab } from '@livediagram/document';
import { MAX_TAB_BYTES, tabDataBytes } from '@livediagram/api-schema';
import { sqliteD1, type SqliteD1 } from './test-sqlite-d1';
import { seedTabs, swapTabData, upsertTab } from './db/tabs';
import { TabTooLargeError } from './limits';
import { makeTestRouteContext } from './routes/test-route-context';
import { handleDocuments } from './routes/documents';

// docs/specs/015-api/api.md "Tab size": a tab's data fits one D1 row (2,000,000 bytes), which the
// local sqlite does not enforce, so the worker does, at every write, at the boundary.

const T0 = 1_700_000_000_000;

// A tab whose stored data is exactly `bytes` long: one text element padded to fit.
function tabOf(bytes: number, id = 't1'): Tab {
  const base = {
    id,
    name: 'Board',
    elements: [{ id: 'x', type: 'text', x: 0, y: 0, width: 10, height: 10, label: '' }],
  } as unknown as Tab;
  const pad = bytes - tabDataBytes(base);
  return {
    ...base,
    elements: [{ ...base.elements[0]!, label: 'x'.repeat(pad) }],
  } as unknown as Tab;
}

function liveDoc(db: SqliteD1, id: string, owner = 'owner') {
  db.sql
    .prepare(
      'INSERT INTO documents (id, owner_id, name, shareable, saved_at, created_at) VALUES (?, ?, ?, 0, ?, ?)',
    )
    .run(id, owner, id, T0, T0);
}

const stored = (db: SqliteD1, id: string) =>
  db.sql.prepare('SELECT length(data) AS n FROM tabs WHERE id = ?').get(id) as
    { n: number } | undefined;

const quiet = () => vi.spyOn(console, 'warn').mockImplementation(() => {});

describe('the storage layer', () => {
  it('stores a tab at the cap and refuses one byte over, writing nothing, with its log line', async () => {
    const warn = quiet();
    const db = sqliteD1();
    liveDoc(db, 'd1');
    const at = tabOf(MAX_TAB_BYTES);
    expect(tabDataBytes(at)).toBe(MAX_TAB_BYTES);
    await upsertTab(db.env, 'd1', at, 0);
    expect(stored(db, 't1')?.n).toBe(MAX_TAB_BYTES);

    await expect(upsertTab(db.env, 'd1', tabOf(MAX_TAB_BYTES + 1, 't2'), 0)).rejects.toBeInstanceOf(
      TabTooLargeError,
    );
    expect(stored(db, 't2')).toBeUndefined();
    expect(warn).toHaveBeenCalledWith('[tab-size] refused', {
      write: 'upsertTab',
      tabId: 't2',
      bytes: MAX_TAB_BYTES + 1,
      cap: MAX_TAB_BYTES,
    });
    warn.mockRestore();
  });

  it('seeds all of a create’s tabs or none', async () => {
    const warn = quiet();
    const db = sqliteD1();
    liveDoc(db, 'd1');
    await expect(
      seedTabs(db.env, 'd1', [tabOf(100, 'small'), tabOf(MAX_TAB_BYTES + 1, 'big')]),
    ).rejects.toBeInstanceOf(TabTooLargeError);
    expect(stored(db, 'small')).toBeUndefined();
    warn.mockRestore();
  });

  it('refuses a swap that would outgrow the row, counting bytes, not characters', async () => {
    const warn = quiet();
    const db = sqliteD1();
    liveDoc(db, 'd1');
    await upsertTab(db.env, 'd1', tabOf(100), 0);
    const raw = (db.sql.prepare('SELECT data FROM tabs WHERE id = ?').get('t1') as { data: string })
      .data;
    // Two bytes a character: under the cap in characters, over it in bytes.
    const next = JSON.stringify({ elements: [], pad: 'é'.repeat(MAX_TAB_BYTES / 2) });
    expect(next.length).toBeLessThan(MAX_TAB_BYTES);
    await expect(swapTabData(db.env, 'd1', 't1', raw, next, 0)).rejects.toBeInstanceOf(
      TabTooLargeError,
    );
    expect(stored(db, 't1')?.n).toBe(100);
    warn.mockRestore();
  });
});

describe('the routes answer the named 413', () => {
  it('refuses a create with a tab over the cap before writing anything', async () => {
    const warn = quiet();
    const db = sqliteD1();
    const res = await handleDocuments(
      makeTestRouteContext('POST', '/api/documents', {
        env: db.env,
        owner: 'owner',
        body: { id: 'd1', name: 'Doc', tabs: [tabOf(MAX_TAB_BYTES + 1)] },
      }),
    );
    expect(res?.status).toBe(413);
    expect(((await res!.json()) as { error: string }).error).toBe('payload_too_large');
    expect(db.sql.prepare('SELECT id FROM documents WHERE id = ?').get('d1')).toBeUndefined();
    expect(warn).toHaveBeenCalledWith(
      '[tab-size] refused',
      expect.objectContaining({ write: 'create', bytes: MAX_TAB_BYTES + 1 }),
    );
    warn.mockRestore();
  });

  it('creates a document whose tab is at the cap', async () => {
    const db = sqliteD1();
    const res = await handleDocuments(
      makeTestRouteContext('POST', '/api/documents', {
        env: db.env,
        owner: 'owner',
        body: { id: 'd1', name: 'Doc', tabs: [tabOf(MAX_TAB_BYTES)] },
      }),
    );
    expect(res?.status).toBe(201);
    expect(stored(db, 't1')?.n).toBe(MAX_TAB_BYTES);
  });

  it('refuses a comment that would push a tab at the cap over it', async () => {
    const warn = quiet();
    const db = sqliteD1();
    liveDoc(db, 'd1');
    await upsertTab(db.env, 'd1', tabOf(MAX_TAB_BYTES - 10), 0);
    const res = await handleDocuments(
      makeTestRouteContext('POST', '/api/documents/d1/tabs/t1/comments', {
        env: db.env,
        owner: 'owner',
        body: { elementId: 'x', text: 'One more thought' },
      }),
    );
    expect(res?.status).toBe(413);
    expect(stored(db, 't1')?.n).toBe(MAX_TAB_BYTES - 10);
    warn.mockRestore();
  });

  it('refuses a tab save over the cap, keeping what was stored', async () => {
    const warn = quiet();
    const db = sqliteD1();
    liveDoc(db, 'd1');
    await upsertTab(db.env, 'd1', tabOf(100), 0);
    const res = await handleDocuments(
      makeTestRouteContext('PUT', '/api/documents/d1/tabs/t1', {
        env: db.env,
        owner: 'owner',
        body: tabOf(MAX_TAB_BYTES + 1),
      }),
    );
    expect(res?.status).toBe(413);
    expect(stored(db, 't1')?.n).toBe(100);
    warn.mockRestore();
  });
});
