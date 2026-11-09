import { describe, expect, it } from 'vitest';
import {
  layOutPages,
  newFlashcardPage,
  newSlidePage,
  pagesOf,
  type Tab,
} from '@livedocuments/document';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import { renderTabToSvg } from './export-tab';
import {
  printDocumentHtml,
  printSheets,
  printTabCount,
  sheetScopedSvg,
  type PrintSheet,
} from './print-pages';

// docs/specs/020-import-export/print.md "What prints".

const tab = (id: string, pages?: unknown[], elements: unknown[] = []) =>
  ({ id, name: id, elements, ...(pages ? { pages } : {}) }) as unknown as Tab;
const deck = tab('deck', [newSlidePage('s1'), newSlidePage('s2')]);
const poster = tab('poster', [{ id: 'p1', orientation: 'portrait', kind: 'infographic' }]);
const cards = tab('cards', [newFlashcardPage('c1', 'f')]);
const start = tab('start');
const current = (t: Tab, at = 0) => {
  const pages = layOutPages(pagesOf(t));
  return { tab: t, pages, page: pages[at]! };
};
const ids = (sheets: readonly PrintSheet[]) => sheets.map((s) => `${s.tab.id}:${s.page.id}`);

describe('printSheets', () => {
  it('prints the chosen page of this tab for Current Page', () => {
    expect(ids(printSheets('page', current(deck, 1), [poster, deck]))).toEqual(['deck:s2']);
  });

  it('prints every tab in tab order for Whole Document, skipping a Start screen tab', () => {
    const sheets = printSheets('document', current(deck), [poster, start, deck, cards]);
    expect(ids(sheets)).toEqual(['poster:p1', 'deck:s1', 'deck:s2', 'cards:c1']);
    expect(printTabCount(sheets)).toBe(3);
  });

  it("draws this tab from the dialog's pages, not its stored ones", () => {
    const live = current(deck);
    const moved = { ...live, pages: live.pages.slice().reverse() };
    expect(ids(printSheets('document', moved, [deck]))).toEqual(['deck:s2', 'deck:s1']);
  });

  it("prints this tab alone when the document's list does not hold it", () => {
    expect(ids(printSheets('document', current(deck), [poster]))).toEqual(['deck:s1', 'deck:s2']);
  });

  it('prints an unchosen page that has something on it', () => {
    const drawn = tab('drawn', [{ id: 'd1', orientation: 'portrait' }], [{ id: 'x' }]);
    expect(ids(printSheets('document', current(deck), [drawn, deck]))).toContain('drawn:d1');
  });
});

describe('printDocumentHtml', () => {
  const sheets = printSheets('document', current(deck), [poster, deck, cards]);
  const html = printDocumentHtml(sheets, (s) => `<svg data-page="${s.page.id}"></svg>`);

  it('sizes each sheet exactly its page through one named @page rule per size', () => {
    const rules = [...html.matchAll(/@page (s\d+x\d+)\{size:(\d+)px (\d+)px;margin:0\}/g)];
    expect(rules.map((r) => r[1])).toEqual(['s794x1123', 's1920x1080', 's900x540']);
    const styles = [...html.matchAll(/class="sheet" style="([^"]+)"/g)].map((m) => m[1]);
    expect(styles[0]).toBe('page:s794x1123;width:794px;height:1123px;break-after:page');
    expect(styles[1]).toContain('page:s1920x1080');
    // The last sheet breaks after nothing, so no blank page follows.
    expect(styles.at(-1)).toBe('page:s900x540;width:900px;height:540px');
  });

  it('holds only the sheets, backgrounds printed, the first size the default', () => {
    expect(html).toContain('print-color-adjust:exact');
    expect(html).toContain('-webkit-print-color-adjust:exact');
    expect(html).toMatch(/@page\{size:794px 1123px;margin:0\}/);
    expect([...html.matchAll(/<svg data-page="([^"]+)"/g)].map((m) => m[1])).toEqual([
      'p1',
      's1',
      's2',
      'c1',
    ]);
  });

  it('builds an empty document with no sheets', () => {
    expect(printDocumentHtml([], () => '')).toContain('@page{margin:0}');
  });

  it("builds a 200-page document's markup in a few ms of CPU", () => {
    const many = tab(
      'many',
      Array.from({ length: 200 }, (_, i) => newSlidePage(`s${i}`)),
    );
    const all = printSheets('document', current(many), [many]);
    // Each sheet a drawing of 40 gradients and the 40 shapes painted with them (about 6 KB), so the budget covers
    // making each sheet's ids its own.
    const drawing = `<svg>${Array.from(
      { length: 40 },
      (_, i) =>
        `<linearGradient id="g${i}"><stop offset="0" stop-color="#fff"/></linearGradient><rect data-element-id="e${i}" fill="url(#g${i})" width="10" height="10"/>`,
    ).join('')}</svg>`;
    const ms = cpuMsOf(() => printDocumentHtml(all, () => drawing));
    expect(ms).toBeLessThan(cpuBudgetMs(60));
  });
});

// docs/specs/020-import-export/print.md "What prints": each sheet keeps to its own gradients and patterns.
describe('sheetScopedSvg', () => {
  const painted = (id: string, from: string) =>
    tab(id, [
      {
        id: 'page-1',
        orientation: 'portrait',
        kind: 'infographic',
        background: {
          fill: { kind: 'gradient', from, to: '#ffffff', angle: 90 },
          pattern: 'dots',
        },
      },
    ]);

  it('gives two tabs drawn with the same ids their own, each url(#…) its own sheet', () => {
    const a = painted('a', '#ff0000');
    const b = painted('b', '#0000ff');
    const sheets = printSheets('document', current(a), [a, b]);
    const html = printDocumentHtml(sheets, (s) => renderTabToSvg(s.tab, { page: s.page }));
    const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]!);
    expect(ids.length).toBeGreaterThan(2);
    expect(new Set(ids).size).toBe(ids.length);
    // The second sheet's fill names its own gradient, the blue one.
    const second = html.split('<section').at(-1)!;
    const fill = /fill="url\(#([^)]+)\)"/.exec(second)![1]!;
    expect(fill.startsWith('p1-')).toBe(true);
    expect(new RegExp(`id="${fill}"[^]*?#0000ff`).test(second)).toBe(true);
  });

  it('leaves references it does not own, data ids, and a drawing with no ids', () => {
    const svg =
      '<svg><linearGradient id="g"/><rect data-element-id="g" fill="url(#g)"/>' +
      '<use href="#g"/><use xlink:href="#g"/><rect fill="url(#other)"/></svg>';
    expect(sheetScopedSvg(svg, 3)).toBe(
      '<svg><linearGradient id="p3-g"/><rect data-element-id="g" fill="url(#p3-g)"/>' +
        '<use href="#p3-g"/><use xlink:href="#p3-g"/><rect fill="url(#other)"/></svg>',
    );
    expect(sheetScopedSvg('<svg><rect/></svg>', 0)).toBe('<svg><rect/></svg>');
  });
});
