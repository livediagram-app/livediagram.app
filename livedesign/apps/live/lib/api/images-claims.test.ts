import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiClaimPlacedImages } from './images';

vi.mock('../guest-token', () => ({
  readGuestToken: () => ({ token: 'guest-jwt', id: 'guest_1', expiresAt: 1 }),
}));

// A Participant's placement claim (docs/specs/009-elements/images.md "Placement grants"): the editor asks the
// design to serve the pictures it places, once each, with its share link.

type Seen = { method: string; url: string; headers: Headers; body: string | null };

function stubFetch(status: number): Seen[] {
  const seen: Seen[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      seen.push({
        method: init?.method ?? 'GET',
        url: String(url),
        headers: new Headers(init?.headers),
        body: typeof init?.body === 'string' ? init.body : null,
      });
      return Response.json(status === 200 ? { granted: 1 } : { error: 'forbidden' }, { status });
    }),
  );
  return seen;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('apiClaimPlacedImages', () => {
  it('posts the ids to the design once, with the share link', async () => {
    const seen = stubFetch(200);
    await apiClaimPlacedImages('guest_1', 'design 1', ['img-1', 'img-2'], 'code-1');
    await apiClaimPlacedImages('guest_1', 'design 1', ['img-1'], 'code-1');
    expect(seen).toHaveLength(1);
    expect(seen[0]!.method).toBe('POST');
    expect(seen[0]!.url).toMatch(/\/api\/images\/grants\?d=design%201$/);
    expect(seen[0]!.headers.get('X-Share-Code')).toBe('code-1');
    expect(seen[0]!.headers.get('Content-Type')).toBe('application/json');
    expect(JSON.parse(seen[0]!.body!)).toEqual({ ids: ['img-1', 'img-2'] });
  });

  it('never throws on a refusal, and claims again next time', async () => {
    const seen = stubFetch(403);
    await expect(
      apiClaimPlacedImages('guest_1', 'design 2', ['img-3'], null),
    ).resolves.toBeUndefined();
    await apiClaimPlacedImages('guest_1', 'design 2', ['img-3'], null);
    expect(seen).toHaveLength(2);
  });
});
