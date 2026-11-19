// The index's doors into a design (docs/specs/015-api/api.md "Internal"): where the design stands after a trash.
import { describe, expect, it, vi } from 'vitest';
import { sentJson } from '@liveworkspace/vitest-config/sent-request';
import { sqliteD1 } from '../test-sqlite-d1';
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

// docs/specs/013-workspace/trash.md "Open editors": the index pushes where an item stands after every trash (the api,
// MCP or the Explorer alike), and a trashed design's room tells its editors and closes.
describe('POST /api/internal/items/:id/standing', () => {
  it("tells a trashed design's room, and closes an archived one's sessions", async () => {
    tellTrashed.mockClear();
    closeArchivedSessions.mockClear();
    const stand = (id: string, archived: boolean, trashed: boolean) =>
      handleInternalItems(
        new Request(`https://api.test/api/internal/items/${id}/standing`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${'index-key'}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ archived, trashed, at: 1 }),
        }),
        sqliteD1({ INDEX_KEY: 'index-key' }).env,
      );
    expect((await stand('A', false, true))?.status).toBe(200);
    expect((await stand('B', true, false))?.status).toBe(200);
    expect((await stand('C', false, false))?.status).toBe(200);
    expect(tellTrashed.mock.calls.map(([, id, op]) => [id, op])).toEqual([['A', 'design-trashed']]);
    // Archived from anywhere (one-explorer.md "Archived from elsewhere while open"): B's room closes every session,
    // and a trashed or restored item's never does.
    expect(closeArchivedSessions.mock.calls.map(([, id]) => id)).toEqual(['B']);
    // An archived item sent to the Trash is trashed: its room hears the trash, not the archive.
    expect((await stand('D', true, true))?.status).toBe(200);
    expect(closeArchivedSessions).toHaveBeenCalledTimes(1);
  });
});

// docs/specs/015-api/public-api-and-tokens.md "Revoking a token": liveworkspace's revoke reaches the index, which calls
// this door with the token; the design's room is asked to close exactly that token's sockets (room tests: which close).
describe('POST /api/internal/items/:id/workbench-close with a revoked token', () => {
  const TOKEN = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d';
  function roomEnv(status = 204) {
    const asked: { id: string; path: string; body: unknown }[] = [];
    const env = {
      INDEX_KEY: 'index-key',
      DESIGN_ROOM: {
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

  it("asks the design's room to close the token's sockets", async () => {
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
