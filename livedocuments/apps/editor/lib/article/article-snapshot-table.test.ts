// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { snapshotWriting, type ArticleDrawOp } from './article-snapshot';

// docs/specs/007-editor/article-pages.md "Everywhere a page goes": a table's rules, a contents entry's dotted
// leader, and what an export leaves out (selected cells' tint, the contents block's chips).

const rect = (left: number, top: number, w: number, h: number) =>
  ({ left, top, right: left + w, bottom: top + h, width: w, height: h }) as DOMRect;

function el(tag: string, style: string, rects: DOMRect[], cls = ''): HTMLElement {
  const e = document.createElement(tag);
  e.setAttribute('style', style);
  if (cls) e.className = cls;
  e.getClientRects = () => rects as unknown as DOMRectList;
  return e;
}

const lines = (ops: ArticleDrawOp[]) =>
  ops.flatMap((o) => (o.k === 'line' ? [[o.x1, o.y1, o.x2, o.y2, o.width, o.dash ?? false]] : []));

describe('a table, as an export draws it', () => {
  it('rules its top and left edges and each cell’s right and bottom, on each page it lies on', () => {
    const root = document.createElement('div');
    // Split across two pages: two rects.
    const table = el(
      'table',
      'border-top: 2px solid #000; border-left: 2px solid #000',
      [rect(0, 0, 100, 40), rect(200, 0, 100, 40)],
      'article-table',
    );
    const cell = el('td', 'border-right: 2px solid #000; border-bottom: 2px solid #000', [
      rect(0, 0, 50, 20),
    ]);
    table.appendChild(cell);
    root.appendChild(table);
    const ops = snapshotWriting(root, (x, y) => ({ x, y }), 1);
    expect(lines(ops)).toEqual(
      expect.arrayContaining([
        [1, 0, 1, 40, 2, false],
        [201, 0, 201, 40, 2, false],
        [0, 1, 100, 1, 2, false],
        [200, 1, 300, 1, 2, false],
        [49, 0, 49, 20, 2, false],
        [0, 19, 50, 19, 2, false],
      ]),
    );
  });

  it('never rules the top or right of anything outside a table', () => {
    const root = document.createElement('div');
    root.appendChild(
      el('p', 'border-top: 2px solid #000; border-right: 2px solid #000', [rect(0, 0, 10, 10)]),
    );
    expect(lines(snapshotWriting(root, (x, y) => ({ x, y }), 1))).toEqual([]);
  });

  it('draws a dotted leader dashed, and leaves out selected cells’ tint and the chips', () => {
    const root = document.createElement('div');
    root.appendChild(el('span', 'border-bottom: 1px dotted #888', [rect(0, 0, 80, 10)]));
    root.appendChild(el('td', 'background-color: #ccddff', [rect(0, 0, 9, 9)], 'selectedCell'));
    const chips = el('div', 'background-color: #eee', [rect(0, 0, 9, 9)], 'article-chrome');
    chips.appendChild(el('button', 'background-color: #eee', [rect(0, 0, 9, 9)]));
    root.appendChild(chips);
    const ops = snapshotWriting(root, (x, y) => ({ x, y }), 1);
    expect(lines(ops)).toEqual([[0, 9.5, 80, 9.5, 1, true]]);
    expect(ops.some((o) => o.k === 'rect')).toBe(false);
  });

  it('draws an opaque colour with no blue in it, and leaves a see-through one out', () => {
    const root = document.createElement('div');
    root.appendChild(el('p', 'background-color: rgb(255, 0, 0)', [rect(0, 0, 9, 9)]));
    root.appendChild(el('p', 'background-color: rgba(255, 0, 0, 0)', [rect(0, 0, 9, 9)]));
    const fills = snapshotWriting(root, (x, y) => ({ x, y }), 1).flatMap((o) =>
      o.k === 'rect' ? [o.fill] : [],
    );
    expect(fills).toEqual(['rgb(255, 0, 0)']);
  });
});
