'use client';

// <Explorer>: the One Explorer, the same in every app. The host renders it at its own /explorer, reads
// the view from its URL (viewFromLocation) and passes it in; the Explorer asks to go elsewhere through
// onNavigate and links items through itemHref, so it never touches the host's router. It shows this app's
// items or every app's (the filter), and New makes this app's kind. It draws the page as livediagram's
// Explorer does: the host's header (with the search field in its middle), Home's hero across the full width
// under it, then the sidebar and the pane.

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { CloseIcon } from '../ui/icons';
import { useItemCount } from '../data/useItemCount';
import type { App, IndexClient, Item } from '@liveworkspace/index-client';
import { ToastProvider } from '../ui/Toasts';
import { LibraryHostProvider } from '../library/context';
import type { LibraryHostProps } from '../library/types';
import type { ExplorerView } from '../views';
import type { AppFilter, HeroWords } from '../words';
import type {
  ItemHref,
  LinkComponent,
  Placement,
  RenderAppLogo,
  RenderItemMark,
  RenderThumbnail,
  InboxHost,
  ShareHost,
  SignInBannerHost,
  ShareUrl,
  TeamRef,
  TimelineTelemetry,
  HomeTelemetry,
  OrganiseTelemetry,
} from '../types';
import type { LensOption, LensTelemetryType } from '../lens';
import type { DefaultFolderOption } from '../defaults/entries';
import {
  ExplorerProvider,
  useExplorer as useExplorerContext,
  type HelpHref,
  type FolderShown,
  type NavigateOptions,
} from './context';
import { ExplorerDialogs } from './Dialogs';
import { HomeHero } from './HomeHero';
import { HomePane } from './HomePane';
import { InboxPane } from './InboxPane';
import { InvitesPane } from './InvitesPane';
import { GalleryView, ShapeLibrariesView } from '../library/LibraryViews';
import { ItemsPane } from './ItemsPane';
import { SearchField } from './SearchField';
import { Sidebar } from './Sidebar';
import { TimelinePane } from './TimelinePane';
import { useHeroPresence } from './useHeroPresence';
import { HostExtrasProvider, type SidebarLink } from './host';
import { ThisBrowserPane, type ThisBrowserHost } from './ThisBrowser';
import { SignInBanner } from './SignInBanner';
import { WelcomeProvider, useFirstRun } from '../welcome/context';
import { WelcomeFan } from '../welcome/HomeWelcome';
import type { WelcomeOptions } from '../welcome/types';
import { ExtrasProvider, type ViewModeTelemetry } from './extras';
import type { ExplorerAccounts } from '../data/accounts';

export type ExplorerProps = {
  /** The host app: its kind is what New makes and what "this app" shows. */
  app: App;
  client: IndexClient;
  view: ExplorerView;
  /** Go to another view; `href` is its address under `basePath`. `replace`: replace the history entry rather
   *  than add one (the filter field's writes, at most every 250 ms while typing). */
  onNavigate: (view: ExplorerView, href: string, options?: NavigateOptions) => void;
  /** An item's address in its own app (another app's item opens there), optionally at a tab and element. */
  itemHref: ItemHref;
  /** New: make an item of this app's kind at this placement, then open it. */
  onCreate: (placement: Placement) => void;
  /** A preview for a row (small) or a card (large); without it rows show the kind's icon. */
  renderThumbnail?: RenderThumbnail;
  /** The host's own marks on an item, beside its name and its Updated time (RenderItemMark). */
  renderItemMark?: RenderItemMark;
  /** The filter's logos: the app's, and the platform's for All (RenderAppLogo). */
  renderAppLogo?: RenderAppLogo;
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
  /** The Share dialog's extras, per item: its tabs (a link can open one), its embed and live image, help articles and
   *  telemetry. */
  share?: ShareHost;
  /** The Inbox's extras: rows from items only this browser holds, card glyphs, a help article and telemetry. */
  inbox?: InboxHost;
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
  /** The Timeline's reports (a mode or filter changed, a page read, a card opened), for the host's telemetry. */
  onTimeline?: TimelineTelemetry;
  /** Home's What Happened reports (an entry opened, a summary dealt out, a failed read retried), for the host's
   *  telemetry. */
  onHome?: HomeTelemetry;
  /** Folders made, moved and deleted, default folders set and cleared, the Trash restored from, deleted from and
   *  emptied, and items moved into, within and out of a team (OrganiseTelemetry), for the host's telemetry. */
  onOrganise?: OrganiseTelemetry;
  /** The filter lens's Template values: the host app's template families, matched against the last word of each
   *  item's creation intent. Without them there is no Template filter. */
  lensTemplates?: readonly LensOption[];
  /** Default Folders' entries for what the host's items open in and the kinds of their first tabs (livediagram's
   *  Diagrams, Whiteboards, Sessions, Event Storming boards), between the app's own and its templates'. */
  defaultFolderOptions?: readonly DefaultFolderOption[];
  /** The folder on screen, once its list is in: its name and how many items sit directly in it (FolderShown). */
  onFolderShown?: (shown: FolderShown) => void;
  /** A facet of the filter lens gained a value (`Explorer / Selected / <Facet>`), for the host's telemetry. */
  onLensSelected?: (type: LensTelemetryType) => void;
  /** Home's first run: for a person with nothing yet, the app's starting points in place of empty lists, and the
   *  hero's welcome. Without it Home shows its empty sections. */
  welcome?: WelcomeOptions;
  /** The host's own rows in the sidebar's More group, before the Trash (This Browser, say). */
  sidebarLinks?: readonly SidebarLink[];
  /** The host app's items kept only in this browser, where the host can read them (the Explorer on the app's own
   *  address): a sidebar row with their count, `/explorer/offline`, a Trash group and Jump Back In. */
  thisBrowser?: ThisBrowserHost | null;
  /** The filter's every-app choice, "All" by default ("All apps" where the Explorer is no one app's). */
  allLabel?: string;
  /** A sentence said once on arrival, as a toast (why the person was sent here: a revoked link, say). */
  arrivalNotice?: string | null;
  /** liveworkspace accounts, for people's names (the Owner column, What Happened, the Timeline: one cache), a
   *  team's page and member count, and the invitations waiting. On liveworkspace.app: `createExplorerAccounts()`.
   *  Without it those go unsaid. */
  accounts?: ExplorerAccounts | null;
  /** Whether the person is signed in; a guest is nudged to sign in for Teams. Signed in when omitted. */
  signedIn?: boolean;
  /** Where a guest signs in (the Teams nudge, and the banner). */
  signInHref?: string;
  /** A guest's sign-in banner at the foot of the page (Sign In, the reasons, a close this browser remembers), shown
   *  while `signedIn` is false and there is a `signInHref`. Without it there is no banner. */
  signInBanner?: SignInBannerHost;
  /** Where a team is run, for its page's Manage link; `manageTeamsUrl` when omitted. */
  teamManageUrl?: (teamId: string) => string;
  /** Loads an item's preview ahead, as its Details row comes near the screen (the hover preview then paints at
   *  once). */
  prefetchThumbnail?: (item: Item) => void;
  /** The List / Card / Details toggle switched (`UI / Toggled / <type>`), for the host's telemetry. */
  onViewToggled?: (type: ViewModeTelemetry) => void;
} & LibraryHostProps;

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

export function Explorer({
  gallery,
  shapeLibraries,
  imports,
  itemMenu,
  history,
  onCreateTeam,
  ...props
}: ExplorerProps) {
  return (
    <ToastProvider>
      <LibraryHostProvider
        gallery={gallery}
        shapeLibraries={shapeLibraries}
        imports={imports}
        itemMenu={itemMenu}
        history={history}
        onCreateTeam={onCreateTeam}
      >
        <ExplorerInner {...props} />
      </LibraryHostProvider>
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
  renderItemMark,
  renderAppLogo,
  Link,
  onOpenItem,
  basePath,
  teams,
  viewerId,
  shareUrl,
  share,
  inbox: inboxHost,
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
  onTimeline,
  onHome,
  onOrganise,
  lensTemplates,
  defaultFolderOptions,
  onFolderShown,
  onLensSelected,
  welcome,
  sidebarLinks,
  thisBrowser,
  allLabel,
  arrivalNotice,
  accounts,
  signedIn,
  signInHref,
  signInBanner,
  teamManageUrl,
  prefetchThumbnail,
  onViewToggled,
}: Omit<ExplorerProps, keyof LibraryHostProps>) {
  const [filter, setFilter] = useFilter(app, controlledFilter, onFilterChange);
  const [heroHidden, hideHero] = useHeroHidden(app, controlledHeroHidden, onHideHero);
  const heroOnHome = view.kind === 'home' && !heroHidden;
  const hero = useHeroPresence(heroOnHome);
  const [navOpen, setNavOpen] = useState(false);
  const navigate = useCallback(
    (v: ExplorerView, href: string, options?: NavigateOptions) => {
      setNavOpen(false);
      if (options) onNavigate(v, href, options);
      else onNavigate(v, href);
    },
    [onNavigate],
  );
  const openNav = useCallback(() => setNavOpen(true), []);
  const extras = useMemo(
    () => ({
      sidebarLinks: sidebarLinks ?? [],
      allLabel: allLabel ?? 'All',
      thisBrowser: thisBrowser ?? null,
    }),
    [sidebarLinks, allLabel, thisBrowser],
  );
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
      renderItemMark={renderItemMark}
      renderAppLogo={renderAppLogo}
      shareUrl={shareUrl}
      shareHost={share}
      inboxHost={inboxHost}
      manageTeamsUrl={manageTeamsUrl}
      openNav={openNav}
      helpHref={helpHref}
      heroWords={heroWords}
      onTimeline={onTimeline}
      onHome={onHome}
      onOrganise={onOrganise}
      lensTemplates={lensTemplates}
      defaultFolderOptions={defaultFolderOptions}
      onFolderShown={onFolderShown}
      onLensSelected={onLensSelected}
    >
      <ExtrasProvider
        accounts={accounts}
        signedIn={signedIn}
        signInHref={signInHref}
        teamManageUrl={teamManageUrl}
        prefetchThumbnail={prefetchThumbnail}
        onViewToggled={onViewToggled}
      >
        <HostExtrasProvider value={extras}>
          <WelcomeProvider welcome={welcome} active={view.kind === 'home'}>
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
              {signInBanner && signedIn === false && signInHref ? (
                <SignInBanner href={signInHref} host={signInBanner} />
              ) : null}
            </div>
          </WelcomeProvider>
        </HostExtrasProvider>
        <ExplorerDialogs />
        {trashedOnArrival ? <ArrivalUndo trashed={trashedOnArrival} /> : null}
        {arrivalNotice ? <ArrivalNotice text={arrivalNotice} /> : null}
      </ExtrasProvider>
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

/** The host's word on arrival, said once. */
function ArrivalNotice({ text }: { text: string }) {
  const { toast } = useExplorerContext();
  const said = useRef<string | null>(null);
  useEffect(() => {
    if (said.current === text) return;
    said.current = text;
    toast.show(text);
  }, [text, toast]);
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
  // A first run fans the app's starts in the art's place.
  const { heroFirstRun, welcome } = useFirstRun();
  const shown = heroFirstRun && welcome?.manifest ? <WelcomeFan /> : art;
  return <HomeHero items={items} art={shown} onHide={onHide} />;
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
    case 'timeline':
      return <TimelinePane onOpenNav={onOpenNav} />;
    case 'invites':
      return <InvitesPane onOpenNav={onOpenNav} />;
    case 'gallery':
      return <GalleryView onOpenNav={onOpenNav} />;
    case 'shape-libraries':
      return <ShapeLibrariesView onOpenNav={onOpenNav} />;
    case 'offline':
      return <ThisBrowserPane onOpenNav={onOpenNav} />;
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
