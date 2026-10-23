// The editor's half of the returning visitor (docs/specs/019-marketing/returning-visitor.md): every time
// it lists your designs it leaves a note of your six most recent diagrams in the browser, and keeps
// their snapshot SVGs in Cache Storage, for the landing page's Welcome back window to read without
// calling the api. Signing out forgets both.

import {
  RECENT_DIAGRAMS_KEY,
  RECENT_THUMBS_CACHE,
  RECENT_THUMBS_CACHE_LEGACY,
  pickRecentDiagrams,
  recentThumbPath,
  serializeRecentDiagrams,
  type RecentDiagram,
} from '@livedesign/api-schema';
import {
  readLocalStorageSafe,
  removeLocalStorageSafe,
  writeLocalStorageSafe,
} from './local-storage-safe';

// Fetches one diagram's snapshot SVG: null when the server has none (404 / 403 / 503), and throws when
// the request itself failed, which is worth trying again on the next list.
type FetchSnapshotSvg = (id: string, savedAt: number) => Promise<string | null>;

// What the note is picked from: a design's id, name, last save, whether it is empty, and whether the person hid it
// from Recent (the index's, docs/specs/013-workspace/hide-from-recent.md).
export type RecentSource = Parameters<typeof pickRecentDiagrams>[0][number] & {
  hiddenFromRecent?: boolean;
};

// Set once the note is forgotten (sign-out): a design list still in flight from the signed-in
// session must not write it back before the page leaves.
let forgotten = false;
// The latest list and its fetcher, for a thumbnail pass asked for while one ran.
let latest: { designs: readonly RecentSource[]; fetchSnapshotSvg: FetchSnapshotSvg } | null =
  null;
// One thumbnail sync at a time; a list that lands mid-sync asks for one more pass after it.
let syncing = false;
let syncAgain = false;

export function rememberRecentDiagrams(
  designs: readonly RecentSource[],
  fetchSnapshotSvg: FetchSnapshotSvg,
): void {
  if (forgotten || typeof window === 'undefined') return;
  latest = { designs, fetchSnapshotSvg };
  const hidden = designs.filter((p) => p.hiddenFromRecent).map((p) => p.id);
  const diagrams = pickRecentDiagrams(designs, hidden);
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

// Drop the pre-v2 cache, which nothing reads now. Best effort: a browser that refuses keeps an orphan.
async function dropLegacyCache(): Promise<void> {
  try {
    await caches.delete(RECENT_THUMBS_CACHE_LEGACY);
  } catch {
    // Cache Storage refused, or a partial implementation without delete.
  }
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
    // The v1 cache held "no preview" for every design in This Browser; v2 draws them (lib/local-snapshot.ts).
    // On its own, so a refusal here never stops the sync.
    await dropLegacyCache();
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
      rememberRecentDiagrams(latest.designs, latest.fetchSnapshotSvg);
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
    await dropLegacyCache();
  }
}
