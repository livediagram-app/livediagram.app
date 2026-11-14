import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EditorState } from 'prosemirror-state';
import type { DecorationSet } from 'prosemirror-view';
import type { ArticleBlock } from '@livedocuments/document';
import { blocksToDoc } from './article-convert';
import {
  REPEAT_SLACK,
  keepsHeader,
  measureRepeats,
  repeatBreaks,
  repeatHeaderKey,
  repeatHeaderPlugin,
} from './article-table-repeat';
import { columnTemplate, gripAt, sharesDragged } from './article-table-view';
import { tsvGrid, tsvSlice } from './article-table-paste';
import { hasToc, tocKey, tocPlugin, type TocLine } from './article-toc-view';
import { pageBandLayout } from './article-band-layout';
import { bandOps } from './article-export';
import { linkAnnotation, pdfLinksOn, pdfString } from '../export-pdf-links';

// docs/specs/007-editor/article-pages.md "Tables", "Table of contents", "Headers and footers".

describe('the header row repeated on later pages', () => {
  it('breaks before the row that would run past a page, never with only a header above it', () => {
    // Pages 100 high; a 10 high header, rows of 30, the table starting at 20.
    expect(
      repeatBreaks({ columnHeight: 100, firstTop: 20, rowHeights: [10, 30, 30, 30, 30] }),
    ).toEqual([3]);
    // After a break the header is at the top: row 3 at 10..40, row 4 40..70; row 5 would end on the
    // page's very foot, inside the slack, so it moves on too.
    expect(
      repeatBreaks({ columnHeight: 100, firstTop: 20, rowHeights: [10, 30, 30, 30, 30, 30, 30] }),
    ).toEqual([3, 5]);
    // A row taller than a page breaks inside instead of moving on alone.
    expect(repeatBreaks({ columnHeight: 100, firstTop: 0, rowHeights: [10, 200, 10] })).toEqual([
      2,
    ]);
    expect(repeatBreaks({ columnHeight: 100, firstTop: 0, rowHeights: [] })).toEqual([]);
    // Within the slack it stays.
    expect(
      repeatBreaks({ columnHeight: 100, firstTop: 0, rowHeights: [10, 89 - REPEAT_SLACK + 1] }),
    ).toEqual([]);
  });

  it('stays linear for a 500 row table', () => {
    const rows = Array.from({ length: 501 }, () => 24);
    const ms = cpuMsOf(() => {
      for (let i = 0; i < 100; i++)
        repeatBreaks({ columnHeight: 900, firstTop: 0, rowHeights: rows });
    });
    expect(ms).toBeLessThan(cpuBudgetMs(200));
  });

  it('draws a copy of the header row before each break row, as measured', () => {
    const doc = blocksToDoc([
      {
        id: 't',
        type: 'table',
        header: true,
        cols: [{ id: 'c1', w: 1 }],
        rows: [
          { id: 'r1', cells: [[{ text: 'H' }]] },
          { id: 'r2', cells: [[{ text: 'a' }]] },
          { id: 'r3', cells: [[{ text: 'b' }]] },
        ],
      },
      {
        id: 'u',
        type: 'table',
        cols: [{ id: 'c1', w: 1 }],
        rows: [{ id: 'r1', cells: [[{ text: 'x' }]] }],
      },
    ]);
    const s = EditorState.create({ doc, plugins: [repeatHeaderPlugin] });
    const deco = (st: EditorState) =>
      (repeatHeaderPlugin.props.decorations!.call(repeatHeaderPlugin, st) as DecorationSet).find();
    expect(deco(s)).toHaveLength(0);
    const next = s.apply(
      s.tr.setMeta(
        repeatHeaderKey,
        new Map([
          ['t', ['r3']],
          ['u', ['r1']],
          ['missing', ['r1']],
        ]),
      ),
    );
    // Only the table with a header row gets a copy.
    const found = deco(next);
    expect(found).toHaveLength(1);
    expect(found[0]!.from).toBe(
      1 + doc.child(0).child(0).nodeSize + doc.child(0).child(1).nodeSize,
    );
    // A transaction without the meta keeps them.
    expect(repeatHeaderKey.getState(next.apply(next.tr))!.get('t')).toEqual(['r3']);
  });
});

// "Flowing onto pages": a header row is never left alone at a page's foot (Work Tracker 776).
describe('a header row kept with the row under it', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('starts the whole table on the next page when the header and first row do not fit below the writing', () => {
    // Pages 100 high; the writing above ends at 70: a 10 high header and a 30 high first row reach 110.
    expect(keepsHeader({ columnHeight: 100, rowHeights: [10, 30, 30], aboveFoot: 70 })).toBe(true);
    expect(
      repeatBreaks({ columnHeight: 100, firstTop: 70, rowHeights: [10, 30, 30], aboveFoot: 70 }),
    ).toEqual([0]);
    // Rows after it count from the top of the next page: 10 + 30 + 30 + 30 ends at 100, inside the slack.
    expect(
      repeatBreaks({
        columnHeight: 100,
        firstTop: 70,
        rowHeights: [10, 30, 30, 30],
        aboveFoot: 70,
      }),
    ).toEqual([0, 3]);
    // Measured again once the table has moved (its first row now at the page's top): the same answer.
    expect(
      repeatBreaks({ columnHeight: 100, firstTop: 0, rowHeights: [10, 30, 30], aboveFoot: 70 }),
    ).toEqual([0]);
  });

  it('leaves a table that fits, starts its page, has one row or is too tall as it was', () => {
    // Fits below the writing.
    expect(keepsHeader({ columnHeight: 100, rowHeights: [10, 30], aboveFoot: 50 })).toBe(false);
    expect(
      repeatBreaks({ columnHeight: 100, firstTop: 50, rowHeights: [10, 30], aboveFoot: 50 }),
    ).toEqual([]);
    // Nothing above it: the table is the first block.
    expect(keepsHeader({ columnHeight: 100, rowHeights: [10, 30] })).toBe(false);
    // A header row alone.
    expect(keepsHeader({ columnHeight: 100, rowHeights: [10], aboveFoot: 95 })).toBe(false);
    // A first row taller than a page breaks inside, under its header, where it is.
    expect(keepsHeader({ columnHeight: 100, rowHeights: [10, 95], aboveFoot: 40 })).toBe(false);
  });

  it('leaves a page with notes to the footnote layout', () => {
    expect(
      keepsHeader({ columnHeight: 100, rowHeights: [10, 30], aboveFoot: 70, heightAt: () => 80 }),
    ).toBe(false);
    // Notes on a later page only: this page's foot is the column's.
    expect(
      keepsHeader({
        columnHeight: 100,
        rowHeights: [10, 30],
        aboveFoot: 70,
        heightAt: (p) => (p === 0 ? undefined : 80),
      }),
    ).toBe(true);
  });

  it('draws a column break before the table, and no copy before its own header row', () => {
    const doc = blocksToDoc([
      { id: 'p', type: 'paragraph', runs: [{ text: 'Above' }] },
      {
        id: 't',
        type: 'table',
        header: true,
        cols: [{ id: 'c1', w: 1 }],
        rows: [
          { id: 'r1', cells: [[{ text: 'H' }]] },
          { id: 'r2', cells: [[{ text: 'a' }]] },
          { id: 'r3', cells: [[{ text: 'b' }]] },
        ],
      },
    ]);
    const s = EditorState.create({ doc, plugins: [repeatHeaderPlugin] });
    const next = s.apply(s.tr.setMeta(repeatHeaderKey, new Map([['t', ['r1', 'r3']]])));
    const found = (
      repeatHeaderPlugin.props.decorations!.call(repeatHeaderPlugin, next) as DecorationSet
    ).find();
    expect(found).toHaveLength(2);
    const keep = found.find((d) => d.from === doc.child(0).nodeSize)!;
    expect(keep.to).toBe(doc.child(0).nodeSize + doc.child(1).nodeSize);
    expect((keep as unknown as { type: { attrs: { class: string } } }).type.attrs.class).toBe(
      'article-table-keep',
    );
  });

  it('reads where the table would start from the writing above it', () => {
    vi.stubGlobal('getComputedStyle', (el: { style: object }) => el.style);
    const view = fakeView([
      { tag: 'P', rects: [{ bottom: 170 }] },
      { tag: 'TABLE', rows: [10, 30, 30], firstTop: 170 },
    ]);
    const dispatched: unknown[] = [];
    view.dispatch = (tr: { getMeta: (k: unknown) => unknown }) =>
      dispatched.push(tr.getMeta(repeatHeaderKey));
    // Box top 100, scale 1, page 100 high: the paragraph ends at 70, the table's margin is 4.
    expect(measureRepeats(view as never, 100, 1)).toBe(true);
    expect(dispatched[0]).toEqual(new Map([['t', ['r1']]]));
    // With notes on the page the footnote layout keeps them: no break of its own here.
    const noted = fakeView([
      { tag: 'P', rects: [{ bottom: 170 }] },
      { tag: 'TABLE', rows: [10, 30, 30], firstTop: 170 },
    ]);
    const foot = { colOf: () => 0, limit: () => 80 };
    noted.dispatch = (tr: { getMeta: (k: unknown) => unknown }) =>
      dispatched.push(tr.getMeta(repeatHeaderKey));
    measureRepeats(noted as never, 100, 1, foot);
    expect(dispatched[1]).toEqual(new Map([['t', ['r3']]]));
  });

  it('keeps a table that is the first block where it is', () => {
    vi.stubGlobal('getComputedStyle', (el: { style: object }) => el.style);
    const view = fakeView([{ tag: 'TABLE', rows: [10, 30, 30], firstTop: 100 }]);
    expect(measureRepeats(view as never, 100, 1)).toBe(false);
    // A block above with no line boxes (nothing drawn) counts as nothing above.
    const empty = fakeView([
      { tag: 'P', rects: [] },
      { tag: 'TABLE', rows: [10, 30, 30], firstTop: 100 },
    ]);
    expect(measureRepeats(empty as never, 100, 1)).toBe(false);
  });
});

// Just enough of a laid-out article for measureRepeats: blocks with client rects, a table's rows with heights.
function fakeView(
  blocks: (
    { tag: 'P'; rects: { bottom: number }[] } | { tag: 'TABLE'; rows: number[]; firstTop: number }
  )[],
) {
  const els = blocks.map((b, i) => {
    if (b.tag === 'P')
      return {
        previousElementSibling: null as unknown,
        getClientRects: () => b.rects,
      };
    const rows = b.rows.map((h, r) => ({
      offsetHeight: h,
      dataset: { rowId: `r${r + 1}` },
      getBoundingClientRect: () => ({ top: b.firstTop, left: 0 }),
    }));
    return {
      previousElementSibling: null as unknown,
      dataset: { blockId: 't' },
      querySelectorAll: () => rows,
      style: { marginTop: '4px' },
      index: i,
    };
  });
  els.forEach((e, i) => (e.previousElementSibling = i > 0 ? els[i - 1] : null));
  const tables = els.filter((e) => 'querySelectorAll' in e);
  return {
    dom: { clientHeight: 100, querySelectorAll: () => tables },
    state: EditorState.create({ doc: blocksToDoc([]), plugins: [repeatHeaderPlugin] }),
    dispatch: (_tr: { getMeta: (k: unknown) => unknown }): unknown => undefined,
  };
}

describe('column widths', () => {
  it('lays the columns out as fractions', () => {
    expect(columnTemplate([0.25, 0.75])).toBe('0.25fr 0.75fr');
    expect(columnTemplate([])).toBe('1fr');
    expect(columnTemplate([0])).toBe('0.0001fr');
  });

  it('finds the column line under the pointer', () => {
    expect(gripAt([0.5, 0.5], 101, 200, 5)).toBe(1);
    expect(gripAt([0.5, 0.5], 120, 200, 5)).toBe(0);
    expect(gripAt([0.25, 0.25, 0.5], 99, 200, 5)).toBe(2);
  });

  it('moves width across a line, each column keeping its least share', () => {
    expect(sharesDragged([0.5, 0.5], 1, 0.1)).toEqual([0.6, 0.4]);
    expect(sharesDragged([0.5, 0.5], 1, 0.9)).toEqual([0.95, expect.closeTo(0.05)]);
    expect(sharesDragged([0.5, 0.3, 0.2], 1, -0.9)).toEqual([expect.closeTo(0.05), 0.75, 0.2]);
  });
});

describe('tab-separated text', () => {
  it('reads a grid of at least two lines and two columns', () => {
    expect(tsvGrid('a\tb\nc\td\n')).toEqual([
      ['a', 'b'],
      ['c', 'd'],
    ]);
    expect(tsvGrid('a\tb\r\n"two\nlines"\t"say ""hi"""')).toEqual([
      ['a', 'b'],
      ['two\nlines', 'say "hi"'],
    ]);
    expect(tsvGrid('one line\tonly')).toBeNull();
    expect(tsvGrid('no tabs\nat all')).toBeNull();
    expect(tsvGrid('a\tb\nc')).toBeNull();
  });

  it('makes a table block of it, with no header row', () => {
    const slice = tsvSlice('a\tb\nc\t')!;
    const t = slice.content.firstChild!;
    expect(t.type.name).toBe('table');
    expect(t.childCount).toBe(2);
    expect(t.child(0).child(0).type.name).toBe('table_cell');
    expect(t.child(1).child(1).content.size).toBe(0);
    expect(tsvSlice('plain text')).toBeNull();
  });
});

describe('the contents block', () => {
  const blocks: ArticleBlock[] = [
    { id: 'title', type: 'paragraph', style: 'title', runs: [{ text: 'Report' }] },
    { id: 'c', type: 'toc', depth: 2 },
    { id: 'all', type: 'toc' },
    { id: 'h1', type: 'paragraph', style: 'h1', runs: [{ text: 'Intro' }] },
    { id: 'h2', type: 'paragraph', style: 'h2', runs: [{ text: 'Why' }] },
    { id: 'h3', type: 'paragraph', style: 'h3', runs: [{ text: 'Detail' }] },
    { id: 'e', type: 'paragraph', style: 'h1', runs: [] },
  ];
  const linesOf = (s: EditorState) =>
    (tocKey.getState(s)!.decos.find() as { spec: { tocLines: TocLine[] } }[]).map((d) =>
      d.spec.tocLines.map((l) => [l.text, l.level, l.page]),
    );

  it('lists the headings to each block’s depth, with their pages once measured', () => {
    const s = EditorState.create({ doc: blocksToDoc(blocks), plugins: [tocPlugin] });
    expect(hasToc(s)).toBe(true);
    expect(linesOf(s)).toEqual([
      [
        ['Intro', 1, null],
        ['Why', 2, null],
      ],
      [
        ['Intro', 1, null],
        ['Why', 2, null],
        ['Detail', 3, null],
      ],
    ]);
    const measured = s.apply(
      s.tr.setMeta(
        tocKey,
        new Map([
          ['h1', 0],
          ['h2', 2],
        ]),
      ),
    );
    expect(linesOf(measured)[0]).toEqual([
      ['Intro', 1, 1],
      ['Why', 2, 3],
    ]);
    // The same pages again, or a caret move, change nothing.
    expect(
      tocKey.getState(
        measured.apply(
          measured.tr.setMeta(
            tocKey,
            new Map([
              ['h1', 0],
              ['h2', 2],
            ]),
          ),
        ),
      ),
    ).toBe(tocKey.getState(measured));
    // A heading renamed follows at once.
    const renamed = measured.apply(measured.tr.insertText('!', measured.doc.content.size - 3));
    expect(linesOf(renamed)[1]!.map((l) => l[0])).toContain('Detail!');
  });

  it('draws nothing without a contents block', () => {
    const s = EditorState.create({ doc: blocksToDoc([blocks[3]!]), plugins: [tocPlugin] });
    expect(hasToc(s)).toBe(false);
  });
});

describe('headers and footers on a page', () => {
  const page = {
    id: 'p2',
    kind: 'article' as const,
    rect: { x: 0, y: 0, width: 794, height: 1123 },
  };
  const own = [{ id: 'p1' }, { id: 'p2' }];

  it('places the header in its band and the footer on the page number’s line', () => {
    const layout = pageBandLayout(
      { header: { left: '{name}', right: 'Page {page} of {pages}' }, pageNumbers: true },
      own,
      page,
      'Plan',
      '1 November 2026',
    )!;
    expect(layout.header!.parts).toEqual({ left: 'Plan', right: 'Page 2 of 2' });
    expect(layout.header!.y).toBe(104 - 16);
    expect(layout.footer!.parts).toEqual({ center: '2' });
    expect(layout.left).toBeGreaterThan(0);
    expect(layout.right).toBe(794 - layout.left);
  });

  it('shows none on a card, off the article, or on a first page set apart', () => {
    const style = { footer: { left: 'x' }, differentFirstPage: true as const };
    expect(pageBandLayout(style, own, { ...page, kind: 'flashcard' }, '')).toBeNull();
    expect(pageBandLayout(style, [{ id: 'other' }], page, '')).toBeNull();
    expect(pageBandLayout(style, own, { ...page, id: 'p1' }, '')).toBeNull();
    expect(pageBandLayout(undefined, own, page, '')).toBeNull();
  });

  it('draws them as text for an export, each part on its margin, a long one cut', () => {
    const layout = pageBandLayout(
      { header: { left: 'L', center: 'C'.repeat(200) }, footer: { right: 'R' } },
      own,
      page,
      '',
    );
    const ops = bandOps(layout, { x: 1000, y: 2000, width: 794, height: 1123 });
    expect(ops.map((o) => (o.k === 'text' ? [o.anchor, o.text.length < 200] : null))).toEqual([
      ['start', true],
      ['middle', true],
      ['end', true],
    ]);
    expect(ops[0]!.k === 'text' && ops[0]!.x).toBe(1000 + layout!.left);
    expect(ops[2]!.k === 'text' && ops[2]!.y).toBe(2000 + 1123 - layout!.left / 2 + 4);
    expect(bandOps(null, page.rect)).toEqual([]);
  });
});

describe('a PDF’s link areas', () => {
  const page = { rect: { x: 100, y: 0, width: 400, height: 800 } };
  const own = [{ id: 'a' }, { id: 'b' }];
  it('lays contents entries and links over the page in points', () => {
    const links = pdfLinksOn(
      page,
      [
        { x: 140, y: 100, w: 200, h: 20, page: 1 },
        { x: 140, y: 200, w: 40, h: 20, href: 'https://example.com/a b' },
        { x: 140, y: 300, w: 40, h: 20, href: 'javascript:alert(1)' },
        { x: 900, y: 100, w: 20, h: 20, page: 0 },
        { x: 140, y: 400, w: 20, h: 20, page: 0 },
      ],
      own,
      (id) => (id === 'b' ? 3 : -1),
    );
    expect(links).toEqual([
      { x: 30, y: 510, w: 150, h: 15, page: 3 },
      { x: 30, y: 435, w: 30, h: 15, uri: 'https://example.com/a b' },
    ]);
  });

  it('writes link annotations, addresses escaped', () => {
    expect(pdfString('a(b)\\é')).toBe('(a\\(b\\)\\\\%C3%A9)');
    expect(linkAnnotation({ x: 1, y: 2, w: 3, h: 4, page: 0 }, (i) => `${3 + i * 3} 0 R`)).toBe(
      '<< /Type /Annot /Subtype /Link /Rect [1 2 4 6] /Border [0 0 0] /Dest [3 0 R /Fit] >>',
    );
    expect(linkAnnotation({ x: 0, y: 0, w: 1, h: 1, uri: 'https://x.y' }, () => '')).toContain(
      '/A << /S /URI /URI (https://x.y) >>',
    );
  });
});
