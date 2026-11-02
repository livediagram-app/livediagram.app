// @vitest-environment jsdom

// docs/specs/007-editor/logo-pages.md "Export": every file in the Logo Kit draws the logo alone, without the
// words a template wrote about the page (its `templateNote` text); everything else on the page stays in.

import { afterEach, describe, expect, it, vi } from 'vitest';
import { createShape, createText, layOutPages, newLogoPage, type Tab } from '@livedesign/design';
import { exportTabAsSvg, renderTabToCanvas } from './export-tab';
import { exportLogoKit, logoKitTab } from './export-logo-kit';

vi.mock('./export-tab', () => ({
  exportTabAsSvg: vi.fn(async () => new Blob(['<svg/>'])),
  renderTabToCanvas: vi.fn(async () => {
    const c = document.createElement('canvas');
    c.width = 1024;
    c.height = 1024;
    return c;
  }),
}));

afterEach(() => vi.restoreAllMocks());

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

  it('hands back the tab itself when it has none', () => {
    const plain = { ...tab, elements: [mark, word] } as Tab;
    expect(logoKitTab(plain)).toBe(plain);
  });
});

describe('exportLogoKit', () => {
  it("draws the SVG and every PNG without the template's notes", async () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      drawImage: () => {},
    } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((done) =>
      done(new Blob([new Uint8Array([137, 80, 78, 71])])),
    );
    const [page] = layOutPages(tab.pages!);
    const zip = await exportLogoKit(tab, page!);
    expect(zip.type).toBe('application/zip');
    expect(ids(vi.mocked(exportTabAsSvg).mock.calls[0]![0])).toEqual(['mark', 'word']);
    expect(ids(vi.mocked(renderTabToCanvas).mock.calls[0]![0])).toEqual(['mark', 'word']);
  });
});
