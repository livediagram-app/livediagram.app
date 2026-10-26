import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DesignDTO } from '../types';
import { sqliteD1, testShareLink, type SqliteD1 } from '../test-sqlite-d1';
import type { DesignGrant } from '../index-service';
import { makeTestRouteContext } from './test-route-context';
import { handleDesigns } from './designs';

// /api/designs/<id> on the index's grants (liveworkspace/docs/specs/004-index/one-explorer-contracts.md "Grants"): a design answers
// whoever holds a grant on it, as the grant says (level, tab), and answers anyone else as missing. Real SQLite
// (test-sqlite-d1.ts), whose stand-in index grants as the real one does: the owner and the design's team edit, a
// share link grants its level on its tab.

const box = (id: string) => ({
  id,
  type: 'shape',
  shape: 'square',
  x: 0,
  y: 0,
  width: 100,
  height: 60,
});

type Opts = Parameters<typeof makeTestRouteContext>[2];
const call = (db: SqliteD1, method: string, path: string, opts: Opts = {}) =>
  handleDesigns(makeTestRouteContext(method, path, { env: db.env, owner: 'owner', ...opts }));

async function design(db = sqliteD1(), teamId: string | null = null): Promise<SqliteD1> {
  const res = await call(db, 'POST', '/api/designs', {
    body: {
      id: 'P',
      name: 'Roadmap',
      tabs: [
        { id: 't1', name: 'Pricing', elements: [box('a')] },
        { id: 't2', name: 'Roadmap', elements: [] },
      ],
    },
  });
  expect(res.status).toBe(201);
  if (teamId) db.sql.prepare("UPDATE design SET team_id = ? WHERE id = 'P'").run(teamId);
  return db;
}

const read = async (res: Response) => (await res.json<{ design: DesignDTO }>()).design;

beforeEach(() => {
  vi.spyOn(console, 'info').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe('a design read', () => {
  it('answers its owner, with the owner id', async () => {
    const db = await design();
    const res = await call(db, 'GET', '/api/designs/P');
    expect(res.status).toBe(200);
    const doc = await read(res);
    expect(doc).toMatchObject({ id: 'P', name: 'Roadmap', ownerId: 'owner' });
    expect(doc.tabs.map((t) => t.name)).toEqual(['Pricing', 'Roadmap']);
  });

  it('answers anyone without a grant as missing (no existence leak)', async () => {
    const db = await design();
    expect((await call(db, 'GET', '/api/designs/P', { owner: 'stranger' })).status).toBe(404);
    expect((await call(db, 'GET', '/api/designs/nope')).status).toBe(404);
  });

  it("answers a joined team member, who is not told the owner's id", async () => {
    const db = await design(sqliteD1(), 'team1');
    const res = await call(db, 'GET', '/api/designs/P', {
      owner: 'user_bob',
      teams: [{ id: 'team1', name: 'T', role: 'member' }],
    });
    expect(res.status).toBe(200);
    expect((await read(res)).ownerId).not.toBe('owner');
  });

  it("answers a link visitor, who is not told the owner's id", async () => {
    const db = await design();
    testShareLink(db, 'P', 'CODE2345', 'view');
    const res = await call(db, 'GET', '/api/designs/P', {
      owner: 'guest_v',
      headers: { 'X-Share-Code': 'CODE2345' },
    });
    expect(res.status).toBe(200);
    expect((await read(res)).ownerId).not.toBe('owner');
  });

  it("starts a design the index made but nothing has written, as its grant's person's", async () => {
    const db = sqliteD1();
    const grant: DesignGrant = {
      item: 'N',
      level: 'edit',
      tab: null,
      sub: 'user_new',
      team: null,
      exp: Math.floor(Date.now() / 1000) + 600,
      shareCode: null,
      token: 'g',
    };
    const res = await call(db, 'GET', '/api/designs/N', { owner: 'user_new', grant });
    expect(res.status).toBe(200);
    expect(await read(res)).toMatchObject({ id: 'N', name: 'Untitled', ownerId: 'user_new' });
  });

  it('never starts one for a link visitor', async () => {
    const db = sqliteD1();
    const grant: DesignGrant = {
      item: 'N',
      level: 'edit',
      tab: null,
      sub: 'link:CODE2345',
      team: null,
      exp: Math.floor(Date.now() / 1000) + 600,
      shareCode: 'CODE2345',
      token: 'g',
    };
    expect((await call(db, 'GET', '/api/designs/N', { owner: null, grant })).status).toBe(404);
  });
});

describe('a create', () => {
  it("refuses an id that is another person's started design", async () => {
    const db = await design();
    const res = await call(db, 'POST', '/api/designs', {
      owner: 'stranger',
      body: { id: 'P', name: 'Mine now', tabs: [] },
    });
    expect([403, 404]).toContain(res.status);
    expect(db.sql.prepare("SELECT owner_id, name FROM design WHERE id = 'P'").get()).toEqual({
      owner_id: 'owner',
      name: 'Roadmap',
    });
  });

  it('is the caller own re-commit when the design is already theirs', async () => {
    const db = await design();
    const res = await call(db, 'POST', '/api/designs', {
      body: {
        id: 'P',
        name: 'Roadmap',
        tabs: [{ id: 't1', name: 'Pricing', elements: [box('b')] }],
      },
    });
    expect(res.status).toBe(201);
  });
});

describe('a view grant', () => {
  it('reads, and never writes', async () => {
    const db = await design();
    testShareLink(db, 'P', 'VIEW2345', 'view');
    const who = { owner: 'guest_v', headers: { 'X-Share-Code': 'VIEW2345' } };
    expect((await call(db, 'GET', '/api/designs/P/tabs/t1', who)).status).toBe(200);
    const write = await call(db, 'PUT', '/api/designs/P/tabs/t1', {
      ...who,
      body: { id: 't1', name: 'Pricing', elements: [] },
    });
    expect(write.status).toBe(403);
    const rename = await call(db, 'PUT', '/api/designs/P', { ...who, body: { name: 'Hijack' } });
    expect(rename.status).toBe(403);
  });
});

describe('a tab-scoped visitor', () => {
  const visitor = { owner: 'visitor-1', headers: { 'X-Share-Code': 'SCOPED23' } };

  it('gets the design with every other tab locked', async () => {
    const db = await design();
    testShareLink(db, 'P', 'SCOPED23', 'edit', 'never', 't2');
    const doc = await read(await call(db, 'GET', '/api/designs/P', visitor));
    expect(doc.tabs.map((t) => t.name)).toEqual(['', 'Roadmap']);
  });

  it('reads and writes its own tab only', async () => {
    const db = await design();
    testShareLink(db, 'P', 'SCOPED23', 'edit', 'never', 't2');
    expect((await call(db, 'GET', '/api/designs/P/tabs/t2', visitor)).status).toBe(200);
    expect((await call(db, 'GET', '/api/designs/P/tabs/t1', visitor)).status).toBe(404);
    const other = await call(db, 'PUT', '/api/designs/P/tabs/t1', {
      ...visitor,
      body: { id: 't1', name: 'Pricing', elements: [] },
      headers: { ...visitor.headers, 'X-Allow-Empty': '1' },
    });
    expect([403, 404]).toContain(other.status);
  });

  it('cannot delete the tab its link is scoped to', async () => {
    const db = await design();
    testShareLink(db, 'P', 'SCOPED23', 'edit', 'never', 't2');
    expect((await call(db, 'DELETE', '/api/designs/P/tabs/t2', visitor)).status).toBe(403);
  });
});

describe('the tab autosave backstop', () => {
  const body = (elements: unknown[]) => ({ id: 't1', name: 'Pricing', elements });

  it('409s, writing nothing, when an empty body would blank a tab that has content', async () => {
    const db = await design();
    const res = await call(db, 'PUT', '/api/designs/P/tabs/t1', { body: body([]) });
    expect(res.status).toBe(409);
    const tab = await call(db, 'GET', '/api/designs/P/tabs/t1');
    expect((await tab.json<{ tab: { elements: unknown[] } }>()).tab.elements).toHaveLength(1);
  });

  it('writes the empty body the client marks intentional, and over an empty tab', async () => {
    const db = await design();
    const marked = await call(db, 'PUT', '/api/designs/P/tabs/t1', {
      body: body([]),
      headers: { 'X-Allow-Empty': '1' },
    });
    expect(marked.status).toBe(200);
    expect(
      (await call(db, 'PUT', '/api/designs/P/tabs/t2', { body: { ...body([]), id: 't2' } })).status,
    ).toBe(200);
  });

  it('is a 400 for a body that is not a JSON object, never a 500', async () => {
    const db = await design();
    for (const path of ['/api/designs/P', '/api/designs/P/tabs/t1']) {
      const res = await call(db, 'PUT', path, { rawBody: '[1, 2]' });
      expect(res.status, path).toBe(400);
    }
  });
});

describe('a delete', () => {
  it('is never the design own: only the index deletes (design-index-routes.ts), and the design keeps its content', async () => {
    const db = await design();
    const res = await call(db, 'DELETE', '/api/designs/P');
    expect(res.status).toBe(404);
    expect(db.sql.prepare("SELECT id FROM design WHERE id = 'P'").get()).toEqual({ id: 'P' });
  });
});
