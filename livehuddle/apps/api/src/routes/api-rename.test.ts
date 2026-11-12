import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GrantClaims } from '@liveworkspace/index-client';
import type { DocumentDTO, Env } from '../types';
import { sqliteD1, type SqliteD1 } from '../test-sqlite-d1';
import { clearGrantCacheForTests, setGrantVerifierForTests } from '../index-service';

// What reached the index's rename: each `updateItem` the worker sent.
const { index } = vi.hoisted(() => ({
  index: { renames: [] as { id: string; input: unknown }[] },
}));
vi.mock('../index-service', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../index-service')>()),
  indexFor: () => ({
    updateItem: async (id: string, input: unknown) => {
      index.renames.push({ id, input });
      return { item: {} };
    },
  }),
}));

import { makeTestRouteContext } from './test-route-context';
import { handleDocuments } from './documents';

// Work Tracker #690: a rename through the API reaches the index's title, as the editor's own rename does.
// An API token's is sent by the worker (routes/documents.ts forwardToDocument); a browser's bearer is the editor's, which renames at the
// index itself, so the worker sends nothing for it.

type Opts = Parameters<typeof makeTestRouteContext>[2];
const call = (db: SqliteD1, method: string, path: string, opts: Opts = {}) =>
  handleDocuments(makeTestRouteContext(method, path, { env: db.env, owner: 'owner', ...opts }));
const read = async (res: Response) => (await res.json<{ document: DocumentDTO }>()).document;

async function seeded(): Promise<SqliteD1> {
  const db = sqliteD1();
  const res = await call(db, 'POST', '/api/documents', {
    body: { id: 'P', name: 'Roadmap', tabs: [{ id: 't1', name: 'Board', elements: [] }] },
  });
  expect(res.status).toBe(201);
  return db;
}

const token = { id: 'tok1', readOnly: false, name: 'CI' };
// The index's grant on the space, sent as the editor sends it.
const grantClaims = {
  item: 'P',
  sub: 'owner',
  level: 'edit',
  tab: null,
  team: null,
  owner: 'owner',
  exp: 9e9,
};

beforeEach(() => {
  index.renames = [];
  clearGrantCacheForTests();
  setGrantVerifierForTests(async (t: string) =>
    t === 'G.P' ? (grantClaims as unknown as GrantClaims) : null,
  );
  vi.spyOn(console, 'info').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

// The worker's side of the request: no tables of its own, the space's Durable Object reached through DOCUMENT_ROOM.
async function rename(db: SqliteD1, name: string, opts: Opts = {}): Promise<Response> {
  const waits: Promise<unknown>[] = [];
  const ctx = makeTestRouteContext('PUT', '/api/documents/P', {
    owner: 'owner',
    body: { name },
    headers: { 'X-Index-Grant': 'G.P' },
    waitUntil: (p) => void waits.push(p),
    ...opts,
  });
  const res = await handleDocuments({
    ...ctx,
    env: { DOCUMENT_ROOM: (db.env as unknown as Env).DOCUMENT_ROOM } as unknown as Env,
  });
  await Promise.all(waits);
  return res;
}

describe('a rename through the API', () => {
  it("sends an API token's rename to the index as the item's title", async () => {
    const db = await seeded();
    const res = await rename(db, '  Roadmap 2027 ', { token, verifiedUserId: 'owner' });
    expect(res.status).toBe(200);
    expect(index.renames).toEqual([{ id: 'P', input: { title: 'Roadmap 2027' } }]);
    expect((await read(await call(db, 'GET', '/api/documents/P'))).name).toBe('Roadmap 2027');
  });

  it("leaves the editor's rename to the editor, and sends nothing for a refused one", async () => {
    const db = await seeded();
    expect((await rename(db, 'Plans')).status).toBe(200);
    expect((await read(await call(db, 'GET', '/api/documents/P'))).name).toBe('Plans');
    // An empty name is refused: the index hears nothing either.
    expect((await rename(db, '', { token, verifiedUserId: 'owner' })).status).toBe(400);
    expect(index.renames).toEqual([]);
  });
});
