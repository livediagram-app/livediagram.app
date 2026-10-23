'use client';

// <Explorer>: the One Explorer, the same in every app. The host renders it at its own /explorer, reads
// the view from its URL (viewFromLocation) and passes it in; the Explorer asks to go elsewhere through
// onNavigate and links items through itemHref, so it never touches the host's router. It shows this app's
// items or every app's (the filter), and New makes this app's kind. It draws the page as livediagram's
// Explorer does: the host's header (with the search field in its middle), Home's hero across the full width
// under it, then the sidebar and the pane.

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { CloseIcon } from '../ui/icons';
import { useItemCount } from '../data/useItemCount';
import type { App, IndexClient, Item } from '@liveworkspace/index-client';
import { ToastProvider } from '../ui/Toasts';
import type { ExplorerView } from '../views';
import type { AppFilter, HeroWords } from '../words';
import type {
  ItemHref,
  LinkComponent,
  Placement,
  RenderThumbnail,
  ShareUrl,
  TeamRef,
} from '../types';
import { ExplorerProvider, useExplorer as useExplorerContext, type HelpHref } from './context';
import { ExplorerDialogs } from './Dialogs';
import { HomeHero } from './HomeHero';
import { HomePane } from './HomePane';
import { InboxPane } from './InboxPane';
import { ItemsPane } from './ItemsPane';
import { SearchField } from './SearchField';
import { Sidebar } from './Sidebar';
import { useHeroPresence } from './useHeroPresence';

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
  /** Rendered beside the search field (the host's own controls). */
  toolbar?: ReactNode;
  /** The host's top bar, given the search field to set in it (null while Home's hero holds the field).
   *  Without it the Explorer draws a slim bar of its own with the field in the middle. */
  header?: (parts: { search: ReactNode }) => ReactNode;
  /** The picture on the right of Home's hero (a fan of previews, say), from `lg` up. */
  heroArt?: ReactNode;
  /** The hero's question and lead; each app's kind has its own by default. */
  heroWords?: HeroWords;
  /** Controlled: whether the person hid Home's hero (a synced setting). Uncontrolled (remembered in this
   *  browser) when omitted. */
  heroHidden?: boolean;
  /** Called when the person hides the hero with its close. */
  onHideHero?: () => void;
  /** A view's help article; a Help button shows in its header (and Home's hero) when there is one. */
  helpHref?: HelpHref;
  /** An item the host trashed just before landing here (the plan open in its editor): the Explorer says so, once,
   *  with an Undo that restores it and re-reads the lists. */
  trashedOnArrival?: { id: string; title: string | null } | null;
};

const FILTER_KEY = (app: App) => `liveworkspace:explorer-filter:${app}`;
const HERO_KEY = (app: App) => `liveworkspace:explorer-hero-hidden:${app}`;

/** Whether Home's hero is hidden: the host's setting, or this browser's own choice. */
function useHeroHidden(app: App, controlled?: boolean, onHide?: () => void) {
  const [own, setOwn] = useState(false);
  useEffect(() => {
    if (controlled !== undefined) return;
    try {
      setOwn(localStorage.getItem(HERO_KEY(app)) === '1');
    } catch {
      // No storage: the hero shows.
    }
  }, [app, controlled]);
  const hide = useCallback(() => {
    if (controlled === undefined) {
      setOwn(true);
      try {
        localStorage.setItem(HERO_KEY(app), '1');
      } catch {
        // A convenience only.
      }
    }
    onHide?.();
  }, [app, controlled, onHide]);
  return [controlled ?? own, hide] as const;
}

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
  header,
  heroArt,
  heroWords,
  heroHidden: controlledHeroHidden,
  onHideHero,
  helpHref,
  trashedOnArrival,
}: ExplorerProps) {
  const [filter, setFilter] = useFilter(app, controlledFilter, onFilterChange);
  const [heroHidden, hideHero] = useHeroHidden(app, controlledHeroHidden, onHideHero);
  const heroOnHome = view.kind === 'home' && !heroHidden;
  const hero = useHeroPresence(heroOnHome);
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
      openNav={openNav}
      helpHref={helpHref}
      heroWords={heroWords}
    >
      <div data-explorer="" className="flex min-w-0 flex-1 flex-col">
        {header ? (
          header({ search: heroOnHome ? null : <BarSearch toolbar={toolbar} /> })
        ) : heroOnHome ? null : (
          <div className="sticky top-0 z-30 flex h-12 shrink-0 items-center border-b border-slate-200 bg-white/85 px-4 backdrop-blur dark:border-slate-700 dark:bg-slate-900/85">
            <div className="w-full sm:mx-auto sm:max-w-md">
              <BarSearch toolbar={toolbar} />
            </div>
          </div>
        )}
        {hero.mounted ? (
          <div
            data-home-hero-fold={hero.open ? 'open' : 'closed'}
            inert={!hero.open}
            aria-hidden={!hero.open || undefined}
            className={`grid transition-[grid-template-rows,opacity] duration-long ease-out motion-reduce:transition-none ${
              hero.open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
            }`}
          >
            <div className="min-h-0 overflow-hidden">
              <HeroWithCount art={heroArt} onHide={hideHero} />
            </div>
          </div>
        ) : null}
        <main className="mx-auto flex w-full max-w-7xl flex-1 gap-8 px-4 pb-16 pt-8 sm:px-6">
          {/* No box: the tree sits on the page. Hidden on a phone, where the drawer holds it. */}
          <aside className="hidden w-64 shrink-0 self-start sm:block" aria-label="Sections">
            <div className="sticky top-20 px-1 py-1">
              <Sidebar />
            </div>
          </aside>
          {navOpen ? <SectionsDrawer onClose={() => setNavOpen(false)} /> : null}
          <section className="min-w-0 flex-1">
            <Pane view={view} onOpenNav={openNav} hero={heroOnHome} />
          </section>
        </main>
      </div>
      <ExplorerDialogs />
      {trashedOnArrival ? <ArrivalUndo trashed={trashedOnArrival} /> : null}
    </ExplorerProvider>
  );
}

/** The Trash toast for an item trashed before the page opened, with its Undo; offered once per item. */
function ArrivalUndo({ trashed }: { trashed: { id: string; title: string | null } }) {
  const { client, toast, reloadLists } = useExplorerContext();
  const offered = useRef<string | null>(null);
  useEffect(() => {
    if (offered.current === trashed.id) return;
    offered.current = trashed.id;
    const name = trashed.title || 'Untitled';
    toast.show(`Moved “${name}” to the Trash.`, {
      action: {
        label: 'Undo',
        run: () =>
          void client.restoreItem(trashed.id).then(
            () => {
              reloadLists();
              toast.show(`Restored “${name}”.`, { tone: 'success' });
            },
            () => toast.error(`Couldn’t restore “${name}”. It is in the Trash.`),
          ),
      },
    });
  }, [trashed, client, toast, reloadLists]);
  return null;
}

/** The header's field, with the host's own controls beside it. */
function BarSearch({ toolbar }: { toolbar?: ReactNode }) {
  if (!toolbar) return <SearchField />;
  return (
    <div className="flex items-center gap-2">
      <SearchField />
      {toolbar}
    </div>
  );
}

/** The hero with My Work's count: asked for only while the hero is in the page. */
function HeroWithCount({ art, onHide }: { art?: ReactNode; onHide: () => void }) {
  const { client, app, filter, epoch } = useExplorerContext();
  const items = useItemCount(client, app, filter, true, epoch);
  return <HomeHero items={items} art={art} onHide={onHide} />;
}

function Pane({
  view,
  onOpenNav,
  hero,
}: {
  view: ExplorerView;
  onOpenNav: () => void;
  hero: boolean;
}) {
  switch (view.kind) {
    case 'home':
      return <HomePane onOpenNav={onOpenNav} hero={hero} />;
    case 'inbox':
      return <InboxPane onOpenNav={onOpenNav} />;
    default:
      return <ItemsPane view={view} onOpenNav={onOpenNav} />;
  }
}

function SectionsDrawer({ onClose }: { onClose: () => void }) {
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    panel.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-40 sm:hidden">
      <div
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label="Sections"
        tabIndex={-1}
        className="absolute inset-y-0 left-0 flex w-72 max-w-[85%] animate-slide-in-left flex-col overflow-y-auto border-r border-slate-200 bg-white px-3 py-4 shadow-xl outline-none dark:border-slate-700 dark:bg-slate-800"
      >
        <div className="mb-1 flex items-center justify-between pl-1">
          <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Sections</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            <CloseIcon size={11} />
          </button>
        </div>
        <Sidebar />
      </div>
    </div>
  );
}
