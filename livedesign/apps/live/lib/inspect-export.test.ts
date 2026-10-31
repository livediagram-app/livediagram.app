import { afterEach, describe, expect, it, vi } from 'vitest';
import type { BoxedElement, Element, Tab } from '@livedesign/design';

const exporters = vi.hoisted(() => ({
  exportTabAsPng: vi.fn(async () => new Blob(['png'])),
  exportTabAsSvg: vi.fn(async () => new Blob(['svg'])),
  loadTabImages: vi.fn(async () => new Map()),
  downloadBlob: vi.fn(),
}));
vi.mock('./export-tab', () => exporters);
vi.mock('@liveworkspace/workbench/lib/icon-registry', () => ({
  ensureIconCatalogs: vi.fn(async () => {}),
}));

import { exportInspectedElement, inspectExportName, inspectExportTab } from './inspect-export';

// docs/specs/007-editor/wireframe-pages.md "The Inspect panel": Export.
const box = (id: string, x: number, y: number, w: number, h: number, extra = {}) =>
  ({ id, type: 'shape', shape: 'square', x, y, width: w, height: h, ...extra }) as Element;
const card = box('card', 0, 0, 300, 200);
const inside = box('inside', 20, 20, 50, 50);
const outside = box('outside', 500, 0, 50, 50);
const tab = { id: 't', name: 'Tab', elements: [card, inside, outside] } as unknown as Tab;

afterEach(() => vi.clearAllMocks());

describe('inspectExportTab', () => {
  it('keeps the element and what it holds, nothing else', () => {
    const ids = inspectExportTab(tab, card as BoxedElement).elements.map((e) => e.id);
    expect(ids).toContain('card');
    expect(ids).not.toContain('outside');
  });

  it('keeps only the element when it holds nothing', () => {
    expect(inspectExportTab(tab, outside as BoxedElement).elements.map((e) => e.id)).toEqual([
      'outside',
    ]);
  });
});

describe('inspectExportName', () => {
  it('names the design, the element and the scale', () => {
    expect(inspectExportName('Checkout', 'Button · Pay', 2, 'png')).toMatch(
      /^Checkout - .+@2x\.png$/,
    );
    expect(inspectExportName('', '', 3, 'svg')).toBe('design - element@3x.svg');
  });
});

describe('exportInspectedElement', () => {
  const input = {
    tab,
    el: outside as BoxedElement,
    scale: 3 as const,
    surface: 'light' as const,
    fileName: 'x@3x.png',
  };

  it('draws a PNG at the scale on a clear ground cut to the element', async () => {
    await exportInspectedElement({ ...input, format: 'png' });
    const [scoped, opts] = exporters.exportTabAsPng.mock.calls[0] as unknown as [Tab, object];
    expect(scoped.elements.map((e) => e.id)).toEqual(['outside']);
    expect(opts).toMatchObject({
      scale: 3,
      padding: 0,
      transparent: true,
      pattern: false,
      surface: 'light',
    });
    expect(exporters.loadTabImages).not.toHaveBeenCalled();
    expect(exporters.downloadBlob).toHaveBeenCalledWith(expect.any(Blob), 'x@3x.png');
  });

  it('draws an SVG, loading the design’s images when it has them', async () => {
    const imageContext = { ownerId: 'o', designId: 'd', shareCode: null };
    await exportInspectedElement({ ...input, format: 'svg', fileName: 'x.svg', imageContext });
    expect(exporters.loadTabImages).toHaveBeenCalledOnce();
    expect(exporters.exportTabAsSvg).toHaveBeenCalledOnce();
    expect(exporters.exportTabAsPng).not.toHaveBeenCalled();
  });
});
