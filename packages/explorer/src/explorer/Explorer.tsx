'use client';

// <Explorer>: the One Explorer, the same in every app. The host renders it at its own /explorer, reads
// the view from its URL (viewFromLocation) and passes it in; the Explorer asks to go elsewhere through
// onNavigate and links items through itemHref, so it never touches the host's router. It shows this app's
// items or every app's (the filter), and New makes this app's kind.

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import type { App, IndexClient, Item } from '@liveworkspace/index-client';
import { ToastProvider } from '../ui/Toasts';
import type { ExplorerView } from '../views';
import type { AppFilter } from '../words';
import type {
  ItemHref,
  LinkComponent,
  Placement,
  RenderThumbnail,
  ShareUrl,
  TeamRef,
} from '../types';
import { ExplorerProvider } from './context';
import { ExplorerDialogs } from './Dialogs';
import { HomePane } from './HomePane';
import { InboxPane } from './InboxPane';
import { ItemsPane } from './ItemsPane';
import { SearchField } from './SearchField';
import { Sidebar } from './Sidebar';
import { TagsPane } from './TagsPane';

export type ExplorerProps = {
  /** The host app: its kind is what New makes and what "this app" shows. */
  app: App;
  client: IndexClient;
  view: ExplorerView;
  /** Go to another view; `href` is its address under `basePath`. */
  onNavigate: (view: ExplorerView, href: string) => void;
  /** An item's address in its own app (another app's item opens there), optionally at a tab and element. */
  itemHref: ItemHref;
  /** New: make an item of this app's kind at this placement, then open it. */
  onCreate: (placement: Placement) => void;
  /** A preview for a row (small) or a card (large); without it rows show the kind's icon. */
  renderThumbnail?: RenderThumbnail;
  /** The host's link component (Next.js `Link`); a plain `<a>` by default. */
  Link?: LinkComponent;
  /** Opens an item from a menu; a page load by default. */
  onOpenItem?: (href: string, item: Item) => void;
  /** Where the Explorer lives in the host, `/explorer` by default. */
  basePath?: string;
  /** Teams the person has joined (their token's `teams` claim), for the sidebar and Move. */
  teams?: TeamRef[];
  /** The person's id, for "Assigned to You" in the Inbox. */
  viewerId?: string | null;
  /** A share link's address; `${origin}/s/<code>` by default. */
  shareUrl?: ShareUrl;
  /** The Manage Teams row's address; the row is hidden without it. */
  manageTeamsUrl?: string;
  /** Controlled filter; uncontrolled (remembered per app in this browser) when omitted. */
  filter?: AppFilter;
  onFilterChange?: (filter: AppFilter) => void;
  /** Rendered above the pane, beside the search field (the host's own controls). */
  toolbar?: ReactNode;
};

const FILTER_KEY = (app: App) => `liveworkspace:explorer-filter:${app}`;

function useFilter(app: App, controlled?: AppFilter, onChange?: (f: AppFilter) => void) {
  const [own, setOwn] = useState<AppFilter>('app');
  useEffect(() => {
    if (controlled) return;
    try {
      const saved = localStorage.getItem(FILTER_KEY(app));
      if (saved === 'all' || saved === 'app') setOwn(saved);
    } catch {
      // No storage: this app's items.
    }
  }, [app, controlled]);
  const set = useCallback(
    (next: AppFilter) => {
      if (!controlled) {
        setOwn(next);
        try {
          localStorage.setItem(FILTER_KEY(app), next);
        } catch {
          // A convenience only.
        }
      }
      onChange?.(next);
    },
    [app, controlled, onChange],
  );
  return [controlled ?? own, set] as const;
}

export function Explorer(props: ExplorerProps) {
  return (
    <ToastProvider>
      <ExplorerInner {...props} />
    </ToastProvider>
  );
}

function ExplorerInner({
  app,
  client,
  view,
  onNavigate,
  itemHref,
  onCreate,
  renderThumbnail,
  Link,
  onOpenItem,
  basePath,
  teams,
  viewerId,
  shareUrl,
  manageTeamsUrl,
  filter: controlledFilter,
  onFilterChange,
  toolbar,
}: ExplorerProps) {
  const [filter, setFilter] = useFilter(app, controlledFilter, onFilterChange);
  const [navOpen, setNavOpen] = useState(false);
  const navigate = useCallback(
    (v: ExplorerView, href: string) => {
      setNavOpen(false);
      onNavigate(v, href);
    },
    [onNavigate],
  );
  const openNav = useCallback(() => setNavOpen(true), []);
  return (
    <ExplorerProvider
      app={app}
      client={client}
      view={view}
      filter={filter}
      setFilter={setFilter}
      onNavigate={navigate}
      itemHref={itemHref}
      onCreate={onCreate}
      onOpenItem={onOpenItem}
      Link={Link}
      basePath={basePath}
      teams={teams}
      viewerId={viewerId}
      renderThumbnail={renderThumbnail}
      shareUrl={shareUrl}
      manageTeamsUrl={manageTeamsUrl}
    >
      <div
        data-explorer=""
        className="mx-auto flex w-full max-w-7xl flex-1 gap-8 px-4 pb-16 pt-8 sm:px-6"
      >
        <aside className="hidden w-64 shrink-0 self-start sm:block" aria-label="Sections">
          <div className="sticky top-20 px-1 py-1">
            <Sidebar />
          </div>
        </aside>
        {navOpen ? <SectionsDrawer onClose={() => setNavOpen(false)} /> : null}
        <section className="min-w-0 flex-1">
          <div className="mb-6 flex items-center gap-2">
            <SearchField className="w-full sm:max-w-md" />
            {toolbar}
          </div>
          <Pane view={view} onOpenNav={openNav} />
        </section>
      </div>
      <ExplorerDialogs />
    </ExplorerProvider>
  );
}

function Pane({ view, onOpenNav }: { view: ExplorerView; onOpenNav: () => void }) {
  switch (view.kind) {
    case 'home':
      return <HomePane onOpenNav={onOpenNav} />;
    case 'inbox':
      return <InboxPane onOpenNav={onOpenNav} />;
    case 'tags':
      return view.id ? (
        <ItemsPane view={view} onOpenNav={onOpenNav} />
      ) : (
        <TagsPane onOpenNav={onOpenNav} />
      );
    default:
      return <ItemsPane view={view} onOpenNav={onOpenNav} />;
  }
}

function SectionsDrawer({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div
      className="fixed inset-0 z-40 sm:hidden"
      role="dialog"
      aria-modal="true"
      aria-label="Sections"
    >
      <button
        type="button"
        aria-label="Close sections"
        className="absolute inset-0 bg-slate-900/40"
        onClick={onClose}
      />
      <div className="absolute inset-y-0 left-0 w-72 max-w-[85%] overflow-y-auto bg-slate-50 p-3 shadow-xl dark:bg-slate-900">
        <Sidebar />
      </div>
    </div>
  );
}
