// Groups keep their lines clear (docs/specs/015-api/mcp-server.md §4.7 "The graph look"). The clustered layout
// (auto-layout-clusters.ts) places each group as one contracted box, so a node outside a group that a member links
// to was placed against the middle of the whole group: every database of a row of services packed under the
// group's centre, its line jogging across its neighbours'. And an edge to or from the group itself left the frame's
// middle and swept along it past the members' own drops. These two passes run on the expanded geometry.

import { SIBLING_GAP } from './auto-layout-shared';
import { LABEL_FONT_PX } from '@liveworkspace/model-core/label-font';
import { legalise, rankOffsets } from './auto-layout-placement';
import { NOTCH_MAX } from './graph-notches';
import type { LayoutDirection } from './auto-layout';
import type { DiagramGraph } from './graph-authoring';
import type { Anchor, ArrowElement, BoxedElement, TextSizePreset } from './index';

type Axis = {
  main: (el: BoxedElement) => number;
  cross: (el: BoxedElement) => number;
  crossLen: (el: BoxedElement) => number;
  at: (el: BoxedElement, centre: number) => BoxedElement;
};

const axisOf = (direction: LayoutDirection): Axis =>
  direction === 'TB'
    ? {
        main: (el) => Math.round(el.y + el.height / 2),
        cross: (el) => el.x + el.width / 2,
        crossLen: (el) => el.width,
        at: (el, c) => ({ ...el, x: c - el.width / 2 }),
      }
    : {
        main: (el) => Math.round(el.x + el.width / 2),
        cross: (el) => el.y + el.height / 2,
        crossLen: (el) => el.height,
        at: (el, c) => ({ ...el, y: c - el.height / 2 }),
      };

// Moves, in place, each node outside every group to sit by the members it links to: a node whose neighbours on one
// side of it (before or after it along the flow) are all members of one group is pulled to their mean, its rank kept
// in order with its gaps (the flow layout's own isotonic pass). A rank a frame shares is left alone, as is a node
// with no such side: what the contracted layout placed by other nodes stays placed by them.
export function seatByMembers(
  nodes: BoxedElement[],
  frames: readonly BoxedElement[],
  clusterOf: ReadonlyMap<string, string>,
  graph: DiagramGraph,
  direction: LayoutDirection,
): void {
  const ax = axisOf(direction);
  const index = new Map(nodes.map((n, i) => [n.id, i]));
  const free = nodes.filter((n) => !clusterOf.has(n.id));
  const ranks = new Map<number, BoxedElement[]>();
  for (const n of free) {
    const k = ax.main(n);
    (ranks.get(k) ?? ranks.set(k, []).get(k)!).push(n);
  }
  const neighbours = new Map<string, string[]>();
  for (const e of graph.edges) {
    if (e.from === e.to) continue;
    (neighbours.get(e.from) ?? neighbours.set(e.from, []).get(e.from)!).push(e.to);
    (neighbours.get(e.to) ?? neighbours.set(e.to, []).get(e.to)!).push(e.from);
  }
  const mainSpan = (el: BoxedElement) =>
    direction === 'TB' ? [el.y, el.y + el.height] : [el.x, el.x + el.width];
  for (const [k, rank] of ranks) {
    if (frames.some((f) => mainSpan(f)[0]! <= k && k <= mainSpan(f)[1]!)) continue;
    const want = new Map<string, number>();
    const seated = new Set<string>();
    for (const n of rank) {
      const at = (id: string) => nodes[index.get(id) ?? -1];
      const sides = [-1, 1].map((sign) =>
        (neighbours.get(n.id) ?? [])
          .map(at)
          .filter((o): o is BoxedElement => !!o && Math.sign(ax.main(o) - k) === sign),
      );
      const seat = sides.find(
        (side) =>
          side.length > 0 &&
          side.every((o) => clusterOf.has(o.id)) &&
          new Set(side.map((o) => clusterOf.get(o.id))).size === 1,
      );
      if (seat) {
        seated.add(n.id);
        want.set(n.id, seat.reduce((s, o) => s + ax.cross(o), 0) / seat.length);
      }
    }
    if (seated.size === 0) continue;
    const order = [...rank].sort((a, b) => ax.cross(a) - ax.cross(b));
    const ids = order.map((n) => n.id);
    const byId = new Map(order.map((n) => [n.id, n]));
    const offsets = rankOffsets(
      ids,
      (id) => ax.crossLen(byId.get(id)!),
      () => SIBLING_GAP,
    );
    // A node with nothing to sit by pulls nowhere: it packs against the seated node before it (or, leading the rank,
    // after it), so it never drags a seated neighbour off its member.
    const first = ids.findIndex((id) => seated.has(id));
    for (let i = first + 1; i < ids.length; i++)
      if (!seated.has(ids[i]!))
        want.set(ids[i]!, want.get(ids[i - 1]!)! + offsets[i]! - offsets[i - 1]!);
    for (let i = first - 1; i >= 0; i--)
      want.set(ids[i]!, want.get(ids[i + 1]!)! - offsets[i + 1]! + offsets[i]!);
    for (const [id, c] of legalise(ids, want, offsets))
      nodes[index.get(id)!] = ax.at(byId.get(id)!, c);
  }
  // A node a pixel or two off a member it links to lines up with it, so the line between runs straight: a gateway
  // centred over its clients sat 1.5 px off the first service under it, a step in the trunk's drop.
  for (const n of free) {
    const i = index.get(n.id)!;
    const el = nodes[i]!;
    const near = (neighbours.get(n.id) ?? [])
      .filter((id) => clusterOf.has(id))
      .map((id) => nodes[index.get(id)!]!)
      .map((o) => ax.cross(o) - ax.cross(el))
      .filter((d) => d !== 0 && Math.abs(d) <= NOTCH_MAX)
      .sort((a, b) => Math.abs(a) - Math.abs(b))[0];
    if (near !== undefined) nodes[i] = ax.at(el, ax.cross(el) + near);
  }
}

// The anchors along each side, in order across it (corners left out: a line from a corner reads as from neither side).
const SIDE: Record<'n' | 's' | 'e' | 'w', readonly Anchor[]> = {
  n: ['nnw', 'n', 'nne'],
  s: ['ssw', 's', 'sse'],
  w: ['wnw', 'w', 'wsw'],
  e: ['ene', 'e', 'ese'],
};

// An edge to or from a group leaves the frame facing its other end: from the side across the flow level with it
// when it lies within the frame's span (the anchor of that side nearest it), else from the frame's near side,
// toward the flow's end it lies on, so it never sweeps along the frame past the members' own lines.
export function faceGroupEdges(
  arrows: ArrowElement[],
  frames: readonly BoxedElement[],
  nodes: readonly BoxedElement[],
  direction: LayoutDirection,
): ArrowElement[] {
  const frameById = new Map(frames.map((f) => [f.id, f]));
  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const tb = direction === 'TB';
  return arrows.map((a) => {
    if (a.from.kind !== 'pinned' || a.to.kind !== 'pinned') return a;
    const fromFrame = frameById.get(a.from.elementId);
    const toFrame = frameById.get(a.to.elementId);
    const frame = fromFrame ?? toFrame;
    const other = nodeById.get(fromFrame ? a.to.elementId : a.from.elementId);
    if (!frame || !other || (fromFrame && toFrame)) return a;
    const [ox, oy] = [other.x + other.width / 2, other.y + other.height / 2];
    const [c0, c1] = tb ? [frame.x, frame.x + frame.width] : [frame.y, frame.y + frame.height];
    const along = tb ? oy - (frame.y + frame.height / 2) : ox - (frame.x + frame.width / 2);
    const across = tb ? ox : oy;
    let anchor: Anchor;
    if (across >= c0 && across <= c1) {
      // Level with it: the side facing it along the flow, at the quarter nearest.
      const side = SIDE[tb ? (along >= 0 ? 's' : 'n') : along >= 0 ? 'e' : 'w'];
      anchor = side[Math.min(2, Math.max(0, Math.round(((across - c0) / (c1 - c0)) * 4) - 1))]!;
    } else {
      // Beside it: the near side, its quarter toward the end of the flow the other end lies on.
      const side = SIDE[tb ? (across > c1 ? 'e' : 'w') : across > c1 ? 's' : 'n'];
      anchor = along >= 0 ? side[2]! : side[0]!;
    }
    const end = fromFrame ? 'from' : 'to';
    if (a[end].kind === 'pinned' && a[end].anchor === anchor) return a;
    return { ...a, [end]: { kind: 'pinned', elementId: frame.id, anchor } };
  });
}

// A frame's heading as drawn at its top left: its label's estimated width, at about FRAME_HEADING_CHAR_PX a
// character (bold, at the nodes' size) plus its padding, FRAME_HEADING_HEIGHT tall. An estimate: a heading is a
// few words, and the lead it sets keeps FRAME_HEADING_CLEAR spare.
const FRAME_HEADING_CHAR_PX = 8;
const FRAME_HEADING_PAD = 24;
const FRAME_HEADING_HEIGHT = 36;
const FRAME_HEADING_CLEAR = 16;

export function frameHeadingRect(frame: {
  x: number;
  y: number;
  label?: string;
  textSize?: unknown;
}): { x: number; y: number; width: number; height: number } | null {
  const text = frame.label?.trim();
  if (!text) return null;
  // A larger look's heading is wider in step with its size (a small graph's md heading ran past the lead).
  const size =
    typeof frame.textSize === 'string' && frame.textSize in LABEL_FONT_PX
      ? LABEL_FONT_PX[frame.textSize as TextSizePreset]
      : LABEL_FONT_PX.sm;
  const scale = size / LABEL_FONT_PX.sm;
  return {
    x: frame.x,
    y: frame.y,
    width: text.length * FRAME_HEADING_CHAR_PX * scale + FRAME_HEADING_PAD,
    height: FRAME_HEADING_HEIGHT,
  };
}

// How much further in from a frame's left edge its members start, down the page, so a line from outside into one of
// its first members lands clear of the heading: `pad` is the frame's own left padding, `members` laid out among
// themselves. The narrowest of those first members is reckoned in the leftmost slot, since the members are later
// reordered by their neighbours.
export function headingLead(
  label: string | undefined,
  members: readonly BoxedElement[],
  enteredFromOutside: ReadonlySet<string>,
  pad: number,
  direction: LayoutDirection,
  textSize?: unknown,
): number {
  if (direction !== 'TB' || members.length === 0) return 0;
  const heading = frameHeadingRect({ x: 0, y: 0, label, ...(textSize ? { textSize } : {}) });
  if (!heading) return 0;
  // The first rank by centre, as the layout aligns a rank: by its top, a taller box (a cloud among cylinders) stood
  // alone as the first row.
  const mid = (m: BoxedElement) => m.y + m.height / 2;
  const top = Math.min(...members.map(mid));
  const first = members.filter((m) => mid(m) - top < 1);
  const entered = first.filter((m) => enteredFromOutside.has(m.id));
  if (entered.length === 0) return 0;
  const left = Math.min(...members.map((m) => m.x));
  const slot = Math.min(...first.map((m) => m.x)) - left;
  const centre = pad + slot + Math.min(...entered.map((m) => m.width)) / 2;
  return Math.max(0, Math.ceil(heading.width + FRAME_HEADING_CLEAR - centre));
}
