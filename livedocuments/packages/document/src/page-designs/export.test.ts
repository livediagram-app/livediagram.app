import { describe, expect, it } from 'vitest';
import type { Tab } from '../index';
import { layOutPages, pagesOf, type Page } from '../page';
import { pageExportFrame } from '../page-frame';
import { renderPageToSvg } from '../svg-render-pages';
import { pageDesignExportSvg, pageWearsDesign, tabHasPageDesign } from './export';

// docs/specs/011-theme/page-designs.md "Exports and thumbnails": every export draws the still frame.
const slide = (id: string, extra: Partial<Page> = {}): Page => ({
  id,
  orientation: 'landscape',
  size: 'slide',
  kind: 'slide',
  ...extra,
});
const tab = (extra: Partial<Tab> = {}): Tab => ({
  id: 't',
  name: 'T',
  elements: [],
  pages: [
    slide('a'),
    slide('b', { design: { id: 'none' } }),
    slide('c', { design: { id: 'grid' } }),
  ],
  ...extra,
});

describe('page design exports', () => {
  it('draws the still frame at the page, none on a page that opts out', () => {
    const t = tab({ pageDesign: { id: 'aurora', animate: true } });
    const [a, b, c] = layOutPages(pagesOf(t));
    const svg = pageDesignExportSvg(t, a!);
    expect(svg).toContain(`translate(${a!.rect.x} ${a!.rect.y})`);
    expect(svg).not.toMatch(/pd-drift|animation/);
    expect(pageDesignExportSvg(t, b!)).toBe('');
    expect(pageDesignExportSvg(t, c!)).toContain('pattern');
    expect(pageDesignExportSvg(tab(), a!)).toBe('');
  });

  it('dresses a page an article’s estimate adds past the tab’s own, as the editor’s will be', () => {
    const t = tab({ pageDesign: { id: 'grid' } });
    const last = layOutPages(pagesOf(t)).at(-1)!;
    const added = { ...last, id: 'added-1', index: last.index + 1, design: undefined };
    expect(pageDesignExportSvg(t, added)).toContain('pattern');
  });

  it('tells which pages wear a design', () => {
    const t = tab({ pageDesign: { id: 'aurora' } });
    const [a, b, c] = layOutPages(pagesOf(t));
    expect([a, b, c].map((p) => pageWearsDesign(t, p!))).toEqual([true, false, true]);
    expect(pageWearsDesign(tab(), a!)).toBe(false);
    expect(tabHasPageDesign(tab())).toBe(true);
    expect(tabHasPageDesign({ elements: [], pages: [slide('a')] })).toBe(false);
  });

  it('lays the design over the background in the frame and in an agent’s preview', () => {
    const t = tab({ pageDesign: { id: 'waves' } });
    const [a] = layOutPages(pagesOf(t));
    const frame = pageExportFrame(a!, { design: '<g id="DESIGN"/>' });
    expect(frame.backgroundSvg.endsWith('<g id="DESIGN"/>')).toBe(true);
    expect(renderPageToSvg(t, a!)).toContain('clip-path="url(#pg-0-');
  });
});
