// The offline id cache (docs/specs/006-document/offline-mode.md "Persistence architecture"): a
// cheap "is this document offline?" for the dispatch in lib/api/*. The set of offline ids IS the
// set of record keys, mirrored in memory per browser tab.
//
// Every tab of the same browser shares the one IndexedDB store, so a tab's cache goes stale the
// moment another tab registers or removes an id (Take Offline, Sync Document, a purge). Each change
// is therefore told to the other tabs on a BroadcastChannel and applied there; without it a tab
// kept routing a document's writes to the store it had left.

import { reportApiWarning } from '../api/error-report';
import { debugLog } from '../debug-log';
import { OfflineStoreUnavailableError, offlineBackend } from './offline-backend';

// The channel the tabs of one browser tell each other about offline ids on.
export const OFFLINE_IDS_CHANNEL = 'livediagram-offline';

// One change to the set of offline ids, as broadcast to the other tabs.
export type OfflineIdChange = { kind: 'add' | 'remove'; id: string };

let idCache: Set<string> | null = null;
let idCacheLoad: Promise<Set<string>> | null = null;
// Ids registered before the cache finished loading (a create racing the
// first lookup). Merged into the cache when it lands and consulted by both
// checks, so a just-created offline document can never read as "not offline"
// (a miss would leak its writes to the server; see docs/specs/006-document/offline-mode.md and the ghost-row
// bug the meta PUT's create-on-first-write used to turn that into).
const pendingIds = new Set<string>();
// Ids another tab removed before this tab's cache finished loading: the load's snapshot of the
// store may predate the removal, so they are dropped from it when it lands.
const removedIds = new Set<string>();

// Set once the store failed to open in time: the rest of the page load answers from the pending set
// instead of waiting out the limit again on every check (two per document load).
let storeUnavailable = false;

async function loadIds(): Promise<Set<string>> {
  idsChannel();
  if (idCache) return idCache;
  if (storeUnavailable) return new Set(pendingIds);
  if (!idCacheLoad) {
    idCacheLoad = offlineBackend()
      .all()
      .then((recs) => {
        const ids = new Set([...recs.map((r) => r.id), ...pendingIds]);
        for (const id of removedIds) ids.delete(id);
        removedIds.clear();
        idCache = ids;
        return ids;
      })
      .catch((err: unknown) => {
        // No IndexedDB (SSR, private mode) or a transient open failure.
        // Do NOT pin an empty cache: clear the in-flight slot so the next
        // check retries, and answer THIS check from the pending set only.
        // A store that would not open in time is the exception: it is not
        // retried for the rest of the page load (see storeUnavailable).
        idCacheLoad = null;
        if (err instanceof OfflineStoreUnavailableError) {
          storeUnavailable = true;
          console.warn(`[offline-store] unavailable: ${err.message}`);
          reportApiWarning('OfflineStore.Unavailable');
        }
        return new Set(pendingIds);
      });
  }
  return idCacheLoad;
}

export async function isOfflineId(id: string): Promise<boolean> {
  return (await loadIds()).has(id);
}

// Synchronous check off the already-loaded cache, for the `beforeunload`
// beacon flush, which can't await. Returns false until the cache has loaded
// (by which point any document being edited has already been through the async
// path, so its id is cached).
export function isOfflineIdSync(id: string): boolean {
  idsChannel();
  return pendingIds.has(id) || (idCache?.has(id) ?? false);
}

function applyChange(change: OfflineIdChange): void {
  if (change.kind === 'add') {
    removedIds.delete(change.id);
    pendingIds.add(change.id);
    idCache?.add(change.id);
  } else {
    pendingIds.delete(change.id);
    idCache?.delete(change.id);
    if (!idCache) removedIds.add(change.id);
  }
}

// ---------------------------------------------------------------------------
// The other tabs
// ---------------------------------------------------------------------------

let channel: BroadcastChannel | null = null;

function isIdChange(data: unknown): data is OfflineIdChange {
  if (typeof data !== 'object' || data === null) return false;
  const { kind, id } = data as Record<string, unknown>;
  return (kind === 'add' || kind === 'remove') && typeof id === 'string' && id.length > 0;
}

// Opened on first use and kept for the page's life: a tab listens from the moment it first asks
// about an id or changes one, which is before it routes any write. A browser without BroadcastChannel keeps the per-tab behaviour.
function idsChannel(): BroadcastChannel | null {
  if (channel || typeof BroadcastChannel === 'undefined') return channel;
  channel = new BroadcastChannel(OFFLINE_IDS_CHANNEL);
  channel.onmessage = (event: MessageEvent) => {
    if (!isIdChange(event.data)) return;
    applyChange(event.data);
    debugLog(`[offline-ids] ${event.data.kind} from another tab`);
  };
  // Node (the tests) keeps a process alive on an open channel; a browser has no unref.
  (channel as { unref?: () => void }).unref?.();
  return channel;
}

function tell(change: OfflineIdChange): void {
  try {
    idsChannel()?.postMessage(change);
  } catch (err) {
    console.warn('[offline-ids] broadcast failed', err);
  }
}

export function rememberOfflineId(id: string): void {
  applyChange({ kind: 'add', id });
  tell({ kind: 'add', id });
}

export function forgetOfflineId(id: string): void {
  applyChange({ kind: 'remove', id });
  tell({ kind: 'remove', id });
}

// Test seam: drop the cache and stop listening (each test starts a fresh "tab").
export function resetOfflineIds(): void {
  idCache = null;
  idCacheLoad = null;
  storeUnavailable = false;
  pendingIds.clear();
  removedIds.clear();
  channel?.close();
  channel = null;
}
