// The graph look's channel passes (graph-look.ts): elbows between two ranks given channels of their own, and a
// stacked parent's arrows drawn as a bus into its leaves.

import type { GraphEdge } from './graph-authoring';
import { endAt, pinnedId, through, type Pt, type Routes } from './graph-look-routes';
import { inCount, outEdges, type LookNode } from './graph-look-tones';
import type { ArrowElement, Element } from './index';

// Space between two channels in one gap, and the bin bends fall into to count as one gap.
const CHANNEL_GAP = 14;
const CHANNEL_BIN = 24;

// Elbows given channels of their own (docs/specs/015-api/mcp-server.md §4.7 "Flow lines are elbows"): every elbow
// between the same two ranks bent at the gap's middle, so arrows from different nodes ran down one line and read as
// joined. Within each gap the arrows of one source drawn alike share a slot (its trunk) and so do the arrows into one
// target (its bus); every other arrow gets a slot of its own, CHANNEL_GAP apart around the middle, ordered so runs going the
// same way never cross: of those heading down (TB) or right (LR) the one starting nearest the far side bends first.
export function spreadChannels(elements: Element[], axis: 'TB' | 'LR'): Element[] {
  type Bent = { el: ArrowElement; from: Pt; to: Pt; at: number };
  const bent: Bent[] = [];
  for (const el of elements) {
    if (el.type !== 'arrow' || el.arrowStyle !== 'angled' || el.curvePoints?.length !== 2) continue;
    const from = endAt(el, 'from', elements);
    const to = endAt(el, 'to', elements);
    const mid = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
    const [a, b] = el.curvePoints.map((p) => ({ x: mid.x + p.dx, y: mid.y + p.dy }));
    // Only the down-across-down (TB) or right-down-right (LR) shape: both bends on one cross line.
    const at = axis === 'TB' ? a!.y : a!.x;
    if (Math.abs((axis === 'TB' ? b!.y : b!.x) - at) > 0.5) continue;
    bent.push({ el, from, to, at });
  }
  const gaps = new Map<number, Bent[]>();
  for (const b of bent)
    (
      gaps.get(Math.round(b.at / CHANNEL_BIN)) ??
      gaps.set(Math.round(b.at / CHANNEL_BIN), []).get(Math.round(b.at / CHANNEL_BIN))!
    ).push(b);
  const placed = new Map<string, number>();
  for (const group of gaps.values()) {
    // Slots: one per source trunk, a lone arrow into a shared target joining that target's bus.
    // Keyed by line too: only lines drawn alike share a trunk or bus (withExactEnds), so a dashed event line never
    // rides a solid call's run across the gap.
    const line = (b: Bent) => b.el.strokeStyle ?? 'solid';
    const slotOf = new Map<string, string>();
    const bySource = new Map<string, Bent[]>();
    for (const b of group) {
      const src = `${pinnedId(b.el.from) ?? b.el.id}|${line(b)}`;
      (bySource.get(src) ?? bySource.set(src, []).get(src)!).push(b);
    }
    const intoTarget = new Map<string, Bent[]>();
    for (const b of group) {
      const dst = `${pinnedId(b.el.to) ?? b.el.id}|${line(b)}`;
      (intoTarget.get(dst) ?? intoTarget.set(dst, []).get(dst)!).push(b);
    }
    for (const b of group) {
      const src = `${pinnedId(b.el.from) ?? b.el.id}|${line(b)}`;
      const dst = `${pinnedId(b.el.to) ?? b.el.id}|${line(b)}`;
      slotOf.set(
        b.el.id,
        bySource.get(src)!.length > 1 || intoTarget.get(dst)!.length < 2 ? `s:${src}` : `t:${dst}`,
      );
    }
    const slots = [...new Set(group.map((b) => slotOf.get(b.el.id)!))];
    if (slots.length < 2) continue;
    const cross = (p: Pt) => (axis === 'TB' ? p.x : p.y);
    // Each slot's way across and where its runs start: heading toward larger cross, or smaller.
    const info = slots.map((slot) => {
      const members = group.filter((b) => slotOf.get(b.el.id) === slot);
      const start = members.reduce((s, b) => s + cross(b.from), 0) / members.length;
      const end = members.reduce((s, b) => s + cross(b.to), 0) / members.length;
      return { slot, start, forward: end >= start };
    });
    // Toward larger cross: the run starting at the smaller cross bends last (farthest along the flow); away, mirrored.
    info.sort((p, q) =>
      p.forward !== q.forward
        ? p.forward
          ? 1
          : -1
        : p.forward
          ? q.start - p.start
          : p.start - q.start,
    );
    const centre = group.reduce((s, b) => s + b.at, 0) / group.length;
    info.forEach(({ slot }, i) =>
      placed.set(slot, centre + (i - (info.length - 1) / 2) * CHANNEL_GAP),
    );
    for (const b of group) placed.set(b.el.id, placed.get(slotOf.get(b.el.id)!)!);
  }
  if (placed.size === 0) return elements;
  return elements.map((el) => {
    const b = el.type === 'arrow' ? bent.find((x) => x.el.id === el.id) : undefined;
    const at = b ? placed.get(el.id) : undefined;
    if (!b || at === undefined) return el;
    const points =
      axis === 'TB'
        ? [
            { x: b.from.x, y: at },
            { x: b.to.x, y: at },
          ]
        : [
            { x: at, y: b.from.y },
            { x: at, y: b.to.y },
          ];
    return through(b.el, points, elements);
  });
}

// The parents in a tree whose children are all leaves, two or more, below the root: their leaves stack in a column
// under them, the compact org chart (docs/specs/015-api/mcp-server.md §4.7 "Layout choices"), instead of a row that
// makes a wide company four times wider than tall.
export function stackedParents(
  nodes: readonly LookNode[],
  edges: readonly GraphEdge[],
): Set<string> {
  const out = new Set<string>();
  for (const n of nodes) {
    const kids = outEdges(edges, n.id).map((e) => e.to);
    if (kids.length < 2 || inCount(edges, n.id) === 0) continue;
    if (kids.every((k) => outEdges(edges, k).length === 0 && inCount(edges, k) === 1))
      out.add(n.id);
  }
  return out;
}

// A stacked parent's arrows as a bus: down from its lower-left quarter, then across into each leaf's left side.
export function stackBuses(
  elements: Element[],
  stacked: ReadonlySet<string>,
  routes: Routes,
): Element[] {
  return elements.map((el) => {
    if (el.type !== 'arrow' || el.from.kind !== 'pinned' || el.to.kind !== 'pinned') return el;
    if (!stacked.has(el.from.elementId)) return el;
    routes.set(el.id, { kind: 'corner', first: 'v' });
    return {
      ...el,
      from: { ...el.from, anchor: 'ssw' as const },
      to: { ...el.to, anchor: 'w' as const },
      exactStart: true,
      exactEnd: true,
    };
  });
}
