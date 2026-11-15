// @vitest-environment jsdom

// docs/specs/007-editor/logo-pages.md "Export": every file in the Logo Kit draws the logo alone, without the
// words a template wrote about the page (its `templateNote` text); everything else on the page stays in.
// "Outlined text": the kit's SVG has its text outlined in the faces it fetched, text with no face is lettered in
// Inter, and a face that can't be fetched stops the kit with a sentence naming it.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createShape, createText, layOutPages, newLogoPage, type Tab } from '@livedesign/design';
import { embeddedFontFaces } from './export-fonts';
import { renderTabToCanvas, renderTabToSvg } from './export-tab';
import { exportLogoKit, LOGO_KIT_FALLBACK_FONT, logoKitTab } from './export-logo-kit';
import { outlineSvgText } from './outline-text/outline-svg';
import { OutlineError } from './outline-text/outline-error';

vi.mock('./export-tab', () => ({
  renderTabToSvg: vi.fn((tab: Tab) =>
    tab.elements.some((e) => e.type === 'text') ? '<svg><text>x</text></svg>' : '<svg/>',
  ),
  renderTabToCanvas: vi.fn(async () => {
    const c = document.createElement('canvas');
    c.width = 1024;
    c.height = 1024;
    return c;
  }),
}));
vi.mock('./export-fonts', () => ({
  embeddedFontFaces: vi.fn(async () => ({ css: '@font-face{}', missing: [] })),
}));
vi.mock('./outline-text/outline-svg', () => ({
  outlineSvgText: vi.fn(async () => '<svg><path/></svg>'),
}));

beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    drawImage: () => {},
  } as unknown as CanvasRenderingContext2D);
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((done) =>
    done(new Blob([new Uint8Array([137, 80, 78, 71])])),
  );
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.mocked(renderTabToSvg).mockClear();
  vi.mocked(renderTabToCanvas).mockClear();
  vi.mocked(outlineSvgText).mockClear();
});

const mark = { ...createShape('circle', 400, 400), id: 'mark' };
const word = { ...createText(300, 600), id: 'word', label: 'Sunny Side' };
const note = {
  ...createText(60, 60),
  id: 'note',
  label: 'Pick the lockup that fits',
  templateNote: true,
} as const;
const tab = {
  id: 't',
  name: 'Brand',
  elements: [mark, word, note],
  pages: [newLogoPage('logo')],
} as unknown as Tab;

const ids = (t: Tab) => t.elements.map((e) => e.id);

describe('logoKitTab', () => {
  it("leaves out only a template's notes", () => {
    expect(ids(logoKitTab(tab))).toEqual(['mark', 'word']);
  });

  it('letters text with no face in Inter, and keeps a face the tab sets', () => {
    expect(LOGO_KIT_FALLBACK_FONT).toBe('inter');
    expect(logoKitTab(tab).font).toBe('inter');
    expect(logoKitTab({ ...tab, font: 'lobster' }).font).toBe('lobster');
  });

  it('hands back the tab itself when it has no notes and a face', () => {
    const plain = { ...tab, elements: [mark, word], font: 'lora' } as Tab;
    expect(logoKitTab(plain)).toBe(plain);
  });
});

describe('exportLogoKit', () => {
  const [page] = layOutPages(tab.pages!);

  it("draws the SVG and every PNG without the template's notes, with the faces fetched once", async () => {
    const zip = await exportLogoKit(tab, page!);
    expect(zip.type).toBe('application/zip');
    expect(ids(vi.mocked(renderTabToSvg).mock.calls[0]![0])).toEqual(['mark', 'word']);
    const raster = vi.mocked(renderTabToCanvas).mock.calls[0]!;
    expect(ids(raster[0])).toEqual(['mark', 'word']);
    expect(raster[1]).toMatchObject({ fontCss: '@font-face{}', transparentPaper: true });
    expect(vi.mocked(embeddedFontFaces).mock.calls.at(-1)![0]).toContain('inter');
  });

  it('outlines the text of the SVG it zips', async () => {
    await exportLogoKit(tab, page!);
    expect(vi.mocked(outlineSvgText)).toHaveBeenCalledWith(
      '<svg><text>x</text></svg>',
      '@font-face{}',
    );
  });

  it("stops with the face's name when a face of the text couldn't be fetched", async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.mocked(embeddedFontFaces).mockResolvedValueOnce({ css: '', missing: ['Lobster'] });
    const err = await exportLogoKit(tab, page!).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(OutlineError);
    expect((err as Error).message).toContain("Couldn't fetch Lobster");
    expect(vi.mocked(renderTabToCanvas)).not.toHaveBeenCalled();
  });

  it('needs no face for a logo with no text, and still strips the faces through the outliner', async () => {
    vi.mocked(embeddedFontFaces).mockResolvedValueOnce({ css: '', missing: ['Inter'] });
    const shapes = { ...tab, elements: [mark] } as Tab;
    const zip = await exportLogoKit(shapes, page!);
    expect(zip.type).toBe('application/zip');
    expect(vi.mocked(outlineSvgText)).toHaveBeenCalledWith('<svg/>', '');
  });
});
