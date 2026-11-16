import { fileURLToPath } from 'node:url';
import { staticLazyImports } from '@liveworkspace/vector-export/lazy-guard';
import { describe, expect, it, vi } from 'vitest';

// The PDF export (docs/specs/020-import-export/export-fidelity.md "PDF"; liveworkspace/docs/specs/013-export/
// vector-pdf.md): the tab's SVG export, drawn as vectors by the shared writer, which loads only when a PDF is made.
const svgPagesToPdf = vi.fn(async () => new Blob(['%PDF'], { type: 'application/pdf' }));
vi.mock('@liveworkspace/vector-export/pdf', () => ({ svgPagesToPdf }));
// Text in a system stack is set in Inter: its faces, fetched by the product's embedder.
vi.mock('./export-fonts', () => ({
  embeddedFontFaceCss: vi.fn(async (ids: string[]) => `css:${ids.join(',')}`),
}));
const canvas = { width: 1 };
vi.mock('./export-tab', () => ({
  exportTabAsSvg: vi.fn(async () => new Blob(['<svg/>'])),
  renderTabToCanvas: vi.fn(async () => canvas),
}));

const { exportTabAsPdf } = await import('./export-tab-pdf');
const { exportTabAsSvg, renderTabToCanvas } = await import('./export-tab');

describe('exportTabAsPdf', () => {
  it('hands the writer the SVG export, the canvas render as its fallback, and the tab name as the title', async () => {
    const tab = { id: 't', name: 'Flow', elements: [] } as never;
    const opts = { pattern: true };
    const blob = await exportTabAsPdf(tab, opts);
    expect(blob.type).toBe('application/pdf');
    expect(exportTabAsSvg).toHaveBeenCalledWith(tab, opts);
    const [pages, options] = svgPagesToPdf.mock.calls[0] as unknown as [
      { svg: string; raster: () => Promise<unknown> }[],
      { title: string },
    ];
    expect(pages).toHaveLength(1);
    expect(pages[0]!.svg).toBe('<svg/>');
    expect(options).toEqual({ title: 'Flow', fallbackFontCss: expect.any(Function) });
    await expect(
      (options as unknown as { fallbackFontCss: () => Promise<string> }).fallbackFontCss(),
    ).resolves.toBe('css:inter');
    // The fallback renders only when asked.
    expect(renderTabToCanvas).not.toHaveBeenCalled();
    await expect(pages[0]!.raster()).resolves.toBe(canvas);
    expect(renderTabToCanvas).toHaveBeenCalledWith(tab, opts);
  });
});

describe('the PDF writer stays out of first load', () => {
  it('is reached only by a dynamic import', () => {
    const app = fileURLToPath(new URL('..', import.meta.url));
    const { files, offenders } = staticLazyImports(app, ['app', 'components', 'hooks', 'lib']);
    expect(files).toBeGreaterThan(100);
    expect(offenders).toEqual([]);
  });
});
