import { isBoxed, type Element, type ElementId } from './index';

// Branch assignment for multi-colour ("rainbow") themes. See
// docs/specs/011-theme/multicolour-themes.md. The diagram model has no explicit
// parent/child field — hierarchy is implicit in PINNED arrows (an
// arrow whose endpoints anchor to elements). This module turns that
// arrow graph into a branch index per boxed element so a palette theme
// can tint each limb of a tree a different hue.
//
// Pure + dependency-free so the assignment is unit-testable without
// rendering (hierarchy.test.ts) and reusable by every theme-apply path
// (template build, Markdown import, in-editor theme switch / reset).

// Sentinel branch for the hierarchy's TRUNK: root nodes (no incoming
// pinned edge) and any element not yet wired into the graph. A palette
// theme paints these with its `rootColor` rather than a branch hue.
export const ROOT_BRANCH = -1;

// Map every boxed element to a branch index. Roots and untouched
// elements get ROOT_BRANCH; each distinct subtree hanging off a root
// gets its own 0-based index, propagated to all its descendants; loose
// (graph-less) boxed elements each take the next index in document
// order so a flat canvas still gets rainbow variety.
//
// Arrows are NOT in the returned map: a stored arrow is a retired element
// (docs/specs/002-project-scope/not-in-livehuddle.md "The element engine",
// part 4) and keeps every colour it stored; its pinned ends are only read to
// tell which boxes hang together.
export function assignBranches(elements: Element[]): Map<ElementId, number> {
  const boxedIds = new Set<ElementId>();
  for (const el of elements) {
    if (isBoxed(el)) boxedIds.add(el.id);
  }

  // Parent → children adjacency + "has a parent" set, built only from
  // arrows whose BOTH endpoints pin to boxed elements. Self-loops are
  // ignored (an arrow from an element to itself is not a hierarchy
  // edge).
  const children = new Map<ElementId, ElementId[]>();
  const hasParent = new Set<ElementId>();
  const inGraph = new Set<ElementId>();
  for (const el of elements) {
    if (el.type !== 'arrow') continue;
    if (el.from.kind !== 'pinned' || el.to.kind !== 'pinned') continue;
    const parent = el.from.elementId;
    const child = el.to.elementId;
    if (parent === child) continue;
    if (!boxedIds.has(parent) || !boxedIds.has(child)) continue;
    const list = children.get(parent);
    if (list) list.push(child);
    else children.set(parent, [child]);
    hasParent.add(child);
    inGraph.add(parent);
    inGraph.add(child);
  }

  const branches = new Map<ElementId, number>();
  let nextBranch = 0;

  // Depth-first paint of a subtree with one branch index. `visited`
  // guards cycles + shared (diamond) descendants — the first index to
  // reach a node wins. An explicit stack, not recursion: a single chain
  // as long as a tab allows would exhaust the call stack. The whole
  // subtree takes one index, so visiting order cannot change the result.
  const paint = (start: ElementId, branch: number, visited: Set<ElementId>) => {
    const stack = [start];
    while (stack.length > 0) {
      const id = stack.pop()!;
      if (visited.has(id)) continue;
      visited.add(id);
      branches.set(id, branch);
      for (const child of children.get(id) ?? []) stack.push(child);
    }
  };

  // Walk roots in document order. A root is an in-graph element with no
  // incoming edge; each of its direct children seeds a fresh branch.
  const visited = new Set<ElementId>();
  for (const el of elements) {
    if (!isBoxed(el)) continue;
    if (!inGraph.has(el.id) || hasParent.has(el.id)) continue;
    branches.set(el.id, ROOT_BRANCH);
    visited.add(el.id);
    for (const child of children.get(el.id) ?? []) {
      if (visited.has(child)) continue;
      paint(child, nextBranch, visited);
      nextBranch += 1;
    }
  }

  // Loose boxed elements (untouched by any pinned arrow) each take the
  // next branch index, in document order, so a hierarchy-free diagram
  // still spreads across the palette.
  for (const el of elements) {
    if (!isBoxed(el)) continue;
    if (branches.has(el.id)) continue;
    if (inGraph.has(el.id)) continue; // an unreached graph node (cycle) — leave as trunk
    branches.set(el.id, nextBranch);
    nextBranch += 1;
  }

  // Any in-graph node never reached from a root (e.g. a pure cycle with
  // no root) falls back to the trunk so it still gets a colour.
  for (const id of inGraph) {
    if (!branches.has(id)) branches.set(id, ROOT_BRANCH);
  }

  return branches;
}
