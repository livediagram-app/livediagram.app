// Groups keep their lines clear, the reverse of seatByMembers (docs/specs/015-api/mcp-server.md "Groups keep their
// lines clear"). A group's members are laid out among themselves and packed, so a row of data stores sat apart from
// the services that own them: each database's line jogged across the next one's, and across the lines between.
// Seated by the outside nodes they link to, each sits under its own.

import { SIBLING_GAP } from './auto-layout-shared';
import { legalise, rankOffsets } from './auto-layout-placement';
import { headingLead } from './auto-layout-cluster-seats';
import { NOTCH_MAX } from './graph-notches';
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

// A member linked to more outside nodes than half its row holds (a Kafka bus every service publishes to) is a hub:
// seated at the mean of its links it lands mid-row and parts each service from its own store, so it goes to the row's
// end instead and packs there, beside the pairs it would have split.
// Only where the row holds at least HUB_MIN_PAIRS members of one link each (stores, one to a service): a hub among
// fewer is best left at the middle of what it links.
const HUB_MIN_LINKS = 3;
// How many members besides those sharing a spot a split may move before the row counts as tight (the split spread).
const SPREAD_SLACK = 2;
const HUB_MIN_PAIRS = 3;
export const isRowHub = (links: number, rowLinks: readonly number[]) =>
  links >= HUB_MIN_LINKS &&
  links * 2 > rowLinks.length &&
  rowLinks.filter((n) => n === 1).length >= HUB_MIN_PAIRS;

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
  // Each group's hubs (isRowHub): members linked to more outside nodes than half the group holds.
  const outsideLinks = new Map<string, number>();
  for (const e of graph.edges) {
    const [a, b] = [clusterOf.get(e.from), clusterOf.get(e.to)];
    if (a === b) continue;
    if (a) outsideLinks.set(e.from, (outsideLinks.get(e.from) ?? 0) + 1);
    if (b) outsideLinks.set(e.to, (outsideLinks.get(e.to) ?? 0) + 1);
  }
  const groupLinks = new Map<string, number[]>();
  for (const n of nodes) {
    const g = clusterOf.get(n.id);
    if (g) (groupLinks.get(g) ?? groupLinks.set(g, []).get(g)!).push(outsideLinks.get(n.id) ?? 0);
  }
  const hubs = new Set(
    nodes
      .filter((n) => {
        const g = clusterOf.get(n.id);
        return !!g && isRowHub(outsideLinks.get(n.id) ?? 0, groupLinks.get(g)!);
      })
      .map((n) => n.id),
  );
  frames.forEach((frame, f) => {
    const members = nodes.filter((n) => clusterOf.get(n.id) === frame.id);
    if (members.length === 0) return;
    const inside = new Set(members.map((m) => m.id));
    if (graph.edges.some((e) => inside.has(e.from) && inside.has(e.to))) return;
    const row = Math.round(mainOf(members[0]!, direction));
    if (members.some((m) => Math.round(mainOf(m, direction)) !== row)) return;

    const want = new Map<string, number>();
    const othersOf = (m: BoxedElement) =>
      graph.edges
        .flatMap((e) => (e.from === m.id ? [e.to] : e.to === m.id ? [e.from] : []))
        .map((id) => nodes[index.get(id) ?? -1])
        .filter((o): o is BoxedElement => !!o && !inside.has(o.id));
    // The group most of the row links to (services to their stores): a member sits by its links there, so a service's
    // one link to a third party does not pull it off its own store. A hub of another row (a bus every service
    // publishes to) is no place to sit by.
    const groupOf = (o: BoxedElement) => clusterOf.get(o.id) ?? o.id;
    const linkers = new Map<string, number>();
    for (const m of members)
      for (const g of new Set(othersOf(m).map(groupOf))) linkers.set(g, (linkers.get(g) ?? 0) + 1);
    const partner = [...linkers].sort((a, b) => b[1] - a[1])[0]?.[0];
    const rowLinks = members.map((m) => othersOf(m).length);
    for (const m of members) {
      const all = othersOf(m);
      if (isRowHub(all.length, rowLinks)) continue;
      const near = all.filter((o) => !hubs.has(o.id));
      const own = near.filter((o) => groupOf(o) === partner);
      const others = own.length ? own : near;
      const sides = [-1, 1].map((sign) =>
        others.filter((o) => Math.sign(mainOf(o, direction) - row) === sign),
      );
      const side = sides.find((s) => s.length > 0);
      if (side) want.set(m.id, side.reduce((s, o) => s + crossOf(o, direction), 0) / side.length);
    }
    // All wanting one spot (a row fed by one node) is what the contracted layout already placed them by.
    if (new Set([...want.values()].map(Math.round)).size < 2) return;
    const own = new Map(want);

    const order = [...members].sort((a, b) => crossOf(a, direction) - crossOf(b, direction));
    const ids = order.map((m) => m.id);
    const byId = new Map(order.map((m) => [m.id, m]));
    const offsets = rankOffsets(
      ids,
      (id) => crossLen(byId.get(id)!, direction),
      () => SIBLING_GAP,
    );
    // Each member placed by its spot, the ones without packed beside the nearest that has one.
    const legalised = (spots: ReadonlyMap<string, number>) => {
      const w = new Map(spots);
      const first = ids.findIndex((id) => w.has(id));
      for (let i = first + 1; i < ids.length; i++)
        if (!w.has(ids[i]!)) w.set(ids[i]!, w.get(ids[i - 1]!)! + offsets[i]! - offsets[i - 1]!);
      for (let i = first - 1; i >= 0; i--)
        w.set(ids[i]!, w.get(ids[i + 1]!)! - offsets[i + 1]! + offsets[i]!);
      return legalise(ids, w, offsets);
    };
    const pooled = legalised(want);
    // Two members wanting one spot (a store and a warehouse both under the analytics service) split the difference,
    // which is right while only they move. In a tight row the split spreads to every member, and each line from a
    // service to its store jogged: then the first takes the spot and the next packs beside it.
    const sharers = new Set<number>();
    const counts = new Map<number, number>();
    for (const spot of want.values())
      counts.set(Math.round(spot), (counts.get(Math.round(spot)) ?? 0) + 1);
    for (const [spot, n] of counts) if (n > 1) sharers.add(spot);
    const moved = [...want].filter(([id, spot]) => Math.abs(pooled.get(id)! - spot) > 1).length;
    let placed = pooled;
    if (sharers.size > 0) {
      const sharing = [...want.values()].filter((spot) => sharers.has(Math.round(spot))).length;
      if (moved > sharing + SPREAD_SLACK) {
        const first = new Map<string, number>();
        const taken = new Set<number>();
        for (const id of ids) {
          const spot = want.get(id);
          if (spot === undefined || taken.has(Math.round(spot))) continue;
          taken.add(Math.round(spot));
          first.set(id, spot);
        }
        placed = legalised(first);
      }
    }
    // A member within a notch of its own spot sits on it, its gap to the next shrinking by no more than that: pooled
    // with neighbours that wanted one spot, a store sat 5 px off its service and its line was drawn as a slant.
    ids.forEach((id, i) => {
      const target = own.get(id);
      const at = placed.get(id)!;
      if (target === undefined || target === at || Math.abs(target - at) > NOTCH_MAX) return;
      const j = target > at ? i + 1 : i - 1;
      const other = ids[j];
      const fits =
        other === undefined ||
        Math.abs(placed.get(other)! - target) >= Math.abs(offsets[j]! - offsets[i]!) - NOTCH_MAX;
      if (fits) placed.set(id, target);
    });
    const seated = [...placed].map(([id, c]) => atCross(byId.get(id)!, c, direction));

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
      pad +
        headingLead(
          frame.label,
          seated,
          entered,
          pad,
          direction,
          (frame as { textSize?: unknown }).textSize,
        ),
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
