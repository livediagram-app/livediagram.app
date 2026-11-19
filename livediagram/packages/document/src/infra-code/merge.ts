// An update's three-way merge (docs/specs/027-repositories/diagram-sources.md "Re-reading a source", blueprint
// "mergeSourceGraph"): the base is the tab's sources record, local the fresh drawing of the files, remote the tab as
// people left it. Kept boxes stay where they are with their style; their label, note and icon follow the files unless
// edited on the tab; new boxes are placed beside their neighbours; boxes gone from the files go, with their lines; a
// box someone deleted stays deleted; whatever people added is never touched.

import { bestAnchorTowards } from '../anchor-choice';
import type { DiagramSourceNode, DiagramSources } from '../diagram-sources';
import { isBoxed, type BoxedElement } from '../element-union';
import type { GraphInput } from '../graph-input';
import type { ArrowElement, Element } from '../index';
import { frameRect, grownFrame, placeAdded, type Rect } from './placement';
import { edgeKeyOf, keyedElements, nodeRecord } from './sources';

const TRACKED = ['label', 'note', 'iconId'] as const;
type Tracked = (typeof TRACKED)[number];

// The route a fresh arrow was given among the fresh boxes: meaningless between boxes placed elsewhere.
const ROUTE_FIELDS = [
  'curveOffset',
  'curvePoints',
  'elbowOffset',
  'labelOffset',
  'exactStart',
  'exactEnd',
] as const;

export type SourceMergeCounts = {
  added: number;
  removed: number;
  kept: number;
  editsKept: number;
  linesAdded: number;
  linesRemoved: number;
};

const isHeader = (key: string) => key.startsWith('#');
const isFrame = (el: Element) => el.type === 'shape' && el.shape === 'frame';
const own = <T extends object>(o: T, key: string) => Object.hasOwn(o, key);
const centre = (r: Rect) => ({ x: r.x + r.width / 2, y: r.y + r.height / 2 });

// The element with one tracked field set to `value`, or removed when it is undefined.
function withField(el: Element, field: Tracked, value: string | undefined): Element {
  const next = { ...el } as Record<string, unknown>;
  if (value === undefined) delete next[field];
  else next[field] = value;
  return next as unknown as Element;
}

export function mergeSourceGraph(input: {
  tab: readonly Element[];
  record: Pick<DiagramSources, 'nodes' | 'edges'> | null;
  fresh: readonly Element[];
  graph: GraphInput;
}): {
  elements: Element[];
  nodes: Record<string, DiagramSourceNode>;
  edges: Record<string, string>;
  counts: SourceMergeCounts;
} {
  const base = input.record ?? { nodes: {}, edges: {} };
  const onTab = new Map(input.tab.map((el) => [el.id, el]));
  const freshKeyed = keyedElements(input.fresh, input.graph);
  const freshKeyOfId = new Map([...freshKeyed].map(([key, el]) => [el.id, key]));
  const counts: SourceMergeCounts = {
    added: 0,
    removed: 0,
    kept: 0,
    editsKept: 0,
    linesAdded: 0,
    linesRemoved: 0,
  };
  const nodes: Record<string, DiagramSourceNode> = {};
  const changed = new Map<string, Element>();
  const removed = new Set<string>();
  // Each key's element on the result (kept or added), and the added ones in fresh order.
  const resultId = new Map<string, string>();
  const added: { key: string; fresh: Element; id: string }[] = [];
  const takenIds = new Set(onTab.keys());

  for (const [key, f] of freshKeyed) {
    const drawn = nodeRecord(f);
    const was = own(base.nodes, key) ? base.nodes[key]! : undefined;
    const cur = was ? onTab.get(was.el) : undefined;
    if (was && cur) {
      if (!isHeader(key)) counts.kept++;
      let next = cur;
      for (const field of TRACKED) {
        const value = (cur as Partial<Record<Tracked, string>>)[field];
        if (value !== was[field]) {
          // Changed on the tab since it was drawn: the person's stays.
          if (value !== drawn[field]) counts.editsKept++;
        } else if (value !== drawn[field]) next = withField(next, field, drawn[field]);
      }
      // A heading that reads longer is widened to hold it, never narrowed.
      if (next !== cur && next.type === 'text' && isBoxed(f) && f.width > next.width)
        next = { ...next, width: f.width };
      if (next !== cur) changed.set(cur.id, next);
      resultId.set(key, cur.id);
      nodes[key] = { ...drawn, el: cur.id };
    } else if (was) {
      // Deleted on the tab while the files still name it: the deletion is the newer edit.
      nodes[key] = { ...drawn, el: was.el };
    } else {
      const id = takenIds.has(f.id) ? crypto.randomUUID() : f.id;
      takenIds.add(id);
      added.push({ key, fresh: f, id });
      resultId.set(key, id);
      nodes[key] = { ...drawn, el: id };
      if (!isHeader(key)) counts.added++;
    }
  }
  for (const [key, was] of Object.entries(base.nodes)) {
    if (freshKeyed.has(key) || !onTab.has(was.el)) continue;
    removed.add(was.el);
    if (!isHeader(key)) counts.removed++;
  }

  // Lines, by their two ends' keys.
  const edges: Record<string, string> = {};
  const freshEdges = new Map<string, ArrowElement>();
  for (const el of input.fresh) {
    const key = edgeKeyOf(el, (id) => freshKeyOfId.get(id));
    if (key !== undefined && !freshEdges.has(key)) freshEdges.set(key, el as ArrowElement);
  }
  const newArrows: { arrow: ArrowElement; id: string; from: string; to: string }[] = [];
  for (const [key, arrow] of freshEdges) {
    if (own(base.edges, key)) {
      // Kept, or deleted by a person (and staying so).
      edges[key] = base.edges[key]!;
      continue;
    }
    const from = resultId.get(freshKeyOfId.get((arrow.from as { elementId: string }).elementId)!);
    const to = resultId.get(freshKeyOfId.get((arrow.to as { elementId: string }).elementId)!);
    // An end someone deleted: the line has nothing to join.
    if (from === undefined || to === undefined) continue;
    const id = takenIds.has(arrow.id) ? crypto.randomUUID() : arrow.id;
    takenIds.add(id);
    newArrows.push({ arrow, id, from, to });
    edges[key] = id;
  }
  for (const [key, id] of Object.entries(base.edges))
    if (!freshEdges.has(key) && onTab.has(id)) removed.add(id);
  // A removed box takes every line pinned to it, a person's own included, as `rm` does.
  for (const el of input.tab)
    if (
      el.type === 'arrow' &&
      ((el.from.kind === 'pinned' && removed.has(el.from.elementId)) ||
        (el.to.kind === 'pinned' && removed.has(el.to.elementId)))
    )
      removed.add(el.id);
  for (const id of removed) if (onTab.get(id)?.type === 'arrow') counts.linesRemoved++;

  // The result before the additions: the tab, removals dropped, changes applied.
  const kept = input.tab.filter((el) => !removed.has(el.id)).map((el) => changed.get(el.id) ?? el);
  const keptById = new Map(kept.map((el) => [el.id, el]));
  const rectOfKey = (key: string): Rect | undefined => {
    const id = resultId.get(key);
    const el = id === undefined ? undefined : keptById.get(id);
    return el && isBoxed(el) ? el : undefined;
  };

  // Where the added boxes go: their neighbours by a fresh line, then their groups' members.
  const neighbours = new Map<string, string[]>();
  const link = (a: string, b: string) => {
    const list = neighbours.get(a);
    if (list) list.push(b);
    else neighbours.set(a, [b]);
  };
  for (const key of freshEdges.keys()) {
    const [a, b] = key.split('>') as [string, string];
    link(a, b);
    link(b, a);
  }
  for (const g of input.graph.groups ?? [])
    for (const m of g.members ?? [])
      for (const other of g.members ?? []) if (other !== m) link(m, other);
  const freshRect = (key: string) => {
    const el = freshKeyed.get(key);
    return el && isBoxed(el) ? el : undefined;
  };
  const addedBoxes = added.filter((a) => !isHeader(a.key) && isBoxed(a.fresh) && !isFrame(a.fresh));
  const placed = placeAdded({
    added: addedBoxes.map((a) => a.key),
    fresh: freshRect,
    onTab: rectOfKey,
    neighbours,
    obstacles: kept.filter((el): el is BoxedElement => isBoxed(el) && !isFrame(el)),
  });
  const rectAfter = (key: string) => rectOfKey(key) ?? placed.get(key);

  // Frames: a new one round its members where they now are; a kept one grown round the members added to it.
  const newFrames: Element[] = [];
  for (const g of input.graph.groups ?? []) {
    const members = (g.members ?? []).flatMap((m) => {
      const r = rectAfter(m);
      return r ? [r] : [];
    });
    const a = added.find((x) => x.key === g.id);
    if (a && isBoxed(a.fresh)) {
      const freshMembers = (g.members ?? []).flatMap((m) => {
        const r = freshRect(m);
        return r ? [r] : [];
      });
      const rect = frameRect(a.fresh, freshMembers, members);
      if (rect) newFrames.push({ ...a.fresh, id: a.id, ...rect });
      continue;
    }
    const frameId = resultId.get(g.id);
    const frame = frameId === undefined ? undefined : keptById.get(frameId);
    const joined = (g.members ?? []).flatMap((m) => {
      const r = placed.get(m);
      return r ? [r] : [];
    });
    if (frame && isBoxed(frame) && joined.length > 0) {
      const grown = grownFrame(frame, joined);
      if (grown !== frame) keptById.set(frame.id, grown);
    }
  }

  const boxes: Element[] = addedBoxes.map((a) => ({
    ...a.fresh,
    id: a.id,
    ...(placed.get(a.key) ? { x: placed.get(a.key)!.x, y: placed.get(a.key)!.y } : {}),
  }));
  // A new heading keeps its fresh offset from the drawing's first kept box.
  const anchorKey = [...freshKeyed.keys()].find((k) => !isHeader(k) && rectOfKey(k));
  for (const a of added) {
    if (!isHeader(a.key) || !isBoxed(a.fresh)) continue;
    const at = anchorKey ? rectOfKey(anchorKey)! : undefined;
    const was = anchorKey ? freshRect(anchorKey) : undefined;
    boxes.push(
      at && was
        ? { ...a.fresh, id: a.id, x: at.x + a.fresh.x - was.x, y: at.y + a.fresh.y - was.y }
        : { ...a.fresh, id: a.id },
    );
  }
  const byId = new Map<string, Element>([...keptById, ...boxes.map((b) => [b.id, b] as const)]);
  const arrows: Element[] = newArrows.map(({ arrow, id, from, to }) => {
    const a = byId.get(from)! as BoxedElement;
    const b = byId.get(to)! as BoxedElement;
    const next = {
      ...arrow,
      id,
      from: { kind: 'pinned' as const, elementId: from, anchor: bestAnchorTowards(a, centre(b)) },
      to: { kind: 'pinned' as const, elementId: to, anchor: bestAnchorTowards(b, centre(a)) },
    } as Record<string, unknown>;
    for (const f of ROUTE_FIELDS) delete next[f];
    return next as unknown as ArrowElement;
  });
  counts.linesAdded = arrows.length;

  return {
    // New frames lowest, so they never cover a box; then the tab as kept; then the new boxes and lines.
    elements: [...newFrames, ...kept.map((el) => keptById.get(el.id) ?? el), ...boxes, ...arrows],
    nodes,
    edges,
    counts,
  };
}
