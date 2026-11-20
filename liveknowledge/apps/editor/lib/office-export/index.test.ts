// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ONE_PIXEL_PNG, everyBlockArticle, everyKindDeck } from './test-tabs';

// docs/specs/020-import-export/office-export.md "Errors": the one entry the dialog calls, with the canvas renderer
// stood in for (its pictures are the image export's, tested there).

const toBlob = vi.fn((done: (b: Blob | null) => void) =>
  done(new Blob([ONE_PIXEL_PNG as BlobPart])),
);
vi.mock('../export-tab', () => ({
  renderTabToCanvas: vi.fn(async () => ({ toBlob })),
}));
vi.mock('../export-fonts', () => ({ embeddedFontFaceCss: vi.fn(async () => '') }));

const { renderTabToCanvas } = await import('../export-tab');
const { exportOfficeFile, OFFICE_EXPORT_MESSAGES } = await import('./index');

afterEach(() => vi.clearAllMocks());

async function bytesOf(blob: Blob): Promise<Uint8Array> {
  return new Uint8Array(await blob.arrayBuffer());
}

describe('exportOfficeFile', () => {
  it('makes a PowerPoint deck, its pictures drawn alone and cut to their place', async () => {
    const { tab, pages, deck } = everyKindDeck();
    const steps: number[] = [];
    const result = await exportOfficeFile(
      { format: 'pptx', tab, pages, deck, title: 'Deck' },
      { onProgress: (p) => steps.push(p) },
    );
    if (!result.ok) throw new Error('not made');
    expect(result.blob.type).toBe(
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    );
    expect([...(await bytesOf(result.blob)).slice(0, 2)]).toEqual([0x50, 0x4b]);
    expect(steps.at(-1)).toBe(1);
    const call = vi.mocked(renderTabToCanvas).mock.calls[0]![1];
    expect(call).toMatchObject({ scale: 2, fontCss: '' });
    expect(call?.only?.size).toBeGreaterThan(0);
    expect(call?.crop).toBeDefined();
  });

  it('makes a Word document in the theme’s accent', async () => {
    const { tab, pages } = everyBlockArticle();
    const result = await exportOfficeFile({ format: 'docx', tab, pages, title: 'Article' });
    if (!result.ok) throw new Error('not made');
    expect(result.blob.type).toBe(
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    );
    expect(vi.mocked(renderTabToCanvas)).toHaveBeenCalledTimes(2);
  });

  it('paints a page background as its own picture at the page’s size', async () => {
    const { tab: base, pages: laid } = everyKindDeck();
    const pages = laid.map((p) => ({ ...p, background: { pattern: 'dots' as const } }));
    const tab = { ...base, elements: [] };
    const result = await exportOfficeFile({
      format: 'pptx',
      tab,
      pages: pages.slice(0, 1),
      title: 'D',
    });
    expect(result.ok).toBe(true);
    const call = vi.mocked(renderTabToCanvas).mock.calls[0]!;
    expect(call[0].elements).toEqual([]);
    expect(call[1]).toMatchObject({ scale: 1, page: pages[0] });
  });

  it('names a tab with no pages left', async () => {
    const { tab } = everyKindDeck();
    expect(await exportOfficeFile({ format: 'pptx', tab, pages: [], title: 'D' })).toEqual({
      ok: false,
      failure: 'gone',
    });
    expect(OFFICE_EXPORT_MESSAGES.gone).toMatch(/no pages/);
  });

  it('names a browser that will not read its canvas back', async () => {
    toBlob.mockImplementationOnce((done) => done(null));
    const { tab, pages } = everyBlockArticle();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(await exportOfficeFile({ format: 'docx', tab, pages, title: 'A' })).toEqual({
      ok: false,
      failure: 'draw',
    });
    toBlob.mockImplementationOnce(() => {
      throw new Error('tainted');
    });
    expect(await exportOfficeFile({ format: 'docx', tab, pages, title: 'A' })).toEqual({
      ok: false,
      failure: 'draw',
    });
    warn.mockRestore();
  });

  it('names anything else as a failure, and a cancel as neither', async () => {
    vi.mocked(renderTabToCanvas).mockRejectedValueOnce(new Error('boom'));
    const { tab, pages } = everyBlockArticle();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(await exportOfficeFile({ format: 'docx', tab, pages, title: 'A' })).toEqual({
      ok: false,
      failure: 'failed',
    });
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
    const controller = new AbortController();
    controller.abort();
    expect(
      await exportOfficeFile(
        { format: 'docx', tab, pages, title: 'A' },
        { signal: controller.signal },
      ),
    ).toEqual({
      ok: false,
      cancelled: true,
    });
  });
});
