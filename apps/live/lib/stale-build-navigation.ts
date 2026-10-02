// Navigating while the live build is newer than this page's (docs/specs/016-platform/stale-builds.md
// "Navigating while stale"), and the browser side of the chunk safety net. In-app link clicks, back
// and forward, and the app's own navigations become full page loads once the server release signal
// says a newer build is live, so no old chunk name is ever requested; a chunk that fails anyway
// (the signal not heard yet) is recovered by a full page load of its destination. Every full load
// waits for unsaved editor work first, and falls back to the client transition when it cannot.
import { APP_RECOVERY_FLAG } from './reload-guard';
import { reloadWhenSaved } from './reload-when-saved';
import { runningStaleBuild } from './server-release';
import { createNavigationIntents, recoverFromChunkError, type ChunkRecovery } from './stale-chunks';
import { track } from './telemetry';
import { hasUnsavedWork } from './unsaved-work';

export type NavigationDeps = {
  win: Window;
  isStale: () => boolean;
  hasUnsavedChanges: () => boolean;
  /** A full page load. */
  load: (url: string, replace: boolean) => void;
  /** The client router's transition, used when a full load must not happen (unsaved work). */
  navigateClient: (url: string, replace: boolean) => void;
  now: () => number;
  storage: () => Storage;
  track: (category: 'Error', action: 'Client', type: string) => void;
};

export const navigationIntents = createNavigationIntents();

let clientNavigator: ((url: string, replace: boolean) => void) | null = null;

/** The root boot hands over the router once mounted, for the unsaved-work fallback. */
export function setClientNavigator(navigate: ((url: string, replace: boolean) => void) | null) {
  clientNavigator = navigate;
}

export function browserNavigationDeps(): NavigationDeps {
  return {
    win: window,
    isStale: runningStaleBuild,
    hasUnsavedChanges: hasUnsavedWork,
    load: (url, replace) => (replace ? window.location.replace(url) : window.location.assign(url)),
    navigateClient: (url, replace) => {
      if (clientNavigator) clientNavigator(url, replace);
      else if (replace) window.location.replace(url);
      else window.location.assign(url);
    },
    now: () => Date.now(),
    storage: () => window.sessionStorage,
    track,
  };
}

/** An in-app destination (path, query and hash) for a URL on this origin, else null. */
export function inAppDestination(href: string, base: Location): string | null {
  let url: URL;
  try {
    url = new URL(href, base.href);
  } catch {
    return null;
  }
  if (url.origin !== base.origin) return null;
  return `${url.pathname}${url.search}${url.hash}`;
}

// A plain left click on an in-app link: the only clicks the app itself would navigate.
function linkClickDestination(event: MouseEvent, win: Window): string | null {
  if (event.defaultPrevented || event.button !== 0) return null;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return null;
  const target = event.target as Element | null;
  const anchor = target?.closest?.('a[href]') as HTMLAnchorElement | null;
  if (!anchor) return null;
  if (anchor.hasAttribute('download')) return null;
  const opensElsewhere = anchor.target && anchor.target !== '_self';
  if (opensElsewhere) return null;
  return inAppDestination(anchor.getAttribute('href') ?? '', win.location);
}

const samePage = (destination: string, location: Location) =>
  destination.split('#')[0] === `${location.pathname}${location.search}`;

/** A full page load once nothing is unsaved; 'unsaved' when it could not happen. */
export function fullPageLoad(
  url: string,
  replace: boolean,
  deps: NavigationDeps,
): Promise<'reloaded' | 'unsaved'> {
  return reloadWhenSaved({
    hasUnsavedChanges: deps.hasUnsavedChanges,
    reload: () => deps.load(url, replace),
  });
}

/** The app's own navigation: a full load while stale, the client transition otherwise. */
export async function navigateTo(url: string, replace: boolean, deps: NavigationDeps) {
  navigationIntents.note(url, deps.now());
  if (deps.isStale() && (await fullPageLoad(url, replace, deps)) === 'reloaded') {
    console.info('[stale-build] newer build live; loaded in full', { url });
    return;
  }
  deps.navigateClient(url, replace);
}

/** The safety net, in the browser: a chunk failure becomes a full load of its destination. */
export function recoverInBrowser(error: unknown, deps: NavigationDeps): Promise<ChunkRecovery> {
  const { win } = deps;
  return recoverFromChunkError(error, {
    storage: deps.storage(),
    now: deps.now,
    destination: () =>
      navigationIntents.destination(
        deps.now(),
        `${win.location.pathname}${win.location.search}${win.location.hash}`,
      ),
    hasUnsavedChanges: deps.hasUnsavedChanges,
    load: (url) => deps.load(url, false),
    track: deps.track,
  });
}

/**
 * Listens for in-app link clicks, back and forward, and chunk failures. Install before the client
 * router's own popstate listener (the root layout's boot does), so a stale back or forward stops
 * here. Returns the cleanup.
 */
export function installStaleBuildNavigation(deps: NavigationDeps): () => void {
  const { win } = deps;
  let replaying = false;

  const onClick = (event: MouseEvent) => {
    const destination = linkClickDestination(event, win);
    if (destination === null) return;
    navigationIntents.note(destination, deps.now());
    if (!deps.isStale() || samePage(destination, win.location)) return;
    // Before the app's own link handler sees it: this navigation is a full load.
    event.preventDefault();
    event.stopPropagation();
    void fullPageLoad(destination, false, deps).then((outcome) => {
      if (outcome === 'unsaved') deps.navigateClient(destination, false);
      else console.info('[stale-build] newer build live; loaded in full', { url: destination });
    });
  };

  const onPopState = (event: PopStateEvent) => {
    if (replaying) return;
    const destination = `${win.location.pathname}${win.location.search}${win.location.hash}`;
    navigationIntents.note(destination, deps.now());
    if (!deps.isStale()) return;
    event.stopImmediatePropagation();
    void fullPageLoad(destination, true, deps).then((outcome) => {
      if (outcome === 'reloaded') {
        console.info('[stale-build] newer build live; loaded in full', { url: destination });
        return;
      }
      // Unsaved work: hand the back or forward to the client router after all.
      replaying = true;
      try {
        win.dispatchEvent(new PopStateEvent('popstate', { state: event.state }));
      } finally {
        replaying = false;
      }
    });
  };

  const onError = (event: ErrorEvent) => void recoverInBrowser(event.error, deps);
  const onRejection = (event: PromiseRejectionEvent) => void recoverInBrowser(event.reason, deps);

  // From here the app recovers chunk failures itself (waiting for unsaved work first); the pre-boot
  // guard in the page's head stands down for them.
  const flags = win as unknown as Record<string, unknown>;
  flags[APP_RECOVERY_FLAG] = true;
  win.addEventListener('click', onClick, true);
  win.addEventListener('popstate', onPopState);
  win.addEventListener('error', onError);
  win.addEventListener('unhandledrejection', onRejection);
  return () => {
    win.removeEventListener('click', onClick, true);
    win.removeEventListener('popstate', onPopState);
    win.removeEventListener('error', onError);
    win.removeEventListener('unhandledrejection', onRejection);
    delete flags[APP_RECOVERY_FLAG];
  };
}
