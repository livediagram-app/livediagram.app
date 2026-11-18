import { afterEach, describe, expect, it, vi } from 'vitest';
import { sentJson } from '@liveworkspace/vitest-config/sent-request';
import { mediaGuestOwner } from '@liveworkspace/media';
import { MEDIA_APP } from '../media';
import type { Env } from '../types';
import { handleInternalItems } from './internal-items';

// A guest merged into an account (accounts → index → apps): the pictures they uploaded for Image fields move to the
// account at liveworkspace's media service (internal-items.ts); with no service there is nothing to move, and the
// merge door confirms at once.

const KEY = 'index-key';
const merge = (guest: string, into: unknown, env: Partial<Env> = {}) =>
  handleInternalItems(
    new Request(`https://api.test/api/internal/people/${guest}/merge`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ into }),
    }),
    { INDEX_KEY: KEY, ...env } as Env,
  );

afterEach(() => vi.unstubAllGlobals());

describe('a guest merged into an account', () => {
  it('is confirmed, with nothing to move', async () => {
    const res = await merge('guest_abc', 'user_def');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it('refuses a merge into anything but an account', async () => {
    expect((await merge('guest_abc', 'guest_xyz')).status).toBe(400);
  });

  it("moves the guest's pictures to the account at the media service", async () => {
    const calls: { path: string; body: unknown }[] = [];
    vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
      const req = new Request(input, init);
      calls.push({ path: new URL(req.url).pathname, body: await req.json() });
      return Response.json({ moved: ['img-1'], kept: [] });
    });
    const res = await merge('guest_abc', 'user_def', {
      MEDIA_KEY: 'media-key',
      MEDIA_URL: 'https://media.test/api/media',
    });
    expect(res.status).toBe(200);
    expect(calls).toEqual([
      {
        path: '/api/media/app/owners/merge',
        body: { from: await mediaGuestOwner(MEDIA_APP, 'guest_abc'), to: 'user_def' },
      },
    ]);
  });

  it('is not confirmed while the media service refuses, so the index asks again', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.stubGlobal('fetch', async () => Response.json({ error: 'internal' }, { status: 500 }));
    const res = await merge('guest_abc', 'user_def', { MEDIA_KEY: 'media-key' });
    expect(res.status).toBeGreaterThanOrEqual(500);
  });
});

// docs/specs/015-api/public-api-and-tokens.md "Revoking a token": liveworkspace's revoke reaches the index, which calls
// this door with the token; the plan's room is asked to close exactly that token's sockets (room tests: which close).
describe('POST /api/internal/items/:id/workbench-close with a revoked token', () => {
  const TOKEN = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d';
  function roomEnv(status = 204) {
    const asked: { id: string; path: string; body: unknown }[] = [];
    const env = {
      INDEX_KEY: 'index-key',
      PLAN_ROOM: {
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

  it("asks the plan's room to close the token's sockets", async () => {
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
