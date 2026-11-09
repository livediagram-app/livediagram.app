import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Element } from '@livehuddle/document';
import { sqliteD1, type SqliteD1 } from '../test-sqlite-d1';
import type { Env } from '../types';
import type { ItemGrant } from '../index-service';
import { makeTestRouteContext } from './test-route-context';
import { handleDocuments } from './documents';

// docs/specs/013-workspace/tab-scoped-share-links.md "Enforcement": every write door answers a grant confined to
// another tab 404, as if the tab did not exist, and a caller with no grant, or one below Editor, 403.

const OWNER = 'user_owner';
const box = (id: string): Element => ({
  id,
  type: 'shape',
  shape: 'square',
  x: 0,
  y: 0,
  width: 10,
  height: 10,
  label: id,
});

const grantFor = (over: Partial<ItemGrant> = {}): ItemGrant => ({
  item: 'D',
  level: 'edit',
  tab: 't1',
  sub: 'link:abc',
  team: null,
  exp: 2_000_000_000,
  shareCode: 'abc',
  token: 'g',
  ...over,
});

function call(
  db: SqliteD1,
  method: string,
  path: string,
  body?: unknown,
  grant?: ItemGrant | null,
) {
  const visitor = grant !== undefined;
  return handleDocuments(
    makeTestRouteContext(method, path, {
      env: db.env,
      owner: visitor ? 'guest_v' : OWNER,
      accountUserId: visitor ? null : OWNER,
      verifiedUserId: visitor ? null : OWNER,
      body,
      token: visitor ? null : { id: 'tok_1' },
      ...(visitor ? { grant } : {}),
    }),
  );
}

const room = {
  idFromName: (name: string) => name,
  get: () => ({ fetch: async () => new Response(null, { status: 204 }) }),
};

async function setUp(): Promise<SqliteD1> {
  const db = sqliteD1({ DOCUMENT_ROOM: room } as unknown as Partial<Env>);
  const created = await call(db, 'POST', '/api/documents', {
    id: 'D',
    name: 'Board',
    tabs: [
      { id: 't1', name: 'Mine', elements: [box('a')] },
      { id: 't2', name: 'Pricing', elements: [box('b')] },
    ],
  });
  expect(created.status).toBe(201);
  return db;
}

afterEach(() => vi.restoreAllMocks());

describe('a tab-scoped editor on another tab', () => {
  it('gets 404 from the save, the rename, the delete and a revert, and changes nothing', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const db = await setUp();
    const scoped = grantFor();
    const written = await call(db, 'POST', '/api/documents/D/tabs/t2/changesets', {
      operations: [{ op: 'rm', target: 'b' }],
    });
    expect(written.status).toBe(200);
    const { changeset } = (await written.json()) as { changeset: { id: string } };

    const save = await call(
      db,
      'PUT',
      '/api/documents/D/tabs/t2',
      { name: 'Pricing', elements: [] },
      scoped,
    );
    expect(save.status).toBe(404);
    const rename = await call(db, 'PUT', '/api/documents/D/tabs/t2/name', { name: 'X' }, scoped);
    expect(rename.status).toBe(404);
    expect((await call(db, 'DELETE', '/api/documents/D/tabs/t2', undefined, scoped)).status).toBe(
      404,
    );
    const revert = await call(
      db,
      'POST',
      `/api/documents/D/changesets/${changeset.id}/revert`,
      undefined,
      scoped,
    );
    expect(revert.status).toBe(404);
    expect(db.sql.prepare("SELECT name FROM tabs WHERE id = 't2'").get()).toEqual({
      name: 'Pricing',
    });
  });

  it('still gets 403 for its own tab’s rename and delete, which are structure', async () => {
    const db = await setUp();
    const scoped = grantFor();
    expect(
      (await call(db, 'PUT', '/api/documents/D/tabs/t1/name', { name: 'X' }, scoped)).status,
    ).toBe(403);
    expect((await call(db, 'DELETE', '/api/documents/D/tabs/t1', undefined, scoped)).status).toBe(
      403,
    );
  });
});

describe('a caller below Editor, or with no grant', () => {
  it('gets 403 on any tab, never a 404 that hides the refusal', async () => {
    const db = await setUp();
    for (const grant of [grantFor({ level: 'view', tab: null }), null]) {
      expect(
        (await call(db, 'PUT', '/api/documents/D/tabs/t2', { elements: [] }, grant)).status,
      ).toBe(403);
      expect(
        (await call(db, 'PUT', '/api/documents/D/tabs/t2/name', { name: 'X' }, grant)).status,
      ).toBe(403);
      expect((await call(db, 'DELETE', '/api/documents/D/tabs/t2', undefined, grant)).status).toBe(
        403,
      );
    }
    // A Viewer confined to its own tab is below Editor there: 403, not 404.
    const viewer = grantFor({ level: 'view' });
    expect(
      (await call(db, 'PUT', '/api/documents/D/tabs/t1', { elements: [] }, viewer)).status,
    ).toBe(403);
  });
});
