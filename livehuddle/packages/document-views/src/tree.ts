// The outline's elements (docs/specs/024-agents/blueprints/document-views.md "The view model"): each printed
// non-arrow element at the top level, in reading order, bare strokes folded. Nothing nests: the layout containers
// that once held elements are retired kinds that hold nothing (docs/specs/002-project-scope/not-in-livehuddle.md
// "The element engine", part 3), so a stored lane, stack or boundary prints beside what sat on it.
import type { Element } from '@livehuddle/document';
import { freehandRuns, type FreehandRun } from './freehand-runs';
import { readingOrder, type Placed } from './reading-order';

export type ViewNode = Placed;
export type FreehandRunItem = FreehandRun<ViewNode>;
export type ViewItem = ViewNode | FreehandRunItem;

export type ViewTree = { roots: ViewItem[]; nodes: ReadonlyMap<string, ViewNode> };

export function isViewRun(item: ViewItem): item is FreehandRunItem {
  return 'run' in item;
}

// `printed` is in array order; arrows are left out.
export function buildViewTree(
  printed: readonly Element[],
  arrowEndIds: ReadonlySet<string>,
): ViewTree {
  const nodes = new Map<string, ViewNode>();
  printed.forEach((el, index) => {
    if (el.type === 'arrow' || nodes.has(el.id)) return;
    nodes.set(el.id, { el, index });
  });
  return { roots: freehandRuns(readingOrder([...nodes.values()]), arrowEndIds), nodes };
}

// Every node of `items` in reading order, runs unfolded into their strokes.
export function nodesOf(items: readonly ViewItem[]): ViewNode[] {
  return items.flatMap((item) => (isViewRun(item) ? item.strokes : [item]));
}

// The items a view starts from: the whole tab, or the one element `only`.
export function subtreeItems(tree: ViewTree, only: string | undefined): ViewItem[] {
  if (only === undefined) return tree.roots;
  const node = tree.nodes.get(only);
  return node === undefined ? [] : [node];
}
