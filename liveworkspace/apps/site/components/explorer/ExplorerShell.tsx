'use client';

// The Explorer on liveworkspace.app (liveworkspace/docs/site.md "The Explorer"): the shared Explorer
// (@liveworkspace/explorer) once, for every app, instead of at each app's /explorer. Mounted by app/explorer's
// layout, so a list already loaded stays loaded from view to view.
//
// It asks the index as the person: the signed-in account, or this browser's guest (lib/explorer/token.ts). It wears
// the colours and logo of the app the person came from (`?from=`, the referrer, or the last app used here), opens
// filtered to that app's items with All Apps one click away, and sends every item, New and template back to its own
// app (lib/explorer/host.ts).
//
// The same page is also served under each app's own address (`liveplanner.app/explorer/…`, through the app's router;
// lib/explorer/page-app.ts). There it is that app's Explorer: it asks as the app's session, shows the app's items kept
// only in this browser (This Browser), keeps its links on the app's address and sends liveworkspace's own pages
// (account, teams, settings) to liveworkspace.app.

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import {
  createExplorerAccounts,
  Explorer,
  HeroArt,
  viewFromLocation,
  type AppFilter,
  type ExplorerView,
  type HeroArtManifest,
  type LinkComponent,
  type NavigateOptions,
  type Placement,
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
import { APP_ITEMS, siteOfApp, type AppName } from '@liveworkspace/sites';
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
  lensTemplatesFor,
  newItemHref,
  offlineHref,
  readLastApp,
  rememberApp,
  RETIRED_TARGETS,
  retiredTarget,
  settingsTarget,
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
import { makeTeam } from '@/lib/explorer/new-team';
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
import { ExplorerHeader } from './ExplorerHeader';

// The kind New makes, and "this app", for a person who came from no app: the first app on the index.
const FALLBACK_APP: AppName = 'liveplanner';
// The handoffs an address may carry, taken once and then dropped from it.
const TRASHED_PARAM = 'trashed';
const TITLE_PARAM = 'title';

const client = createIndexClient({ getToken: workspaceToken });
// The person's own accounts routes on this origin: people's names (owners, who did what, one cache; a guest's too),
// and, signed in, a team's members and count and the invitations waiting. On an app's address, through its router
// with the page's token (accountFetch).
const accounts = createExplorerAccounts({ fetch: accountFetch });

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
  const found: Arrival = host
    ? { app: host, via: 'host' }
    : arrival(search, document.referrer, readLastApp());
  // A retired address gives way to its successor. This Browser is a view of its own on the app's address.
  const retired = retiredView(window.location.pathname);
  if (retired === 'offline' && !host)
    return { leave: offlineHref(found.app ?? FALLBACK_APP) ?? '/explorer' };
  if (retired && retired !== 'offline')
    return { leave: onWorkspace(retiredTarget(retired, search)) };
  // The apps' Settings deep link (every notification email's unsubscribe link carries one).
  const settings = settingsTarget(search, found.app);
  if (settings) return { leave: onWorkspace(settings) };
  const params = new URLSearchParams(search);
  const trashedId = params.get(TRASHED_PARAM);
  return {
    leave: null,
    arrived: found,
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

  const app: AppName = arrived.app ?? FALLBACK_APP;
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
  // New Team in the Move dialog: made on liveworkspace, then the renewed token lists it among the teams.
  const onCreateTeam = useCallback(async (name: string) => {
    const made = await makeTeam(name);
    if (!made) return null;
    if (made.identity) setIdentity(made.identity);
    return made.team;
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
  const thisBrowser: ThisBrowserHost | null = useMemo(
    () =>
      host
        ? {
            items: local as ThisBrowserItem[],
            itemHref: (item) => `${APP_ITEMS[host].itemPath}${encodeURIComponent(item.id)}`,
            helpHref: '/help/privacy-and-security/offline-mode/',
          }
        : null,
    [host, local],
  );

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

  // Cmd/Ctrl+K: to the search field.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.altKey || e.key.toLowerCase() !== 'k') return;
      const field = document.querySelector<HTMLInputElement>(
        '[data-explorer] input[role="combobox"]',
      );
      e.preventDefault();
      if (field) field.focus();
      else router.push('/explorer/search');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [router]);

  const header = useCallback(
    ({ search }: { search: ReactNode }) => <ExplorerHeader app={arrived.app} search={search} />,
    [arrived.app],
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
          manageTeamsUrl={host ? workspaceHref('/account/teams') : '/account/teams'}
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
          {...(signedIn && !host ? { onCreateTeam } : {})}
          heroHidden={settings.heroHidden}
          onHideHero={settings.onHideHero}
          onTimeline={trackTimeline}
          onHome={trackHome}
          onOrganise={trackOrganise}
          lensTemplates={lensTemplatesFor(app)}
          onLensSelected={trackLens}
          onViewToggled={trackViewToggled}
        />
      ) : (
        <>
          <ExplorerHeader app={arrived.app} search={null} />
          <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-16 sm:px-6" aria-busy={!failed}>
            {failed ? (
              <p className="text-center text-sm text-slate-600 dark:text-slate-400">
                The Explorer couldn’t reach your account just now. Reload the page to try again.
              </p>
            ) : null}
          </main>
        </>
      )}
    </div>
  );
}
