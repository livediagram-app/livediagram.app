// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ImageElement, Tab } from '@livediagram/document';
import { renderTabToCanvas } from './export-tab';
import type { ExportImageMap } from './export-tab-images';

// An image the PNG / PDF export draws through its SVG (a shadow, a turn, an accent edge, a
// finish) embeds its bytes, as the SVG export does, rather than the empty-image placeholder: a
// slide deck's pictures came out of its PDF as empty boxes.

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
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
    ctx as unknown as CanvasRenderingContext2D,
  );
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

const images = new Map([
  ['img1', { href: HREF, image: {} as HTMLImageElement }],
]) as ExportImageMap;

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
