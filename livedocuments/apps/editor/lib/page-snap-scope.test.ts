// Pages mode's alignment guides keep to one page (docs/specs/007-editor/pages-mode.md "Snapping on a page").
import { describe, expect, it } from 'vitest';
import { layOutPages, type Element } from '@livedocuments/document';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import { snapScope } from './page-snap-scope';

const pages = layOutPages([
  { id: 'p1', orientation: 'portrait' },
  { id: 'p2', orientation: 'portrait' },
]);
const [one, two] = pages;
const boxOn = (id: string, page: typeof one, dx = 0): Element =>
  ({
    id,
    type: 'shape',
    shape: 'square',
    x: page!.rect.x + 100 + dx,
    y: page!.rect.y + 100,
    width: 80,
    height: 60,
  }) as unknown as Element;
const edgeOf = (page: typeof one): Element => boxOn(`margin:${page!.id}`, page);
const ids = (els: Element[]) => els.map((e) => e.id);

describe('snapScope', () => {
  const elements = [boxOn('a1', one), boxOn('a2', one, 200), boxOn('b1', two)];
  const boxes = [edgeOf(one), edgeOf(two)];

  it('keeps only what is on the page under the moving box, and that page’s own edges', () => {
    const scope = snapScope(elements, boxes, pages, { ...boxOn('m', one, 400) } as never);
    expect(ids(scope.spaced)).toEqual(['a1', 'a2']);
    expect(ids(scope.aligned)).toEqual(['a1', 'a2', 'margin:p1']);
  });

  it('follows the box onto another page', () => {
    const scope = snapScope(elements, boxes, pages, boxOn('m', two, 300) as never);
    expect(ids(scope.aligned)).toEqual(['b1', 'margin:p2']);
  });

  it('outside Pages mode, everything, page boxes included', () => {
    const scope = snapScope(elements, boxes, undefined, boxOn('m', one) as never);
    expect(scope.spaced).toBe(elements);
    expect(ids(scope.aligned)).toEqual(['a1', 'a2', 'b1', 'margin:p1', 'margin:p2']);
  });

  it('scopes two thousand elements over fifty pages in a few ms of CPU', () => {
    const many = layOutPages(
      Array.from({ length: 50 }, (_, i) => ({ id: `p${i}`, orientation: 'portrait' as const })),
    );
    const els = many.flatMap((p) =>
      Array.from({ length: 40 }, (_, j) => boxOn(`${p.id}-${j}`, p, j)),
    );
    const ms = cpuMsOf(() => snapScope(els, undefined, many, boxOn('m', many[25]) as never));
    expect(ms).toBeLessThan(cpuBudgetMs(20));
  });
});
