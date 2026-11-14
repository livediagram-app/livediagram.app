'use client';

// <Explorer>: the One Explorer, the same in every app. The host renders it at its own /explorer, reads
// the view from its URL (viewFromLocation) and passes it in; the Explorer asks to go elsewhere through
// onNavigate and links items through itemHref, so it never touches the host's router. It shows this app's
// items or every app's (the filter), and New makes this app's kind. It draws the page as livediagram's
// Explorer does: the host's header (with the search field in its middle), Home's hero across the full width
// under it, then the sidebar and the pane.

import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { EXPLORER_MAIN } from '../ui/classes';
import { useItemCount } from '../data/useItemCount';
import { ToastProvider } from '../ui/Toasts';
import { LibraryHostProvider } from '../library/context';
import type { LibraryHostProps } from '../library/types';
import { explorerPath, type ExplorerView } from '../views';
import { appHasInbox } from '../inbox-apps';
import {
  ExplorerProvider,
  useExplorer as useExplorerContext,
  type NavigateOptions,
} from './context';
import { ExplorerDialogs } from './Dialogs';
import { useSyncPlaces } from './this-browser-space/useSyncPlaces';
import { HomeHero } from './HomeHero';
import { HomePane } from './HomePane';
import {
  GalleryView,
  InboxPane,
  InvitesPane,
  preloadExplorerPanesWhenIdle,
  ShapeLibrariesView,
} from './lazy-panes';
import { ItemsPane } from './ItemsPane';
import { SearchField } from './SearchField';
import { Sidebar } from './Sidebar';
import { SectionsBar, SectionsDrawer } from './PhoneSections';
import { useHeroPresence } from './useHeroPresence';
import { ArrivedItemContext, useArrivedItem } from './arrived-item';
import { HostExtrasProvider } from './host';
import { ThisBrowserPane, useThisBrowserItems } from './ThisBrowser';
import { SignInBanner } from './SignInBanner';
import { WelcomeProvider } from '../welcome/context';
import { WorkKinds, type TemplateHref } from '../hero/WorkKinds';
import { ExtrasProvider } from './extras';
import { TeamsProvider, useTeams } from '../teams/context';
import { DriveReconnectBanner, withDriveMarks } from '../drive/DriveMarks';
import { useDriveMarks } from '../drive/useDriveMarks';
import { quoted } from '../quoted';
import { useHeroHidden, useFilter } from './explorer-prefs';
import type { ExplorerProps } from './explorer-props';
export { type ExplorerProps } from './explorer-props';

export function Explorer({
  gallery,
  shapeLibraries,
  imports,
  itemMenu,
  history,
  teamsHost,
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
      >
        {/* The page reads the person's teams as it opens: the Invites badge and member counts. */}
        <TeamsProvider
          host={teamsHost}
          signedIn={props.signedIn ?? true}
          tokenTeams={props.teams}
          eager
        >
          <ExplorerInner {...props} />
        </TeamsProvider>
      </LibraryHostProvider>
    </ToastProvider>
  );
}

function ExplorerInner({
  app,
  client,
  view: askedView,
  onNavigate,
  itemHref,
  onCreate,
  newApps,
  renderThumbnail,
  renderItemMark: hostItemMark,
  drive,
  renderAppLogo,
  Link,
  onOpenItem,
  basePath,
  viewerId,
  shareUrl,
  share,
  inbox: inboxHost,
  filter: controlledFilter,
  onFilterChange,
  toolbar,
  header,
  templateHref,
  heroWords,
  heroHidden: controlledHeroHidden,
  onHideHero,
  helpHref,
  trashedOnArrival,
  arrivedItem,
  onHome,
  onOrganise,
  lensTemplates,
  lensModes,
  defaultFolderOptions,
  onFolderShown,
  onLensSelected,
  welcome,
  sidebarLinks,
  thisBrowser,
  allLabel,
  showAppFilter,
  arrivalNotice,
  accounts,
  signedIn,
  signInHref,
  signInBanner,
  prefetchThumbnail,
  onViewToggled,
}: Omit<ExplorerProps, keyof LibraryHostProps | 'teamsHost'>) {
  // An app with no Inbox (appHasInbox) opens Home at the Inbox's address, an old link or a bookmark.
  const view: ExplorerView =
    askedView.kind === 'inbox' && !appHasInbox(app) ? { kind: 'home' } : askedView;
  const shownTeams = useTeams().teams;
  const [filter, setFilter] = useFilter(app, controlledFilter, onFilterChange);
  const [heroHidden, hideHero] = useHeroHidden(app, controlledHeroHidden, onHideHero);
  const heroOnHome = view.kind === 'home' && !heroHidden;
  const hero = useHeroPresence(heroOnHome);
  // The phone's sidebar drawer, open for the view it was opened on: any change of view (a pick, Back, an address)
  // closes it, with no effect to run.
  const viewKey = explorerPath(view);
  const [navOpenAt, setNavOpenAt] = useState<string | null>(null);
  const navOpen = navOpenAt === viewKey;
  const drawerId = useId();
  const navigate = useCallback(
    (v: ExplorerView, href: string, options?: NavigateOptions) => {
      setNavOpenAt(null);
      if (options) onNavigate(v, href, options);
      else onNavigate(v, href);
    },
    [onNavigate],
  );
  const openNav = useCallback(() => setNavOpenAt(viewKey), [viewKey]);
  const closeNav = useCallback(() => setNavOpenAt(null), []);
  const driveMarks = useDriveMarks(drive);
  useArrivedItem(arrivedItem);
  const renderItemMark = useMemo(
    () => withDriveMarks(hostItemMark, driveMarks),
    [hostItemMark, driveMarks],
  );
  const extras = useMemo(
    () => ({
      sidebarLinks: sidebarLinks ?? [],
      allLabel: allLabel ?? 'All',
      showAppFilter: showAppFilter ?? true,
      thisBrowser: thisBrowser ?? null,
    }),
    [sidebarLinks, allLabel, showAppFilter, thisBrowser],
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
      newApps={newApps}
      onOpenItem={onOpenItem}
      Link={Link}
      basePath={basePath}
      teams={shownTeams}
      viewerId={viewerId}
      renderThumbnail={renderThumbnail}
      renderItemMark={renderItemMark}
      renderAppLogo={renderAppLogo}
      shareUrl={shareUrl}
      shareHost={share}
      inboxHost={inboxHost}
      helpHref={helpHref}
      heroWords={heroWords}
      onHome={onHome}
      onOrganise={onOrganise}
      lensTemplates={lensTemplates}
      lensModes={lensModes}
      defaultFolderOptions={defaultFolderOptions}
      onFolderShown={onFolderShown}
      onLensSelected={onLensSelected}
    >
      <ExtrasProvider
        accounts={accounts}
        signedIn={signedIn}
        signInHref={signInHref}
        prefetchThumbnail={prefetchThumbnail}
        onViewToggled={onViewToggled}
      >
        <HostExtrasProvider value={extras}>
          <WelcomeProvider welcome={welcome} active={view.kind === 'home'}>
            <div data-explorer="" className="flex min-w-0 flex-1 flex-col">
              {/* The header and, on a phone, the sections bar under it: one sticky block, so they stay at the top
                  together as the page scrolls, never overlapping, whatever the host's header measures. */}
              <div data-explorer-top="" className="sticky top-0 z-40 shrink-0">
                {header ? (
                  header({ search: heroOnHome ? null : <BarSearch toolbar={toolbar} /> })
                ) : heroOnHome ? null : (
                  <div className="flex h-12 shrink-0 items-center border-b border-slate-200 bg-white/85 px-4 backdrop-blur dark:border-slate-700 dark:bg-slate-900/85">
                    <div className="w-full sm:mx-auto sm:max-w-md">
                      <BarSearch toolbar={toolbar} />
                    </div>
                  </div>
                )}
                <SectionsBar open={navOpen} drawerId={drawerId} onOpen={openNav} />
              </div>
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
                    <HeroWithCount templateHref={templateHref} onHide={hideHero} />
                  </div>
                </div>
              ) : null}
              <main className={EXPLORER_MAIN}>
                {/* No box: the tree sits on the page. Hidden on a phone, where the drawer holds it. */}
                <aside className="hidden w-64 shrink-0 self-start sm:block" aria-label="Sections">
                  <div className="sticky top-20 px-1 py-1">
                    <Sidebar />
                  </div>
                </aside>
                {navOpen ? <SectionsDrawer id={drawerId} onClose={closeNav} /> : null}
                <section className="min-w-0 flex-1">
                  <ArrivedItemContext.Provider value={arrivedItem ?? null}>
                    <Pane view={view} hero={heroOnHome} />
                  </ArrivedItemContext.Provider>
                </section>
              </main>
              {signInBanner && signedIn === false && signInHref ? (
                <SignInBanner href={signInHref} host={signInBanner} />
              ) : null}
              {drive && driveMarks.needsReconnect ? (
                <DriveReconnectBanner workspaceOrigin={drive.workspaceOrigin} />
              ) : null}
            </div>
          </WelcomeProvider>
          {/* Inside the host's extras: This Browser's dialogs run its verbs. */}
          <ExplorerDialogs />
          <SyncPlaces />
        </HostExtrasProvider>
        {trashedOnArrival ? <ArrivalUndo trashed={trashedOnArrival} /> : null}
        {arrivalNotice ? <ArrivalNotice text={arrivalNotice} /> : null}
      </ExtrasProvider>
    </ExplorerProvider>
  );
}

/** Moves a handed-over Sync to the place it was asked for, once the index has it (useSyncPlaces). */
function SyncPlaces() {
  useSyncPlaces();
  return null;
}

/** The Trash toast for an item trashed before the page opened, with its Undo; offered once per item. */
function ArrivalUndo({ trashed }: { trashed: { id: string; title: string | null } }) {
  const { client, toast, reloadLists } = useExplorerContext();
  const offered = useRef<string | null>(null);
  useEffect(() => {
    if (offered.current === trashed.id) return;
    offered.current = trashed.id;
    const name = trashed.title || 'Untitled';
    toast.show(`Moved ${quoted(name)} to the Trash.`, {
      action: {
        label: 'Undo',
        run: () =>
          void client.restoreItem(trashed.id).then(
            () => {
              reloadLists();
              toast.show(`Restored ${quoted(name)}.`, { tone: 'success' });
            },
            () => toast.error(`Couldn’t restore ${quoted(name)}. It is in the Trash.`),
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
function HeroWithCount({
  templateHref,
  onHide,
}: {
  templateHref?: TemplateHref;
  onHide: () => void;
}) {
  const { client, app, filter, epoch } = useExplorerContext();
  const indexed = useItemCount(client, app, filter, true, epoch);
  // What this browser keeps is the person's too, and Most Used and Recent lists it: the pill counts it beside the index's.
  const { live: local } = useThisBrowserItems();
  const items = useMemo(
    () => (indexed && local.length ? { ...indexed, count: indexed.count + local.length } : indexed),
    [indexed, local.length],
  );
  // What the app makes, the same set on a first run as on any other visit.
  const kinds = useMemo(
    () => <WorkKinds app={app} all={filter === 'all'} templateHref={templateHref} />,
    [app, filter, templateHref],
  );
  return <HomeHero items={items} kinds={kinds} onHide={onHide} />;
}

function Pane({ view, hero }: { view: ExplorerView; hero: boolean }) {
  // The other sections' code, fetched once the page is idle so a move to one draws at once (lazy-panes.ts).
  useEffect(() => preloadExplorerPanesWhenIdle(), []);
  switch (view.kind) {
    case 'home':
      return <HomePane hero={hero} />;
    case 'inbox':
      return <InboxPane />;
    case 'invites':
      return <InvitesPane />;
    case 'gallery':
      return <GalleryView />;
    case 'shape-libraries':
      return <ShapeLibrariesView />;
    case 'offline':
      return <ThisBrowserPane />;
    default:
      return <ItemsPane view={view} />;
  }
}
