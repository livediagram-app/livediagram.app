// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { layOutPages, type ImageElement, type Tab } from '@livedesign/design';
import { renderTabToCanvas } from './export-tab';
import { photoImageKey, type ExportImageMap } from './export-tab-images';

// An image the PNG / PDF export draws through its SVG (a shadow, a turn, an accent edge, a
// finish) embeds its bytes, as the SVG export does, rather than the empty-image placeholder: a
// page's pictures came out of its PDF as empty boxes.

const HREF = 'data:image/png;base64,iVBORw0KGgo=';

// Every SVG the export rasterises, decoded, in the order it asked for them.
let rasterised: string[] = [];

beforeEach(() => {
  rasterised = [];
  const ctx = new Proxy(
    {},
    {
      get: (_, key) =>
        key === 'measureText' ? (text: string) => ({ width: text.length * 7 }) : () => undefined,
      set: () => true,
    },
  );
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx as never);
  class FakeImage {
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    set src(value: string) {
      const prefix = 'data:image/svg+xml;charset=utf-8,';
      if (value.startsWith(prefix)) rasterised.push(decodeURIComponent(value.slice(prefix.length)));
      queueMicrotask(() => this.onload?.());
    }
  }
  vi.stubGlobal('Image', FakeImage);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const image = (overrides: Partial<ImageElement> = {}): ImageElement => ({
  id: 'pic',
  type: 'image',
  x: 0,
  y: 0,
  width: 200,
  height: 120,
  imageId: 'img1',
  ...overrides,
});

const tab = (el: ImageElement) => ({ id: 't', name: 'T', elements: [el] }) as unknown as Tab;

const images = new Map([['img1', { href: HREF, image: {} as HTMLImageElement }]]) as ExportImageMap;

describe('renderTabToCanvas images drawn through their SVG', () => {
  it('embeds a shadowed image', async () => {
    const el = image({ shadow: { offsetX: 0, offsetY: 4, blur: 8, color: '#000000' } } as never);
    await renderTabToCanvas(tab(el), { images, fontCss: '' });
    expect(rasterised.some((svg) => svg.includes(HREF))).toBe(true);
  });

  it('embeds a turned image', async () => {
    await renderTabToCanvas(tab(image({ rotation: 12 })), { images, fontCss: '' });
    expect(rasterised.some((svg) => svg.includes(HREF))).toBe(true);
  });

  it('leaves an image without bytes to its placeholder', async () => {
    await renderTabToCanvas(tab(image({ rotation: 12, imageId: 'missing' })), {
      images,
      fontCss: '',
    });
    expect(rasterised.some((svg) => svg.includes(HREF))).toBe(false);
  });
});

// docs/specs/031-photo/photo-pages.md "Exports and other views": the composite is the page in every
// export. The PNG and PDF drew the empty-photo placeholder while the SVG drew the photo.
describe('renderTabToCanvas on a photo page', () => {
  const photoTab = {
    id: 't',
    name: 'T',
    elements: [],
    pages: [{ id: 'p', orientation: 'landscape', kind: 'photo', size: 'photo' }],
  } as unknown as Tab;
  const page = layOutPages(photoTab.pages as never)[0]!;

  it('draws the photo’s preview, not the placeholder', async () => {
    const photos = new Map([
      [photoImageKey('p'), { href: HREF, image: {} as HTMLImageElement }],
    ]) as ExportImageMap;
    await renderTabToCanvas(photoTab, { page, images: photos, fontCss: '' });
    expect(rasterised.some((svg) => svg.includes(`href="${HREF}"`))).toBe(true);
  });
});
