import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiClaimPlacedImages, claimPlacedImagesOnUnload } from './images';

vi.mock('../guest-token', () => ({
  readGuestToken: () => ({ token: 'guest-jwt', id: 'guest_1', expiresAt: 1 }),
}));

// A Participant's placement claim (docs/specs/009-elements/images.md "Placement grants"): the editor asks the
// document to serve the pictures it places, once each, with its share link.

type Seen = {
  method: string;
  url: string;
  headers: Headers;
  body: string | null;
  keepalive: boolean;
};

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
        keepalive: init?.keepalive === true,
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
  it('posts the ids to the document once, with the share link', async () => {
    const seen = stubFetch(200);
    await apiClaimPlacedImages('guest_1', 'doc 1', ['img-1', 'img-2'], 'code-1');
    await apiClaimPlacedImages('guest_1', 'doc 1', ['img-1'], 'code-1');
    expect(seen).toHaveLength(1);
    expect(seen[0]!.method).toBe('POST');
    expect(seen[0]!.url).toMatch(/\/api\/images\/grants\?d=doc%201$/);
    expect(seen[0]!.headers.get('X-Share-Code')).toBe('code-1');
    expect(seen[0]!.headers.get('Content-Type')).toBe('application/json');
    expect(JSON.parse(seen[0]!.body!)).toEqual({ ids: ['img-1', 'img-2'] });
  });

  it('never throws on a refusal, and claims again next time', async () => {
    const seen = stubFetch(403);
    await expect(
      apiClaimPlacedImages('guest_1', 'doc 2', ['img-3'], null),
    ).resolves.toBeUndefined();
    await apiClaimPlacedImages('guest_1', 'doc 2', ['img-3'], null);
    expect(seen).toHaveLength(2);
  });
});

describe('claimPlacedImagesOnUnload', () => {
  it('sends the claim at once, kept alive past the page, with the share link', () => {
    const seen = stubFetch(200);
    claimPlacedImagesOnUnload('guest_1', 'doc 3', ['img-4'], 'code-3');
    // Synchronously: the page may be gone after this tick.
    expect(seen).toHaveLength(1);
    expect(seen[0]!).toMatchObject({ method: 'POST', keepalive: true });
    expect(seen[0]!.url).toMatch(/\/api\/images\/grants\?d=doc%203$/);
    expect(seen[0]!.headers.get('X-Share-Code')).toBe('code-3');
    expect(seen[0]!.headers.get('Content-Type')).toBe('application/json');
    expect(JSON.parse(seen[0]!.body!)).toEqual({ ids: ['img-4'] });
  });

  it('sends nothing for no pictures, or for one claimed already', async () => {
    const seen = stubFetch(200);
    claimPlacedImagesOnUnload('guest_1', 'doc 4', [], null);
    expect(seen).toHaveLength(0);
    await apiClaimPlacedImages('guest_1', 'doc 4', ['img-5'], null);
    claimPlacedImagesOnUnload('guest_1', 'doc 4', ['img-5'], null);
    expect(seen).toHaveLength(1);
  });
});
