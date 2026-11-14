import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiAnnounceRoomName } from './room-name';

vi.mock('../guest-token', () => ({ readGuestToken: () => null }));

// docs/specs/014-identity/auth-and-guest-access.md "Presence names": the request names nothing, the api reads the
// profile.
afterEach(() => vi.unstubAllGlobals());

describe('apiAnnounceRoomName', () => {
  it('posts to the room-name door through the share link, with no name in it, and answers the name', async () => {
    const fetchSpy = vi.fn(async () => Response.json({ name: 'Grace' }));
    vi.stubGlobal('fetch', fetchSpy);
    expect(await apiAnnounceRoomName('guest_1', 'doc 1', 'CODE')).toBe('Grace');
    const [url, init] = fetchSpy.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/documents/doc%201/room-name');
    expect(init.method).toBe('POST');
    expect(init.body).toBeUndefined();
    expect(new Headers(init.headers).get('X-Share-Code')).toBe('CODE');
  });

  it('answers null for no name, a refusal or no network', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({ name: null })),
    );
    expect(await apiAnnounceRoomName('guest_1', 'd')).toBeNull();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({}, { status: 404 })),
    );
    expect(await apiAnnounceRoomName('guest_1', 'd')).toBeNull();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('offline');
      }),
    );
    expect(await apiAnnounceRoomName('guest_1', 'd')).toBeNull();
  });
});
