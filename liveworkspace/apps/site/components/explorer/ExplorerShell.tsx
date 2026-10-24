'use client';

// The Explorer on liveworkspace.app (liveworkspace/docs/site.md "The Explorer"): the shared Explorer
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
// only in this browser (This Browser), keeps its links on the app's address and sends only what needs
// liveworkspace.app's session (the profile, API tokens) there. Where the app supplies them (the sites registry), it also offers the
// app's Take Offline and Sync (lib/explorer/offline-moves.tsx). Teams are made and run in place, here and there alike,
// over liveworkspace's account API (createTeamsHost with accountFetch).
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
  HeroArt,
  viewFromLocation,
  type AppFilter,
  type ExplorerView,
  type HeroArtManifest,
  type LinkComponent,
  type NavigateOptions,
  type Placement,
  type RenderAppLogo,
  type SidebarLink,
  type ThisBrowserHost,
  type ThisBrowserItem,
  type WelcomeManifest,
  type WelcomeOptions,
} from '@liveworkspace/explorer';
import { createIndexClient } from '@liveworkspace/index-client';
import {
  readThisBrowser,
  subscribeThisBrowser,
  thisBrowserKey,
} from '@liveworkspace/explorer/this-browser';
import { BrandMark } from '@livediagram/ui';
import { APP_ITEMS, PLATFORM_SITE, siteOfApp, type AppName } from '@liveworkspace/sites';
import { signInHref } from '@/lib/accounts';
import { useSession } from '@/lib/session';
import { pageApp, workspaceHref } from '@/lib/explorer/page-app';
import { appSignInHref } from '@/lib/explorer/app-session';
import {
  arrival,
  arrivalNotice,
  ENDED_PARAM,
  helpHrefFor,
  itemHref,
  defaultFolderOptionsFor,
  lensTemplatesFor,
  newItemHref,
  offlineHref,
  readLastApp,
  rememberApp,
  RETIRED_TARGETS,
  retiredTarget,
  SETTINGS_PARAM,
  settingsOpening,
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
import { inboxHost } from '@/lib/explorer/inbox';
import { libraryHosts } from '@/lib/explorer/library';
import { importsHost } from '@/lib/explorer/imports';
import { renewIdentity } from '@/lib/explorer/new-team';
import { offlineItemMenu, offlineSyncHref } from '@/lib/explorer/offline-moves';
import { useExplorerSettings } from '@/lib/explorer/settings';
import { shareHostFor } from '@/lib/explorer/share';
import {
  setExplorerSender,
  trackHome,
  trackInbox,
  trackLens,
  trackOrganise,
  trackSignInBanner,
  trackTimeline,
  trackViewToggled,
  trackWelcome,
  trackWelcomeOpened,
} from '@/lib/explorer/telemetry';
import { prefetchPreview, renderPreview } from '@/lib/explorer/previews';
import { heroHasRoom, loadHeroArt } from '@/lib/explorer/hero';
import { loadWelcome } from '@/lib/explorer/welcome';
import { ExplorerBottomBar, EXPLORER_FLOOR } from './ExplorerBottomBar';
import { loadCatalogue, type AppId } from '@/lib/app-settings';
import { preloadSettingsPanel } from '@liveworkspace/settings-ui';
import { ExplorerHeader } from './ExplorerHeader';

// The Search panel and its entries: fetched when Search is pointed at or pressed, never with the page.
const loadSearch = () => import('./ExplorerSearch');
const ExplorerSearch = lazy(loadSearch);
// The Settings panel: fetched when Settings is pointed at or pressed (or `?settings=` opens it).
const loadSettings = () => import('@/components/settings/SiteSettingsDialog');
const SiteSettingsDialog = lazy(loadSettings);
// The toasts and a guest's sign-in banner stand on the bottom bar.
const FLOOR = { '--explorer-floor': EXPLORER_FLOOR } as CSSProperties;

// The kind New makes, and "this app", for a person who came from no app and has used none here: the first app on the
// index.
const FALLBACK_APP: AppName = 'liveplanner';
// The filter's logos: the app's prism in its accent, and liveworkspace's own (the Wordmark's) for All Apps.
const renderAppLogo: RenderAppLogo = (app) => (
  <BrandMark accentColor={app === 'all' ? PLATFORM_SITE.accent : siteOfApp(app).accent} />
);
// The handoffs an address may carry, taken once and then dropped from it.
const TRASHED_PARAM = 'trashed';
const TITLE_PARAM = 'title';

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

// Where the Settings panel opens: the app it is for (by its site id), the side of the switch, and the category.
type PanelOpening = { app: AppId | null; scope: 'app' | 'all' | null; categoryId: string | null };
const appIdOf = (app: AppName) => siteOfApp(app).id as AppId;
// The API tokens, a category of the Settings panel (the timeline's token cards lead there). The tokens are
// liveworkspace.app's session's, so from an app's address they are the panel there.
const TOKENS_SETTINGS = `/explorer?${SETTINGS_PARAM}=tokens`;

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

/** The retired view an address names (`/explorer/profile`, …), if any. */
function retiredView(pathname: string): keyof typeof RETIRED_TARGETS | 'offline' | null {
  const section = pathname.replace(/\/+$/, '').split('/')[2] ?? '';
  if (section === 'offline') return 'offline';
  return section in RETIRED_TARGETS ? (section as keyof typeof RETIRED_TARGETS) : null;
}

type Trashed = { id: string; title: string | null };

/** What the address says on arrival: somewhere else to go, or where the person came from and what it hands over. */
type Landing =
  | { leave: string }
  | {
      leave: null;
      arrived: Arrival;
      // The last app this browser came from: what New makes in no app (it never filters the lists).
      lastApp: AppName | null;
      notice: string | null;
      trashed: Trashed | null;
      strip: boolean;
    };

// A successor on liveworkspace.app, in full from an app's address; the Explorer's own stay where they are.
const onWorkspace = (target: string) =>
  target.startsWith('/explorer') ? target : workspaceHref(target);

function readLanding(): Landing {
  const search = window.location.search;
  // On an app's address the page is that app's, whatever the address says.
  const host = pageApp();
  const found: Arrival = host ? { app: host, via: 'host' } : arrival(search, document.referrer);
  const lastApp = readLastApp();
  // A retired address gives way to its successor. This Browser is a view of its own on the app's address.
  const retired = retiredView(window.location.pathname);
  if (retired === 'offline' && !host)
    return { leave: offlineHref(found.app ?? lastApp ?? FALLBACK_APP) ?? '/explorer' };
  if (retired && retired !== 'offline')
    return { leave: onWorkspace(retiredTarget(retired, search)) };
  const params = new URLSearchParams(search);
  // `?settings=teams`: teams are run in the Explorer, the Invites beside them. Every other `?settings=` opens the
  // Settings panel in place, once the page knows who is here (below).
  if (settingsOpening(params.get(SETTINGS_PARAM), found.app) === 'teams')
    return { leave: '/explorer/invites' };
  const trashedId = params.get(TRASHED_PARAM);
  return {
    leave: null,
    arrived: found,
    lastApp,
    notice: arrivalNotice(search, found.app),
    trashed: trashedId ? { id: trashedId, title: params.get(TITLE_PARAM) } : null,
    strip: params.has(ENDED_PARAM) || trashedId !== null,
  };
}

// Read once per visit (a stable snapshot), and forgotten when the Explorer unmounts, so a later visit reads afresh.
let landing: Landing | null = null;
const landingNow = () => (landing ??= readLanding());
const noSubscribe = () => () => {};

// This Browser's list as the app last wrote it, read again only when it changes (one stable array per change).
const NO_LOCAL: readonly ThisBrowserItem[] = [];
let localRead: { raw: string | null; items: readonly ThisBrowserItem[] } | null = null;
function localItems(app: AppName): readonly ThisBrowserItem[] {
  let raw: string | null;
  try {
    raw = localStorage.getItem(thisBrowserKey(app));
  } catch {
    return NO_LOCAL;
  }
  if (localRead?.raw !== raw) localRead = { raw, items: raw ? readThisBrowser(app) : NO_LOCAL };
  return localRead.items;
}

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
      window.history.replaceState(window.history.state, '', url);
    }
  }, [landed]);
  useEffect(
    () => () => {
      landing = null;
    },
    [],
  );

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
  const onCreate = useCallback(
    (placement: Placement) => window.location.assign(newItemHref(app, placement)),
    [app],
  );
  const teams = useMemo(() => teamsOfToken(identity?.token ?? null), [identity]);
  const helpHref = useMemo(() => helpHrefFor(app), [app]);
  // The app's Image Gallery and Shape Libraries, where it keeps them (stable per app).
  const library = libraryHosts(app);
  // Its "Import from" sources, each opening the app's /import page (stable per app).
  const imports = importsHost(app);

  // Home's first run: the app's starts, loaded only once Home finds nothing.
  const [loaded, setLoaded] = useState<{ app: AppName; manifest: WelcomeManifest } | null>(null);
  const onFirstRun = useCallback(() => {
    void loadWelcome(app).then((manifest) => manifest && setLoaded({ app, manifest }));
  }, [app]);
  const signedIn = identity?.kind === 'account';
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
  // Home's hero art: the app's pictures, loaded once Home shows its hero with room for them.
  const [art, setArt] = useState<{ app: AppName; art: HeroArtManifest } | null>(null);
  const wantsArt = view.kind === 'home' && !settings.heroHidden;
  useEffect(() => {
    if (!wantsArt || !heroHasRoom()) return;
    let live = true;
    void loadHeroArt(app).then((loadedArt) => live && loadedArt && setArt({ app, art: loadedArt }));
    return () => {
      live = false;
    };
  }, [app, wantsArt]);
  const heroArt = useMemo(
    () => (art?.app === app ? <HeroArt art={art.art} /> : undefined),
    [art, app],
  );
  const share = useMemo(() => shareHostFor(app), [app]);
  const inbox = useMemo(() => ({ ...inboxHost, onTelemetry: trackInbox }), []);
  const signInBanner = useMemo(
    () => ({
      helpHref: `${siteOfApp(app).url}/help/getting-started/guest-vs-account/`,
      onTelemetry: trackSignInBanner,
    }),
    [app],
  );

  // This Browser on the app's own address: the app's list, read here and heard as it changes.
  const subscribeLocal = useCallback(
    (onChange: () => void) => (host ? subscribeThisBrowser(host, onChange) : () => {}),
    [host],
  );
  const local = useSyncExternalStore(
    subscribeLocal,
    () => (host ? localItems(host) : NO_LOCAL),
    () => NO_LOCAL,
  );
  const syncHref = useMemo(() => offlineSyncHref(host, signedIn), [host, signedIn]);
  const thisBrowser: ThisBrowserHost | null = useMemo(
    () =>
      host
        ? {
            items: local as ThisBrowserItem[],
            itemHref: (item) => `${APP_ITEMS[host].itemPath}${encodeURIComponent(item.id)}`,
            helpHref: '/help/privacy-and-security/offline-mode/',
            ...(syncHref ? { syncHref } : {}),
          }
        : null,
    [host, local, syncHref],
  );
  // Take Offline on the app's own items, handed to the app's This Browser page.
  const itemMenu = useMemo(() => offlineItemMenu(host), [host]);

  // This Browser on liveworkspace.app, which can't read it: a link to the app's own offline view.
  const sidebarLinks: SidebarLink[] = useMemo(() => {
    if (host) return [];
    const href = offlineHref(app);
    return href
      ? [
          {
            id: 'this-browser',
            label: 'This Browser',
            href,
            description: `${APP_ITEMS[app].nouns} kept only in this browser, in ${APP_ITEMS[app].site.replace(/\.app$/, '')}`,
            icon: 'browser',
          },
        ]
      : [];
  }, [app, host]);

  // The Search panel: the bottom bar's Search, or Cmd/Ctrl+K.
  const [searchOpen, setSearchOpen] = useState(false);
  const closeSearch = useCallback(() => setSearchOpen(false), []);
  const openSearch = useCallback(() => setSearchOpen(true), []);
  const prepareSearch = useCallback(() => void loadSearch(), []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.altKey || e.key.toLowerCase() !== 'k') return;
      e.preventDefault();
      setSearchOpen(true);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  // A result: the Explorer's own addresses move inside the page, anything else (an item, a settings page) loads.
  const openResult = useCallback(
    (href: string) => {
      if (isExplorerHref(href)) router.push(href.replace(/^https?:\/\/[^/]+/, ''));
      else window.location.assign(href);
    },
    [router],
  );

  // The account's settings, for a person signed in: the Settings panel in place over the Explorer (the bottom bar, the
  // account menu, `?settings=`), opened for the app the person came from (its settings, All one click away), or on
  // All from no app. Never a page of its own, and never another address.
  const [settingsAt, setSettingsAt] = useState<PanelOpening | null>(null);
  const settingsApp: AppId | null = arrived.app ? appIdOf(arrived.app) : null;
  // A guest's settings, on an app's address only: the app's, as its editor keeps them in this browser (this origin's
  // storage). liveworkspace.app can't read them, and keeps no device settings of its own beyond Appearance, which is
  // on the bar already, so a guest there gets no Settings.
  const guestSettingsApp: AppId | null = host && identity?.kind === 'guest' ? appIdOf(host) : null;
  const hasSettings = signedIn || guestSettingsApp !== null;
  const openSettings = useCallback(
    () => setSettingsAt({ app: settingsApp, scope: null, categoryId: null }),
    [settingsApp],
  );
  const prepareSettings = useCallback(() => {
    void loadSettings();
    preloadSettingsPanel();
    if (settingsApp) void loadCatalogue(settingsApp);
  }, [settingsApp]);
  const settingsControl = useMemo(
    () => (hasSettings ? { onOpen: openSettings, onPrepare: prepareSettings } : null),
    [hasSettings, openSettings, prepareSettings],
  );
  const header = useCallback(
    ({ search }: { search: ReactNode }) => (
      <ExplorerHeader app={arrived.app} search={search} settings={settingsControl} />
    ),
    [arrived.app, settingsControl],
  );

  // `?settings=<section>` (an email's link, the old /account/settings, a Search result, an editor's account menu): the
  // panel opens in place on that section once the page knows who is here, on arrival or on a move inside the
  // Explorer, and the address drops it as the panel closes. An Account section needs an account: a guest signs in and
  // comes back to the same address; on an app's address a guest's app side is the guest's own panel.
  const settingsParam = searchParams.get(SETTINGS_PARAM);
  const asked = useMemo(
    () => (ready && identity ? settingsOpening(settingsParam, arrived.app) : null),
    [ready, identity, settingsParam, arrived.app],
  );
  // What the address opens for whoever is here: null where they would have to sign in first.
  const askedFor = useMemo<PanelOpening | null>(() => {
    if (asked === null || asked === 'teams' || !identity) return null;
    if (identity.kind === 'account')
      return {
        app: asked.app ? appIdOf(asked.app) : null,
        scope: asked.scope,
        categoryId: asked.categoryId,
      };
    return host && asked.scope === 'app'
      ? { app: appIdOf(host), scope: 'app', categoryId: null }
      : null;
  }, [asked, identity, host]);
  useEffect(() => {
    if (asked === 'teams') router.replace('/explorer/invites');
    else if (asked && !askedFor) {
      const here = window.location.pathname + window.location.search;
      window.location.assign(host ? appSignInHref(here) : signInHref(here));
    }
  }, [asked, askedFor, host, router]);
  const shownSettings = settingsAt ?? askedFor;
  const closeSettings = useCallback(() => {
    setSettingsAt(null);
    const url = new URL(window.location.href);
    if (!url.searchParams.has(SETTINGS_PARAM)) return;
    url.searchParams.delete(SETTINGS_PARAM);
    window.history.replaceState(window.history.state, '', url);
  }, []);

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
          renderThumbnail={renderPreview}
          prefetchThumbnail={prefetchPreview}
          Link={ExplorerLink}
          teams={teams}
          viewerId={identity.sub}
          shareUrl={shareUrl}
          share={share}
          teamsHost={teamsHost}
          tokensUrl={host ? workspaceHref(TOKENS_SETTINGS) : TOKENS_SETTINGS}
          filter={shownFilter}
          onFilterChange={setFilter}
          header={header}
          helpHref={helpHref}
          trashedOnArrival={trashed}
          welcome={welcome}
          heroArt={heroArt}
          sidebarLinks={sidebarLinks}
          thisBrowser={thisBrowser}
          allLabel="All Apps"
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
          onTimeline={trackTimeline}
          onHome={trackHome}
          onOrganise={trackOrganise}
          lensTemplates={lensTemplatesFor(app)}
          defaultFolderOptions={defaultFolderOptionsFor(app)}
          onLensSelected={trackLens}
          onViewToggled={trackViewToggled}
        />
      ) : (
        <>
          <ExplorerHeader app={arrived.app} search={null} settings={settingsControl} />
          <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-16 sm:px-6" aria-busy={!failed}>
            {failed ? (
              <p className="text-center text-sm text-slate-600 dark:text-slate-400">
                The Explorer couldn’t reach your account just now. Reload the page to try again.
              </p>
            ) : null}
          </main>
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
