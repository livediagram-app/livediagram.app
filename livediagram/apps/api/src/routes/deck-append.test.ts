import { afterEach, describe, expect, it, vi } from 'vitest';
import { sentJson } from '@liveworkspace/vitest-config/sent-request';
import { parseStoredPresentation, type Slide } from '@livediagram/document';
import { sqliteD1, type SqliteD1 } from '../test-sqlite-d1';
import type { Env } from '../types';
import { makeTestRouteContext } from './test-route-context';
import { handleDocuments } from './documents';

// Slides an agent appends (docs/specs/012-collaboration/presentation-mode.md "Slides an agent appends"): the MCP's
// add_tab sends `appendSlides`, the api merges them into the stored deck by id and tells the room, so an editor with
// the document open takes them in instead of writing them away with its next deck edit.

const OWNER = 'user_owner';
const slide = (id: string): Slide => ({ id, tabId: 't1', elementIds: ['a'] });

// `status` 'throw': a room that cannot be reached at all.
function roomRecorder(status: number | 'throw' = 204) {
  const calls: { url: string; body: unknown }[] = [];
  const binding = {
    idFromName: (name: string) => name,
    get: () => ({
      fetch: async (input: string | Request, init?: RequestInit) => {
        const url = typeof input === 'string' ? input : input.url;
        calls.push({ url, body: init?.body ? sentJson(init) : null });
        if (status === 'throw') throw new Error('room down');
        return new Response(null, { status });
      },
    }),
  };
  return { calls, binding };
}

async function call(db: SqliteD1, method: string, path: string, body?: unknown) {
  const pending: Promise<unknown>[] = [];
  const ctx = makeTestRouteContext(method, path, {
    env: db.env,
    owner: OWNER,
    accountUserId: null,
    verifiedUserId: OWNER,
    body,
    waitUntil: (p) => void pending.push(p),
  });
  const res = await handleDocuments({ ...ctx, token: { id: 'tok_1' } });
  await Promise.all(pending);
  return res;
}

async function documentWithDeck(room: ReturnType<typeof roomRecorder>, deck: Slide[]) {
  const db = sqliteD1({ DOCUMENT_ROOM: room.binding } as unknown as Partial<Env>);
  const created = await call(db, 'POST', '/api/documents', {
    id: 'D',
    name: 'Board',
    tabs: [{ id: 't1', name: 'Board', elements: [] }],
    presentation: JSON.stringify({ decks: [{ slides: deck }, { slides: [slide('later')] }] }),
  });
  expect(created.status).toBe(201);
  return db;
}

const storedDecks = async (db: SqliteD1) => {
  const res = await call(db, 'GET', '/api/documents/D');
  const { document } = await res.json<{ document: { presentation: string | null } }>();
  return parseStoredPresentation(document.presentation)?.decks.map((d) =>
    d.slides.map((s) => s.id),
  );
};

afterEach(() => vi.restoreAllMocks());

describe('appendSlides on the metadata PUT', () => {
  it("appends after the deck's own, keeps a later deck, and tells the room only what it added", async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const room = roomRecorder();
    const db = await documentWithDeck(room, [slide('mine')]);
    const res = await call(db, 'PUT', '/api/documents/D', {
      appendSlides: [slide('mine'), slide('s1'), slide('s2')],
    });
    expect(res.status).toBe(200);
    expect(await storedDecks(db)).toEqual([['mine', 's1', 's2'], ['later']]);
    const relayed = room.calls.filter((c) => c.url.endsWith('/mutation'));
    expect(relayed).toHaveLength(1);
    expect(relayed[0]!.body).toEqual({
      op: { kind: 'deck-slides', slides: [slide('s1'), slide('s2')] },
    });
  });

  it('adds nothing twice, and tells the room nothing, when every slide is already there', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const room = roomRecorder();
    const db = await documentWithDeck(room, [slide('mine')]);
    await call(db, 'PUT', '/api/documents/D', { appendSlides: [slide('mine')] });
    expect(await storedDecks(db)).toEqual([['mine'], ['later']]);
    expect(room.calls.some((c) => c.url.endsWith('/mutation'))).toBe(false);
  });

  it('refuses slides that are not slides, and appendSlides beside a whole deck, writing nothing', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const db = await documentWithDeck(roomRecorder(), [slide('mine')]);
    for (const body of [
      { appendSlides: 'nope' },
      { appendSlides: [{ id: 'x' }] },
      { appendSlides: [slide('s1')], presentation: null },
    ]) {
      expect((await call(db, 'PUT', '/api/documents/D', body)).status).toBe(400);
    }
    expect(await storedDecks(db)).toEqual([['mine'], ['later']]);
  });

  it('refuses an append that would pass the deck cap', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const db = await documentWithDeck(roomRecorder(), [slide('mine')]);
    const huge = { ...slide('big'), notes: 'x'.repeat(256 * 1024) };
    expect((await call(db, 'PUT', '/api/documents/D', { appendSlides: [huge] })).status).toBe(400);
    expect(await storedDecks(db)).toEqual([['mine'], ['later']]);
  });

  it.each([503, 'throw'] as const)(
    'keeps the stored deck when the room cannot be told (%s), and says so in the log',
    async (status) => {
      vi.spyOn(console, 'info').mockImplementation(() => {});
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const db = await documentWithDeck(roomRecorder(status), []);
      await call(db, 'PUT', '/api/documents/D', { appendSlides: [slide('s1')] });
      expect(await storedDecks(db)).toEqual([['s1'], ['later']]);
      expect(warn).toHaveBeenCalledWith(
        '[room-mutation] deck-slides did not reach the room',
        expect.objectContaining({ documentId: 'D' }),
      );
    },
  );
});
