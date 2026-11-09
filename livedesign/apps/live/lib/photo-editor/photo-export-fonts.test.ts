import { afterEach, describe, expect, it, vi } from 'vitest';
import { layOutPages, newPhotoPage, type Tab } from '@livedesign/design';

// docs/specs/031-photo/photo-pages.md "Elements on top": a photo export draws the page's elements over the
// composite in their own typefaces. Drawn as an image, the SVG's Google Fonts @import never loaded, so a text
// element in a webfont came out in the fallback face.
const FACE = '@font-face{font-family:"Shantell Sans";src:url(data:font/woff2;base64,AAAA)}';
vi.mock('../export-fonts', () => ({ embeddedFontFaceCss: vi.fn(async () => FACE) }));

const { elementsImage } = await import('./photo-export');

afterEach(() => vi.unstubAllGlobals());

describe('elementsImage', () => {
  it('carries the faces inside the SVG it draws', async () => {
    let drawn = '';
    class FakeImage {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(value: string) {
        drawn = decodeURIComponent(value.slice('data:image/svg+xml;charset=utf-8,'.length));
        queueMicrotask(() => this.onload?.());
      }
    }
    vi.stubGlobal('Image', FakeImage);
    const page = layOutPages([newPhotoPage('a', 400, 300)])[0]!;
    const tab = {
      id: 't',
      name: 'T',
      pages: [page],
      photos: { a: { width: 400, height: 300, layers: [] } },
      elements: [
        {
          id: 'title',
          type: 'text',
          x: page.rect.x + 10,
          y: page.rect.y + 10,
          width: 200,
          height: 40,
          text: 'Hello',
          fontFamily: 'shantell',
        },
      ],
    } as unknown as Tab;
    expect(await elementsImage(tab, page)).not.toBeNull();
    expect(drawn).toContain(FACE);
    expect(drawn).not.toContain('@import');
  });
});
