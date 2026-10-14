// Groups keep their lines clear, the reverse of seatByMembers (docs/specs/015-api/mcp-server.md "Groups keep their
// lines clear"). A group's members are laid out among themselves and packed, so a row of data stores sat apart from
// the services that own them: each database's line jogged across the next one's, and across the lines between.
// Seated by the outside nodes they link to, each sits under its own.

import { SIBLING_GAP } from './auto-layout-shared';
import { legalise, rankOffsets } from './auto-layout-placement';
import { headingLead } from './auto-layout-cluster-seats';
import type { LayoutDirection } from './auto-layout';
import type { DiagramGraph } from './graph-authoring';
import type { BoxedElement } from './index';

const tb = (direction: LayoutDirection) => direction === 'TB';
const mainOf = (el: BoxedElement, d: LayoutDirection) =>
  tb(d) ? el.y + el.height / 2 : el.x + el.width / 2;
const crossOf = (el: BoxedElement, d: LayoutDirection) =>
  tb(d) ? el.x + el.width / 2 : el.y + el.height / 2;
const crossLo = (el: BoxedElement, d: LayoutDirection) => (tb(d) ? el.x : el.y);
const crossLen = (el: BoxedElement, d: LayoutDirection) => (tb(d) ? el.width : el.height);
const atCross = (el: BoxedElement, c: number, d: LayoutDirection): BoxedElement =>
  tb(d) ? { ...el, x: c - el.width / 2 } : { ...el, y: c - el.height / 2 };

const overlaps = (a: BoxedElement, b: BoxedElement) =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

// Moves, in place, the members of each group in one row with no lines among them to sit by the outside nodes they
// link to on one side along the flow (the mean of them), order and gaps kept (the flow layout's own isotonic pass),
// and refits the group's frame round them with its old insets. A member with nothing to sit by packs against the one
// before it. A frame that would then cover another node or frame is left as it was.
export function seatMembersByNeighbours(
  nodes: BoxedElement[],
  frames: BoxedElement[],
  clusterOf: ReadonlyMap<string, string>,
  graph: DiagramGraph,
  direction: LayoutDirection,
  pad: number,
): void {
  const index = new Map(nodes.map((n, i) => [n.id, i]));
  frames.forEach((frame, f) => {
    const members = nodes.filter((n) => clusterOf.get(n.id) === frame.id);
    if (members.length === 0) return;
    const inside = new Set(members.map((m) => m.id));
    if (graph.edges.some((e) => inside.has(e.from) && inside.has(e.to))) return;
    const row = Math.round(mainOf(members[0]!, direction));
    if (members.some((m) => Math.round(mainOf(m, direction)) !== row)) return;

    const want = new Map<string, number>();
    for (const m of members) {
      const others = graph.edges
        .flatMap((e) => (e.from === m.id ? [e.to] : e.to === m.id ? [e.from] : []))
        .map((id) => nodes[index.get(id) ?? -1])
        .filter((o): o is BoxedElement => !!o && !inside.has(o.id));
      const sides = [-1, 1].map((sign) =>
        others.filter((o) => Math.sign(mainOf(o, direction) - row) === sign),
      );
      const side = sides.find((s) => s.length > 0);
      if (side) want.set(m.id, side.reduce((s, o) => s + crossOf(o, direction), 0) / side.length);
    }
    // All wanting one spot (a row fed by one node) is what the contracted layout already placed them by.
    if (new Set([...want.values()].map(Math.round)).size < 2) return;

    const order = [...members].sort((a, b) => crossOf(a, direction) - crossOf(b, direction));
    const ids = order.map((m) => m.id);
    const byId = new Map(order.map((m) => [m.id, m]));
    const offsets = rankOffsets(
      ids,
      (id) => crossLen(byId.get(id)!, direction),
      () => SIBLING_GAP,
    );
    const first = ids.findIndex((id) => want.has(id));
    for (let i = first + 1; i < ids.length; i++)
      if (!want.has(ids[i]!))
        want.set(ids[i]!, want.get(ids[i - 1]!)! + offsets[i]! - offsets[i - 1]!);
    for (let i = first - 1; i >= 0; i--)
      want.set(ids[i]!, want.get(ids[i + 1]!)! - offsets[i + 1]! + offsets[i]!);
    const seated = [...legalise(ids, want, offsets)].map(([id, c]) =>
      atCross(byId.get(id)!, c, direction),
    );

    const lo = (els: BoxedElement[]) => Math.min(...els.map((m) => crossLo(m, direction)));
    const hi = (els: BoxedElement[]) =>
      Math.max(...els.map((m) => crossLo(m, direction) + crossLen(m, direction)));
    // The heading's lead worked out again for the seated row: a line into a first member moved under the heading
    // struck its text.
    const entered = new Set(
      graph.edges.filter((e) => inside.has(e.to) && !inside.has(e.from)).map((e) => e.to),
    );
    const before = Math.max(
      lo(members) - crossLo(frame, direction),
      pad + headingLead(frame.label, seated, entered, pad, direction),
    );
    const after = crossLo(frame, direction) + crossLen(frame, direction) - hi(members);
    const from = lo(seated) - before;
    const len = hi(seated) + after - from;
    const refit: BoxedElement = tb(direction)
      ? { ...frame, x: from, width: len }
      : { ...frame, y: from, height: len };
    const covers =
      nodes.some((n) => !inside.has(n.id) && overlaps(refit, n)) ||
      frames.some((o) => o.id !== frame.id && overlaps(refit, o));
    if (covers) return;
    frames[f] = refit;
    for (const m of seated) nodes[index.get(m.id)!] = m;
  });
}
