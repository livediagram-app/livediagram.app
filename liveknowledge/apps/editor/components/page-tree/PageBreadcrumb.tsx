'use client';

// The breadcrumb above a page's title (docs/specs/030-knowledgebase/knowledgebases-and-pages.md "Breadcrumb"): the
// page's ancestors, the top-level one first, each a link that opens that page. A top-level page has none, and shows
// nothing. Drawn in the page's title row, at one size whatever the zoom.
import { useContext, useSyncExternalStore } from 'react';
import { pageAncestors, type Tab } from '@liveknowledge/document';
import { EditorChromeContext, type EditorChromeStore } from '@/app/document/[id]/EditorContext';
import { ChevronIcon } from './page-tree-icons';
import { selectPage } from './select-page';

/** The crumbs as one string a reader compares by value: a typing commit changes no ancestor's id or name. */
function crumbsKey(tabs: readonly Tab[], activeId: string): string {
  return pageAncestors(tabs, activeId)
    .map((page) => `${page.id}\u0000${page.name}`)
    .join('\u0001');
}

function Crumbs({ store }: { store: EditorChromeStore }) {
  const key = useSyncExternalStore(
    store.subscribe,
    () => crumbsKey(store.get().tabs, store.get().activeId),
    () => '',
  );
  if (!key) return null;
  const crumbs = key.split('\u0001').map((entry) => {
    const [id = '', name = ''] = entry.split('\u0000');
    return { id, name: name || 'Untitled Page' };
  });
  return (
    <nav
      aria-label="Breadcrumb"
      data-page-breadcrumb=""
      className="pointer-events-auto flex min-w-0 items-center overflow-hidden text-[13px] text-slate-500 dark:text-slate-400"
    >
      <ol className="flex min-w-0 items-center">
        {crumbs.map((crumb) => (
          <li key={crumb.id} className="flex min-w-0 items-center">
            <a
              // The page's own address (the editor reads the page to open from the fragment), so the link opens
              // in a new tab too; a plain click opens it here.
              href={`#t=${encodeURIComponent(crumb.id)}`}
              onClick={(e) => {
                if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
                e.preventDefault();
                selectPage(store.get(), crumb.id);
              }}
              className="min-w-0 max-w-40 cursor-pointer truncate rounded px-1 py-0.5 motion-safe:transition-colors motion-safe:duration-micro hover:bg-slate-200/70 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-brand-600 dark:hover:bg-slate-800 dark:hover:text-slate-100"
            >
              {crumb.name}
            </a>
            <ChevronIcon aria-hidden className="shrink-0 text-slate-400" />
          </li>
        ))}
      </ol>
    </nav>
  );
}

const noStore = () => () => {};

/** Whether the open page has a parent: its title row then keeps room for the breadcrumb. False with no editor store. */
export function usePageHasAncestors(): boolean {
  const store = useContext(EditorChromeContext);
  return useSyncExternalStore(
    store ? store.subscribe : noStore,
    () => (store ? pageAncestors(store.get().tabs, store.get().activeId).length > 0 : false),
    () => false,
  );
}

export function PageBreadcrumb() {
  // Drawn on its own (a test, a thumbnail) a page sheet has no editor store, and so no breadcrumb.
  const store = useContext(EditorChromeContext);
  return store ? <Crumbs store={store} /> : null;
}
