import { describe, expect, it } from 'vitest';
import { sqliteD1, testShareLink, type SqliteD1 } from '../test-sqlite-d1';
import { handleDocuments } from './documents';
import { makeTestRouteContext } from './test-route-context';

// GET /api/documents/:id/tabs/:tabId needs only a grant (docs/specs/015-api/api.md): a link visitor with no identity
// (a guest-only deployment, or a guest handoff that failed) reads with its share code alone. Every write still needs a
// caller.

const OWNER = 'user_owner';

const call = (db: SqliteD1, method: string, path: string, owner: string | null, code?: string) =>
  handleDocuments(
    makeTestRouteContext(method, path, {
      env: db.env,
      owner,
      accountUserId: owner,
      verifiedUserId: owner,
      ...(method === 'PUT' ? { body: { id: 't1', name: 'Slides', elements: [] } } : {}),
      ...(code ? { headers: { 'X-Share-Code': code } } : {}),
    }),
  );

async function setUp() {
  const db = sqliteD1();
  await handleDocuments(
    makeTestRouteContext('POST', '/api/documents', {
      env: db.env,
      owner: OWNER,
      accountUserId: OWNER,
      body: { id: 'D', name: 'Deck', tabs: [{ id: 't1', name: 'Slides', elements: [] }] },
    }),
  );
  testShareLink(db, 'D', 'VIEWCODE', 'view');
  return db;
}

describe('a link visitor with no identity', () => {
  it('reads a tab with its share code alone', async () => {
    const db = await setUp();
    const res = await call(db, 'GET', '/api/documents/D/tabs/t1', null, 'VIEWCODE');
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ tab: { id: 't1', name: 'Slides' } });
  });

  it('is still refused without a share code', async () => {
    const db = await setUp();
    expect((await call(db, 'GET', '/api/documents/D/tabs/t1', null)).status).toBe(403);
  });

  it('still needs a caller to write or to ask for a view', async () => {
    const db = await setUp();
    expect((await call(db, 'PUT', '/api/documents/D/tabs/t1', null, 'VIEWCODE')).status).toBe(400);
    expect((await call(db, 'DELETE', '/api/documents/D/tabs/t1', null, 'VIEWCODE')).status).toBe(
      400,
    );
    expect(
      (await call(db, 'GET', '/api/documents/D/tabs/t1?view=outline', null, 'VIEWCODE')).status,
    ).toBe(400);
  });
});
