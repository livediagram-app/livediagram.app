import { describe, expect, it } from 'vitest';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import {
  createShape,
  layOutPages,
  pagesOf,
  pageScreenRect,
  type Element,
  type Layer,
  type Page,
  type ScreenLink,
  type ShapeElement,
} from '@livedesign/design';
import {
  FLOW_EDGE_INSET,
  FLOW_ENTRY_FRACTION,
  FLOW_ENTRY_STEP,
  FLOW_GAP_SIDE_PX,
  FLOW_LANE_BASE_PX,
  FLOW_LANE_SPREAD,
  FLOW_LANE_STEP_PX,
  FLOW_PULL_MIN_PX,
  FLOW_STUB_PX,
  adjacentPath,
  arcPath,
  flowLinks,
  showsFlowView,
  type FlowLink,
} from './flow-view';

// docs/specs/007-editor/wireframe-pages.md "Flow view": what the canvas draws from each linked element.
const wire = (id: string, name?: string): Page => ({
  id,
  orientation: 'portrait',
  kind: 'wireframe',
  device: 'iphone',
  ...(name ? { name } : {}),
});
const pages = layOutPages(
  pagesOf({ pages: [wire('p1', 'Home'), wire('p2', 'Cart'), wire('p3'), wire('p4')] }),
);
const screen = (i: number) => pageScreenRect(pages[i]!);
const linked = (
  id: string,
  page: number,
  link: ScreenLink | undefined,
  at = { x: 40, y: 120 },
): ShapeElement => {
  const s = screen(page);
  return { ...createShape('square', s.x + at.x, s.y + at.y), id, ...(link ? { link } : {}) };
};
const to = (pageId: string): ScreenLink => ({ kind: 'page', pageId });

// The numbers of an SVG path, in order.
const nums = (path: string) => (path.match(/-?\d+(\.\d+)?/g) ?? []).map(Number);
const only = (links: FlowLink[]) => {
  expect(links).toHaveLength(1);
  return links[0]!;
};

describe('flowLinks', () => {
  it('draws nothing without a screen link or without pages', () => {
    expect(flowLinks([linked('a', 0, undefined)], undefined, pages, 1)).toEqual([]);
    expect(flowLinks([linked('a', 0, to('p2'))], undefined, [], 1)).toEqual([]);
  });

  it('curves to the screen beside, from the facing side, into its near edge at the element’s height', () => {
    const el = linked('a', 0, to('p2'));
    const link = only(flowLinks([el], undefined, pages, 1));
    expect(link.state).toBe('page');
    if (link.state !== 'page') return;
    expect(link.toPageId).toBe('p2');
    expect(link.start).toEqual({ x: el.x + el.width, y: el.y + el.height / 2 });
    const n = nums(link.path);
    // The end: the target's left edge, at the start's height.
    expect(n.slice(-2)).toEqual([pages[1]!.rect.x, link.start.y]);
  });

  it('goes back left from the left side, into the right edge', () => {
    const el = linked('a', 1, to('p1'));
    const link = only(flowLinks([el], undefined, pages, 1));
    if (link.state !== 'page') throw new Error('page');
    expect(link.start.x).toBe(el.x);
    expect(nums(link.path).slice(-2)[0]).toBe(pages[0]!.rect.x + pages[0]!.rect.width);
  });

  it('arcs over the row to a screen further along, onto its top edge, higher the further it goes', () => {
    const two = only(flowLinks([linked('a', 0, to('p3'))], undefined, pages, 1));
    const three = only(flowLinks([linked('a', 0, to('p4'))], undefined, pages, 1));
    if (two.state !== 'page' || three.state !== 'page') throw new Error('page');
    const top = Math.min(...pages.map((p) => p.rect.y));
    const laneOf = (path: string) => nums(path)[11]!;
    expect(laneOf(two.path)).toBe(top - FLOW_LANE_BASE_PX);
    expect(laneOf(three.path)).toBe(top - FLOW_LANE_BASE_PX - FLOW_LANE_STEP_PX);
    const end = nums(two.path).slice(-2);
    const target = pages[2]!.rect;
    expect(end).toEqual([
      Math.round((target.x + FLOW_ENTRY_FRACTION * target.width) * 10) / 10,
      target.y,
    ]);
  });

  it('lifts an arc to the next free lane over screens an earlier arc already runs over', () => {
    const laneOf = (l: FlowLink) => (l.state === 'page' ? nums(l.path)[11]! : NaN);
    const top = Math.min(...pages.map((p) => p.rect.y));
    // Two arcs of one length over overlapping screens, one each way: never on one lane.
    const [right, left] = flowLinks(
      [linked('a', 0, to('p3')), linked('b', 3, to('p2'))],
      undefined,
      pages,
      1,
    );
    expect(laneOf(right!)).toBe(top - FLOW_LANE_BASE_PX);
    expect(laneOf(left!)).toBe(top - FLOW_LANE_BASE_PX - FLOW_LANE_STEP_PX);
    // A longer arc over them takes the lane above both.
    const three = flowLinks(
      [
        linked('a', 0, to('p3')),
        linked('b', 3, to('p2')),
        linked('c', 0, to('p4'), { x: 40, y: 300 }),
      ],
      undefined,
      pages,
      1,
    );
    expect(laneOf(three[2]!)).toBe(top - FLOW_LANE_BASE_PX - 2 * FLOW_LANE_STEP_PX);
    // A crowd over one stretch climbs no higher than the spread, and shares the top lane past it.
    const crowd = flowLinks(
      Array.from({ length: FLOW_LANE_SPREAD + 3 }, (_, i) =>
        linked(`c${i}`, 0, to('p3'), { x: 40, y: 20 + i * 30 }),
      ),
      undefined,
      pages,
      1,
    );
    const highest = top - FLOW_LANE_BASE_PX - FLOW_LANE_SPREAD * FLOW_LANE_STEP_PX;
    expect(Math.min(...crowd.map(laneOf))).toBe(highest);
    expect(crowd.slice(FLOW_LANE_SPREAD).map(laneOf)).toEqual(Array(3).fill(highest));
  });

  it('rises on its own screen’s side of a gap, apart from an arc the other way', () => {
    const [right, left] = flowLinks(
      [linked('a', 1, to('p4')), linked('b', 2, to('p1'))],
      undefined,
      pages,
      1,
    );
    const gapOf = (l: FlowLink) => (l.state === 'page' ? nums(l.path)[8]! : NaN);
    const middle = (pages[1]!.rect.x + pages[1]!.rect.width + pages[2]!.rect.x) / 2;
    expect(gapOf(right!)).toBeCloseTo(middle - FLOW_GAP_SIDE_PX, 0);
    expect(gapOf(left!)).toBeCloseTo(middle + FLOW_GAP_SIDE_PX, 0);
  });

  it('spreads the arcs landing on one screen', () => {
    const links = flowLinks(
      [linked('a', 0, to('p4')), linked('b', 1, to('p4'), { x: 40, y: 300 })],
      undefined,
      pages,
      1,
    );
    const ends = links.map((l) => (l.state === 'page' ? nums(l.path).at(-2)! : NaN));
    const w = pages[3]!.rect.width;
    expect(ends[1]! - ends[0]!).toBeCloseTo(FLOW_ENTRY_STEP * w, 0);
  });

  it('tags a back link, outlines a link to its own screen, and never draws an arrow for either', () => {
    const links = flowLinks(
      [linked('a', 0, { kind: 'back' }), linked('b', 0, to('p1'), { x: 40, y: 300 })],
      undefined,
      pages,
      1,
    );
    expect(links.map((l) => l.state)).toEqual(['back', 'self']);
  });

  it('gives a broken link a short stub out of its right side, held in screen px', () => {
    const el = linked('a', 0, to('gone'));
    const link = only(flowLinks([el], undefined, pages, 2));
    if (link.state !== 'broken') throw new Error('broken');
    expect(link.stub.from).toEqual({ x: el.x + el.width, y: el.y + el.height / 2 });
    expect(link.stub.to.x - link.stub.from.x).toBe(FLOW_STUB_PX / 2);
  });

  it('cuts the box to the screen, and leaves out elements off every screen or wholly off theirs', () => {
    const s = screen(0);
    const hanging: Element = { ...linked('a', 0, to('p2')), x: s.x - 20, width: 100 };
    const offPage = { ...linked('b', 0, to('p2')), x: -5000, y: -5000 };
    const links = flowLinks([hanging, offPage], undefined, pages, 1);
    expect(links).toHaveLength(1);
    expect(links[0]!.box.x).toBe(s.x);
  });

  it('leaves out an element on the frame’s bezel, beside or above the screen', () => {
    const page = pages[0]!.rect;
    const s = screen(0);
    const side = { ...linked('a', 0, to('p2')), x: page.x + 1, y: s.y + 100, width: 2, height: 2 };
    const above = { ...linked('b', 0, to('p2')), x: s.x + 50, y: page.y + 1, width: 2, height: 2 };
    expect(flowLinks([side, above], undefined, pages, 1)).toEqual([]);
  });

  it('leaves out elements on a hidden layer', () => {
    const layers: Layer[] = [
      { id: 'base', name: 'Base' },
      { id: 'hid', name: 'Hidden', visible: false },
    ];
    const el = { ...linked('a', 0, to('p2')), layerId: 'hid' };
    expect(flowLinks([el], layers, pages, 1)).toEqual([]);
  });

  it('walks a big tab well inside a frame', () => {
    const many: Element[] = [];
    for (let i = 0; i < 4000; i++) {
      const page = i % 4;
      many.push(
        linked(`e${i}`, page, i % 3 === 0 ? to(`p${((page + 2) % 4) + 1}`) : undefined, {
          x: 10 + (i % 30) * 10,
          y: 10 + (i % 70) * 10,
        }),
      );
    }
    const ms = cpuMsOf(() => flowLinks(many, undefined, pages, 0.5));
    expect(ms).toBeLessThan(cpuBudgetMs(40));
  });
});

describe('the paths', () => {
  it('keeps an adjacent end inside the screen’s top and foot', () => {
    const target = { x: 500, y: 0, width: 400, height: 800 };
    const high = nums(adjacentPath({ x: 400, y: -300 }, target, 1, 1)).slice(-2);
    const low = nums(adjacentPath({ x: 400, y: 2000 }, target, 1, 1)).slice(-2);
    expect(high).toEqual([500, FLOW_EDGE_INSET]);
    expect(low).toEqual([500, 800 - FLOW_EDGE_INSET]);
  });

  it('bends a short hop by at least the least pull, in screen px', () => {
    const n = nums(
      adjacentPath({ x: 490, y: 100 }, { x: 500, y: 0, width: 400, height: 800 }, 1, 2),
    );
    expect(n[2]! - 490).toBe(FLOW_PULL_MIN_PX / 2);
  });

  it('rises in the gap beside its screen, never over a screen it passes', () => {
    const link = only(flowLinks([linked('a', 0, to('p3'))], undefined, pages, 1));
    if (link.state !== 'page') throw new Error('page');
    const gapX = nums(link.path)[8]!;
    expect(gapX).toBeGreaterThan(pages[0]!.rect.x + pages[0]!.rect.width);
    expect(gapX).toBeLessThan(pages[1]!.rect.x);
    // Leftwards, the gap on the element's left.
    const back = only(flowLinks([linked('b', 3, to('p1'))], undefined, pages, 1));
    if (back.state !== 'page') throw new Error('page');
    const backGap = nums(back.path)[8]!;
    expect(backGap).toBeLessThan(pages[3]!.rect.x);
    expect(backGap).toBeGreaterThan(pages[2]!.rect.x + pages[2]!.rect.width);
  });

  it('keeps a corner within half of each run it joins', () => {
    const n = nums(arcPath({ x: 0, y: 0 }, 10, { x: 1000, y: 50 }, -100, 1, 40));
    // The first corner starts no further back than the start.
    expect(n[2]).toBe(0);
  });

  it('ends an arc vertical, so its head points down into the screen', () => {
    const n = nums(arcPath({ x: 0, y: 0 }, 60, { x: 1000, y: 50 }, -100, 1, 12));
    const [c2x, , ex] = n.slice(-4);
    expect(c2x).toBe(ex);
  });
});

describe('showsFlowView', () => {
  it('draws while on, on a wireframe tab, never in Zen', () => {
    expect(showsFlowView(true, pages, false)).toBe(true);
    expect(showsFlowView(false, pages, false)).toBe(false);
    expect(showsFlowView(true, pages, true)).toBe(false);
    expect(showsFlowView(true, [{ kind: 'logo' }], undefined)).toBe(false);
    expect(showsFlowView(true, undefined, undefined)).toBe(false);
  });
});
