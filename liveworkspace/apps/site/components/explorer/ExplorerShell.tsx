'use client';

// The Explorer on liveworkspace.app (liveworkspace/docs/site.md "The Explorer"): the shared Explorer
// (@liveworkspace/explorer) once, for every app, instead of at each app's /explorer. Mounted by app/explorer's
// layout, so a list already loaded stays loaded from view to view.
//
// It asks the index as the person: the signed-in account, or this browser's guest (lib/explorer/token.ts). It wears
// the colours and logo of the app the person came from (`?from=`, the referrer, or the last app used here), opens
// filtered to that app's items with All Apps one click away, and sends every item, New and template back to its own
// app (lib/explorer/host.ts).

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  Explorer,
  viewFromLocation,
  type AppFilter,
  type ExplorerView,
  type NavigateOptions,
  type Placement,
  type SidebarLink,
  type WelcomeManifest,
  type WelcomeOptions,
} from '@liveworkspace/explorer';
import { createIndexClient } from '@liveworkspace/index-client';
import { APP_ITEMS, type AppName } from '@liveworkspace/sites';
import { signInHref } from '@/lib/accounts';
import { useSession } from '@/lib/session';
import {
  arrival,
  arrivalNotice,
  ENDED_PARAM,
  helpHrefFor,
  itemHref,
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
import { lookupNames } from '@/lib/explorer/names';
import {
  resetWorkspaceIdentity,
  teamsOfToken,
  workspaceIdentity,
  workspaceToken,
  type WorkspaceIdentity,
} from '@/lib/explorer/token';
import { loadWelcome } from '@/lib/explorer/welcome';
import { ExplorerHeader } from './ExplorerHeader';

// The kind New makes, and "this app", for a person who came from no app: the first app on the index.
const FALLBACK_APP: AppName = 'liveplanner';
// The handoffs an address may carry, taken once and then dropped from it.
const TRASHED_PARAM = 'trashed';
const TITLE_PARAM = 'title';

const client = createIndexClient({ getToken: workspaceToken });

const NO_ARRIVAL: Arrival = { app: null, via: null };

/** The retired view an address names (`/explorer/profile`, …), if any. */
function retiredView(pathname: string): keyof typeof RETIRED_TARGETS | 'offline' | null {
  const section = pathname.replace(/\/+$/, '').split('/')[2] ?? '';
  if (section === 'offline') return 'offline';
  return section in RETIRED_TARGETS ? (section as keyof typeof RETIRED_TARGETS) : null;
}

export function ExplorerShell() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const session = useSession();

  // Decided once per visit: later moves inside the Explorer carry no `?from=`.
  const [arrived, setArrived] = useState<Arrival>(NO_ARRIVAL);
  const [ready, setReady] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [trashed, setTrashed] = useState<{ id: string; title: string | null } | null>(null);
  const [identity, setIdentity] = useState<WorkspaceIdentity | null>(null);
  const [failed, setFailed] = useState(false);

  // Arrival: where from, and what the address hands over (settings, a revoked link's note, a trashed plan).
  useEffect(() => {
    const search = window.location.search;
    const found = arrival(search, document.referrer, readLastApp());
    // A retired address replaces itself with its successor.
    const retired = retiredView(window.location.pathname);
    if (retired === 'offline') {
      window.location.replace(offlineHref(found.app ?? FALLBACK_APP) ?? '/explorer');
      return;
    }
    if (retired) {
      window.location.replace(retiredTarget(retired, search));
      return;
    }
    // The apps' Settings deep link (every notification email's unsubscribe link carries one).
    const settings = settingsTarget(search, found.app);
    if (settings) {
      window.location.replace(settings);
      return;
    }
    if (found.app) rememberApp(found.app);
    setArrived(found);
    setNotice(arrivalNotice(search, found.app));
    const params = new URLSearchParams(search);
    const trashedId = params.get(TRASHED_PARAM);
    if (trashedId) setTrashed({ id: trashedId, title: params.get(TITLE_PARAM) });
    // Taken once: a reload doesn't say it again.
    if (params.has(ENDED_PARAM) || trashedId) {
      const url = new URL(window.location.href);
      for (const key of [ENDED_PARAM, TRASHED_PARAM, TITLE_PARAM]) url.searchParams.delete(key);
      window.history.replaceState(window.history.state, '', url);
    }
    setReady(true);
  }, []);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- asked when ready, and again on signing out
  }, [ready, session.state]);

  const app: AppName = arrived.app ?? FALLBACK_APP;
  const [filter, setFilter] = useState<AppFilter | null>(null);
  const shownFilter: AppFilter = filter ?? (arrived.app ? 'app' : 'all');

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

  // Home's first run: the app's starts, loaded only once Home finds nothing.
  const [loaded, setLoaded] = useState<{ app: AppName; manifest: WelcomeManifest } | null>(null);
  const onFirstRun = useCallback(() => {
    void loadWelcome(app).then((manifest) => manifest && setLoaded({ app, manifest }));
  }, [app]);
  const signedIn = identity?.kind === 'account';
  const welcome: WelcomeOptions = useMemo(
    () => ({
      manifest: loaded?.app === app ? loaded.manifest : null,
      onFirstRun,
      signedIn,
      signInHref: signInHref(pathname || '/explorer'),
    }),
    [loaded, app, onFirstRun, signedIn, pathname],
  );

  // This Browser: what the app keeps only in this browser, in its own offline view.
  const sidebarLinks: SidebarLink[] = useMemo(() => {
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
  }, [app]);

  // Cmd/Ctrl+K: to the search field.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.altKey || e.key.toLowerCase() !== 'k') return;
      const field = document.querySelector<HTMLInputElement>('[data-explorer] input[role="combobox"]');
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
          Link={Link}
          teams={teams}
          viewerId={identity.sub}
          shareUrl={shareUrl}
          manageTeamsUrl="/account/teams"
          filter={shownFilter}
          onFilterChange={setFilter}
          header={header}
          helpHref={helpHref}
          trashedOnArrival={trashed}
          welcome={welcome}
          sidebarLinks={sidebarLinks}
          allLabel="All Apps"
          lookupNames={lookupNames}
          arrivalNotice={notice}
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
