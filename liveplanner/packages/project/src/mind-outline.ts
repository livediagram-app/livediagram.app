// An outline applied to a mind map (docs/specs/009-elements/mind-node.md "Edit Outline"): each line
// is matched to an existing node, so its look, comments, actions and links stay with it (the same
// text under the same parent, else the same text anywhere in the map, a move, else the same place
// under the same parent, a rename); new lines become nodes that look like their level; nodes whose
// line is gone are removed with the arrows pinned to them; and the map is laid out again in the
// outline's order. Pure: the caller mints ids and dresses new nodes and connectors (the tab's
// theme), and commits the result as one change.
import type { ArrowElement, Element, ElementId, ShapeElement } from './index';
import { createPinnedArrow, createShape } from './factories';
import { MIND_CONNECTOR_LOOK } from './mind-flow';
import {
  applyMindMoves,
  mindConnectorBetween,
  mindConnectorStyleSource,
  mindStyleSource,
  relayoutMindMap,
} from './mind-grow';
import { isMindNode, mindFlowOf, mindRootOf } from './mind-map';
import { mindNodesInOrder } from './mind-layout';
import { mindOutlineNodeText, type MindOutlineNode } from './mind-outline-text';
import {
  mindNodeMarks,
  mindRichTextFor,
  restyleMindNode,
  sameMindMarks,
} from './mind-outline-marks';
import type { TextRun } from './rich-text';

/** What a save will do, for the dialog's count and its removal question. */
export type MindOutlineSummary = {
  added: number;
  renamed: number;
  // Same text, different bold / italic / underline.
  restyled: number;
  moved: number;
  removed: ShapeElement[];
};

// The outline flattened depth first: each node's text, its marks and the index of its parent.
type Flat = { text: string; marks: TextRun[]; parent: number };

function flatten(root: MindOutlineNode): Flat[] {
  const out: Flat[] = [];
  const walk = (node: MindOutlineNode, parent: number) => {
    const at = out.length;
    out.push({ text: node.text.trim(), marks: node.marks, parent });
    for (const kid of node.children) walk(kid, at);
  };
  walk(root, -1);
  return out;
}

type Match = {
  lines: Flat[];
  // The existing node each line keeps, by line index (undefined: a new node).
  nodeOf: (ShapeElement | undefined)[];
  // The map's nodes as they stand, depth first in the map's own order.
  map: { node: ShapeElement; depth: number }[];
};

function match(elements: Element[], root: ShapeElement, outline: MindOutlineNode): Match {
  const lines = flatten(outline);
  const map = mindNodesInOrder(elements, root.id, mindFlowOf(elements, root));
  const nodeOf: (ShapeElement | undefined)[] = lines.map(() => undefined);
  const taken = new Set<ElementId>([root.id]);
  nodeOf[0] = root;
  const take = (i: number, node: ShapeElement) => {
    nodeOf[i] = node;
    taken.add(node.id);
  };
  const free = (pred: (n: ShapeElement) => boolean) =>
    map.find(({ node }) => !taken.has(node.id) && pred(node))?.node;
  const kidsOf = (parent: ShapeElement) =>
    map.filter(({ node }) => node.mindParentId === parent.id).map(({ node }) => node);
  // Rules 1 and 2, to a fixed point: a line under a kept parent takes that parent's child of the
  // same text; failing that, any free node of the map with that text (a move).
  for (let changed = true; changed;) {
    changed = false;
    lines.forEach((line, i) => {
      if (nodeOf[i]) return;
      const parent = nodeOf[line.parent];
      const sameText = (n: ShapeElement) => mindOutlineNodeText(n.label) === line.text;
      const found =
        (parent && kidsOf(parent).find((n) => !taken.has(n.id) && sameText(n))) ?? free(sameText);
      if (found) {
        take(i, found);
        changed = true;
      }
    });
    if (changed) continue;
    // Rule 3: the free children of a kept parent, in order, are renamed to its unkept lines.
    lines.forEach((line, i) => {
      if (nodeOf[i] || changed) return;
      const parent = nodeOf[line.parent];
      if (!parent) return;
      const freeKids = kidsOf(parent).filter((n) => !taken.has(n.id));
      const unkept = lines
        .map((l, j) => ({ l, j }))
        .filter(({ l, j }) => l.parent === line.parent && !nodeOf[j]);
      const at = unkept.findIndex(({ j }) => j === i);
      const node = freeKids[at];
      if (node) {
        take(i, node);
        changed = true;
      }
    });
  }
  return { lines, nodeOf, map };
}

/** What saving `outline` onto the map rooted at `rootId` will do. */
export function summariseMindOutline(
  elements: Element[],
  rootId: ElementId,
  outline: MindOutlineNode,
): MindOutlineSummary {
  const root = elements.find((el): el is ShapeElement => el.id === rootId && isMindNode(el));
  if (!root) return { added: 0, renamed: 0, restyled: 0, moved: 0, removed: [] };
  const { lines, nodeOf, map } = match(elements, root, outline);
  const kept = new Set(nodeOf.filter(Boolean).map((n) => n!.id));
  let added = 0;
  let renamed = 0;
  let restyled = 0;
  let moved = 0;
  lines.forEach((line, i) => {
    const node = nodeOf[i];
    if (!node) return void (added += 1);
    const change = changeOf(node, line);
    if (change === 'renamed') renamed += 1;
    if (change === 'restyled') restyled += 1;
    if (i === 0) return;
    const parent = nodeOf[line.parent];
    if (parent && node.mindParentId !== parent.id) moved += 1;
  });
  const removed = map.map(({ node }) => node).filter((n) => !kept.has(n.id));
  return { added, renamed, restyled, moved, removed };
}

/** How a kept node's text changes: new words, the same words restyled, or not at all. */
function changeOf(node: ShapeElement, line: Flat): 'renamed' | 'restyled' | null {
  if (mindOutlineNodeText(node.label) !== line.text) return 'renamed';
  return sameMindMarks(mindNodeMarks(node), line.marks) ? null : 'restyled';
}

/** A kept node's text fields after `line`: new text with its marks, or its marks changed. */
function textOf(node: ShapeElement, line: Flat): Partial<ShapeElement> {
  const change = changeOf(node, line);
  if (change === 'renamed')
    return { label: line.text, richText: mindRichTextFor(node, line.text, line.marks) };
  if (change === 'restyled') return { richText: restyleMindNode(node, line.marks) };
  return {};
}

export type MindOutlineDress = {
  // A new element id.
  newId: () => ElementId;
  // A new node dressed for the tab (its theme's colours), then in `from`'s look (null: defaults).
  node: (node: ShapeElement, from: ShapeElement | null) => ShapeElement;
  // A new connector in `from`'s look (null: the mind connector defaults).
  connector: (arrow: ArrowElement, from: ArrowElement | null) => ArrowElement;
};

/**
 * The elements with `outline` applied to the map rooted at `rootId`, or null when it changes
 * nothing (or there is no such map).
 */
export function applyMindOutline(
  elements: Element[],
  rootId: ElementId,
  outline: MindOutlineNode,
  dress: MindOutlineDress,
): Element[] | null {
  const root = elements.find((el): el is ShapeElement => el.id === rootId && isMindNode(el));
  if (!root || mindRootOf(elements, root).id !== root.id) return null;
  const { lines, nodeOf, map } = match(elements, root, outline);
  const summary = summariseMindOutline(elements, rootId, outline);
  const sameOrder =
    map.length === lines.length && map.every(({ node }, i) => nodeOf[i]?.id === node.id);
  if (
    summary.added === 0 &&
    summary.renamed === 0 &&
    summary.restyled === 0 &&
    summary.moved === 0 &&
    summary.removed.length === 0 &&
    sameOrder
  )
    return null;

  // Removed: the nodes whose line is gone, and every arrow pinned to anything removed.
  const gone = new Set(summary.removed.map((n) => n.id));
  for (let grew = true; grew;) {
    grew = false;
    for (const el of elements) {
      if (el.type !== 'arrow' || gone.has(el.id)) continue;
      const pins = [el.from, el.to].filter((e) => e.kind === 'pinned');
      if (pins.some((e) => e.kind === 'pinned' && gone.has(e.elementId))) {
        gone.add(el.id);
        grew = true;
      }
    }
  }
  let next = elements.filter((el) => !gone.has(el.id));

  // Kept and new nodes, line by line (parents first), so a new node's look is read from the
  // siblings already in place.
  const ids: ElementId[] = [];
  // A connector in the look of the sibling the node's own look came from, so a node and the line
  // into it match; else a sibling's, else the one into the parent.
  const connectTo = (parent: ShapeElement, child: ShapeElement, lookFrom?: ShapeElement | null) => {
    const from =
      (lookFrom?.mindParentId === parent.id
        ? mindConnectorBetween(next, parent.id, lookFrom.id)
        : undefined) ?? mindConnectorStyleSource(next, parent);
    const arrow = createPinnedArrow(parent.id, 'e', child.id, 'w');
    arrow.id = dress.newId();
    next = [...next, dress.connector({ ...arrow, ...MIND_CONNECTOR_LOOK }, from)];
  };
  const byId = (id: ElementId) =>
    next.find((el): el is ShapeElement => el.id === id && el.type === 'shape');
  lines.forEach((line, i) => {
    const existing = nodeOf[i];
    if (i === 0) {
      ids.push(root.id);
      const text = textOf(root, line);
      if (Object.keys(text).length)
        next = next.map((el) => (el.id === root.id ? ({ ...el, ...text } as Element) : el));
      return;
    }
    const parent = byId(ids[line.parent]!)!;
    if (existing) {
      ids.push(existing.id);
      const text = textOf(existing, line);
      const moved = existing.mindParentId !== parent.id;
      if (moved) {
        const old = existing.mindParentId
          ? mindConnectorBetween(next, existing.mindParentId, existing.id)
          : undefined;
        if (old) next = next.filter((el) => el.id !== old.id);
      }
      if (Object.keys(text).length || moved)
        next = next.map((el) =>
          el.id === existing.id ? ({ ...el, ...text, mindParentId: parent.id } as Element) : el,
        );
      if (moved) connectTo(parent, byId(existing.id)!);
      return;
    }
    const look = mindStyleSource(next, parent, parent);
    const fresh: ShapeElement = {
      ...createShape('mind-node', parent.x, parent.y),
      id: dress.newId(),
      label: line.text,
    };
    const dressed = dress.node(fresh, look);
    const node: ShapeElement = {
      ...dressed,
      id: fresh.id,
      label: line.text,
      richText: mindRichTextFor(dressed, line.text, line.marks),
      mindParentId: parent.id,
    };
    next = [...next, node];
    ids.push(node.id);
    connectTo(parent, node, look);
  });

  // Only a change of structure lays the map out again: text and formatting alone move nothing.
  const restructured =
    summary.added > 0 || summary.moved > 0 || summary.removed.length > 0 || !sameOrder;
  if (!restructured) return next;
  // Laid out again in the outline's order, connectors re-anchored, other trees moved aside.
  const order = new Map(ids.map((id, i) => [id, i]));
  const relayout = relayoutMindMap(next, root.id, undefined, order);
  return relayout ? applyMindMoves(next, relayout.moves, relayout.reanchored) : next;
}
