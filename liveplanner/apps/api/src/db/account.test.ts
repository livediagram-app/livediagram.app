import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Env } from '../types';
import { deleteAccount } from './account';

// Closing an account (docs/specs/015-api/api.md "Owner-keyed data"): the pictures they uploaded for Image fields go
// from liveworkspace's media service first; with no service there is nothing to delete there.

afterEach(() => vi.unstubAllGlobals());

const env = { MEDIA_KEY: 'media-key', MEDIA_URL: 'https://media.test/api/media' } as Env;

describe('deleteAccount', () => {
  it("deletes the owner's pictures at the media service", async () => {
    const calls: string[] = [];
    vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
      const req = new Request(input, init);
      calls.push(`${req.method} ${new URL(req.url).pathname}`);
      return Response.json({ deleted: 2 });
    });
    await deleteAccount(env, 'user_ada');
    expect(calls).toEqual(['DELETE /api/media/app/owners/user_ada']);
  });

  it('fails while the service refuses, so the account is deleted again later', async () => {
    vi.stubGlobal('fetch', async () => Response.json({ error: 'internal' }, { status: 500 }));
    await expect(deleteAccount(env, 'user_ada')).rejects.toThrow(/answered 500/);
  });

  it('asks nothing without a media service', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    await deleteAccount({} as Env, 'user_ada');
    expect(fetch).not.toHaveBeenCalled();
  });
});
