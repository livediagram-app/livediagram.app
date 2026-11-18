// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ImageElement, Tab } from '@livehuddle/document';
import { renderTabToCanvas, renderTabToSvg } from './export-tab';
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

  // docs/specs/009-elements/room-builder.md "Export" (Work Tracker 1121): an open Door's swing arc reaches past its
  // box; the PNG's raster frame takes it in, so the PNG draws the swing the SVG export draws.
  it('rasters an open Door in a frame holding the swing the SVG export draws', async () => {
    const door = {
      id: 'door',
      type: 'shape',
      shape: 'door',
      x: 100,
      y: 100,
      width: 60,
      height: 20,
    } as unknown as ImageElement;
    const board = tab(door);
    const svg = renderTabToSvg(board, { fontCss: '' });
    const swing = /<path d="M[\d.]+ [\d.]+ A[\d.]+ [\d.]+ 0 0 1 ([\d.]+) ([\d.]+)"/.exec(svg);
    expect(swing).not.toBeNull();
    // The arc's far end, in board px (the door's group is translated to its box).
    const end = { x: door.x + Number(swing![1]), y: door.y + Number(swing![2]) };
    expect(end.y).toBeGreaterThan(door.y + door.height);
    await renderTabToCanvas(board, { fontCss: '' });
    const raster = rasterised.find((s) => s.includes('stroke-dasharray="4 4"'));
    expect(raster).toBeDefined();
    const [vx, vy, vw, vh] = /viewBox="([^"]+)"/.exec(raster!)![1]!.split(' ').map(Number);
    expect(end.x).toBeGreaterThanOrEqual(vx!);
    expect(end.x).toBeLessThanOrEqual(vx! + vw!);
    expect(end.y).toBeGreaterThanOrEqual(vy!);
    expect(end.y).toBeLessThanOrEqual(vy! + vh!);
    // A shut door draws no swing in either.
    const shut = tab({ ...door, doorClosed: true } as unknown as ImageElement);
    expect(renderTabToSvg(shut, { fontCss: '' })).not.toContain('stroke-dasharray="4 4"');
  });

  it('leaves an image without bytes to its placeholder', async () => {
    await renderTabToCanvas(tab(image({ rotation: 12, imageId: 'missing' })), {
      images,
      fontCss: '',
    });
    expect(rasterised.some((svg) => svg.includes(HREF))).toBe(false);
  });
});
