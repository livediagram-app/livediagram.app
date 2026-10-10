// The stale chunk safety net (docs/specs/016-platform/stale-builds.md "The safety net"): a tab from
// an earlier build asks for a code chunk the last deploy removed. Wherever that failure surfaces (an
// uncaught error, an area error boundary, the root error boundary), the tab instead loads where the
// user was going in full, which fetches the live build. At most once per destination in a short
// window (the one reload guard, reload-guard.ts, shared with the pre-boot guard), so a genuinely
// broken deploy shows its error rather than reloading forever, and never
// over unsaved editor changes. Pure but for the dependencies passed in.
import { claimReload } from './reload-guard';
import { reloadWhenSaved } from './reload-when-saved';
import { debugLog } from '@/lib/debug-log';

/** How long a navigation's destination stays the one a chunk failure is blamed on. */
export const NAVIGATION_INTENT_MS = 10_000;

// What browsers and bundlers say when a chunk or module cannot be fetched: webpack's and
// Turbopack's ChunkLoadError, and the dynamic import failures of Chrome, Safari and Firefox.
const CHUNK_FAILURE =
  /Loading (CSS )?chunk \S+ failed|Failed to load chunk|Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module/i;

export function isChunkLoadError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return error.name === 'ChunkLoadError' || CHUNK_FAILURE.test(error.message);
}

/** Where the app was last asked to go (a link, back or forward, a programmatic navigation). */
export function createNavigationIntents() {
  let latest: { url: string; at: number } | null = null;
  return {
    note(url: string, now: number) {
      latest = { url, at: now };
    },
    destination(now: number, currentUrl: string): string {
      return latest && now - latest.at <= NAVIGATION_INTENT_MS ? latest.url : currentUrl;
    },
    clear() {
      latest = null;
    },
  };
}

export type ChunkRecovery =
  'reloading' | 'gave-up' | 'unsaved' | 'not-a-chunk-error' | 'already-recovering' | 'offline';

export type ChunkRecoveryDeps = {
  storage: Storage;
  now: () => number;
  /** The URL being navigated to, else the current one. */
  destination: () => string;
  hasUnsavedChanges: () => boolean;
  /** A full page load of a URL. */
  load: (url: string) => void;
  track: (category: 'Error', action: 'Client', type: string) => void;
  /** False when the browser says it is offline; defaults to online. */
  online?: () => boolean;
};

// The same failure is often reported twice (a boundary, then the window): recover once.
const handled = new WeakSet<Error>();

export async function recoverFromChunkError(
  error: unknown,
  deps: ChunkRecoveryDeps,
): Promise<ChunkRecovery> {
  if (!isChunkLoadError(error)) return 'not-a-chunk-error';
  const err = error as Error;
  if (handled.has(err)) return 'already-recovering';
  // Offline, a chunk that cannot be fetched is the connection, not an earlier build: a reload would
  // only swap in the browser's own error page and spend the reload guard
  // (docs/specs/007-editor/load-recovery.md "Offline"). Not marked handled, so the same failure
  // reported again once back online still recovers.
  if (deps.online && !deps.online()) {
    console.warn('[stale-chunks] a chunk failed to load while offline; not reloading');
    return 'offline';
  }
  handled.add(err);
  const destination = deps.destination();
  // The one reload guard shared with the pre-boot guard (reload-guard.ts).
  if (!claimReload(destination, deps.storage, deps.now())) {
    console.warn('[stale-chunks] already reloaded for this page, showing the error', {
      destination,
    });
    return 'gave-up';
  }
  debugLog('[stale-chunks] a chunk from an earlier build is gone; loading the page in full', {
    destination,
  });
  const outcome = await reloadWhenSaved({
    hasUnsavedChanges: deps.hasUnsavedChanges,
    reload: () => {
      // The recovery (the failure kept its own event, which names the page). Called by the name
      // `track`, so the dashboard's emitter scan sees it.
      const { track } = deps;
      track('Error', 'Client', 'StaleChunkReload');
      deps.load(destination);
    },
  });
  return outcome === 'reloaded' ? 'reloading' : 'unsaved';
}
