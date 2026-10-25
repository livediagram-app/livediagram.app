import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('./api/core', () => ({ currentBearer: async () => 'tok' }));

import { explorerLibrary } from './explorer-library';

afterEach(() => vi.unstubAllGlobals());

describe("The Explorer's Library in livedocuments", () => {
  it('has the Image Gallery and no Shape Libraries, as the sites registry says', () => {
    expect(explorerLibrary.gallery).toBeDefined();
    expect(explorerLibrary.shapeLibraries).toBeUndefined();
  });

  it("reads the gallery from this app's own API with the person's Bearer", async () => {
    const fetch = vi.fn(async () =>
      Response.json({
        images: [
          { id: 'img1', contentType: 'image/png', byteSize: 3, width: 1, height: 1, createdAt: 5 },
        ],
      }),
    );
    vi.stubGlobal('fetch', fetch);
    const images = await explorerLibrary.gallery!.list();
    expect(images?.map((i) => i.id)).toEqual(['img1']);
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/images');
    expect(new Headers(init.headers).get('Authorization')).toBe('Bearer tok');
  });
});
