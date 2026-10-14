// Stacked groups line up (docs/specs/015-api/mcp-server.md "Stacked groups line up"). Each group's frame is sized to
// its own members, so a pipeline's stages came out as frames of four widths, each centred on its own members and
// off the spine. Groups that follow one another down the flow, no two side by side, share one extent across it.

import type { LayoutDirection } from './auto-layout';
import type { BoxedElement } from './index';

type Span = { lo: number; hi: number };

const along = (el: BoxedElement, direction: LayoutDirection): Span =>
  direction === 'TB' ? { lo: el.y, hi: el.y + el.height } : { lo: el.x, hi: el.x + el.width };
const across = (el: BoxedElement, direction: LayoutDirection): Span =>
  direction === 'TB' ? { lo: el.x, hi: el.x + el.width } : { lo: el.y, hi: el.y + el.height };

const meets = (a: Span, b: Span) => a.lo < b.hi && b.lo < a.hi;

const shifted = (el: BoxedElement, by: number, direction: LayoutDirection): BoxedElement =>
  direction === 'TB' ? { ...el, x: el.x + by } : { ...el, y: el.y + by };

// Widens `frames` in place to the union of their extents across the flow when no two share a band along it and no
// node outside a frame would fall inside its widened rectangle. Then each frame with one entry (the one member a line
// from outside reaches, in `entries`) moves its members so that entry sits on the column's centre line: a stage
// whose own branch pulled its members aside otherwise took the spine on a jog. The move keeps the members' inset from
// the frame's near side (its heading lead) and `pad` from the far side. `nodes` holds every placed node, in place.
export function lineUpStackedFrames(
  frames: BoxedElement[],
  nodes: BoxedElement[],
  clusterOf: ReadonlyMap<string, string>,
  entries: ReadonlyMap<string, string>,
  pad: number,
  direction: LayoutDirection,
): void {
  if (frames.length < 2) return;
  const outside = nodes.filter((n) => !clusterOf.has(n.id));
  const sorted = [...frames].sort((a, b) => along(a, direction).lo - along(b, direction).lo);
  for (let i = 1; i < sorted.length; i++)
    if (along(sorted[i]!, direction).lo < along(sorted[i - 1]!, direction).hi) return;
  const lo = Math.min(...frames.map((f) => across(f, direction).lo));
  const hi = Math.max(...frames.map((f) => across(f, direction).hi));
  const widened = frames.map((f) =>
    direction === 'TB' ? { ...f, x: lo, width: hi - lo } : { ...f, y: lo, height: hi - lo },
  );
  const takesIn = widened.some((f) =>
    outside.some(
      (n) =>
        meets(along(f, direction), along(n, direction)) &&
        meets(across(f, direction), across(n, direction)),
    ),
  );
  if (takesIn) return;
  const centre = (lo + hi) / 2;
  frames.forEach((old, i) => {
    const frame = widened[i]!;
    frames[i] = frame;
    const entry = nodes.find((n) => n.id === entries.get(frame.id));
    if (!entry) return;
    const members = nodes.flatMap((n, at) => (clusterOf.get(n.id) === frame.id ? [at] : []));
    const memberLo = Math.min(...members.map((at) => across(nodes[at]!, direction).lo));
    const memberHi = Math.max(...members.map((at) => across(nodes[at]!, direction).hi));
    const inset = memberLo - across(old, direction).lo;
    const want = centre - (across(entry, direction).lo + across(entry, direction).hi) / 2;
    const by = Math.max(lo + inset - memberLo, Math.min(hi - pad - memberHi, want));
    if (Math.abs(by) < 1) return;
    for (const at of members) nodes[at] = shifted(nodes[at]!, by, direction);
  });
}
