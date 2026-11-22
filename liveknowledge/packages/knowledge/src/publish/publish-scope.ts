// Which pages a public site holds (docs/specs/030-knowledgebase/publishing.md "What goes public", blueprint P4): the
// whole knowledgebase or one section, in the tree's order, without the pages Pending Approval or Rejected. A page
// left out keeps its subpages, which hang under its nearest published ancestor. Connected rows (another app's file
// among the pages) are no pages, and never published.
import { isConnectedRow, pageParents, pageTreeRows, type TreePage } from '@liveknowledge/document';
import { parseKnowledgeFields } from '../trust';

/** A page as the tab list holds it: no writing. */
export type ScopePage = TreePage & { name: string; knowledge?: unknown };

/** Why a page in scope stays private. `empty` is found once its writing is read (no saved text). */
export type LeftOutReason = 'pending' | 'rejected' | 'empty';

/** A page that goes public, with its parent as the site reads it (null at the top). */
export type ScopedPage = { id: string; name: string; parent: string | null };

export type PublishScope = {
  pages: ScopedPage[];
  leftOut: { id: string; name: string; reason: LeftOutReason }[];
};

/** The pages under `root` (`null` for every page) that may go public, and those that may not, in tree order. Null
 *  when `root` names no page of the knowledgebase. */
export function publishableScope(
  tabs: readonly ScopePage[],
  root: string | null,
): PublishScope | null {
  const pages = tabs.filter((t) => !isConnectedRow(t));
  if (root !== null && !pages.some((p) => p.id === root)) return null;
  const parents = pageParents(pages);
  const inScope = (id: string): boolean => {
    if (root === null) return true;
    for (let at: string | undefined = id; at !== undefined; at = parents.get(at))
      if (at === root) return true;
    return false;
  };
  const out: PublishScope = { pages: [], leftOut: [] };
  const included = new Set<string>();
  for (const { page } of pageTreeRows(pages)) {
    if (!inScope(page.id)) continue;
    const state = parseKnowledgeFields(page.knowledge).approval?.state;
    if (state === 'pending' || state === 'rejected') {
      out.leftOut.push({ id: page.id, name: page.name, reason: state });
      continue;
    }
    // The nearest ancestor that is published, inside the section.
    let parent: string | null = null;
    for (
      let at = parents.get(page.id);
      at !== undefined && page.id !== root;
      at = parents.get(at)
    ) {
      if (included.has(at)) {
        parent = at;
        break;
      }
      if (at === root) break;
    }
    included.add(page.id);
    out.pages.push({ id: page.id, name: page.name, parent });
  }
  return out;
}

/** The scope without the pages found empty once read: their subpages move up to the nearest page kept. */
export function withoutEmptyPages(scope: PublishScope, empty: ReadonlySet<string>): PublishScope {
  if (empty.size === 0) return scope;
  const parentOf = new Map(scope.pages.map((p) => [p.id, p.parent]));
  const kept = (id: string | null): string | null => {
    let at = id;
    while (at !== null && empty.has(at)) at = parentOf.get(at) ?? null;
    return at;
  };
  return {
    pages: scope.pages
      .filter((p) => !empty.has(p.id))
      .map((p) => ({ ...p, parent: kept(p.parent) })),
    leftOut: [
      ...scope.leftOut,
      ...scope.pages
        .filter((p) => empty.has(p.id))
        .map((p) => ({ id: p.id, name: p.name, reason: 'empty' as const })),
    ],
  };
}
