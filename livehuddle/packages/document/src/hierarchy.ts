import { isBoxed, type Element, type ElementId } from './index';

// Branch assignment for multi-colour ("rainbow") themes (docs/specs/011-theme/multicolour-themes.md). The branch
// walk over pinned arrows went with the diagram theming (docs/specs/002-project-scope/not-in-livehuddle.md "The
// element engine", part 5; DEFAULTS.md D34): every boxed element takes the next branch index in document order, the
// rule boxes no arrow joined always had, so a palette theme still spreads a tab across its hues. A stored arrow is a
// retired element and keeps every colour it stored, so it takes no branch.
//
// Pure + dependency-free so the assignment is unit-testable without rendering (hierarchy.test.ts) and reusable by
// every theme-apply path (template build, in-editor theme switch / reset).

// Map every boxed element to its branch index, 0-based in document order.
export function assignBranches(elements: Element[]): Map<ElementId, number> {
  const branches = new Map<ElementId, number>();
  for (const el of elements) if (isBoxed(el)) branches.set(el.id, branches.size);
  return branches;
}
