import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DOCUMENT_OPEN_HEADER } from '@livehuddle/api-schema';
import { sqliteD1, testShareLink, type SqliteD1 } from '../test-sqlite-d1';

// The opens the index was told of (it keeps them, for the reader's Home and Most Used): the canvas, and the link the
// reader came in by.
const { opens } = vi.hoisted(() => ({
  opens: [] as { id: string; code: string | null }[],
}));
vi.mock('../index-service', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../index-service')>()),
  indexFor: () => ({
    recordOpen: async (id: string, share?: { code: string } | null) => {
      opens.push({ id, code: share?.code ?? null });
    },
  }),
}));

import { makeTestRouteContext } from './test-route-context';
import { handleDocuments } from './documents';

// Where opens are recorded (docs/specs/013-workspace/explorer-home.md "Opens"; blueprint
// "Interfaces and contracts"): the tab read, only when the editor declares it an open, only after
// the read gate passed, and for whoever is reading, visitors included (the index records it as the caller's).

let db: SqliteD1;
let pending: Promise<unknown>[];

function seed() {
  db.sql.exec(`
    INSERT INTO test_documents (id, owner_id, name, saved_at, created_at)
      VALUES ('d1', 'owner', 'Payments', 1, 1);
    INSERT INTO tabs (id, name, data, updated_at) VALUES ('t1', 'Tab 1', '{"elements":[]}', 1);
    INSERT INTO document_tabs (document_id, tab_id, order_index, added_at) VALUES ('d1', 't1', 0, 1);
  `);
  testShareLink(db, 'd1', 'CODE', 'view');
}

async function readTab(owner: string, headers: Record<string, string> = {}) {
  const res = await handleDocuments(
    makeTestRouteContext('GET', '/api/documents/d1/tabs/t1', {
      env: db.env,
      owner,
      headers,
      waitUntil: (p) => void pending.push(p),
    }),
  );
  await Promise.all(pending);
  return res;
}

beforeEach(() => {
  db = sqliteD1();
  pending = [];
  opens.length = 0;
  seed();
  vi.spyOn(console, 'info').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('the tab read and opens', () => {
  it("records the owner's marked open", async () => {
    const res = await readTab('owner', { [DOCUMENT_OPEN_HEADER]: '1' });
    expect(res.status).toBe(200);
    expect(opens).toEqual([{ id: 'd1', code: null }]);
  });

  it('records nothing for an unmarked read: a resync, a duplicate, an embed', async () => {
    expect((await readTab('owner')).status).toBe(200);
    expect(opens).toEqual([]);
  });

  it("records a share-link visitor's open as the visitor's own", async () => {
    const res = await readTab('guest-visitor', {
      [DOCUMENT_OPEN_HEADER]: '1',
      'X-Share-Code': 'CODE',
    });
    expect(res.status).toBe(200);
    expect(opens).toEqual([{ id: 'd1', code: 'CODE' }]);
  });

  it('records nothing when the read is refused', async () => {
    const res = await readTab('stranger', { [DOCUMENT_OPEN_HEADER]: '1' });
    expect(res.status).toBe(403);
    expect(opens).toEqual([]);
  });
});
