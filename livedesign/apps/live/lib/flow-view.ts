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
// higher for each further screen it passes, so arcs of different lengths never lie on one another.
export const FLOW_LANE_BASE_PX = 44;
export const FLOW_LANE_STEP_PX = 20;
// Where an arc lands on its target's top edge: this share of its width in from the near side, a step further for
// each earlier arc into the same screen, never past the cap.
export const FLOW_ENTRY_FRACTION = 0.2;
export const FLOW_ENTRY_STEP = 0.12;
export const FLOW_ENTRY_MAX = 0.8;
// An arc's corner radius (screen px), never more than half the gap it turns in.
export const FLOW_CORNER_PX = 12;
// The broken stub's length (screen px).
export const FLOW_STUB_PX = 32;

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
  | { state: 'back' | 'self'; elementId: string; box: FlowRect }
  | { state: 'broken'; elementId: string; box: FlowRect; stub: { from: FlowPoint; to: FlowPoint } };

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

/** A curve from `start` to the near edge of the screen beside it, entering at the start's height kept inside the
 *  screen, its handles level. */
export function adjacentPath(
  start: FlowPoint,
  target: FlowRect,
  dir: 1 | -1,
  zoom: number,
): string {
  const ex = dir > 0 ? target.x : target.x + target.width;
  const top = target.y + Math.min(FLOW_EDGE_INSET, target.height / 2);
  const foot = target.y + target.height - Math.min(FLOW_EDGE_INSET, target.height / 2);
  const ey = Math.min(Math.max(start.y, top), foot);
  const pull = Math.max(FLOW_PULL_MIN_PX / zoom, Math.abs(ex - start.x) / 2);
  return `M ${pt(start)} C ${pt({ x: start.x + dir * pull, y: start.y })}, ${pt({ x: ex - dir * pull, y: ey })}, ${pt({ x: ex, y: ey })}`;
}

/** An arc from `start` out to the gap beside its screen (`gapX`), up that gap to a lane at `laneY`, level along it,
 *  and down onto `entry` on the target's top edge: straight runs with rounded corners, so it never crosses a screen it
 *  passes, ending vertical so the arrowhead points down into the screen. */
export function arcPath(
  start: FlowPoint,
  gapX: number,
  entry: FlowPoint,
  laneY: number,
  dir: 1 | -1,
  radius: number,
): string {
  // A corner never rounds past half a run it joins.
  const r = Math.max(
    0,
    Math.min(
      radius,
      Math.abs(gapX - start.x),
      (start.y - laneY) / 2,
      Math.abs(entry.x - gapX) / 2,
      entry.y - laneY,
    ),
  );
  return [
    `M ${pt(start)}`,
    `L ${pt({ x: gapX - dir * r, y: start.y })}`,
    `Q ${pt({ x: gapX, y: start.y })} ${pt({ x: gapX, y: start.y - r })}`,
    `L ${pt({ x: gapX, y: laneY + r })}`,
    `Q ${pt({ x: gapX, y: laneY })} ${pt({ x: gapX + dir * r, y: laneY })}`,
    `L ${pt({ x: entry.x - dir * r, y: laneY })}`,
    `Q ${pt({ x: entry.x, y: laneY })} ${pt({ x: entry.x, y: laneY + r })}`,
    `L ${pt(entry)}`,
  ].join(' ');
}

/** What the Flow view draws, in paint order: one item per visible element on a screen whose link is a screen link. */
export function flowLinks(
  elements: Element[],
  layers: Layer[] | undefined,
  pages: readonly LaidOutPage[],
  zoom: number,
): FlowLink[] {
  if (pages.length === 0 || !elements.some((el) => isScreenLink(el.link))) return [];
  const index = buildElementIndex(elements);
  const arcsInto = new Map<string, number>();
  const out: FlowLink[] = [];
  for (const el of visibleLayerElements(elements, layers)) {
    const link = el.link;
    if (!isScreenLink(link)) continue;
    const page = rowPageAt(pages, elementAnchorPoint(el, index));
    if (!page) continue;
    const b = contentBounds([el], undefined, elements);
    const box = intersect({ x: b.x, y: b.y, width: b.w, height: b.h }, pageScreenRect(page));
    if (!box) continue;
    const target = resolveScreenLink(link, pages);
    if (target.state === 'back') {
      out.push({ state: 'back', elementId: el.id, box });
      continue;
    }
    if (target.state === 'broken') {
      const from = { x: box.x + box.width, y: box.y + box.height / 2 };
      out.push({
        state: 'broken',
        elementId: el.id,
        box,
        stub: { from, to: { x: from.x + FLOW_STUB_PX / zoom, y: from.y } },
      });
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
    let path: string;
    if (span === 1) {
      path = adjacentPath(start, to.rect, dir, zoom);
    } else {
      const lo = Math.min(to.index, page.index);
      let rowTop = Infinity;
      for (let i = lo; i <= lo + span; i++) rowTop = Math.min(rowTop, pages[i]!.rect.y);
      const laneY = rowTop - (FLOW_LANE_BASE_PX + FLOW_LANE_STEP_PX * (span - 2)) / zoom;
      const slot = arcsInto.get(to.id) ?? 0;
      arcsInto.set(to.id, slot + 1);
      const share = Math.min(FLOW_ENTRY_FRACTION + FLOW_ENTRY_STEP * slot, FLOW_ENTRY_MAX);
      const near = dir > 0 ? to.rect.x : to.rect.x + to.rect.width;
      // The middle of the gap between the element's screen and the next one towards the target.
      const beside = pages[page.index + dir]!.rect;
      const gapX =
        dir > 0
          ? (page.rect.x + page.rect.width + beside.x) / 2
          : (beside.x + beside.width + page.rect.x) / 2;
      path = arcPath(
        start,
        gapX,
        { x: near + dir * share * to.rect.width, y: to.rect.y },
        laneY,
        dir,
        FLOW_CORNER_PX / zoom,
      );
    }
    out.push({ state: 'page', elementId: el.id, box, toPageId: to.id, start, path });
  }
  return out;
}
