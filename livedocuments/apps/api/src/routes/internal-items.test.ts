import { beforeEach, describe, expect, it, vi } from 'vitest';
import { sentJson } from '@liveworkspace/vitest-config/sent-request';
import type { Comment, Tab } from '@livedocuments/document';
import { INDEX_ON } from '../test-accounts';
import { sqliteD1, type SqliteD1 } from '../test-sqlite-d1';
import { upsertTab } from '../db/tabs';
import { liveDoc } from '../db/test-image-fixtures';
import { handleInternalItems } from './internal-items';

const { tellTrashed, closeArchivedSessions } = vi.hoisted(() => ({
  tellTrashed: vi.fn(async (_env: unknown, _id: string, _kind: string) => true),
  closeArchivedSessions: vi.fn(async (_env: unknown, _id: string) => true),
}));
vi.mock('../room-access-client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../room-access-client')>()),
  tellTrashed,
  closeArchivedSessions,
}));
// Where it stands, kept by the room for its rules (@liveworkspace/automations/room standing.ts).
const stoodRooms = vi.hoisted(() => [] as string[]);
vi.mock('../document-client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../document-client')>();
  return {
    ...actual,
    documentRoom: (...args: Parameters<typeof actual.documentRoom>) => ({
      ...actual.documentRoom(...args),
      takeStanding: async (standing: { archived: boolean; trashed: boolean }) => {
        stoodRooms.push(`${args[1]}:${standing.archived || standing.trashed ? 'away' : 'live'}`);
      },
    }),
  };
});

// The index's copy door (docs/specs/015-api/api.md "Internal"): a copy made by anyone but the source's owner takes
// the comments as the tab read serves them to that person, other people's author ids redacted.

const OWNER = 'user_ada';
const BOB = 'user_bob';

let db: SqliteD1;

beforeEach(() => {
  db = sqliteD1(INDEX_ON);
});

const comment = (id: string, authorId: string): Comment => ({
  id,
  text: 't',
  createdAt: 1,
  authorName: id,
  authorColor: '#000',
  authorId,
});

const tabWithComments = (): Tab =>
  ({
    id: 't1',
    name: 'One',
    elements: [
      {
        id: 'a',
        type: 'shape',
        shape: 'square',
        x: 0,
        y: 0,
        width: 10,
        height: 10,
        commentThread: { comments: [comment('c1', OWNER), comment('c2', BOB)], resolved: false },
      },
    ],
  }) as unknown as Tab;

async function copy(from: string, to: string, body: Record<string, unknown>) {
  return handleInternalItems(
    new Request(`https://api.test/api/internal/items/${from}/copy-to/${to}`, {
      method: 'POST',
      headers: { Authorization: 'Bearer ldoc-key', 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
    db.env,
  );
}

const copiedAuthors = (documentId: string): (string | undefined)[] => {
  const row = db.sql
    .prepare(
      'SELECT t.data FROM document_tabs dt JOIN tabs t ON t.id = dt.tab_id WHERE dt.document_id = ?',
    )
    .get(documentId) as { data: string };
  const tab = JSON.parse(row.data) as {
    elements: { commentThread: { comments: Comment[] } }[];
  };
  return tab.elements[0]!.commentThread.comments.map((c) => c.authorId);
};

describe('the copy door', () => {
  beforeEach(async () => {
    liveDoc(db.sql, 'S', OWNER);
    await upsertTab(db.env, 'S', tabWithComments(), 0);
  });

  it("redacts other people's comment authors when someone other than the owner copies", async () => {
    expect((await copy('S', 'C', { by: BOB })).status).toBe(201);
    expect(copiedAuthors('C')).toEqual([undefined, BOB]);
  });

  it('keeps every author when the owner copies', async () => {
    expect((await copy('S', 'C', { by: OWNER })).status).toBe(201);
    expect(copiedAuthors('C')).toEqual([OWNER, BOB]);
  });
});

// docs/specs/013-workspace/trash.md "Open editors": the index pushes where an item stands after every trash (the api,
// MCP or the Explorer alike), and a trashed document's room tells its editors and closes.
describe('POST /api/internal/items/:id/standing', () => {
  it("tells a trashed document's room, and closes an archived one's sessions", async () => {
    tellTrashed.mockClear();
    closeArchivedSessions.mockClear();
    const stand = (id: string, archived: boolean, trashed: boolean) =>
      handleInternalItems(
        new Request(`https://api.test/api/internal/items/${id}/standing`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${'ldoc-key'}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ archived, trashed, at: 1 }),
        }),
        db.env,
      );
    expect((await stand('A', false, true))?.status).toBe(200);
    expect((await stand('B', true, false))?.status).toBe(200);
    expect((await stand('C', false, false))?.status).toBe(200);
    expect(tellTrashed.mock.calls.map(([, id, op]) => [id, op])).toEqual([
      ['A', 'document-trashed'],
    ]);
    // Archived from anywhere (one-explorer.md "Archived from elsewhere while open"): B's room closes every session,
    // and a trashed or restored item's never does.
    expect(closeArchivedSessions.mock.calls.map(([, id]) => id)).toEqual(['B']);
    // An archived item sent to the Trash is trashed: its room hears the trash, not the archive.
    expect((await stand('D', true, true))?.status).toBe(200);
    expect(closeArchivedSessions).toHaveBeenCalledTimes(1);
    // Each room keeps where it stands first, for its rules.
    expect(stoodRooms).toEqual(['A:away', 'B:away', 'C:live', 'D:away']);
  });
});

// docs/specs/015-api/public-api-and-tokens.md "Revoking a token": liveworkspace's revoke reaches the index, which calls
// this door with the token; the document's room is asked to close exactly that token's sockets (room tests: which close).
describe('POST /api/internal/items/:id/workbench-close with a revoked token', () => {
  const TOKEN = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d';
  function roomEnv(status = 204) {
    const asked: { id: string; path: string; body: unknown }[] = [];
    const env = {
      INDEX_KEY: 'index-key',
      DOCUMENT_ROOM: {
        idFromName: (name: string) => name,
        get: (id: string) => ({
          fetch: async (url: string, init: RequestInit) => {
            asked.push({ id, path: new URL(url).pathname, body: sentJson(init) });
            return new Response(null, { status });
          },
        }),
      },
    };
    return { env: env as unknown as Parameters<typeof handleInternalItems>[1], asked };
  }
  const close = (env: Parameters<typeof handleInternalItems>[1], body: unknown) =>
    handleInternalItems(
      new Request('https://api.test/api/internal/items/A/workbench-close', {
        method: 'POST',
        headers: { Authorization: 'Bearer index-key', 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }),
      env,
    );

  it("asks the document's room to close the token's sockets", async () => {
    const { env, asked } = roomEnv();
    expect((await close(env, { tokenId: TOKEN }))?.status).toBe(200);
    expect(asked).toEqual([
      { id: 'A', path: '/close-sessions', body: { match: 'token', tokenId: TOKEN } },
    ]);
  });

  it('answers 503 when the room cannot be reached, so the index can say so', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { env } = roomEnv(500);
    expect((await close(env, { tokenId: TOKEN }))?.status).toBe(503);
    warn.mockRestore();
  });
});
