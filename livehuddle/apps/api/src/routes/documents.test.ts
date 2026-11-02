import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DocumentDTO } from '../types';
import { sqliteD1, testShareLink, testTrash, type SqliteD1 } from '../test-sqlite-d1';
import type { ItemGrant } from '../index-service';

// The index as these doors call it: the canvas's share links (a deleted tab's go with it), and the list.
const { index } = vi.hoisted(() => ({
  index: {
    links: [] as { code: string; tabId: string | null }[],
    revoked: [] as string[],
    items: [] as Record<string, unknown>[],
  },
}));
vi.mock('../index-service', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../index-service')>()),
  indexFor: () => ({
    listShareLinks: async () => ({ links: index.links, passwordSet: false }),
    revokeShareLink: async (code: string) => void index.revoked.push(code),
    listItems: async () => ({ items: index.items, nextCursor: null }),
  }),
}));

import { makeTestRouteContext } from './test-route-context';
import { handleDocuments } from './documents';
import { handleDocumentList } from './document-index-routes';

// /api/documents/<id> on the index's grants (liveworkspace/docs/specs/004-index/one-explorer-contracts.md "Grants"): a document answers
// whoever holds a grant on it, as the grant says (level, tab), and answers anyone else as missing. Real SQLite
// (test-sqlite-d1.ts), whose stand-in index grants as the real one does: the owner and the document's team edit, a
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
  handleDocuments(makeTestRouteContext(method, path, { env: db.env, owner: 'owner', ...opts }));

async function seeded(db = sqliteD1(), teamId: string | null = null): Promise<SqliteD1> {
  const res = await call(db, 'POST', '/api/documents', {
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
  if (teamId) db.sql.prepare("UPDATE document SET team_id = ? WHERE id = 'P'").run(teamId);
  return db;
}

const read = async (res: Response) => (await res.json<{ document: DocumentDTO }>()).document;

beforeEach(() => {
  index.links = [];
  index.revoked = [];
  index.items = [];
  vi.spyOn(console, 'info').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe('a document read', () => {
  it('answers its owner, with the owner id', async () => {
    const db = await seeded();
    const res = await call(db, 'GET', '/api/documents/P');
    expect(res.status).toBe(200);
    const document = await read(res);
    expect(document).toMatchObject({ id: 'P', name: 'Roadmap', ownerId: 'owner' });
    expect(document.tabs.map((t) => t.name)).toEqual(['Pricing', 'Roadmap']);
  });

  it('answers anyone without a grant as missing (no existence leak)', async () => {
    const db = await seeded();
    expect((await call(db, 'GET', '/api/documents/P', { owner: 'stranger' })).status).toBe(404);
    expect((await call(db, 'GET', '/api/documents/nope')).status).toBe(404);
  });

  it("answers a joined team member, who is not told the owner's id", async () => {
    const db = await seeded(sqliteD1(), 'team1');
    const res = await call(db, 'GET', '/api/documents/P', {
      owner: 'user_bob',
      teams: [{ id: 'team1', name: 'T', role: 'member' }],
    });
    expect(res.status).toBe(200);
    expect((await read(res)).ownerId).not.toBe('owner');
  });

  it("answers a link visitor, who is not told the owner's id", async () => {
    const db = await seeded();
    testShareLink(db, 'P', 'CODE2345', 'view');
    const res = await call(db, 'GET', '/api/documents/P', {
      owner: 'guest_v',
      headers: { 'X-Share-Code': 'CODE2345' },
    });
    expect(res.status).toBe(200);
    expect((await read(res)).ownerId).not.toBe('owner');
  });

  it("starts a document the index made but nothing has written, as its grant's person's", async () => {
    const db = sqliteD1();
    const grant: ItemGrant = {
      item: 'N',
      level: 'edit',
      tab: null,
      sub: 'user_new',
      team: null,
      exp: Math.floor(Date.now() / 1000) + 600,
      shareCode: null,
      token: 'g',
    };
    const res = await call(db, 'GET', '/api/documents/N', { owner: 'user_new', grant });
    expect(res.status).toBe(200);
    expect(await read(res)).toMatchObject({ id: 'N', name: 'Untitled', ownerId: 'user_new' });
  });

  it('never starts one for a link visitor', async () => {
    const db = sqliteD1();
    const grant: ItemGrant = {
      item: 'N',
      level: 'edit',
      tab: null,
      sub: 'link:CODE2345',
      team: null,
      exp: Math.floor(Date.now() / 1000) + 600,
      shareCode: 'CODE2345',
      token: 'g',
    };
    expect((await call(db, 'GET', '/api/documents/N', { owner: null, grant })).status).toBe(404);
  });
});

describe('a canvas in the Trash', () => {
  it('answers its owner and team 410 document_trashed, and a link visitor as missing', async () => {
    const db = await seeded(sqliteD1(), 'team1');
    testShareLink(db, 'P', 'CODE2345', 'edit');
    testTrash(db, 'P');
    const owner = await call(db, 'GET', '/api/documents/P');
    expect(owner.status).toBe(410);
    expect(await owner.json()).toEqual({ error: 'document_trashed' });
    const member = await call(db, 'PUT', '/api/documents/P', {
      owner: 'user_bob',
      teams: [{ id: 'team1', name: 'T', role: 'member' }],
      body: { name: 'Renamed' },
    });
    expect(member.status).toBe(410);
    const visitor = await call(db, 'GET', '/api/documents/P', {
      owner: 'guest_v',
      headers: { 'X-Share-Code': 'CODE2345' },
    });
    expect(visitor.status).toBe(404);
  });
});

describe('a create', () => {
  it("refuses an id that is another person's started document", async () => {
    const db = await seeded();
    const res = await call(db, 'POST', '/api/documents', {
      owner: 'stranger',
      body: { id: 'P', name: 'Mine now', tabs: [] },
    });
    expect([403, 404]).toContain(res.status);
    expect(db.sql.prepare("SELECT owner_id, name FROM document WHERE id = 'P'").get()).toEqual({
      owner_id: 'owner',
      name: 'Roadmap',
    });
  });

  it('is the caller own re-commit when the document is already theirs', async () => {
    const db = await seeded();
    const res = await call(db, 'POST', '/api/documents', {
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
    const db = await seeded();
    testShareLink(db, 'P', 'VIEW2345', 'view');
    const who = { owner: 'guest_v', headers: { 'X-Share-Code': 'VIEW2345' } };
    expect((await call(db, 'GET', '/api/documents/P/tabs/t1', who)).status).toBe(200);
    const write = await call(db, 'PUT', '/api/documents/P/tabs/t1', {
      ...who,
      body: { id: 't1', name: 'Pricing', elements: [] },
    });
    expect(write.status).toBe(403);
    const rename = await call(db, 'PUT', '/api/documents/P', { ...who, body: { name: 'Hijack' } });
    expect(rename.status).toBe(403);
  });
});

describe('a tab-scoped visitor', () => {
  const visitor = { owner: 'visitor-1', headers: { 'X-Share-Code': 'SCOPED23' } };

  it('gets the document with every other tab locked and no deck', async () => {
    const db = await seeded();
    await call(db, 'PUT', '/api/documents/P', { body: { presentation: '{"slides":[]}' } });
    testShareLink(db, 'P', 'SCOPED23', 'edit', 't2');
    const document = await read(await call(db, 'GET', '/api/documents/P', visitor));
    expect(document.tabs.map((t) => t.name)).toEqual(['', 'Roadmap']);
    expect(document.presentation).toBeNull();
  });

  // docs/specs/025-community/community.md "Viewing a post's document": through the post's link (as its room marks
  // it), the board without its conversation or its people.
  it('reads a Community visit without its conversation', async () => {
    const db = await seeded();
    testShareLink(db, 'P', 'COMMUNITY1', 'view');
    const thread = { comments: [{ id: 'c1', text: 'secret', authorId: 'user_jane' }] };
    await call(db, 'PUT', '/api/documents/P/tabs/t2', {
      body: { id: 't2', name: 'Roadmap', elements: [{ ...box('e1'), commentThread: thread }] },
    });
    const res = await call(db, 'GET', '/api/documents/P/tabs/t2', {
      owner: 'visitor-1',
      headers: { 'X-Share-Code': 'COMMUNITY1' },
      community: { code: 'COMMUNITY1', open: true },
    });
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain('"e1"');
    expect(text).not.toContain('secret');
    expect(text).not.toContain('user_jane');
  });

  it('reads and writes its own tab only', async () => {
    const db = await seeded();
    testShareLink(db, 'P', 'SCOPED23', 'edit', 't2');
    expect((await call(db, 'GET', '/api/documents/P/tabs/t2', visitor)).status).toBe(200);
    expect((await call(db, 'GET', '/api/documents/P/tabs/t1', visitor)).status).toBe(404);
    const other = await call(db, 'PUT', '/api/documents/P/tabs/t1', {
      ...visitor,
      body: { id: 't1', name: 'Pricing', elements: [] },
      headers: { ...visitor.headers, 'X-Allow-Empty': '1' },
    });
    expect([403, 404]).toContain(other.status);
  });

  it('cannot delete the tab its link is scoped to', async () => {
    const db = await seeded();
    testShareLink(db, 'P', 'SCOPED23', 'edit', 't2');
    expect((await call(db, 'DELETE', '/api/documents/P/tabs/t2', visitor)).status).toBe(403);
  });
});

describe('the tab autosave backstop', () => {
  const body = (elements: unknown[]) => ({ id: 't1', name: 'Pricing', elements });

  it('409s, writing nothing, when an empty body would blank a tab that has content', async () => {
    const db = await seeded();
    const res = await call(db, 'PUT', '/api/documents/P/tabs/t1', { body: body([]) });
    expect(res.status).toBe(409);
    const tab = await call(db, 'GET', '/api/documents/P/tabs/t1');
    expect((await tab.json<{ tab: { elements: unknown[] } }>()).tab.elements).toHaveLength(1);
  });

  it('writes the empty body the client marks intentional, and over an empty tab', async () => {
    const db = await seeded();
    const marked = await call(db, 'PUT', '/api/documents/P/tabs/t1', {
      body: body([]),
      headers: { 'X-Allow-Empty': '1' },
    });
    expect(marked.status).toBe(200);
    expect(
      (await call(db, 'PUT', '/api/documents/P/tabs/t2', { body: { ...body([]), id: 't2' } }))
        .status,
    ).toBe(200);
  });

  it('is a 400 for a body that is not a JSON object, never a 500', async () => {
    const db = await seeded();
    for (const path of ['/api/documents/P', '/api/documents/P/tabs/t1']) {
      for (const rawBody of ['[1, 2]', '{nope', 'null']) {
        const res = await call(db, 'PUT', path, { rawBody });
        expect(res.status, `${path} ${rawBody}`).toBe(400);
      }
    }
  });
});

describe('the tabs alone', () => {
  type Tabs = { tabs: { id: string; name: string; kind: string | null }[] };

  it('names each tab, in order, without its content', async () => {
    const db = await seeded();
    const res = await call(db, 'GET', '/api/documents/P/tabs');
    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toBe('private, no-store');
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
    const text = await res.text();
    expect(JSON.parse(text) as Tabs).toEqual({
      tabs: [
        { id: 't1', name: 'Pricing', kind: 'diagram' },
        { id: 't2', name: 'Roadmap', kind: 'diagram' },
      ],
    });
    // The tabs' content never leaves.
    expect(text).not.toContain('elements');
  });

  it('is a 404 without a grant or a document, and a tab’s link sees its own tab alone', async () => {
    const db = await seeded();
    expect((await call(db, 'GET', '/api/documents/P/tabs', { owner: 'stranger' })).status).toBe(
      404,
    );
    expect((await call(db, 'GET', '/api/documents/nope/tabs')).status).toBe(404);
    testShareLink(db, 'P', 'SCOPED23', 'view', 't2');
    const res = await call(db, 'GET', '/api/documents/P/tabs', {
      owner: 'visitor-1',
      headers: { 'X-Share-Code': 'SCOPED23' },
    });
    expect(res.status).toBe(200);
    expect(await res.json<Tabs>()).toEqual({
      tabs: [{ id: 't2', name: 'Roadmap', kind: 'diagram' }],
    });
  });

  it('reads a large document’s tabs in budget, a fraction of the whole document', async () => {
    const db = sqliteD1();
    const many = Array.from({ length: 60 }, (_, i) => ({
      id: `t${i}`,
      name: `Tab ${i}`,
      elements: Array.from({ length: 150 }, (_, k) => box(`e${i}-${k}`)),
    }));
    expect(
      (await call(db, 'POST', '/api/documents', { body: { id: 'P', name: 'Big', tabs: many } }))
        .status,
    ).toBe(201);
    const time = async (path: string) => {
      let best = Infinity;
      let bytes = 0;
      for (let k = 0; k < 5; k++) {
        const t = performance.now();
        bytes = (await (await call(db, 'GET', path)).text()).length;
        best = Math.min(best, performance.now() - t);
      }
      return { ms: best, bytes };
    };
    const whole = await time('/api/documents/P');
    const tabs = await time('/api/documents/P/tabs');
    // console.info is quiet in this file; the measurement is worth seeing.
    console.log(
      `[tabs] 60 tabs of 150 elements: whole document ${whole.ms.toFixed(1)} ms ${whole.bytes} B, tabs ${tabs.ms.toFixed(1)} ms ${tabs.bytes} B`,
    );
    expect(tabs.bytes).toBeLessThan(whole.bytes);
    expect(tabs.ms).toBeLessThan(50);
  });
});

describe('a delete', () => {
  it('is never the document own: only the index deletes (document-index-routes.ts), and the document keeps its content', async () => {
    const db = await seeded();
    const res = await call(db, 'DELETE', '/api/documents/P');
    expect(res.status).toBe(404);
    expect(db.sql.prepare("SELECT id FROM document WHERE id = 'P'").get()).toEqual({ id: 'P' });
  });
});

// The whole-tab save's byte cap (docs/specs/015-api/api.md "Tab size"): measured whether or not the request declares
// its length, so a chunked upload is never read as zero bytes.
describe('the tab save byte cap', () => {
  const tab = (label = 'a') => ({ id: 't2', name: 'Roadmap', elements: [{ ...box('e1'), label }] });
  const stored = (db: SqliteD1) =>
    db.sql.prepare("SELECT data FROM tabs WHERE id = 't2'").get() as { data: string };

  it('413s an oversized tab that arrives without a Content-Length header', async () => {
    const db = await seeded();
    const before = stored(db);
    const res = await call(db, 'PUT', '/api/documents/P/tabs/t2', {
      body: tab('a'.repeat(5 * 1024 * 1024)),
    });
    expect(res.status).toBe(413);
    expect(await res.json()).toEqual({ error: 'payload_too_large' });
    expect(stored(db)).toEqual(before);
  });

  it('413s using the declared Content-Length without re-stringifying', async () => {
    const db = await seeded();
    const before = stored(db);
    const res = await call(db, 'PUT', '/api/documents/P/tabs/t2', {
      body: tab(),
      headers: { 'Content-Length': String(5 * 1024 * 1024) },
    });
    expect(res.status).toBe(413);
    expect(stored(db)).toEqual(before);
  });

  it('writes an ordinary tab that declares no Content-Length', async () => {
    const db = await seeded();
    expect((await call(db, 'PUT', '/api/documents/P/tabs/t2', { body: tab() })).status).toBe(200);
    expect(stored(db).data).toContain('"e1"');
  });
});

// Slide deck (docs/specs/012-collaboration/presentation-mode.md): it rides the metadata PUT but has its own write, so
// an ordinary rename never rewrites it.
describe('the metadata PUT', () => {
  const deck = JSON.stringify({ decks: [{ slides: [] }] });
  const presentation = async (db: SqliteD1) =>
    (await read(await call(db, 'GET', '/api/documents/P'))).presentation;

  it('writes the deck sent, leaves it alone when absent, and clears it on null', async () => {
    const db = await seeded();
    expect(
      (await call(db, 'PUT', '/api/documents/P', { body: { presentation: deck } })).status,
    ).toBe(200);
    expect(await presentation(db)).toBe(deck);
    await call(db, 'PUT', '/api/documents/P', { body: { name: 'Renamed' } });
    expect(await presentation(db)).toBe(deck);
    await call(db, 'PUT', '/api/documents/P', { body: { presentation: null } });
    expect(await presentation(db)).toBeNull();
  });

  it('400s a deck past the size cap, without writing', async () => {
    const db = await seeded();
    const res = await call(db, 'PUT', '/api/documents/P', {
      body: { presentation: 'x'.repeat(256 * 1024 + 1) },
    });
    expect(res.status).toBe(400);
    expect(await presentation(db)).toBeNull();
  });

  it('blanks ownerId in the reply for an edit-role link visitor, and gives the owner theirs', async () => {
    const db = await seeded();
    testShareLink(db, 'P', 'EDIT2345', 'edit');
    const visitor = await call(db, 'PUT', '/api/documents/P', {
      owner: 'visitor-1',
      body: { name: 'Roadmap' },
      headers: { 'X-Share-Code': 'EDIT2345' },
    });
    expect(visitor.status).toBe(200);
    expect((await read(visitor)).ownerId).toBe('');
    expect(
      (await read(await call(db, 'PUT', '/api/documents/P', { body: { name: 'Roadmap' } })))
        .ownerId,
    ).toBe('owner');
  });

  it('404s an unknown id instead of create-on-first-write (ghost-row guard)', async () => {
    const db = sqliteD1();
    const res = await call(db, 'PUT', '/api/documents/ghost', { body: { name: 'Ghost' } });
    expect(res.status).toBe(404);
    expect(db.sql.prepare("SELECT id FROM document WHERE id = 'ghost'").get()).toBeUndefined();
  });
});

// docs/specs/006-document/offline-mode.md: the offline record is deleted once the create succeeds, so its deck has to
// arrive with it.
describe('a create carrying an Offline Mode sync', () => {
  it('stores the deck it was sent, in the document itself', async () => {
    const db = sqliteD1();
    const res = await call(db, 'POST', '/api/documents', {
      body: { id: 'P', name: 'Doc', presentation: '{"decks":[]}', tabs: [] },
    });
    expect(res.status).toBe(201);
    expect((await read(await call(db, 'GET', '/api/documents/P'))).presentation).toBe(
      '{"decks":[]}',
    );
  });
});

describe('deleting a tab (docs/specs/013-workspace/tab-scoped-share-links.md)', () => {
  it('refuses a tab the document does not have, and the last tab for a token', async () => {
    const db = await seeded();
    expect((await call(db, 'DELETE', '/api/documents/P/tabs/nope')).status).toBe(404);
    expect((await call(db, 'DELETE', '/api/documents/P/tabs/t2')).status).toBe(204);
    const agent = await call(db, 'DELETE', '/api/documents/P/tabs/t1', { token: { id: 'tok' } });
    expect(agent.status).toBe(409);
    expect(await agent.json()).toEqual({ error: 'last_tab' });
    // The editor's own delete races its save of the new tab: let through.
    expect((await call(db, 'DELETE', '/api/documents/P/tabs/t1')).status).toBe(204);
  });

  it('takes the links scoped to it along, at the index', async () => {
    const db = await seeded();
    index.links = [
      { code: 'WHOLE234', tabId: null },
      { code: 'AAAA2222', tabId: 't2' },
    ];
    const pending: Promise<unknown>[] = [];
    const res = await call(db, 'DELETE', '/api/documents/P/tabs/t2', {
      waitUntil: (p) => void pending.push(p),
    });
    expect(res.status).toBe(204);
    await Promise.all(pending);
    expect(index.revoked).toEqual(['AAAA2222']);
    expect(db.sql.prepare("SELECT id FROM tabs WHERE id = 't2'").get()).toBeUndefined();
  });
});

// GET /api/documents: the MCP server's and the CLI's list, the index's items in the shape they have always read.
describe('the document list', () => {
  it("is a 400 without a caller, and the caller's documents as summaries", async () => {
    const db = sqliteD1();
    const list = (owner: string | null) =>
      handleDocumentList(makeTestRouteContext('GET', '/api/documents', { env: db.env, owner }));
    expect((await list(null)).status).toBe(400);
    index.items = [
      {
        id: 'A',
        app: 'livehuddle',
        ownerId: 'owner',
        teamId: null,
        folderId: null,
        title: 'Roadmap',
        source: null,
        intent: null,
        summary: { elements: 3, comments: 1, bytes: 10, empty: false },
        sharedVia: null,
        createdAt: 1,
        updatedAt: 2,
        trashedAt: null,
      },
    ];
    const res = await list('owner');
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      documents: [{ id: 'A', name: 'Roadmap', ownerId: 'owner', savedAt: 2, createdAt: 1 }],
    });
  });
});
