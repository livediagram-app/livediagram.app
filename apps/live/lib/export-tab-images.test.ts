import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Tab } from '@livediagram/document';

vi.mock('./api/images', () => ({ apiFetchImageDataUrl: vi.fn() }));

import { loadTabImages } from './export-tab-images';

// An image element's id is document data another editor chose, and an inline
// (Offline Mode) id becomes the export SVG's href, so only a base64 raster
// data URL is ever taken as bytes.
describe('loadTabImages inline data URLs', () => {
  beforeEach(() => {
    // jsdom never loads images, so stand in for a decode that succeeds.
    vi.stubGlobal(
      'Image',
      class {
        onload: (() => void) | null = null;
        set src(_: string) {
          queueMicrotask(() => this.onload?.());
        }
      },
    );
  });

  const tabWith = (imageId: string) =>
    ({ elements: [{ id: 'e', type: 'image', imageId }] }) as unknown as Tab;
  const ctx = { ownerId: 'o', documentId: 'd', shareCode: null };

  it('skips an SVG or otherwise non-raster data URL', async () => {
    for (const id of [
      'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg"/>',
      'data:text/html;base64,PHNjcmlwdD4=',
      'data:image/png;base64,AA"/><img>',
    ]) {
      expect((await loadTabImages(tabWith(id), ctx)).size, id).toBe(0);
    }
  });
});

describe('loadTabImages accepts a raster data URL', () => {
  it('keeps a base64 png', async () => {
    vi.stubGlobal(
      'Image',
      class {
        onload: (() => void) | null = null;
        set src(_: string) {
          queueMicrotask(() => this.onload?.());
        }
      },
    );
    const id = 'data:image/png;base64,iVBORw0KGgo=';
    const tab = { elements: [{ id: 'e', type: 'image', imageId: id }] } as unknown as Tab;
    const map = await loadTabImages(tab, { ownerId: 'o', documentId: 'd', shareCode: null });
    expect(map.get(id)?.href).toBe(id);
  });
});
