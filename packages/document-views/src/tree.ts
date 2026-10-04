// The outline's tree (docs/specs/024-agents/blueprints/document-views.md "The view model"): each printed
// non-arrow element under its derived container, siblings in reading order, bare strokes folded.
import { deriveContainers, type Element } from '@livediagram/document';
import { freehandRuns, type FreehandRun } from './freehand-runs';
import { readingOrder, type Placed } from './reading-order';

export type ViewNode = Placed & { container: string | null; children: ViewItem[] };
export type FreehandRunItem = FreehandRun<ViewNode>;
export type ViewItem = ViewNode | FreehandRunItem;

export type ViewTree = { roots: ViewItem[]; nodes: ReadonlyMap<string, ViewNode> };

export function isViewRun(item: ViewItem): item is FreehandRunItem {
  return 'run' in item;
}

// `printed` is in array order; arrows are left out of the tree.
export function buildViewTree(
  printed: readonly Element[],
  arrowEndIds: ReadonlySet<string>,
): ViewTree {
  const containers = deriveContainers(printed);
  const nodes = new Map<string, ViewNode>();
  const childrenOf = new Map<string | null, ViewNode[]>();
  printed.forEach((el, index) => {
    if (el.type === 'arrow' || nodes.has(el.id)) return;
    const container = containers.get(el.id) ?? null;
    const node: ViewNode = { el, index, container, children: [] };
    nodes.set(el.id, node);
    const siblings = childrenOf.get(container);
    if (siblings) siblings.push(node);
    else childrenOf.set(container, [node]);
  });
  const arrange = (siblings: readonly ViewNode[]): ViewItem[] =>
    freehandRuns(readingOrder(siblings), arrowEndIds);
  for (const node of nodes.values()) node.children = arrange(childrenOf.get(node.el.id) ?? []);
  return { roots: arrange(childrenOf.get(null) ?? []), nodes };
}

// Every node under `items`, depth-first in reading order, runs unfolded into their strokes.
export function depthFirst(items: readonly ViewItem[]): ViewNode[] {
  return items.flatMap((item) =>
    isViewRun(item) ? item.strokes : [item, ...depthFirst(item.children)],
  );
}

// The items a view starts from: the whole tree, or the subtree of `only`.
export function subtreeItems(tree: ViewTree, only: string | undefined): ViewItem[] {
  if (only === undefined) return tree.roots;
  const node = tree.nodes.get(only);
  return node === undefined ? [] : [node];
}
