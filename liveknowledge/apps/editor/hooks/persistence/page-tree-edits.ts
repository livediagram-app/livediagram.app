// The tab actions' edits of the page tree (docs/specs/030-knowledgebase/blueprints/page-tree.md "Tab actions in tree
// terms"), as list transforms over the tree functions (@liveknowledge/document page-tree.ts): a page added under a
// parent, duplicated beside itself, deleted with its subpages. Pure; the hook (useTabActions) commits what they
// answer. Each answers the same list when the tree refuses the edit.
import {
  buildPageTree,
  isConnectedRow,
  pageParents,
  pageSubtreeIds,
  withPageAdded,
  withPageDeleted,
  withPageMoved,
  type PageTreeRefusal,
  type Tab,
} from '@liveknowledge/document';

/** The list with `page` added as the last subpage of `parent` (the last top-level page when absent). */
export function withPageAddedTo(tabs: Tab[], page: Tab, parent?: string): Tab[] {
  const next = withPageAdded(tabs, page, parent);
  return Array.isArray(next) ? next : tabs;
}

// The sibling after a page, under the same parent; undefined for the last.
function nextSiblingOf(tabs: readonly Tab[], id: string): string | undefined {
  const parent = pageParents(tabs).get(id);
  const siblings = tabs.filter((t) => pageParents(tabs).get(t.id) === parent).map((t) => t.id);
  return siblings[siblings.indexOf(id) + 1];
}

/** The list with `copy` placed just after `sourceId`, under the same parent. The copy takes none of its subpages. */
export function withPageDuplicated(tabs: Tab[], sourceId: string, copy: Tab): Tab[] {
  const parents = pageParents(tabs);
  if (!parents.has(sourceId)) return tabs;
  const parent = parents.get(sourceId);
  const before = nextSiblingOf(tabs, sourceId);
  const added = withPageAdded(tabs, copy, parent);
  if (!Array.isArray(added)) return tabs;
  return before === undefined
    ? added
    : (withPageMoved(added, copy.id, { parent, before }) ?? added);
}

// A tab without the element links that point at a deleted page (a link to a document or a url goes elsewhere).
function withoutLinksTo(tab: Tab, gone: ReadonlySet<string>): Tab {
  let changed = false;
  const elements = tab.elements.map((el) => {
    const link = el.link;
    if (!link || (link.kind !== 'tab' && link.kind !== 'element') || !gone.has(link.tabId))
      return el;
    changed = true;
    const { link: _drop, ...rest } = el;
    void _drop;
    return rest;
  });
  return changed ? { ...tab, elements } : tab;
}

/** The list without a page and its subpages, the links on the pages left that pointed at them stripped. The same
 *  list when no page would be left, or the page is not there. */
export function withPageAndSubpagesDeleted(tabs: Tab[], id: string): Tab[] {
  const gone = new Set(pageSubtreeIds(tabs, id));
  const left = withPageDeleted(tabs, id);
  return left ? left.map((tab) => withoutLinksTo(tab, gone)) : tabs;
}

/**
 * The page to open once `id` and its subpages are gone: the next page after them in the tree, else the one before,
 * so the reader stays where they were in the list. Undefined when the page is not there.
 */
export function pageAfterDelete(tabs: readonly Tab[], id: string): string | undefined {
  const gone = new Set(pageSubtreeIds(tabs, id));
  if (gone.size === 0) return undefined;
  const order: string[] = [];
  const walk = (nodes: ReturnType<typeof buildPageTree<Tab>>) => {
    for (const node of nodes) {
      order.push(node.page.id);
      walk(node.children);
    }
  };
  walk(buildPageTree(tabs));
  const first = order.findIndex((pageId) => gone.has(pageId));
  // Never a connected file's row, which is no page to open (links-and-embeds.md "Connected files in the sidebar").
  const rows = new Set(tabs.filter(isConnectedRow).map((t) => t.id));
  const after = order.slice(first).find((pageId) => !gone.has(pageId) && !rows.has(pageId));
  return (
    after ??
    order
      .slice(0, first)
      .reverse()
      .find((pageId) => !rows.has(pageId))
  );
}

/** The delete confirmation's title, naming the count ("Delete Release Process and 3 Subpages?"). */
export function deletePageTitle(name: string, subpages: number, toTrash = false): string {
  const page = name.trim() || 'This Page';
  const what =
    subpages === 0 ? page : `${page} and ${subpages} ${subpages === 1 ? 'Subpage' : 'Subpages'}`;
  return toTrash ? `Move ${what} to the Trash?` : `Delete ${what}?`;
}

/** The delete confirmation's words: to the knowledgebase's Trash, or (an Offline knowledgebase, which has none)
 *  removed, with Undo to bring it back (knowledgebases-and-pages.md "The page Trash"). */
export function deletePageMessage(subpages: number, toTrash: boolean): string {
  if (toTrash)
    return subpages === 0
      ? 'You can restore it from the Trash for 30 days. Undo (Cmd/Ctrl-Z) brings it straight back.'
      : 'You can restore them from the Trash for 30 days. Undo (Cmd/Ctrl-Z) brings them straight back.';
  return subpages === 0
    ? 'The page is removed for everyone. Undo (Cmd/Ctrl-Z) brings it back.'
    : 'The page and its subpages are removed for everyone. Undo (Cmd/Ctrl-Z) brings them back.';
}

/** Why the tree refuses an edit, as a person reads it in a tooltip or a toast. */
export function pageTreeRefusalText(reason: PageTreeRefusal): string {
  switch (reason) {
    case 'page_limit':
      return 'A knowledgebase holds 500 pages at most.';
    case 'depth_limit':
      return 'Pages nest 8 levels deep at most.';
    case 'own_subtree':
      return 'A page cannot move inside its own subpages.';
    case 'unknown_page':
      return 'That page is no longer here.';
  }
}
