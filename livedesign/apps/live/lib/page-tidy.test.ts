// An infographic page's Tidy Up (docs/specs/007-editor/pages-mode.md "Tidy").
import { describe, expect, it } from 'vitest';
import { isBoxed, layOutPages, pageMargin, type Element, type Page } from '@livedesign/document';
import { buildPageLayout, PAGE_LAYOUTS } from '@livedesign/templates';
import { PAGE_TIDY_GRID, tidyPageElements, type PageTidyInput } from './page-tidy';
import { cpuBudgetMs, cpuMsOf } from '@livedesign/vitest-config/cpu-time';

// A4 portrait: the page is 794 x 1123 centred on the origin, its margin 56, so the content box runs
// x -341..341, y -505.5..505.5, and the tolerance is 0.012 x 794, about 9.5 px.
const [A4] = layOutPages([{ id: 'p', orientation: 'portrait' }]);
const BOX = { left: -341, right: 341, top: -505.5, bottom: 505.5 };

const shape = (id: string, x: number, y: number, width = 100, height = 80, more = {}): Element =>
  ({ id, type: 'shape', shape: 'square', x, y, width, height, ...more }) as unknown as Element;
const text = (id: string, x: number, y: number, width = 120, height = 40): Element =>
  ({ id, type: 'text', text: id, x, y, width, height }) as Element;
const arrow = (id: string, from: string, to: string): Element => ({
  id,
  type: 'arrow',
  from: { kind: 'pinned', elementId: from, anchor: 's' },
  to: { kind: 'pinned', elementId: to, anchor: 'n' },
});

const inputFor = (
  elements: Element[],
  page = A4!,
  lockedIds: ReadonlySet<string> = new Set(),
): PageTidyInput => ({
  ids: new Set(elements.map((e) => e.id)),
  rect: page.rect,
  margin: pageMargin(page),
  lockedIds,
});
const tidy = (elements: Element[], lockedIds?: ReadonlySet<string>) =>
  tidyPageElements(elements, inputFor(elements, A4, lockedIds));
const byId = (elements: Element[]) =>
  new Map(elements.filter(isBoxed).map((e) => [e.id, { x: e.x, y: e.y, w: e.width, h: e.height }]));
const onGrid = (v: number, origin: number) =>
  Math.abs(((v - origin) / PAGE_TIDY_GRID) % 1) < 1e-6 ||
  Math.abs(Math.abs(((v - origin) / PAGE_TIDY_GRID) % 1) - 1) < 1e-6;

type R = { x: number; y: number; width: number; height: number };
const overlaps = (a: R, b: R) =>
  a.x < b.x + b.width - 0.5 &&
  b.x < a.x + a.width - 0.5 &&
  a.y < b.y + b.height - 0.5 &&
  b.y < a.y + a.height - 0.5;

describe('tidyPageElements', () => {
  it('gives back the same array when the page holds nothing, or nothing would change', () => {
    const empty: Element[] = [];
    expect(tidy(empty)).toBe(empty);
    const tidyAlready = [shape('a', -341, -505.5), shape('b', -341, -405.5)];
    expect(tidy(tidyAlready)).toBe(tidyAlready);
  });

  it('nudges a block back inside the margins without scaling it', () => {
    const out = byId(tidy([shape('a', 300, 0)]));
    expect(out.get('a')).toMatchObject({ x: BOX.right - 100, w: 100, h: 80 });
  });

  it('leaves a block bigger than the content box where it is on that side, and tidies what it holds against the margins', () => {
    const bg = shape('bg', A4!.rect.x, A4!.rect.y, A4!.rect.width, A4!.rect.height);
    const card = shape('card', BOX.left + 5, -200, 200, 120);
    const out = byId(tidy([bg, card]));
    expect(out.get('bg')).toMatchObject({ x: A4!.rect.x, y: A4!.rect.y, w: 794, h: 1123 });
    // 5 px off the margin: within the tolerance, so it goes onto the margin.
    expect(out.get('card')!.x).toBe(BOX.left);
  });

  it('puts near-aligned left edges onto one line, the middle one’s', () => {
    const out = byId(
      tidy([shape('a', -200, -400), shape('b', -196, -200), shape('c', -203, 0, 140)]),
    );
    expect(['a', 'b', 'c'].map((id) => out.get(id)!.x)).toEqual([-200, -200, -200]);
  });

  it('puts what lines up with nothing on the grid from the content box’s corner', () => {
    const out = byId(tidy([shape('a', -250.7, -301.2)]));
    expect(onGrid(out.get('a')!.x, BOX.left)).toBe(true);
    expect(onGrid(out.get('a')!.y, BOX.top)).toBe(true);
  });

  it('joins a line two blocks already share rather than moving them', () => {
    const out = byId(tidy([shape('a', -150, -400), shape('b', -150, -200), shape('c', -145, 0)]));
    expect(out.get('c')!.x).toBe(-150);
    expect(out.get('a')!.x).toBe(-150);
  });

  it('centres a block on the page centre line when it is nearly there', () => {
    const out = byId(tidy([shape('a', -46, 0, 100, 80)]));
    expect(out.get('a')!.x).toBe(-50);
  });

  it('evens the gaps of a row of similar blocks, keeping its first and last', () => {
    // Gaps 20, 25, 20, clear of the margins and the centre line; the ends are on the grid.
    const row = [shape('a', -325, 0), shape('b', -205, 0), shape('c', -80, 0), shape('d', 39, 0)];
    const out = byId(tidy(row));
    const xs = ['a', 'b', 'c', 'd'].map((id) => out.get(id)!.x);
    const gaps = xs.slice(1).map((x, i) => x - (xs[i]! + 100));
    for (const g of gaps) expect(g).toBeCloseTo(gaps[0]!, 1);
    expect(xs[0]).toBe(-325);
    expect(xs[3]).toBe(39);
  });

  it('leaves gaps alone that are far from even (a deliberate rhythm)', () => {
    const row = [shape('a', -301, 0), shape('b', -181, 0), shape('c', -1, 0)];
    const out = byId(tidy(row));
    expect(out.get('b')!.x).toBe(-181);
  });

  it('rounds a shape’s size to the grid but never a square shape’s, an image’s or text’s', () => {
    const out = byId(
      tidy([
        shape('rect', -301, -400, 101.3, 79.2),
        shape('circle', -301, -200, 101.3, 101.3, { shape: 'circle' }),
        text('t', -301, 0, 121.3, 41.3),
        {
          id: 'img',
          type: 'image',
          imageId: 'img',
          x: -301,
          y: 200,
          width: 99.3,
          height: 66.2,
        },
      ]),
    );
    expect(out.get('rect')).toMatchObject({ w: 100, h: 80 });
    expect(out.get('circle')).toMatchObject({ w: 101.3, h: 101.3 });
    expect(out.get('t')).toMatchObject({ w: 121.3, h: 41.3 });
    expect(out.get('img')).toMatchObject({ w: 99.3, h: 66.2 });
  });

  it('never moves a locked element, and lines others up with it', () => {
    const out = byId(tidy([shape('lock', -203, -400), shape('b', -197, -200)], new Set(['lock'])));
    expect(out.get('lock')!.x).toBe(-203);
    expect(out.get('b')!.x).toBe(-203);
  });

  it('never moves a rotated element', () => {
    const out = byId(tidy([shape('r', -203, -400, 100, 80, { rotation: 15 })]));
    expect(out.get('r')!.x).toBe(-203);
  });

  it('never makes two blocks overlap that did not, lining up the other way instead', () => {
    // b wants c's line, which would put it into a; it stays, and c comes to it.
    const a = shape('a', -95, 0);
    const b = shape('b', 8, 0);
    const c = shape('c', 0, 300);
    const out = tidy([a, b, c]);
    const m = byId(out);
    const rect = (id: string) => ({
      x: m.get(id)!.x,
      y: m.get(id)!.y,
      width: m.get(id)!.w,
      height: m.get(id)!.h,
    });
    expect(overlaps(rect('a'), rect('b'))).toBe(false);
    expect(m.get('c')!.x).toBe(m.get('b')!.x);
  });

  it('carries what sits inside a block with it, and keeps it inside', () => {
    const card = shape('card', BOX.left + 6, -300, 240, 160);
    const label = text('label', BOX.left + 6 + 20, -300 + 20);
    const out = byId(tidy([card, label]));
    expect(out.get('card')!.x).toBe(BOX.left);
    expect(out.get('label')!.x - out.get('card')!.x).toBe(20);
    expect(out.get('label')!.y - out.get('card')!.y).toBe(20);
  });

  it('keeps the paint order and leaves arrows to follow their ends', () => {
    const els = [shape('a', -203, -400), arrow('ar', 'a', 'b'), shape('b', -197, -200)];
    const out = tidy(els);
    expect(out.map((e) => e.id)).toEqual(['a', 'ar', 'b']);
    expect(out[1]).toBe(els[1]);
  });

  it('touches only the page’s own elements', () => {
    const off = shape('off', 1000, 3);
    const els = [shape('a', 300, 0), off];
    const out = tidyPageElements(els, { ...inputFor(els), ids: new Set(['a']) });
    expect(out[1]).toBe(off);
  });

  it('is idempotent', () => {
    const els = [shape('a', -203, -400), shape('b', -197, -200), shape('c', 300, 13, 90, 70)];
    const once = tidy(els);
    expect(tidy(once)).toBe(once);
  });
});

// Every infographic layout as the layouts build it, jittered the way a few drags leave a page.
describe('tidyPageElements on real layouts', () => {
  const pages = layOutPages([
    { id: 'portrait', orientation: 'portrait' },
    { id: 'landscape', orientation: 'landscape' },
    { id: 'square', orientation: 'portrait', size: 'square' },
  ] as Page[]);
  const random = (seed: number) => () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const jitter = (els: Element[], amp: number, seed: number) => {
    const next = random(seed);
    return els.map((e) =>
      isBoxed(e) ? { ...e, x: e.x + (next() - 0.5) * amp, y: e.y + (next() - 0.5) * amp } : e,
    );
  };

  for (const page of pages) {
    it(`tidies every layout on a ${page.id} page: inside the margins, no new overlaps, idempotent`, () => {
      const m = pageMargin(page);
      const box = {
        x: page.rect.x + m,
        y: page.rect.y + m,
        width: page.rect.width - 2 * m,
        height: page.rect.height - 2 * m,
      };
      const tol = 0.012 * Math.min(page.rect.width, page.rect.height);
      for (const layout of PAGE_LAYOUTS) {
        for (const seed of [3, 29]) {
          const before = jitter(buildPageLayout(layout.id, page), 14, seed);
          const input = inputFor(before, page);
          const after = tidyPageElements(before, input);
          const where = `${layout.id} (seed ${seed})`;
          expect(tidyPageElements(after, input), where).toBe(after);
          const b = before.filter(isBoxed);
          const a = after.filter(isBoxed);
          for (let i = 0; i < a.length; i++) {
            const el = a[i]!;
            // Inside the margins, where it fits, unless going in would overlap a neighbour it
            // did not (no new overlap wins): then it stays exactly where it was.
            const inside =
              el.x >= box.x - 0.5 &&
              el.x + el.width <= box.x + box.width + 0.5 &&
              el.y >= box.y - 0.5 &&
              el.y + el.height <= box.y + box.height + 0.5;
            if (!inside && el.width <= box.width && el.height <= box.height) {
              expect({ x: el.x, y: el.y }, `${where}: outside the margins`).toEqual({
                x: b[i]!.x,
                y: b[i]!.y,
              });
            }
            // Never far: the jitter back, then the tolerance, the grid and evening a gap.
            expect(Math.abs(el.x - b[i]!.x), where).toBeLessThanOrEqual(14 + 2 * tol);
            expect(Math.abs(el.y - b[i]!.y), where).toBeLessThanOrEqual(14 + 2 * tol);
            for (let j = i + 1; j < a.length; j++) {
              if (overlaps(a[i]!, a[j]!)) expect(overlaps(b[i]!, b[j]!), where).toBe(true);
            }
          }
        }
      }
    });
  }

  it('settles a page of 600 elements within its budget', () => {
    const page = pages[0]!;
    const els: Element[] = [];
    const next = random(5);
    for (let i = 0; i < 600; i++) {
      const col = i % 20;
      const row = Math.floor(i / 20);
      els.push(shape(`s${i}`, -330 + col * 33 + next() * 4, -500 + row * 33 + next() * 4, 28, 28));
    }
    const input = inputFor(els, page);
    let out: Element[] = els;
    // CPU time, not wall time: a loaded CI runner stretched the wall clock past the budget (1639 ms on #705).
    const ms = cpuMsOf(() => {
      out = tidyPageElements(els, input);
    });
    expect(tidyPageElements(out, input)).toBe(out);
    // Measured about 120 ms on an M-series Mac; the budget leaves room for a slower CI runner.
    expect(ms).toBeLessThan(cpuBudgetMs(1500));
  });
});
