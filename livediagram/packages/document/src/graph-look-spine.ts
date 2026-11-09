// The graph look's spine passes (graph-look.ts): the main path straightened down one centre line, and rejoins into
// it from the side.

import { edgeKey } from './auto-layout';
import type { GraphEdge } from './graph-authoring';
import { isBackdrop, pinnedId, segmentHitsBox, type Routes } from './graph-look-routes';
import { inCount, MAIN_EXIT, outEdges, reachOf, type LookNode } from './graph-look-tones';
import { isBoxed, type ArrowElement, type BoxedElement, type Element } from './index';

// The spine straightened (docs/specs/015-api/mcp-server.md §4.7 "Flow lines are elbows"): the main path, from
// the first node nothing enters along each node's furthest-leading exit (side steps and loops aside), shares one
// centre line, as the template's happy path runs straight down one column. Each side step moves with the node that
// sends it out. A node that would then overlap another box stays where the layout put it.
export function straightenSpine(
  elements: Element[],
  nodes: readonly LookNode[],
  edges: readonly GraphEdge[],
  flat: ReadonlySet<string>,
  axis: 'TB' | 'LR',
): Element[] {
  const boxes = new Map(elements.filter(isBoxed).map((b) => [b.id, b] as const));
  const main = (id: string) => {
    const b = boxes.get(id)!;
    return axis === 'TB' ? b.y + b.height / 2 : b.x + b.width / 2;
  };
  const cross = (b: BoxedElement) => (axis === 'TB' ? b.x + b.width / 2 : b.y + b.height / 2);
  const reach = reachOf(edges);
  const start = nodes.find((n) => boxes.has(n.id) && inCount(edges, n.id) === 0);
  if (!start) return elements;
  const spine: string[] = [start.id];
  const onSpine = new Set(spine);
  for (let at = start.id; ;) {
    const ways = outEdges(edges, at).filter(
      (e) =>
        !flat.has(edgeKey(e.from, e.to)) &&
        !onSpine.has(e.to) &&
        boxes.has(e.to) &&
        main(e.to) > main(at),
    );
    if (ways.length === 0) break;
    const labelled = ways.find((e) => MAIN_EXIT.test((e.label ?? '').trim()));
    const next = (labelled ?? [...ways].sort((a, b) => reach(b.to) - reach(a.to))[0]!).to;
    spine.push(next);
    onSpine.add(next);
    at = next;
  }
  if (spine.length < 3) return elements;
  const centres = spine.map((id) => cross(boxes.get(id)!)).sort((a, b) => a - b);
  const line = centres[Math.floor(centres.length / 2)]!;
  const moved = new Map<string, BoxedElement>();
  const overlaps = (b: BoxedElement, skip: ReadonlySet<string>) =>
    [...boxes.values()].some(
      (o) =>
        !skip.has(o.id) &&
        !isBackdrop(o) &&
        o.x < b.x + b.width &&
        o.x + o.width > b.x &&
        o.y < b.y + b.height &&
        o.y + o.height > b.y,
    );
  for (const id of spine) {
    const b = boxes.get(id)!;
    const delta = line - cross(b);
    if (Math.abs(delta) < 1) continue;
    const group = [
      id,
      ...outEdges(edges, id)
        .filter((e) => flat.has(edgeKey(e.from, e.to)))
        .map((e) => e.to),
    ];
    const shifted = group.map((gid) => {
      const g = boxes.get(gid)!;
      return axis === 'TB' ? { ...g, x: g.x + delta } : { ...g, y: g.y + delta };
    });
    const skip = new Set(group);
    if (shifted.some((g) => overlaps(g, skip))) continue;
    for (const g of shifted) {
      boxes.set(g.id, g);
      moved.set(g.id, g);
    }
  }
  if (moved.size === 0) return elements;
  return elements.map((el) => moved.get(el.id) ?? el);
}

// Rejoins into the spine from the side (the template's back-order joining at the receipt): an edge from a node
// beside the spine down to a later spine node leaves the source's bottom (TB) and enters the target's facing side,
// one bend, instead of fanning into the target's top beside the spine's own arrow.
export function sideRejoins(elements: Element[], axis: 'TB' | 'LR', routes: Routes): Element[] {
  const boxes = new Map(elements.filter(isBoxed).map((b) => [b.id, b] as const));
  let next = elements;
  for (const el of elements) {
    if (el.type !== 'arrow') continue;
    const [f, t] = [pinnedId(el.from), pinnedId(el.to)];
    const [src, dst] = [f ? boxes.get(f) : undefined, t ? boxes.get(t) : undefined];
    if (!src || !dst) continue;
    const [sx0, sx1] = axis === 'TB' ? [src.x, src.x + src.width] : [src.y, src.y + src.height];
    const [dx0, dx1] = axis === 'TB' ? [dst.x, dst.x + dst.width] : [dst.y, dst.y + dst.height];
    const later = axis === 'TB' ? dst.y > src.y + src.height : dst.x > src.x + src.width;
    const right = sx0 > dx1;
    const left = sx1 < dx0;
    if (!later || (!right && !left)) continue;
    // Only into a node another arrow already enters from straight above: the spine's own way in.
    const spineIn = elements.some(
      (o) =>
        o.type === 'arrow' && o.id !== el.id && pinnedId(o.to) === dst.id && pinnedId(o.from) !== f,
    );
    if (!spineIn) continue;
    const turned: ArrowElement = {
      ...el,
      from: { kind: 'pinned', elementId: src.id, anchor: axis === 'TB' ? 's' : 'e' },
      to: {
        kind: 'pinned',
        elementId: dst.id,
        anchor: axis === 'TB' ? (right ? 'e' : 'w') : right ? 's' : 'n',
      },
      // The end fans with any other arrow entering that side (a loop), so the two never merge into one line.
      exactStart: true,
      exactEnd: false,
    };
    // Only when both legs run clear: down the source's own line, then across into the target.
    const a =
      axis === 'TB'
        ? { x: src.x + src.width / 2, y: src.y + src.height }
        : { x: src.x + src.width, y: src.y + src.height / 2 };
    const b =
      axis === 'TB'
        ? { x: right ? dst.x + dst.width : dst.x, y: dst.y + dst.height / 2 }
        : { x: dst.x + dst.width / 2, y: right ? dst.y + dst.height : dst.y };
    const corner = axis === 'TB' ? { x: a.x, y: b.y } : { x: b.x, y: a.y };
    const blocked = [...boxes.values()].some(
      (o) =>
        o.id !== src.id &&
        o.id !== dst.id &&
        !isBackdrop(o) &&
        // A clearance, not just no overlap: a leg grazing a box's edge reads as part of it.
        (segmentHitsBox(a, corner, o, -12) || segmentHitsBox(corner, b, o, -12)),
    );
    if (blocked) continue;
    next = next.map((o) => (o.id === el.id ? turned : o));
    routes.set(el.id, { kind: 'corner', first: axis === 'TB' ? 'v' : 'h' });
  }
  return next;
}
