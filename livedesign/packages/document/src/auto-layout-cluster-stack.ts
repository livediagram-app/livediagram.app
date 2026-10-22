// Stacked groups line up (docs/specs/015-api/mcp-server.md "Stacked groups line up"). Each group is laid out on its
// own and centred on its own members, so a pipeline stage whose branch sat to one side (a rollback beside the
// decision) pulled its entry off the spine, and the line into it jogged. Groups that follow one another down the flow,
// no two side by side, move so each one-entry group's entry sits on the line of what feeds it. Frames keep their own
// width: stretched to one width, a stage of two boxes stood mostly empty.

import type { LayoutDirection } from './auto-layout';
import type { DiagramGraph } from './graph-authoring';
import type { BoxedElement } from './index';

type Span = { lo: number; hi: number };

const along = (el: BoxedElement, direction: LayoutDirection): Span =>
  direction === 'TB' ? { lo: el.y, hi: el.y + el.height } : { lo: el.x, hi: el.x + el.width };
const crossOf = (el: BoxedElement, direction: LayoutDirection) =>
  direction === 'TB' ? el.x + el.width / 2 : el.y + el.height / 2;
const shifted = (el: BoxedElement, by: number, direction: LayoutDirection): BoxedElement =>
  direction === 'TB' ? { ...el, x: el.x + by } : { ...el, y: el.y + by };
const overlaps = (a: BoxedElement, b: BoxedElement) =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

// Moves, in place, each one-entry group of a stack (frame and members) across the flow so its entry lines up with
// the mean of the nodes that feed it, in flow order so a stage follows the one before it moved. A group whose moved
// frame would cover another node or frame stays.
export function lineUpStackedFrames(
  frames: BoxedElement[],
  nodes: BoxedElement[],
  clusterOf: ReadonlyMap<string, string>,
  graph: DiagramGraph,
  direction: LayoutDirection,
): void {
  if (frames.length < 2) return;
  const order = frames
    .map((f, i) => ({ f, i }))
    .sort((a, b) => along(a.f, direction).lo - along(b.f, direction).lo);
  for (let k = 1; k < order.length; k++)
    if (along(order[k]!.f, direction).lo < along(order[k - 1]!.f, direction).hi) return;
  const index = new Map(nodes.map((n, i) => [n.id, i]));
  for (const { i } of order) {
    const frame = frames[i]!;
    const intoGroup = graph.edges.filter(
      (e) => clusterOf.get(e.to) === frame.id && clusterOf.get(e.from) !== frame.id,
    );
    const entries = new Set(intoGroup.map((e) => e.to));
    if (entries.size !== 1) continue;
    const entry = nodes[index.get([...entries][0]!) ?? -1];
    const feeders = intoGroup
      .map((e) => nodes[index.get(e.from) ?? -1])
      .filter((n): n is BoxedElement => !!n);
    if (!entry || feeders.length === 0) continue;
    const want = feeders.reduce((s, n) => s + crossOf(n, direction), 0) / feeders.length;
    const by = want - crossOf(entry, direction);
    if (Math.abs(by) < 1) continue;
    const moved = shifted(frame, by, direction);
    const members = nodes.flatMap((n, at) => (clusterOf.get(n.id) === frame.id ? [at] : []));
    const covers =
      frames.some((o, j) => j !== i && overlaps(moved, o)) ||
      nodes.some((n) => clusterOf.get(n.id) !== frame.id && overlaps(moved, n));
    if (covers) continue;
    frames[i] = moved;
    for (const at of members) nodes[at] = shifted(nodes[at]!, by, direction);
  }
}
