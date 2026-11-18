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
  FLOW_DROP_PX,
  FLOW_EDGE_INSET,
  FLOW_ENTRY_INSET,
  FLOW_ENTRY_STEP_PX,
  FLOW_GAP_SIDE_PX,
  FLOW_LANE_BASE_PX,
  FLOW_LANE_SPREAD,
  FLOW_LANE_STEP_PX,
  FLOW_PULL_MIN_PX,
  FLOW_STUB_PX,
  FLOW_TAG_GAP_PX,
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
// The path's points (every x, y pair, corners' control points too), in order.
const points = (path: string) => {
  const n = nums(path);
  return Array.from({ length: n.length / 2 }, (_, i) => ({ x: n[2 * i]!, y: n[2 * i + 1]! }));
};
const r1 = (v: number) => Math.round(v * 10) / 10;
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

  it('arcs over the row to a screen further along, into its near side below its top, higher the further it goes', () => {
    const two = only(flowLinks([linked('a', 0, to('p3'))], undefined, pages, 1));
    const three = only(flowLinks([linked('a', 0, to('p4'))], undefined, pages, 1));
    if (two.state !== 'page' || three.state !== 'page') throw new Error('page');
    const top = Math.min(...pages.map((p) => p.rect.y));
    const laneOf = (path: string) => nums(path)[11]!;
    expect(laneOf(two.path)).toBe(top - FLOW_LANE_BASE_PX);
    expect(laneOf(three.path)).toBe(top - FLOW_LANE_BASE_PX - FLOW_LANE_STEP_PX);
    const target = pages[2]!.rect;
    expect(nums(two.path).slice(-2)).toEqual([target.x, target.y + FLOW_ENTRY_INSET]);
    // It drops in the gap before the target, on the target's side of the gap's middle, FLOW_DROP_PX out.
    expect(nums(two.path)[20]).toBe(target.x - FLOW_DROP_PX);
  });

  it('never crosses the label and toolbar above its target (or any screen’s)', () => {
    // The band the page chrome takes above every page (34 px, 6 px off the top), at a few zooms.
    for (const zoom of [0.25, 0.5, 1, 2]) {
      const links = flowLinks(
        [
          linked('a', 0, to('p3')),
          linked('b', 0, to('p4'), { x: 40, y: 300 }),
          linked('c', 3, to('p1')),
          linked('d', 2, to('p1'), { x: 40, y: 400 }),
        ],
        undefined,
        pages,
        zoom,
      );
      for (const link of links) {
        if (link.state !== 'page') throw new Error('page');
        const pts = points(link.path);
        // Each run joins two points level or upright, so a run inside a band has a point in it, or spans it.
        for (let i = 1; i < pts.length; i++) {
          const a = pts[i - 1]!;
          const b = pts[i]!;
          for (const page of pages) {
            const band = { top: page.rect.y - 40 / zoom, bottom: page.rect.y };
            const xs = [Math.min(a.x, b.x), Math.max(a.x, b.x)];
            const ys = [Math.min(a.y, b.y), Math.max(a.y, b.y)];
            const overlaps =
              xs[0]! < page.rect.x + page.rect.width &&
              page.rect.x < xs[1]! &&
              ys[0]! < band.bottom &&
              band.top < ys[1]!;
            expect(overlaps).toBe(false);
          }
        }
      }
    }
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

  it('nests the arcs into one side of a screen: the higher lane drops nearest and enters highest', () => {
    // a (0 to 3) passes more screens, so takes the higher lane, though b comes first in the walk.
    const [b, a] = flowLinks(
      [linked('b', 1, to('p4'), { x: 40, y: 300 }), linked('a', 0, to('p4'))],
      undefined,
      pages,
      1,
    );
    if (a?.state !== 'page' || b?.state !== 'page') throw new Error('page');
    const target = pages[3]!.rect;
    expect(nums(a.path).slice(-2)).toEqual([target.x, target.y + FLOW_ENTRY_INSET]);
    expect(nums(b.path).slice(-2)).toEqual([
      target.x,
      target.y + FLOW_ENTRY_INSET + FLOW_ENTRY_STEP_PX,
    ]);
    expect(nums(a.path)[20]).toBeGreaterThan(nums(b.path)[20]!);
    expect(nums(a.path)[11]).toBeLessThan(nums(b.path)[11]!);
  });

  it('drops leftward arcs in the gap on the target’s right, clear of the arcs rising there', () => {
    const links = flowLinks(
      [linked('a', 3, to('p1')), linked('b', 1, to('p4'), { x: 40, y: 500 })],
      undefined,
      pages,
      0.25,
    );
    const [left, right] = links;
    if (left?.state !== 'page' || right?.state !== 'page') throw new Error('page');
    const target = pages[0]!.rect;
    const edge = target.x + target.width;
    expect(nums(left.path).slice(-2)).toEqual([r1(edge), r1(target.y + FLOW_ENTRY_INSET)]);
    const dropX = nums(left.path)[20]!;
    const gapMiddle = (edge + pages[1]!.rect.x) / 2;
    // Between the target and the column a leftward arc leaving the next screen would rise in.
    expect(dropX).toBeGreaterThan(edge);
    expect(dropX).toBeLessThan(gapMiddle - FLOW_GAP_SIDE_PX / 0.25 / 4);
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
    expect(link.side).toBe(1);
    expect(link.stub.from).toEqual({ x: el.x + el.width, y: el.y + el.height / 2 });
    expect(link.stub.to.x - link.stub.from.x).toBe(FLOW_STUB_PX / 2);
    expect(link.at).toEqual({ x: link.stub.to.x + FLOW_TAG_GAP_PX / 4, y: link.stub.from.y });
  });

  it('moves a tag to the box’s left where its right would sit over an arc rising in the gap', () => {
    const s = screen(1);
    const edge = { ...linked('x', 1, to('gone')), x: s.x + s.width - 30, width: 20, height: 20 };
    const back = {
      ...linked('y', 1, { kind: 'back' }),
      x: s.x + s.width - 30,
      width: 20,
      height: 20,
      y: s.y + 200,
    };
    // An arc from low on the same screen rises in the gap on its right, past both tags.
    const arc = linked('a', 1, to('p4'), { x: 40, y: 600 });
    const links = flowLinks([edge, back, arc], undefined, pages, 1);
    const [broken, backTag] = links;
    if (broken?.state !== 'broken' || backTag?.state !== 'back') throw new Error('tags');
    expect(broken.side).toBe(-1);
    expect(broken.stub.from.x).toBe(edge.x);
    expect(broken.stub.to.x).toBe(edge.x - FLOW_STUB_PX);
    expect(broken.at.x).toBe(edge.x - FLOW_STUB_PX - FLOW_TAG_GAP_PX / 2);
    expect(backTag.side).toBe(-1);
    expect(backTag.at.x).toBe(back.x - FLOW_TAG_GAP_PX);
    // Without the arc, both keep the right.
    const alone = flowLinks([edge, back], undefined, pages, 1);
    expect(alone.map((l) => (l.state === 'broken' || l.state === 'back' ? l.side : 0))).toEqual([
      1, 1,
    ]);
  });

  it('keeps a tag on the right when arrows run on both sides', () => {
    const s = screen(2);
    const wide = {
      ...linked('w', 2, to('gone')),
      x: s.x + 10,
      width: s.width - 20,
      height: 20,
      y: s.y + 120,
    };
    // Curves to the screens either side, level with the tag.
    const right = {
      ...linked('r', 2, to('p4')),
      x: s.x + s.width - 40,
      width: 20,
      height: 20,
      y: s.y + 120,
    };
    const left = { ...linked('l', 2, to('p2')), x: s.x + 20, width: 20, height: 20, y: s.y + 120 };
    const [tag] = flowLinks([wide, right, left], undefined, pages, 1);
    if (tag?.state !== 'broken') throw new Error('broken');
    expect(tag.side).toBe(1);
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

  it('places a crowd of tags among a crowd of arcs well inside a frame', () => {
    // 4,000 links on four screens, half arcs and half broken, the worst case for placing tags.
    const many: Element[] = [];
    for (let i = 0; i < 4000; i++) {
      const page = i % 2 === 0 ? 0 : 3;
      const link = i % 4 < 2 ? to(page === 0 ? 'p3' : 'p2') : to('gone');
      many.push(linked(`e${i}`, page, link, { x: 10 + (i % 30) * 10, y: 10 + (i % 70) * 10 }));
    }
    // It reruns on every render while the view is on, so the budget holds a warm walk, not the first compile.
    flowLinks(many, undefined, pages, 0.5);
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
    const n = nums(arcPath({ x: 0, y: 0 }, 10, -100, 900, { x: 1000, y: 50 }, 40));
    // The first corner starts no further back than the start.
    expect(n[2]).toBe(0);
    // A drop with no room beside its entry turns no corner there.
    const flush = nums(arcPath({ x: 0, y: 0 }, 60, -100, 1000, { x: 1000, y: 50 }, 12));
    expect(flush.slice(-6)).toEqual([1000, 50, 1000, 50, 1000, 50]);
  });

  it('ends an arc level, so its head points into the screen', () => {
    const n = nums(arcPath({ x: 0, y: 0 }, 60, -100, 970, { x: 1000, y: 50 }, 12));
    const [, qy, ex, ey] = n.slice(-4);
    expect(qy).toBe(ey);
    expect(ex).toBe(1000);
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
