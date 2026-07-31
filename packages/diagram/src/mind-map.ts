// Mind-map growth (spec/118): where a new node goes, and what connects it.
//
// Pure geometry + tree walking, in the diagram package so the editor's
// keyboard handler and any future auto-arrange share one definition of
// "where does the next node go".

import { createPinnedArrow, createShape } from './factories';
import type { ArrowElement, Element, ElementId, ShapeElement } from './index';

/** Gap between a parent and its child, left to right. */
export const MIND_CHILD_GAP_X = 64;
/** Gap between stacked siblings, top to bottom. */
export const MIND_SIBLING_GAP_Y = 18;

export function isMindNode(el: Element): el is ShapeElement {
  return el.type === 'shape' && el.shape === 'mind-node';
}

/** The nodes whose `mindParentId` is `id`, in document order. */
export function mindChildren(elements: Element[], id: ElementId): ShapeElement[] {
  return elements.filter((el) => isMindNode(el) && el.mindParentId === id) as ShapeElement[];
}

/**
 * Every node under `id`, excluding `id` itself.
 *
 * Walks iteratively with a seen-set rather than recursing: `mindParentId` is
 * plain stored data, so a hand-edited or round-tripped file could contain a
 * cycle, and a recursive walk would blow the stack instead of drawing a
 * diagram.
 */
export function mindSubtree(elements: Element[], id: ElementId): ShapeElement[] {
  const out: ShapeElement[] = [];
  const seen = new Set<ElementId>([id]);
  let frontier = mindChildren(elements, id);
  while (frontier.length > 0) {
    const next: ShapeElement[] = [];
    for (const node of frontier) {
      if (seen.has(node.id)) continue;
      seen.add(node.id);
      out.push(node);
      next.push(...mindChildren(elements, node.id));
    }
    frontier = next;
  }
  return out;
}

/**
 * Where a new child of `parent` should sit.
 *
 * Stacks against the bottom of the parent's whole SUBTREE, not just its
 * immediate children: a branch that has already grown down past its own
 * parent would otherwise have the next sibling land on top of a grandchild.
 */
export function nextMindChildPosition(
  elements: Element[],
  parent: ShapeElement,
  size: { width: number; height: number },
): { x: number; y: number } {
  const x = parent.x + parent.width + MIND_CHILD_GAP_X;
  const subtree = mindSubtree(elements, parent.id);
  if (subtree.length === 0) {
    // First child: centred on the parent, which is what makes a lone branch
    // look deliberate rather than dropped.
    return { x, y: parent.y + parent.height / 2 - size.height / 2 };
  }
  const bottom = Math.max(...subtree.map((n) => n.y + n.height));
  return { x, y: bottom + MIND_SIBLING_GAP_Y };
}

/**
 * Build a node attached to `parent`, plus the arrow that connects them.
 *
 * The connector is an ordinary pinned arrow: the tree is the arrows you can
 * already see plus a pointer saying which node owns which, not a second graph
 * model that could drift from what is drawn.
 */
export function growMindChild(
  elements: Element[],
  parent: ShapeElement,
  // The node the user grew FROM, when that isn't the parent — pressing Enter
  // on a child makes a sibling, and the size should match the sibling you were
  // standing on, not its parent.
  sizeFrom: ShapeElement = parent,
): { node: ShapeElement; arrow: ArrowElement } {
  const base = createShape('mind-node', 0, 0) as ShapeElement;
  // Inherit the source node's size. Resizing one node (or letting a long
  // label widen it) and then growing from it otherwise produced a branch of
  // mismatched boxes, which reads as a mistake rather than a hierarchy.
  const size = { width: sizeFrom.width, height: sizeFrom.height };
  const at = nextMindChildPosition(elements, parent, size);
  const node: ShapeElement = { ...base, ...size, x: at.x, y: at.y, mindParentId: parent.id };
  // East to west: the arrow always leaves the parent's right edge and enters
  // the child's left, so a branch reads as one continuous run regardless of
  // how far the child has been stacked down.
  return { node, arrow: createPinnedArrow(parent.id, 'e', node.id, 'w') };
}

/**
 * Build a sibling of `node` — i.e. another child of its parent.
 *
 * A root has no parent to attach to, so `Enter` on one makes another ROOT,
 * offset below. Returning no arrow is the signal for that.
 */
export function growMindSibling(
  elements: Element[],
  node: ShapeElement,
): { node: ShapeElement; arrow: ArrowElement | null } {
  const parent = node.mindParentId
    ? elements.find((el) => el.id === node.mindParentId && isMindNode(el))
    : undefined;
  if (parent && isMindNode(parent)) return growMindChild(elements, parent, node);
  const base = createShape('mind-node', 0, 0) as ShapeElement;
  return {
    node: {
      ...base,
      width: node.width,
      height: node.height,
      x: node.x,
      y: node.y + node.height + MIND_SIBLING_GAP_Y,
    },
    arrow: null,
  };
}
