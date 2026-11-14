// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { EditorState } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import type { ArticleTableBlock, LaidOutPage } from '@livedocuments/document';
import { blocksToDoc } from './article-convert';
import { flowFrame } from './article-flow-geometry';
import { footnoteKey, footnotesPlugin } from './article-footnotes';
import {
  hiddenSpans,
  measureSplitRows,
  splitLookAttrs,
  splitPartsOf,
} from './article-footnote-split-look';
import { snapshotWriting, type ArticleDrawOp } from './article-snapshot';

// docs/specs/007-editor/article-pages.md "Footnotes", "A table row above the notes": a split row's part ends above
// its page's notes, a closing rule there, on screen and in an export; its rest goes on, ruled, on the next page.

describe('the stretches of a split row left undrawn', () => {
  it("hides each early-ending part from its end to the part's foot, on the strip of its parts", () => {
    // Two parts: 500 tall on page 0 (from 0), 60 on page 1; the part on page 0 ends at 320.
    const parts = [
      { col: 0, top: 0, height: 500 },
      { col: 1, top: 0, height: 60 },
    ];
    expect(hiddenSpans(parts, [{ page: 0, end: 320 }])).toEqual([
      { from: 320, to: 500, part: 0, keep: 320 },
    ]);
    // A part starting lower, ending early on its second page as well.
    expect(
      hiddenSpans(
        [
          { col: 2, top: 40, height: 460 },
          { col: 3, top: 0, height: 500 },
          { col: 4, top: 0, height: 30 },
        ],
        [
          { page: 2, end: 400.2 },
          { page: 3, end: 450 },
        ],
      ),
    ).toEqual([
      { from: 360, to: 460, part: 0, keep: 360 },
      { from: 910, to: 960, part: 1, keep: 450 },
    ]);
  });
  it('hides nothing of a part that ends at its foot or past it', () => {
    expect(hiddenSpans([{ col: 0, top: 0, height: 100 }], [{ page: 0, end: 140 }])).toEqual([]);
    expect(hiddenSpans([{ col: 0, top: 0, height: 100 }], [{ page: 1, end: 20 }])).toEqual([]);
  });
});

describe('a split row’s look', () => {
  it('draws its rules and tint over the drawn stretches, a closing rule where each part ends', () => {
    const attrs = splitLookAttrs([{ from: 320, to: 500, part: 0, keep: 320 }]);
    expect(attrs.class).toBe('article-foot-split');
    expect(attrs['data-foot-keep']).toBe('0:320');
    const style = attrs.style!;
    // The closing rule just above the end, the right rule to it and again from the next part.
    expect(style).toContain('0 319px / 100% 1px no-repeat');
    expect(style).toContain('right 0 top 0px / 1px 320px no-repeat');
    expect(style).toContain('right 0 top 500px / 1px calc(100% - 500px) no-repeat');
    expect(style).toContain('left 0 top 0px / 1px 320px no-repeat');
    expect(style).toContain('--article-foot-tint: ');
    expect(style).not.toMatch(/\b(?:#fff|white)\b/);
  });
});

const views: EditorView[] = [];
afterEach(() => {
  views.splice(0).forEach((v) => v.destroy());
  document.body.replaceChildren();
});

const pages = [0, 1].map(
  (i) =>
    ({
      id: `p${i}`,
      flow: 'f',
      rect: { x: i * 300, y: 0, width: 260, height: 160 },
    }) as LaidOutPage,
);
const frame = flowFrame(pages, 30, 30);
const table: ArticleTableBlock = {
  id: 't',
  type: 'table',
  cols: [{ id: 'c', w: 1 }],
  rows: [{ id: 'r', cells: [[{ text: 'x'.repeat(40) }]] }],
};

describe('measuring a split row', () => {
  function setUp() {
    const view = new EditorView(document.createElement('div'), {
      state: EditorState.create({
        doc: blocksToDoc([table]),
        plugins: [footnotesPlugin(() => {})],
      }),
    });
    views.push(view);
    const tr = view.nodeDOM(1) as HTMLElement;
    (tr.firstElementChild as HTMLElement).style.padding = '0';
    // Its parts: 100 tall on page 0, 40 on page 1.
    tr.getClientRects = () =>
      [
        { left: 0, top: 0, width: 200, height: 100 },
        { left: frame.stride, top: 0, width: 200, height: 40 },
      ] as unknown as DOMRectList;
    return { view, tr };
  }
  const at = { frame, root: { left: 0, top: 0 } as DOMRect, z: 1 };

  it('draws the row ending under its kept lines, never past the notes, and redraws only on a change', () => {
    const { view, tr } = setUp();
    measureSplitRows(view, [{ row: 1, page: 0, bottom: 60, limit: 70 }], at);
    // Under its lowest kept line (60), the cell's padding (none here) and the closing rule.
    expect(footnoteKey.getState(view.state)!.looks).toEqual([
      { row: 1, attrs: expect.objectContaining({ 'data-foot-keep': '0:61' }) },
    ]);
    expect(tr.classList.contains('article-foot-split')).toBe(true);
    const state = view.state;
    measureSplitRows(view, [{ row: 1, page: 0, bottom: 60, limit: 70 }], at);
    expect(view.state).toBe(state);
    // Its kept lines lower than the notes' top: it ends at the notes' top.
    measureSplitRows(view, [{ row: 1, page: 0, bottom: 90, limit: 70 }], at);
    expect(footnoteKey.getState(view.state)!.looks[0]!.attrs['data-foot-keep']).toBe('0:70');
    // No split rows: the look goes.
    measureSplitRows(view, [], at);
    expect(footnoteKey.getState(view.state)!.looks).toEqual([]);
    expect(tr.classList.contains('article-foot-split')).toBe(false);
  });

  it('keeps a look on its row through an edit before it, and drops it with the row', () => {
    const { view } = setUp();
    measureSplitRows(view, [{ row: 1, page: 0, bottom: 60, limit: 70 }], at);
    view.dispatch(view.state.tr.insert(0, view.state.schema.nodes.paragraph!.create()));
    expect(footnoteKey.getState(view.state)!.looks.map((l) => l.row)).toEqual([3]);
    view.dispatch(view.state.tr.delete(2, view.state.doc.content.size));
    expect(footnoteKey.getState(view.state)!.looks).toEqual([]);
  });
});

const rect = (left: number, top: number, w: number, h: number) =>
  ({ left, top, right: left + w, bottom: top + h, width: w, height: h }) as DOMRect;

function el(tag: string, style: string, rects: DOMRect[], parent?: HTMLElement): HTMLElement {
  const e = document.createElement(tag);
  e.setAttribute('style', style);
  e.getClientRects = () => rects as unknown as DOMRectList;
  parent?.appendChild(e);
  return e;
}

const lines = (ops: ArticleDrawOp[]) =>
  ops.flatMap((o) => (o.k === 'line' ? [[o.x1, o.y1, o.x2, o.y2]] : []));

describe('a split row, as an export draws it', () => {
  function splitTable(header = false) {
    // Computed style needs the tree in the document: a detached element has none, as in a browser.
    const root = document.body.appendChild(document.createElement('div'));
    const tableEl = el('table', 'border-top: 1px solid rgb(0, 0, 0)', [rect(0, 0, 100, 200)], root);
    tableEl.className = 'article-table';
    const row = el(
      'tr',
      header ? 'outline-color: rgba(0, 0, 255, 0.1)' : '',
      [rect(0, 0, 100, 200), rect(300, 0, 100, 30)],
      tableEl,
    );
    row.className = 'article-foot-split';
    row.dataset.footKeep = '0:61';
    const cells = [0, 1].map((i) =>
      el(
        header ? 'th' : 'td',
        'border-bottom: 1px solid rgb(0, 0, 0)',
        [rect(i * 50, 0, 50, 200), rect(300 + i * 50, 0, 50, 30)],
        row,
      ),
    );
    return { root, cells };
  }

  it('rules each cell to where its part ends, a closing rule there, and on with the rest', () => {
    const { root } = splitTable();
    const got = lines(snapshotWriting(root, (x, y) => ({ x, y }), 1));
    expect(got).toEqual(
      expect.arrayContaining([
        // The first cell's left rule and both cells' right rules, to 61 on page 0, whole on page 1.
        [0.5, 0, 0.5, 61],
        [49.5, 0, 49.5, 61],
        [99.5, 0, 99.5, 61],
        [349.5, 0, 349.5, 30],
        // Closing rules where the part ends.
        [0, 60.5, 50, 60.5],
        [50, 60.5, 100, 60.5],
      ]),
    );
    // Nothing reaches under the notes.
    expect(got.filter((l) => l[0]! < 200 && Math.max(l[1]!, l[3]!) > 61)).toEqual([]);
  });

  it("fills a split header row's tint only where its parts are drawn", () => {
    const { root } = splitTable(true);
    const fills = snapshotWriting(root, (x, y) => ({ x, y }), 1).flatMap((o) =>
      o.k === 'rect' ? [[o.y, o.h, o.fill]] : [],
    );
    expect(fills).toEqual([
      [0, 61, 'rgba(0, 0, 255, 0.1)'],
      [0, 30, 'rgba(0, 0, 255, 0.1)'],
    ]);
  });

  it('leaves elements outside a split row as they are', () => {
    const plain = document.createElement('td');
    expect(splitPartsOf(plain, [rect(0, 0, 10, 10)], 1)).toBeNull();
    const { cells } = splitTable();
    const inner = el('span', '', [rect(0, 0, 10, 10)], cells[0]);
    expect(splitPartsOf(inner, [rect(0, 0, 10, 10)], 1)).toBeNull();
  });
});
