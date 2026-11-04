import { describe, expect, it } from 'vitest';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import {
  BUBBLE_GAP_PX,
  BUBBLE_SWAP_PX,
  BUBBLE_TAIL_INSET_PX,
  groupWidth,
  layoutBubbles,
  tailShift,
  type BubbleBox,
  type BubbleRect,
} from './bubble-layout';

const H = 67.5;
const box = (id: string, x: number, bottom = 200, width = 120): BubbleBox => ({
  id,
  x,
  bottom,
  width,
  height: H,
});

const overlaps = (a: BubbleRect, b: BubbleRect) =>
  a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

function expectApart(rects: readonly BubbleRect[]) {
  for (let i = 0; i < rects.length; i++)
    for (let j = i + 1; j < rects.length; j++) expect(overlaps(rects[i]!, rects[j]!)).toBe(false);
}

// docs/specs/012-collaboration/video-and-screen-bubbles.md "Close together".
describe('layoutBubbles', () => {
  it('leaves a bubble with room to spare above its head', () => {
    const { dx, rects, order } = layoutBubbles([box('a', 0), box('b', 400)], []);
    expect(dx.get('a')).toBe(0);
    expect(dx.get('b')).toBe(0);
    expect(rects[0]).toEqual({ left: -60, top: 200 - H, right: 60, bottom: 200 });
    expect(order).toEqual(['a', 'b']);
  });

  it('slides two people side by side apart, each as far as the other', () => {
    const { dx, rects } = layoutBubbles([box('b', 40), box('a', 0)], []);
    const half = (120 + BUBBLE_GAP_PX - 40) / 2;
    expect(dx.get('a')).toBeCloseTo(-half);
    expect(dx.get('b')).toBeCloseTo(half);
    expect(rects[1]!.left - rects[0]!.right).toBeCloseTo(BUBBLE_GAP_PX);
  });

  it('keeps a cluster of three and a camera-and-screen pair clear of each other', () => {
    const boxes = [
      box('a', 0),
      box('b', 30, 210),
      box('c', 60, 190),
      box('d', 70, 205, groupWidth(2, 120)),
    ];
    const { rects, order } = layoutBubbles(boxes, []);
    expectApart(rects);
    expect(order).toEqual(['a', 'b', 'c', 'd']);
  });

  it('leaves bubbles at different heights where they are', () => {
    const { dx } = layoutBubbles([box('a', 0), box('b', 10, 200 + H + BUBBLE_GAP_PX)], []);
    expect(dx.get('a')).toBe(0);
    expect(dx.get('b')).toBe(0);
  });

  it('chains rows through a bubble that meets both', () => {
    const { rects } = layoutBubbles([box('a', 0, 200), box('b', 20, 240), box('c', 40, 280)], []);
    expectApart(rects);
  });

  it('swaps two passing people only once they have crossed by the margin', () => {
    // a was left of b; now a is just right of b.
    const near = layoutBubbles([box('a', 10), box('b', 0)], ['a', 'b']);
    expect(near.order).toEqual(['a', 'b']);
    expect(near.dx.get('a')!).toBeLessThan(0);
    const past = layoutBubbles([box('a', BUBBLE_SWAP_PX + 1), box('b', 0)], ['a', 'b']);
    expect(past.order).toEqual(['b', 'a']);
    expectApart(past.rects);
  });

  it('puts a newcomer in by x, swapping on any inversion', () => {
    const { order } = layoutBubbles([box('a', 0), box('n', -5), box('b', 300)], ['a', 'b']);
    expect(order).toEqual(['n', 'a', 'b']);
    const after = layoutBubbles([box('a', 0), box('n', 5), box('b', 300)], ['b', 'a']);
    // b was before a; a newcomer never sits out of x order with its neighbour.
    expect(after.order).toEqual(['a', 'n', 'b']);
  });

  it('settles: laying out again with its own order changes nothing', () => {
    const boxes = [box('a', 10), box('b', 0), box('c', 5, 230)];
    const first = layoutBubbles(boxes, []);
    expect(layoutBubbles(boxes, first.order)).toEqual(first);
  });

  it('lays out the worst case, every bubble received in one huddle, well inside a frame', () => {
    // 6 cameras, 2 of them with screens, and your own camera and screen: 7 groups in one spot.
    const boxes = Array.from({ length: 9 }, (_, i) =>
      box(`p${i}`, (i * 7) % 30, 200 + (i % 3) * 5, groupWidth(i % 3 === 0 ? 2 : 1, 120)),
    );
    let order: string[] = [];
    const run = () => {
      for (let i = 0; i < 1000; i++) order = layoutBubbles(boxes, i % 2 ? order : []).order;
    };
    run();
    const best = Math.min(...[0, 1, 2].map(() => cpuMsOf(run)));
    // 1,000 layouts: about one per walk step for a quarter of an hour of huddling.
    expect(best).toBeLessThan(cpuBudgetMs(50));
    expectApart(layoutBubbles(boxes, []).rects);
  });
});

describe('groupWidth', () => {
  it('is the bubbles and the gaps between them', () => {
    expect(groupWidth(1, 120)).toBe(120);
    expect(groupWidth(2, 120)).toBe(240 + BUBBLE_GAP_PX);
    expect(groupWidth(0, 120)).toBe(0);
  });
});

describe('tailShift', () => {
  it('points back at the head, inside the row’s ends', () => {
    expect(tailShift(0, 120)).toBe(0);
    expect(tailShift(30, 120)).toBe(-30);
    expect(tailShift(-500, 120)).toBe(60 - BUBBLE_TAIL_INSET_PX);
    expect(tailShift(0, 10)).toBe(0);
  });
});
