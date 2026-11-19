import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiFetchImageBlob, apiFetchImageDataUrl } from './images';

vi.mock('../guest-token', () => ({
  readGuestToken: () => ({ token: 'guest-jwt', id: 'guest_1', expiresAt: 1 }),
}));

// One picture's bytes (docs/specs/009-elements/images.md "A data: id is its own bytes"): an offline
// design's id is its data URL and is read in place; a synced design's id is fetched from the images api.

// A 1x1 transparent PNG.
const PNG_DATA_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

function stubFetch(status: number): string[] {
  const seen: string[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      seen.push(String(url));
      return new Response(status === 200 ? new Blob(['png-bytes'], { type: 'image/png' }) : null, {
        status,
      });
    }),
  );
  return seen;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('apiFetchImageBlob', () => {
  it('reads an offline picture from its data URL, never the images api', async () => {
    const seen = stubFetch(404);
    const blob = await apiFetchImageBlob('guest_1', PNG_DATA_URL, { designId: 'local-1' });
    expect(seen).toEqual([]);
    expect(blob?.type).toBe('image/png');
    const bytes = new Uint8Array(await blob!.arrayBuffer());
    expect([...bytes.slice(1, 4)].map((b) => String.fromCharCode(b)).join('')).toBe('PNG');
  });

  it('gives null for a data URL it cannot decode, without asking the api', async () => {
    const seen = stubFetch(200);
    expect(await apiFetchImageBlob('guest_1', 'data:image/png;base64,!!!')).toBeNull();
    expect(seen).toEqual([]);
  });

  it('fetches a synced picture from the images api, scoped to its design', async () => {
    const seen = stubFetch(200);
    const blob = await apiFetchImageBlob('guest_1', 'img_1', { designId: 'design-1' });
    expect(seen).toHaveLength(1);
    expect(seen[0]).toMatch(/\/api\/images\/img_1\?d=design-1$/);
    expect(await blob!.text()).toBe('png-bytes');
  });

  it('gives null when the api refuses a synced picture', async () => {
    stubFetch(404);
    expect(await apiFetchImageBlob('guest_1', 'img_2')).toBeNull();
  });
});

describe('apiFetchImageDataUrl', () => {
  it('hands a data URL id back as the same picture', async () => {
    const seen = stubFetch(404);
    const href = await apiFetchImageDataUrl('guest_1', PNG_DATA_URL);
    expect(seen).toEqual([]);
    expect(href).toBe(PNG_DATA_URL);
  });
});
