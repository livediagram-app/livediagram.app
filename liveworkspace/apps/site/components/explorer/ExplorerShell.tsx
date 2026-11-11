'use client';

// The Explorer on liveworkspace.app (liveworkspace/docs/specs/010-site/site.md "The Explorer"): the shared Explorer
// (@liveworkspace/explorer) once, for every app, instead of at each app's /explorer. Mounted by app/explorer's
// layout, so a list already loaded stays loaded from view to view.
//
// It asks the index as the person: the signed-in account, or this browser's guest (lib/explorer/token.ts). It wears
// the colours and logo of the app the person came from (`?from=` or the referrer), opens filtered to that app's items
// with All Apps one click away (from no app, on All Apps), and sends every item, New and template back to its own
// app (lib/explorer/host.ts). The Settings panel opens over it in place (`?settings=`, the bar, the account menu).
//
// The same page is also served under each app's own address (`liveplanner.app/explorer/…`, through the app's router;
// lib/explorer/page-app.ts). There it is that app's Explorer: it asks as the app's session, shows the app's items kept
// only in this browser (This Browser) and keeps its links on the app's address: every setting, the profile and API
// tokens too, is edited in its Settings panel in place. Where the app supplies them (the sites registry), it also offers the
// app's Take Offline, Sync and Delete (lib/explorer/offline-moves.tsx). Teams are made and run in place, here and
// there alike, over liveworkspace's account API (createTeamsHost with accountFetch).
//
// Under it all, the bottom bar the apps' Explorers had (ExplorerBottomBar.tsx): Search, which opens the Search panel
// (loaded only when first wanted), Settings and Appearance.

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type ReactNode,
} from 'react';
import {
  createExplorerAccounts,
  createTeamsHost,
  Explorer,
  ExplorerSkeleton,
  viewFromLocation,
  type AppFilter,
  type ExplorerView,
  type LinkComponent,
  type NavigateOptions,
  type Placement,
  type RenderAppLogo,
  type WelcomeManifest,
  type WelcomeOptions,
} from '@liveworkspace/explorer';
import { createIndexClient } from '@liveworkspace/index-client';
import { useSearchShortcut } from '@liveworkspace/explorer/search-shortcut';
import { BrandMark } from '@livediagram/ui';
import { APP_NAMES, PLATFORM_SITE, siteOfApp, type AppName } from '@liveworkspace/sites';
import { signInHref } from '@/lib/accounts';
import { useSession } from '@/lib/session';
import { pageApp } from '@/lib/explorer/page-app';
import { explorerDrive } from '@/lib/drive/client';
import { appSignInHref } from '@/lib/explorer/app-session';
import {
  ENDED_PARAM,
  helpHrefFor,
  itemHref,
  defaultFolderOptionsFor,
  lensModesFor,
  lensTemplatesFor,
  newItemHref,
  templateHref,
  rememberApp,
  shareUrl,
  type Arrival,
} from '@/lib/explorer/host';
import {
  accountFetch,
  resetWorkspaceIdentity,
  teamsOfToken,
  workspaceIdentity,
  workspaceToken,
  type WorkspaceIdentity,
} from '@/lib/explorer/token';
import { inboxActionsFor, inboxHost, localInboxHost } from '@/lib/explorer/inbox';
import { libraryHosts } from '@/lib/explorer/library';
import { importsHost } from '@/lib/explorer/imports';
import { trackExplorerDailyReturn } from '@/lib/explorer/daily-return';
import { renewIdentity } from '@/lib/explorer/new-team';
import { useExplorerSettings } from '@/lib/explorer/settings';
import { communityShareAppsHere, shareHostFor } from '@/lib/explorer/share';
import { useCommunityAppsOn } from '@/lib/explorer/community-apps';
import {
  setExplorerSender,
  trackHome,
  trackInbox,
  trackLens,
  trackOrganise,
  trackSignInBanner,
  trackViewToggled,
  trackWelcome,
  trackWelcomeOpened,
} from '@/lib/explorer/telemetry';
import { prefetchPreview, renderPreview } from '@/lib/explorer/previews';
import { loadPlatformWelcome, loadWelcome } from '@/lib/explorer/welcome';
import { ExplorerBottomBar, EXPLORER_FLOOR } from './ExplorerBottomBar';
import { ExplorerHeader } from './ExplorerHeader';
import {
  FALLBACK_APP,
  forgetLanding,
  landingNow,
  noSubscribe,
  TITLE_PARAM,
  TRASHED_PARAM,
} from './explorer-landing';
import { loadSettings, useExplorerSettingsPanel } from './useExplorerSettingsPanel';
import { useExplorerThisBrowser } from './useExplorerThisBrowser';

// The Search panel and its entries: fetched when Search is pointed at or pressed, never with the page.
const loadSearch = () => import('./ExplorerSearch');
const ExplorerSearch = lazy(loadSearch);
// The Settings panel: fetched when Settings is pointed at or pressed (or `?settings=` opens it).
const SiteSettingsDialog = lazy(loadSettings);
// The toasts and a guest's sign-in banner stand on the bottom bar.
const FLOOR = { '--explorer-floor': EXPLORER_FLOOR } as CSSProperties;

// The filter's logos: the app's prism in its accent, and liveworkspace's own (the Wordmark's) for All Apps.
const renderAppLogo: RenderAppLogo = (app) => (
  <BrandMark accentColor={app === 'all' ? PLATFORM_SITE.accent : siteOfApp(app).accent} />
);

const client = createIndexClient({ getToken: workspaceToken });
// The person's own accounts routes on this origin: people's names (owners, who did what, one cache; a guest's too),
// and, signed in, a team's members and count and the invitations waiting. On an app's address, through its router
// with the page's token (accountFetch).
const accounts = createExplorerAccounts({ fetch: accountFetch });
// The person's teams, made and run in place: the account API on this origin, or through the app's router with the
// page's token on an app's address (accountFetch). The list is read once as the page opens; a team's members only
// when its view opens.
const identityRenewed = new Set<(identity: WorkspaceIdentity) => void>();
const teamsHost = createTeamsHost({
  fetch: accountFetch,
  // A team made, joined, renamed, left or deleted: the token is read again, so it names the teams as they now are.
  onTeamsChanged: async () => {
    const identity = await renewIdentity();
    if (identity) for (const set of identityRenewed) set(identity);
  },
});

const NO_ARRIVAL: Arrival = { app: null, via: null };

// The Explorer's own addresses move inside the page; anything else (an item in its app, which on an app's address is
// this same origin) is a full page load, never this site's client router, which has no such page.
const isExplorerHref = (href: string) => {
  const path = href.startsWith('/') ? href : href.replace(/^https?:\/\/[^/]+/, '');
  return (
    (href.startsWith('/') || href.startsWith(window.location.origin)) &&
    /^\/explorer(?:[/?#]|$)/.test(path)
  );
};
const ExplorerLink: LinkComponent = (props) => {
  return isExplorerHref(props.href) ? <Link {...props} /> : <a {...props} />;
};

export function ExplorerShell() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const session = useSession();
  // The app whose address this is, or null on liveworkspace.app (and while prerendered).
  const host = useSyncExternalStore(noSubscribe, pageApp, () => null);

  // Decided once per visit: later moves inside the Explorer carry no `?from=`. Null while prerendered.
  const landed = useSyncExternalStore(noSubscribe, landingNow, () => null);
  const stay = landed && landed.leave === null ? landed : null;
  const ready = stay !== null;
  const arrived = stay?.arrived ?? NO_ARRIVAL;
  const notice = stay?.notice ?? null;
  const trashed = stay?.trashed ?? null;
  const [identity, setIdentity] = useState<WorkspaceIdentity | null>(null);
  const [failed, setFailed] = useState(false);

  // Arrival's effects: going on elsewhere, remembering the app, and dropping what the address handed over.
  useEffect(() => {
    if (!landed) return;
    if (landed.leave !== null) {
      window.location.replace(landed.leave);
      return;
    }
    if (landed.arrived.app) rememberApp(landed.arrived.app);
    // Taken once: a reload doesn't say it again.
    if (landed.strip) {
      const url = new URL(window.location.href);
      for (const key of [ENDED_PARAM, TRASHED_PARAM, TITLE_PARAM]) url.searchParams.delete(key);
      window.history.replaceState(null, '', url);
    }
  }, [landed]);
  useEffect(() => forgetLanding, []);

  // The person: asked once, before the Explorer asks the index anything, and again after signing out here.
  const lastSession = useRef(session.state);
  useEffect(() => {
    if (!ready) return;
    const signedOut = lastSession.current === 'in' && session.state === 'out';
    lastSession.current = session.state;
    if (identity && !signedOut) return;
    if (signedOut) resetWorkspaceIdentity();
    let live = true;
    void workspaceIdentity().then((found) => {
      if (!live) return;
      if (found) setIdentity(found);
      else setFailed(true);
    });
    return () => {
      live = false;
    };
  }, [ready, session.state, identity]);

  // In no app (liveworkspace.app reached from no app), every app's work shows; New makes the last app's kind.
  const app: AppName = arrived.app ?? stay?.lastApp ?? FALLBACK_APP;
  const [filter, setFilter] = useState<AppFilter | null>(null);
  const shownFilter: AppFilter = filter ?? (arrived.app ? 'app' : 'all');
  // Every event counts for the app the page shows, or liveworkspace.app for All Apps. Set as the page renders, so
  // the Explorer's first reports (its effects run before this component's) already count for the right one.
  setExplorerSender(app, shownFilter);
  // Home's banner (synced for an account) and whether events may be sent.
  const settings = useExplorerSettings(app, identity?.kind ?? null);
  // On an app's own address, the app's returning visitor once the person is known, as its editor counts it (once a
  // day at most, whichever page opens first).
  const identityKind = identity?.kind ?? null;
  useEffect(() => {
    if (identityKind) trackExplorerDailyReturn(identityKind === 'account');
  }, [identityKind]);

  const view: ExplorerView = useMemo(
    () => viewFromLocation(pathname, searchParams.toString()),
    [pathname, searchParams],
  );
  const onNavigate = useCallback(
    (_view: ExplorerView, href: string, options?: NavigateOptions) => {
      if (options?.replace) router.replace(href, { scroll: false });
      else router.push(href);
    },
    [router],
  );
  // New makes the chosen app's kind, where the page offers every app's (newApps), else this app's.
  const onCreate = useCallback(
    (placement: Placement, chosen?: AppName) =>
      window.location.assign(newItemHref(chosen ?? app, placement)),
    [app],
  );
  const teams = useMemo(() => teamsOfToken(identity?.token ?? null), [identity]);
  const helpHref = useMemo(() => helpHrefFor(app), [app]);
  // The app's Image Gallery and Shape Libraries, where it keeps them (stable per app).
  const library = libraryHosts(app);
  // Its "Import from" sources, each opening the app's /import page (stable per app).
  const imports = importsHost(app);

  // In no app (liveworkspace.app reached from no app) the page is liveworkspace's own: its first run greets to
  // liveworkspace and offers every app's starts (one-explorer.md).
  const inNoApp = !arrived.app;
  // Home's first run: the app's starts, loaded only once Home finds nothing.
  const [loaded, setLoaded] = useState<{ app: AppName; manifest: WelcomeManifest } | null>(null);
  const onFirstRun = useCallback(() => {
    void (inNoApp ? loadPlatformWelcome(app) : loadWelcome(app)).then(
      (manifest) => manifest && setLoaded({ app, manifest }),
    );
  }, [app, inNoApp]);
  const signedIn = identity?.kind === 'account';
  // Google Drive's marks and reconnect banner, for an account (a guest has no Drive to sync with).
  const drive = useMemo(() => (signedIn ? explorerDrive() : null), [signedIn]);
  // Signing in comes back here: through the app's own sign-in on its address.
  const explorerSignInHref = host
    ? appSignInHref(pathname || '/explorer')
    : signInHref(pathname || '/explorer');
  // After a change to the person's teams the renewed token lists them as they now are.
  useEffect(() => {
    identityRenewed.add(setIdentity);
    return () => {
      identityRenewed.delete(setIdentity);
    };
  }, []);
  const welcome: WelcomeOptions = useMemo(
    () => ({
      manifest: loaded?.app === app ? loaded.manifest : null,
      onFirstRun,
      signedIn,
      signInHref: explorerSignInHref,
      onSelected: trackWelcome,
      onOpened: trackWelcomeOpened,
    }),
    [loaded, app, onFirstRun, signedIn, explorerSignInHref],
  );
  // The Community tab, for the apps with one that this page can offer it for (APP_ITEMS[app].share.communityPath),
  // for an account and for a guest (who sees Sign In to Share). Each app is asked whether its Community is on the
  // first time one of its items is shared.
  const communityApps = useMemo(() => communityShareAppsHere(host), [host]);
  const communityOn = useCommunityAppsOn(communityApps, !!identity);
  const accountName = session.state === 'in' ? session.name : null;
  const share = useMemo(
    () =>
      shareHostFor(
        app,
        identity ? { id: identity.sub, name: accountName, guest: !signedIn } : null,
        communityOn,
        explorerSignInHref,
      ),
    [app, signedIn, identity, accountName, communityOn, explorerSignInHref],
  );
  // On the app's address, its This Browser rows too, for the person reading (lib/explorer/inbox.tsx).
  const viewerId = identity?.sub ?? null;
  const inbox = useMemo(
    () =>
      localInboxHost(
        { ...inboxHost, onTelemetry: trackInbox, actions: inboxActionsFor(host) },
        host,
        viewerId,
      ),
    [host, viewerId],
  );
  const signInBanner = useMemo(
    () => ({
      helpHref: `${siteOfApp(app).url}/help/getting-started/guest-vs-account/`,
      onTelemetry: trackSignInBanner,
    }),
    [app],
  );

  // This Browser: the app's own list on its address, else a link to the app's offline view (useExplorerThisBrowser).
  const { thisBrowser, itemMenu, sidebarLinks } = useExplorerThisBrowser(host, app, signedIn);

  // The Search panel: the bottom bar's Search, or Cmd/Ctrl+K or Cmd/Ctrl+. (not while typing or in a dialog).
  const [searchOpen, setSearchOpen] = useState(false);
  const closeSearch = useCallback(() => setSearchOpen(false), []);
  const openSearch = useCallback(() => setSearchOpen(true), []);
  const prepareSearch = useCallback(() => void loadSearch(), []);
  useSearchShortcut(openSearch);
  // A result: the Explorer's own addresses move inside the page, anything else (an item, a settings page) loads.
  const openResult = useCallback(
    (href: string) => {
      if (isExplorerHref(href)) router.push(href.replace(/^https?:\/\/[^/]+/, ''));
      else window.location.assign(href);
    },
    [router],
  );

  // The Settings panel in place over the Explorer, and `?settings=` opening it (useExplorerSettingsPanel).
  const {
    settingsAt,
    settingsSection,
    guestSettingsApp,
    hasSettings,
    openSettings,
    prepareSettings,
    settingsControl,
    shownSettings,
    closeSettings,
  } = useExplorerSettingsPanel({ arrived, host, identity, signedIn, ready, searchParams, router });
  const header = useCallback(
    ({ search }: { search: ReactNode }) => (
      <ExplorerHeader app={arrived.app} search={search} settings={settingsControl} />
    ),
    [arrived.app, settingsControl],
  );

  // Dialogs and menus render into <body>, outside the page's wrapper: they wear the app's colours from there too.
  useEffect(() => {
    if (!arrived.app) return;
    document.body.dataset.explorerApp = arrived.app;
    return () => {
      delete document.body.dataset.explorerApp;
    };
  }, [arrived.app]);

  if (!ready) return null;
  return (
    <div
      data-explorer-app={arrived.app ?? undefined}
      className="flex min-h-dvh flex-col bg-slate-50 dark:bg-slate-950"
      style={FLOOR}
    >
      {identity ? (
        <Explorer
          key={identity.sub}
          app={app}
          client={client}
          view={view}
          onNavigate={onNavigate}
          itemHref={itemHref}
          onCreate={onCreate}
          {...(host ? {} : { newApps: APP_NAMES })}
          renderThumbnail={renderPreview}
          drive={drive}
          prefetchThumbnail={prefetchPreview}
          Link={ExplorerLink}
          teams={teams}
          viewerId={identity.sub}
          shareUrl={shareUrl}
          share={share}
          teamsHost={teamsHost}
          filter={shownFilter}
          onFilterChange={setFilter}
          header={header}
          helpHref={helpHref}
          trashedOnArrival={trashed}
          welcome={welcome}
          templateHref={templateHref}
          sidebarLinks={sidebarLinks}
          thisBrowser={thisBrowser}
          allLabel="All Apps"
          // In no app there is no app to narrow to: every app's work, and no switch naming one.
          showAppFilter={arrived.app !== null}
          renderAppLogo={renderAppLogo}
          // A guest is named people too: accounts answers this browser's guest for names alone.
          accounts={accounts}
          signedIn={signedIn}
          signInHref={explorerSignInHref}
          signInBanner={signInBanner}
          arrivalNotice={notice}
          inbox={inbox}
          gallery={library.gallery}
          shapeLibraries={library.shapeLibraries}
          imports={imports}
          itemMenu={itemMenu}
          heroHidden={settings.heroHidden}
          onHideHero={settings.onHideHero}
          onHome={trackHome}
          onOrganise={trackOrganise}
          lensTemplates={lensTemplatesFor(app)}
          lensModes={lensModesFor(app)}
          defaultFolderOptions={defaultFolderOptionsFor(app)}
          onLensSelected={trackLens}
          onViewToggled={trackViewToggled}
        />
      ) : (
        <>
          <ExplorerHeader app={arrived.app} search={null} settings={settingsControl} />
          {/* Until the person is known (seconds on a slow session), the Explorer's own shape rather than a blank page. */}
          {failed ? (
            <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-16 sm:px-6">
              <p className="text-center text-sm text-slate-600 dark:text-slate-400">
                The Explorer couldn’t reach your account just now. Reload the page to try again.
              </p>
            </main>
          ) : (
            <ExplorerSkeleton />
          )}
        </>
      )}
      <ExplorerBottomBar
        appName={arrived.app ? siteOfApp(arrived.app).name : null}
        onOpenSearch={openSearch}
        onPrepareSearch={prepareSearch}
        settingsHref={null}
        onOpenSettings={hasSettings ? openSettings : undefined}
        onPrepareSettings={hasSettings ? prepareSettings : undefined}
        settingsKept={signedIn ? 'account' : 'browser'}
      />
      {shownSettings && signedIn ? (
        <Suspense fallback={null}>
          <SiteSettingsDialog
            key={`${shownSettings.app}:${shownSettings.scope}:${shownSettings.categoryId}`}
            app={shownSettings.app}
            initialScope={shownSettings.scope}
            initialCategoryId={shownSettings.categoryId}
            initialSectionId={settingsAt ? null : settingsSection}
            onClose={closeSettings}
          />
        </Suspense>
      ) : shownSettings && guestSettingsApp && identity ? (
        <Suspense fallback={null}>
          <SiteSettingsDialog
            app={guestSettingsApp}
            guest={{ ownerId: identity.sub, signInHref: explorerSignInHref }}
            onClose={closeSettings}
          />
        </Suspense>
      ) : null}
      {searchOpen ? (
        <Suspense fallback={null}>
          <ExplorerSearch
            client={client}
            app={shownFilter === 'app' ? app : null}
            itemHref={itemHref}
            teams={teams}
            renderAppLogo={renderAppLogo}
            helpApp={app}
            signedIn={signedIn}
            onOpen={openResult}
            onClose={closeSearch}
          />
        </Suspense>
      ) : null}
    </div>
  );
}
