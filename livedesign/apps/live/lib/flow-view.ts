// The Flow view's geometry (docs/specs/007-editor/wireframe-pages.md "Flow view"): for each visible linked element on a
// screen, its box cut to the screen and what to draw from it: a curve to the screen beside it, an arc over the row to
// a screen further along, a Back tag, or a broken stub. Pure: the layer draws it; every link resolves through
// resolveScreenLink, so a broken one never throws and never points anywhere.
import {
  buildElementIndex,
  contentBounds,
  elementAnchorPoint,
  isScreenLink,
  pageScreenRect,
  resolveScreenLink,
  rowPageAt,
  visibleLayerElements,
  type Element,
  type LaidOutPage,
  type Layer,
} from '@livedesign/design';

// How far (canvas px) an arrow's end keeps inside its screen's top and foot.
export const FLOW_EDGE_INSET = 24;
// A curve's least handle (screen px), so a short hop still bends.
export const FLOW_PULL_MIN_PX = 40;
// An arc's lane over the row (screen px above the highest page it passes), clear of the page labels, and the step
// higher for each further screen it passes and for each earlier arc over the same screens, so no two arcs lie on one
// another.
export const FLOW_LANE_BASE_PX = 44;
export const FLOW_LANE_STEP_PX = 20;
// How far (screen px) an arc rises off its gap's middle, towards its own screen, so a rightward and a leftward arc in
// one gap never share a column.
export const FLOW_GAP_SIDE_PX = 6;
// How many lanes over its own an arc rises to clear earlier arcs: past it, a crowd of arcs over one stretch shares the
// top one rather than climbing off the canvas (and each lane's runs stay apart, so the walk stays linear).
export const FLOW_LANE_SPREAD = 4;
// Where an arc drops beside its target (screen px out from the target's near edge, into the gap), a step further out
// for each arc nested inside it, never past the room the gap leaves on the target's side of the arcs rising in it.
export const FLOW_DROP_PX = 14;
export const FLOW_DROP_STEP_PX = 8;
// Where an arc enters its target's near side: FLOW_ENTRY_INSET (canvas px) below the frame's top, past a phone frame's
// rounded corner onto its straight side, a step (screen px) lower for each arc nested inside it.
export const FLOW_ENTRY_INSET = 64;
export const FLOW_ENTRY_STEP_PX = 14;
// An arc's corner radius (screen px), never more than half the gap it turns in.
export const FLOW_CORNER_PX = 12;
// The broken stub's length (screen px).
export const FLOW_STUB_PX = 32;
// The tags (screen px). The gap between a box (or a stub's end) and its tag, and the clearance kept from an arrow's run
// (its halo's half).
export const FLOW_TAG_GAP_PX = 6;
export const FLOW_TAG_CLEAR_PX = 3;
// What a tag is made of, as FlowViewLayer draws it, so its size is worked out from the same parts (FlowViewLayer.test
// ties them to the drawing): its words, its side padding (`px-2`), its glyph and the gap after it (`gap-1`), its
// padding above and below (`py-0.5`), the line of its `text-xs` text, and its `ring-1`.
export const FLOW_TAG_LABEL = { back: 'Back', broken: 'Broken' } as const;
export const FLOW_TAG_PAD_X_PX = 8;
export const FLOW_TAG_GLYPH_PX = 12;
export const FLOW_TAG_GLYPH_GAP_PX = 4;
export const FLOW_TAG_PAD_Y_PX = 2;
export const FLOW_TAG_LINE_PX = 16;
export const FLOW_TAG_RING_PX = 1;
// Each word's width in the tag's 12 px semibold system face, rounded up (measured in Chrome on macOS, 2026-11-18: Back
// 29.0, Broken 41.4); a face a pixel or two wider is inside FLOW_TAG_CLEAR_PX.
export const FLOW_TAG_TEXT_PX = { back: 30, broken: 42 } as const;
const tagWidth = (kind: keyof typeof FLOW_TAG_TEXT_PX) =>
  2 * FLOW_TAG_PAD_X_PX + FLOW_TAG_GLYPH_PX + FLOW_TAG_GLYPH_GAP_PX + FLOW_TAG_TEXT_PX[kind];
export const FLOW_TAG_WIDTH_PX = { back: tagWidth('back'), broken: tagWidth('broken') } as const;
export const FLOW_TAG_HEIGHT_PX = 2 * FLOW_TAG_PAD_Y_PX + FLOW_TAG_LINE_PX + 2 * FLOW_TAG_RING_PX;

export type FlowRect = { x: number; y: number; width: number; height: number };
export type FlowPoint = { x: number; y: number };

export type FlowLink =
  | {
      state: 'page';
      elementId: string;
      box: FlowRect;
      toPageId: string;
      start: FlowPoint;
      path: string;
    }
  | { state: 'self'; elementId: string; box: FlowRect }
  // `at`: where the tag starts, at its middle height; `side`: which way it runs from there (1 right, -1 left).
  | { state: 'back'; elementId: string; box: FlowRect; at: FlowPoint; side: 1 | -1 }
  | {
      state: 'broken';
      elementId: string;
      box: FlowRect;
      stub: { from: FlowPoint; to: FlowPoint };
      at: FlowPoint;
      side: 1 | -1;
    };

/** Whether the canvas draws the Flow view: while it is on, on a wireframe tab (its first page a wireframe page), never
 *  in Zen. */
export function showsFlowView(
  on: boolean,
  pages: readonly Pick<LaidOutPage, 'kind'>[] | undefined,
  zen: boolean | undefined,
): boolean {
  return on && pages?.[0]?.kind === 'wireframe' && zen !== true;
}

function intersect(a: FlowRect, b: FlowRect): FlowRect | null {
  const x = Math.max(a.x, b.x);
  const y = Math.max(a.y, b.y);
  const right = Math.min(a.x + a.width, b.x + b.width);
  const bottom = Math.min(a.y + a.height, b.y + b.height);
  return right > x && bottom > y ? { x, y, width: right - x, height: bottom - y } : null;
}

// One decimal is finer than any screen pixel at the zooms the canvas allows, and keeps the path short.
const n = (v: number) => String(Math.round(v * 10) / 10);
const pt = (p: FlowPoint) => `${n(p.x)} ${n(p.y)}`;

// Where a curve to the screen beside ends: its near edge, at the start's height kept inside its top and foot.
function adjacentEnd(start: FlowPoint, target: FlowRect, dir: 1 | -1): FlowPoint {
  const top = target.y + Math.min(FLOW_EDGE_INSET, target.height / 2);
  const foot = target.y + target.height - Math.min(FLOW_EDGE_INSET, target.height / 2);
  return {
    x: dir > 0 ? target.x : target.x + target.width,
    y: Math.min(Math.max(start.y, top), foot),
  };
}

/** A curve from `start` to the near edge of the screen beside it, entering at the start's height kept inside the
 *  screen, its handles level. */
export function adjacentPath(
  start: FlowPoint,
  target: FlowRect,
  dir: 1 | -1,
  zoom: number,
): string {
  const { x: ex, y: ey } = adjacentEnd(start, target, dir);
  const pull = Math.max(FLOW_PULL_MIN_PX / zoom, Math.abs(ex - start.x) / 2);
  return `M ${pt(start)} C ${pt({ x: start.x + dir * pull, y: start.y })}, ${pt({ x: ex - dir * pull, y: ey })}, ${pt({ x: ex, y: ey })}`;
}

// The point `r` from `b` towards `a` (`b` itself when they meet).
function toward(b: FlowPoint, a: FlowPoint, r: number): FlowPoint {
  const len = Math.hypot(a.x - b.x, a.y - b.y);
  return len === 0 ? b : { x: b.x + ((a.x - b.x) * r) / len, y: b.y + ((a.y - b.y) * r) / len };
}

/** A path through `points` in straight runs joined by rounded corners of `radius`: a corner never rounds past half a
 *  run it joins (past the whole of the first or the last run, which has no other corner). */
export function roundedPath(points: readonly FlowPoint[], radius: number): string {
  const parts = [`M ${pt(points[0]!)}`];
  const last = points.length - 2;
  for (let i = 1; i <= last; i++) {
    const a = points[i - 1]!;
    const b = points[i]!;
    const c = points[i + 1]!;
    const into = Math.hypot(b.x - a.x, b.y - a.y);
    const out = Math.hypot(c.x - b.x, c.y - b.y);
    const r = Math.max(0, Math.min(radius, i === 1 ? into : into / 2, i === last ? out : out / 2));
    parts.push(`L ${pt(toward(b, a, r))}`, `Q ${pt(b)} ${pt(toward(b, c, r))}`);
  }
  parts.push(`L ${pt(points[points.length - 1]!)}`);
  return parts.join(' ');
}

/** An arc from `start` out to the gap beside its screen (`gapX`), up that gap to a lane at `laneY`, level along it to
 *  `dropX` in the gap beside the target, down that gap and into `entry` on the target's near side: straight runs with
 *  rounded corners, so it never crosses a screen it passes nor the label and toolbar above its target, ending level so
 *  the arrowhead points into the screen. */
export function arcPath(
  start: FlowPoint,
  gapX: number,
  laneY: number,
  dropX: number,
  entry: FlowPoint,
  radius: number,
): string {
  return roundedPath(
    [
      start,
      { x: gapX, y: start.y },
      { x: gapX, y: laneY },
      { x: dropX, y: laneY },
      { x: dropX, y: entry.y },
      entry,
    ],
    radius,
  );
}

// An axis-aligned box an arrow runs through, as [left, top, right, bottom].
type Run = [number, number, number, number];
const runOf = (a: FlowPoint, b: FlowPoint): Run => [
  Math.min(a.x, b.x),
  Math.min(a.y, b.y),
  Math.max(a.x, b.x),
  Math.max(a.y, b.y),
];

// The arrows' runs, gathered through the walk and then put in a coarse grid (canvas px), so a tag checks only the runs
// near it. Upright runs in one column (the arcs rising, or dropping, in one gap) are kept as one run over all of them,
// so a crowd of arcs through one gap costs a tag one check, and the walk stays linear for a tab of scattered links.
const CELL = 128;
class RunGrid {
  private columns = new Map<number, Run>();
  private level: Run[] = [];
  private cells: Map<string, Run[]> | null = null;
  private each(r: Run, fn: (key: string) => boolean | void) {
    for (let cx = Math.floor(r[0] / CELL); cx <= Math.floor(r[2] / CELL); cx++)
      for (let cy = Math.floor(r[1] / CELL); cy <= Math.floor(r[3] / CELL); cy++)
        if (fn(`${cx},${cy}`)) return;
  }
  add(r: Run) {
    if (r[0] !== r[2]) {
      this.level.push(r);
      return;
    }
    const column = this.columns.get(r[0]);
    if (!column) this.columns.set(r[0], r);
    else {
      column[1] = Math.min(column[1], r[1]);
      column[3] = Math.max(column[3], r[3]);
    }
  }
  hits(r: Run): boolean {
    if (!this.cells) {
      const cells = new Map<string, Run[]>();
      for (const run of [...this.columns.values(), ...this.level])
        this.each(run, (key) => {
          const cell = cells.get(key);
          if (cell) cell.push(run);
          else cells.set(key, [run]);
        });
      this.cells = cells;
    }
    const cells = this.cells;
    let hit = false;
    this.each(r, (key) => {
      hit = !!cells
        .get(key)
        ?.some((o) => o[0] <= r[2] && r[0] <= o[2] && o[1] <= r[3] && r[1] <= o[3]);
      return hit;
    });
    return hit;
  }
}

// An arc waiting for its drop: its place among the items, and what it needs to be drawn.
type PendingArc = {
  at: number;
  start: FlowPoint;
  gapX: number;
  laneY: number;
  dir: 1 | -1;
  to: LaidOutPage;
};

// A tag waiting for its side: its place among the items.
type PendingTag = { at: number; kind: 'back' | 'broken'; elementId: string; box: FlowRect };

/** What the Flow view draws, in paint order: one item per visible element on a screen whose link is a screen link. */
export function flowLinks(
  elements: Element[],
  layers: Layer[] | undefined,
  pages: readonly LaidOutPage[],
  zoom: number,
): FlowLink[] {
  if (pages.length === 0 || !elements.some((el) => isScreenLink(el.link))) return [];
  const index = buildElementIndex(elements);
  // Each lane's runs of pages (index ranges) taken by an earlier arc.
  const lanes: Array<Array<[number, number]>> = [];
  const out: FlowLink[] = [];
  const runs = new RunGrid();
  // The arcs into each side of each screen, and the tags, both placed once every arrow is known.
  const arcsInto = new Map<string, PendingArc[]>();
  const tags: PendingTag[] = [];
  for (const el of visibleLayerElements(elements, layers)) {
    const link = el.link;
    if (!isScreenLink(link)) continue;
    const page = rowPageAt(pages, elementAnchorPoint(el, index));
    if (!page) continue;
    const b = contentBounds([el], undefined, elements);
    const box = intersect({ x: b.x, y: b.y, width: b.w, height: b.h }, pageScreenRect(page));
    if (!box) continue;
    const target = resolveScreenLink(link, pages);
    if (target.state === 'back' || target.state === 'broken') {
      tags.push({ at: out.length, kind: target.state, elementId: el.id, box });
      out.push({ state: 'self', elementId: el.id, box });
      continue;
    }
    const to = pages[target.index]!;
    if (to.id === page.id) {
      out.push({ state: 'self', elementId: el.id, box });
      continue;
    }
    const dir = to.index > page.index ? 1 : -1;
    const start = { x: dir > 0 ? box.x + box.width : box.x, y: box.y + box.height / 2 };
    const span = Math.abs(to.index - page.index);
    if (span === 1) {
      // Its handles run level, so the curve keeps inside the box of its ends.
      runs.add(runOf(start, adjacentEnd(start, to.rect, dir)));
      const path = adjacentPath(start, to.rect, dir, zoom);
      out.push({ state: 'page', elementId: el.id, box, toPageId: to.id, start, path });
      continue;
    }
    const lo = Math.min(to.index, page.index);
    const hi = lo + span;
    let rowTop = Infinity;
    for (let i = lo; i <= hi; i++) rowTop = Math.min(rowTop, pages[i]!.rect.y);
    const held = (l: number) => lanes[l]?.some(([a, b]) => a < hi && lo < b) ?? false;
    let lane = span - 2;
    while (lane < span - 2 + FLOW_LANE_SPREAD && held(lane)) lane++;
    if (!held(lane)) (lanes[lane] ??= []).push([lo, hi]);
    const laneY = rowTop - (FLOW_LANE_BASE_PX + FLOW_LANE_STEP_PX * lane) / zoom;
    // The gap between the element's screen and the next one towards the target, just off its middle on the element's
    // side.
    const beside = pages[page.index + dir]!.rect;
    const [gapFrom, gapTo] =
      dir > 0 ? [page.rect.x + page.rect.width, beside.x] : [beside.x + beside.width, page.rect.x];
    const side = Math.min(FLOW_GAP_SIDE_PX / zoom, Math.abs(gapTo - gapFrom) / 4);
    const gapX = (gapFrom + gapTo) / 2 - dir * side;
    runs.add(runOf(start, { x: gapX, y: start.y }));
    runs.add(runOf({ x: gapX, y: start.y }, { x: gapX, y: laneY }));
    const key = `${to.id}\u0000${dir}`;
    const into = arcsInto.get(key);
    const arc = { at: out.length, start, gapX, laneY, dir, to } as const;
    if (into) into.push(arc);
    else arcsInto.set(key, [arc]);
    out.push({ state: 'page', elementId: el.id, box, toPageId: to.id, start, path: '' });
  }
  for (const into of arcsInto.values()) placeDrops(into, pages, zoom, out, runs);
  for (const tag of tags) out[tag.at] = placeTag(tag, zoom, runs);
  return out;
}

/** The arcs into one side of one screen, nested: the highest lane drops nearest the screen and enters highest, each
 *  one after a step further out and lower, so none crosses another. */
function placeDrops(
  into: PendingArc[],
  pages: readonly LaidOutPage[],
  zoom: number,
  out: FlowLink[],
  runs: RunGrid,
) {
  // Sorted by lane (ties keep the walk's order), the highest first.
  into.sort((a, b) => a.laneY - b.laneY);
  const { to, dir } = into[0]!;
  const near = dir > 0 ? to.rect.x : to.rect.x + to.rect.width;
  // The gap on the target's near side, and the room in it between the target and the arcs rising there on its side.
  const before = pages[to.index - dir]!.rect;
  const gap = Math.abs(near - (dir > 0 ? before.x + before.width : before.x));
  const side = Math.min(FLOW_GAP_SIDE_PX / zoom, gap / 4);
  const room = Math.max(gap / 2 - 2 * side, (gap / 2 - side) / 2);
  const foot = to.rect.y + to.rect.height - Math.min(FLOW_EDGE_INSET, to.rect.height / 2);
  into.forEach((arc, k) => {
    const dropX = near - dir * Math.min((FLOW_DROP_PX + FLOW_DROP_STEP_PX * k) / zoom, room);
    const entry = {
      x: near,
      y: Math.min(to.rect.y + FLOW_ENTRY_INSET + (FLOW_ENTRY_STEP_PX * k) / zoom, foot),
    };
    runs.add(runOf({ x: dropX, y: arc.laneY }, { x: dropX, y: entry.y }));
    runs.add(runOf({ x: dropX, y: entry.y }, entry));
    const item = out[arc.at] as Extract<FlowLink, { state: 'page' }>;
    item.path = arcPath(arc.start, arc.gapX, arc.laneY, dropX, entry, FLOW_CORNER_PX / zoom);
  });
}

/** A Back or Broken tag (and a broken link's stub) on the box's right, or on its left where the right would cover an
 *  arrow's run and the left would not. */
function placeTag({ kind, elementId, box }: PendingTag, zoom: number, runs: RunGrid): FlowLink {
  const y = box.y + box.height / 2;
  const clear = FLOW_TAG_CLEAR_PX / zoom;
  const half = FLOW_TAG_HEIGHT_PX / 2 / zoom + clear;
  const lay = (side: 1 | -1) => {
    const edge = side > 0 ? box.x + box.width : box.x;
    const stubEnd = kind === 'broken' ? edge + (side * FLOW_STUB_PX) / zoom : edge;
    const gap = (kind === 'broken' ? FLOW_TAG_GAP_PX / 2 : FLOW_TAG_GAP_PX) / zoom;
    const at = { x: stubEnd + side * gap, y };
    const far = at.x + (side * FLOW_TAG_WIDTH_PX[kind]) / zoom;
    const reach: Run = [
      Math.min(edge, far) - clear,
      y - half,
      Math.max(edge, far) + clear,
      y + half,
    ];
    return { side, at, stub: { from: { x: edge, y }, to: { x: stubEnd, y } }, reach };
  };
  const right = lay(1);
  let place = right;
  if (runs.hits(right.reach)) {
    const left = lay(-1);
    if (!runs.hits(left.reach)) place = left;
  }
  return kind === 'broken'
    ? { state: 'broken', elementId, box, stub: place.stub, at: place.at, side: place.side }
    : { state: 'back', elementId, box, at: place.at, side: place.side };
}
