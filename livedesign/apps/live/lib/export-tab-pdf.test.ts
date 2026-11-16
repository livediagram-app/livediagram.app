import { fileURLToPath } from 'node:url';
import { staticLazyImports } from '@liveworkspace/vector-export/lazy-guard';
import { describe, expect, it, vi } from 'vitest';

// The PDF export (docs/specs/020-import-export/export-fidelity.md "PDF"; liveworkspace/docs/specs/013-export/
// vector-pdf.md): each page's SVG export, drawn as vectors by the shared writer, which loads only when a PDF is made.
const svgPagesToPdf = vi.fn(async () => new Blob(['%PDF'], { type: 'application/pdf' }));
vi.mock('@liveworkspace/vector-export/pdf', () => ({ svgPagesToPdf }));
// Text in a system stack is set in Inter: its faces, fetched by the product's embedder.
vi.mock('./export-fonts', () => ({
  embeddedFontFaceCss: vi.fn(async (ids: string[]) => `css:${ids.join(',')}`),
}));
vi.mock('./export-tab', () => ({
  exportTabAsSvg: vi.fn(
    async (_tab: unknown, o: { page?: { id: string } }) =>
      new Blob([`<svg id="${o.page?.id ?? 'tab'}"/>`]),
  ),
  renderTabToCanvas: vi.fn(async () => ({ width: 1 })),
}));

const { exportPagesAsPdf, exportTabAsPdf } = await import('./export-tab-pdf');
const { exportTabAsSvg, renderTabToCanvas } = await import('./export-tab');

type Page = { svg: string; links?: unknown[]; raster: () => Promise<unknown> };
const pagesOfCall = (n = 0) =>
  svgPagesToPdf.mock.calls[n] as unknown as [Page[], { title: string }];

describe('exportTabAsPdf', () => {
  it('hands the writer the SVG export, its canvas fallback and the tab name', async () => {
    const tab = { id: 't', name: 'Report', elements: [] } as never;
    await exportTabAsPdf(tab, {});
    const [pages, options] = pagesOfCall();
    expect(pages.map((p) => p.svg)).toEqual(['<svg id="tab"/>']);
    expect(options).toEqual({ title: 'Report', fallbackFontCss: expect.any(Function) });
    await expect(
      (options as unknown as { fallbackFontCss: () => Promise<string> }).fallbackFontCss(),
    ).resolves.toBe('css:inter');
    await pages[0]!.raster();
    expect(renderTabToCanvas).toHaveBeenCalledWith(tab, {});
  });
});

describe('exportPagesAsPdf', () => {
  it('writes every page in order, each from its own SVG, sharing one set of motion frames', async () => {
    const tab = { id: 't', name: 'Deck', elements: [], pages: [] } as never;
    const pages = [{ id: 'a' }, { id: 'b' }] as never[];
    await exportPagesAsPdf(tab, pages, {});
    const [out, options] = pagesOfCall();
    expect(out.map((p) => p.svg)).toEqual(['<svg id="a"/>', '<svg id="b"/>']);
    expect(options).toEqual({ title: 'Deck', fallbackFontCss: expect.any(Function) });
    const frames = vi
      .mocked(exportTabAsSvg)
      .mock.calls.map((c) => (c[1] as { motionFrames: unknown }).motionFrames);
    expect(frames[0]).toBeInstanceOf(Map);
    expect(frames[1]).toBe(frames[0]);
    await out[1]!.raster();
    expect(vi.mocked(renderTabToCanvas).mock.calls[0]![1]).toMatchObject({ page: { id: 'b' } });
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
