// The stale chunk safety net (docs/specs/016-platform/stale-builds.md "The safety net"): a tab from
// an earlier build asks for a code chunk the last deploy removed. Wherever that failure surfaces (an
// uncaught error, an area error boundary, the root error boundary), the tab instead loads where the
// user was going in full, which fetches the live build. At most once per destination in a short
// window, so a genuinely broken deploy shows its error rather than reloading forever, and never
// over unsaved editor changes. Pure but for the dependencies passed in.
import { reloadWhenSaved } from './reload-when-saved';
import { debugLog } from '@/lib/debug-log';

/** One recovery reload per destination within this window; a second failure shows the error. */
export const STALE_CHUNK_RELOAD_WINDOW_MS = 60_000;
/** How long a navigation's destination stays the one a chunk failure is blamed on. */
export const NAVIGATION_INTENT_MS = 10_000;

const RELOADS_KEY = 'livediagram:stale-chunk-reloads';

// What browsers and bundlers say when a chunk or module cannot be fetched: webpack's and
// Turbopack's ChunkLoadError, and the dynamic import failures of Chrome, Safari and Firefox.
const CHUNK_FAILURE =
  /Loading (CSS )?chunk \S+ failed|Failed to load chunk|Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module/i;

export function isChunkLoadError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return error.name === 'ChunkLoadError' || CHUNK_FAILURE.test(error.message);
}

/**
 * Claims the one recovery reload a destination gets per window. Storage that cannot be read
 * refuses (better the error than a reload loop); storage holding junk starts afresh.
 */
export function claimChunkReload(destination: string, storage: Storage, now: number): boolean {
  let reloads: Record<string, number>;
  try {
    const raw = storage.getItem(RELOADS_KEY);
    try {
      const parsed: unknown = raw ? JSON.parse(raw) : {};
      reloads = parsed && typeof parsed === 'object' ? (parsed as Record<string, number>) : {};
    } catch {
      reloads = {};
    }
  } catch {
    return false;
  }
  const last = reloads[destination];
  if (typeof last === 'number' && now - last <= STALE_CHUNK_RELOAD_WINDOW_MS) return false;
  const fresh: Record<string, number> = { [destination]: now };
  for (const [url, at] of Object.entries(reloads)) {
    if (typeof at === 'number' && now - at <= STALE_CHUNK_RELOAD_WINDOW_MS && url !== destination) {
      fresh[url] = at;
    }
  }
  try {
    storage.setItem(RELOADS_KEY, JSON.stringify(fresh));
  } catch {
    return false;
  }
  return true;
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
  'reloading' | 'gave-up' | 'unsaved' | 'not-a-chunk-error' | 'already-recovering';

export type ChunkRecoveryDeps = {
  storage: Storage;
  now: () => number;
  /** The URL being navigated to, else the current one. */
  destination: () => string;
  hasUnsavedChanges: () => boolean;
  /** A full page load of a URL. */
  load: (url: string) => void;
  track: (category: 'Error', action: 'Client', type: string) => void;
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
  handled.add(err);
  const destination = deps.destination();
  if (!claimChunkReload(destination, deps.storage, deps.now())) {
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
