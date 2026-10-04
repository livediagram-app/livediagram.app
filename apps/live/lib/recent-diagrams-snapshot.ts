// The editor's half of the returning visitor (docs/specs/019-marketing/returning-visitor.md): every time
// it lists your documents it leaves a note of your six most recent diagrams in the browser, and keeps
// their snapshot SVGs in Cache Storage, for the landing page's Welcome back window to read without
// calling the api. Signing out forgets both.

import {
  RECENT_DIAGRAMS_KEY,
  RECENT_THUMBS_CACHE,
  pickRecentDiagrams,
  recentThumbPath,
  serializeRecentDiagrams,
  type DocumentSummary,
  type RecentDiagram,
} from '@livediagram/api-schema';
import { USER_PREFERENCES_STORAGE_KEY } from '@livediagram/telemetry-client';
import {
  readLocalStorageSafe,
  removeLocalStorageSafe,
  writeLocalStorageSafe,
} from './local-storage-safe';

// Fetches one diagram's snapshot SVG: null when the server has none (404 / 403 / 503), and throws when
// the request itself failed, which is worth trying again on the next list.
type FetchSnapshotSvg = (id: string, savedAt: number) => Promise<string | null>;

// Set once the note is forgotten (sign-out): a document list still in flight from the signed-in
// session must not write it back before the page leaves.
let forgotten = false;
// The latest list and its fetcher, so hiding a diagram from Recent takes it off the note at once
// rather than at the next list.
let latest: { documents: readonly DocumentSummary[]; fetchSnapshotSvg: FetchSnapshotSvg } | null =
  null;
let listening = false;
// One thumbnail sync at a time; a list that lands mid-sync asks for one more pass after it.
let syncing = false;
let syncAgain = false;

export function rememberRecentDiagrams(
  documents: readonly DocumentSummary[],
  fetchSnapshotSvg: FetchSnapshotSvg,
): void {
  if (forgotten || typeof window === 'undefined') return;
  latest = { documents, fetchSnapshotSvg };
  listenForHiddenChanges();
  const diagrams = pickRecentDiagrams(documents, hiddenFromRecent());
  const next = diagrams.length > 0 ? serializeRecentDiagrams(diagrams) : null;
  if (next !== readLocalStorageSafe(RECENT_DIAGRAMS_KEY)) {
    if (next) writeLocalStorageSafe(RECENT_DIAGRAMS_KEY, next);
    else removeLocalStorageSafe(RECENT_DIAGRAMS_KEY);
  }
  // Thumbnails are a nicety: off the critical path, after the list has painted. Run even when the
  // note is unchanged, so a thumbnail an earlier pass could not fetch (or the browser evicted) is
  // filled in; a pass with nothing missing is a handful of cache reads.
  const later = window.requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 1));
  later(() => void syncThumbnails(diagrams, fetchSnapshotSvg));
}

// The ids hidden from Recent (docs/specs/013-workspace/hide-from-recent.md), read straight from the
// preferences blob: going through lib/user-preferences would loop back into the api client this
// module is called from.
function hiddenFromRecent(): string[] {
  try {
    const prefs = JSON.parse(readLocalStorageSafe(USER_PREFERENCES_STORAGE_KEY) ?? '{}') as {
      recentExcludedIds?: unknown;
    } | null;
    const ids = prefs?.recentExcludedIds;
    return Array.isArray(ids) ? ids.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

// lib/user-preferences.ts PREFERENCES_CHANGED_EVENT (same tab) and the browser's storage event (another
// tab): either may be a diagram hidden from, or returned to, Recent.
const PREFERENCES_CHANGED_EVENT = 'livediagram:preferences-changed';

function listenForHiddenChanges(): void {
  if (listening) return;
  listening = true;
  const repick = () => {
    if (latest) rememberRecentDiagrams(latest.documents, latest.fetchSnapshotSvg);
  };
  window.addEventListener(PREFERENCES_CHANGED_EVENT, repick);
  window.addEventListener('storage', (e) => {
    if (e.key === USER_PREFERENCES_STORAGE_KEY) repick();
  });
}

// Fetch the snapshot of each noted diagram the cache lacks (at its current save), and drop every entry
// that is no longer noted, so the cache never holds more than the note's six.
async function syncThumbnails(
  diagrams: readonly RecentDiagram[],
  fetchSnapshotSvg: FetchSnapshotSvg,
): Promise<void> {
  if (!('caches' in window)) return;
  if (syncing) {
    syncAgain = true;
    return;
  }
  syncing = true;
  try {
    const cache = await caches.open(RECENT_THUMBS_CACHE);
    const wanted = new Map(
      diagrams.map((d) => [new URL(recentThumbPath(d.id, d.savedAt), location.origin).href, d]),
    );
    for (const request of await cache.keys()) {
      if (!wanted.has(request.url)) await cache.delete(request);
    }
    for (const [url, d] of wanted) {
      if (forgotten) return;
      if (await cache.match(url)) continue;
      let svg: string | null;
      try {
        svg = await fetchSnapshotSvg(d.id, d.savedAt);
      } catch {
        // The request failed (offline, a blip): leave it out, to be asked for on the next list.
        continue;
      }
      if (forgotten) return;
      // A diagram the server has no snapshot for (offline, or not drawable) is remembered as such,
      // so it is not asked for again on every list; the landing page shows its placeholder.
      await cache.put(
        url,
        svg
          ? new Response(svg, { headers: { 'Content-Type': 'image/svg+xml' } })
          : new Response(null, { status: 404 }),
      );
    }
  } catch {
    // Cache Storage refused (quota, a private window): the tiles show their placeholders.
  } finally {
    syncing = false;
    if (syncAgain && latest && !forgotten) {
      syncAgain = false;
      rememberRecentDiagrams(latest.documents, latest.fetchSnapshotSvg);
    }
  }
}

// Sign-out (and account deletion): the landing page it returns to, and the next person on this
// computer, must not see the account's diagrams.
export async function forgetRecentDiagrams(): Promise<void> {
  forgotten = true;
  latest = null;
  removeLocalStorageSafe(RECENT_DIAGRAMS_KEY);
  if (typeof window !== 'undefined' && 'caches' in window) {
    await caches.delete(RECENT_THUMBS_CACHE).catch(() => false);
  }
}
