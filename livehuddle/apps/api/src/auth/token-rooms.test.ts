import { afterEach, describe, expect, it, vi } from 'vitest';
import { noteTokenRoom } from './token-rooms';

// docs/specs/015-api/public-api-and-tokens.md "Revoking a token": a token's room ticket is noted at liveworkspace with
// this app's client credentials, so revoking the token closes the room's sockets at once.
describe('noteTokenRoom', () => {
  afterEach(() => vi.unstubAllGlobals());
  const input = { ownerId: 'user_1', tokenId: 'tok-1', itemId: 'd1', until: 2e12 };

  it('tells accounts with this app’s client', async () => {
    const asked: string[] = [];
    vi.stubGlobal('fetch', async (url: RequestInfo | URL) => {
      asked.push(new URL(url instanceof Request ? url.url : url).pathname);
      return new Response(null, { status: 204 });
    });
    await noteTokenRoom(
      {
        ACCOUNTS_URL: 'https://accounts.test',
        ACCOUNTS_CLIENT_ID: 'livehuddle',
        ACCOUNTS_CLIENT_SECRET: 'secret',
      },
      input,
    );
    expect(asked).toEqual(['/api/account/internal/workbench/token-rooms']);
  });

  it('asks nothing with no accounts configured', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    await noteTokenRoom({}, input);
    expect(fetch).not.toHaveBeenCalled();
  });
});
