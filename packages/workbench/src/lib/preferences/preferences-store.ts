// The editors' preferences store, one copy for all six (liveworkspace/docs/specs/011-workbench/editor-preferences.md):
// the browser's warm copy, the load that merges the account's copy into it, the write, and the save queue that sends
// what changed. Each editor binds one with its keys, its trim and its api calls (its own lib/preferences-sync.ts).

import { syncOpenExplorerCookie } from '@liveworkspace/sites/open-explorer';
import { debugLog } from '../debug-log';
import {
  readLocalStorageSafe,
  removeLocalStorageSafe,
  storedRecord,
  writeLocalStorageSafe,
} from '../local-storage-safe';
import {
  __resetPreferencesKeptLocally,
  preferencesKeptLocally,
  rememberPreferencesKeptLocally,
} from '../preferences-local-only';
import {
  mergePreferences,
  preferencesPatch,
  rebasePreferences,
  type PreferencesBlob,
} from './preferences-merge';

/** What a load's read answers: the account's copy, `'local'` when the deployment keeps none, null when it failed. */
export type PreferencesRead = PreferencesBlob | 'local' | null;
/** What a save answers: confirmed, not confirmed (the device copy is kept), or the deployment keeps none. */
export type PreferencesSaveResult = 'saved' | 'failed' | 'local';

export interface PreferencesStoreConfig<P extends object> {
  /** The browser's copy, `<app>:user-preferences:v1`. */
  storageKey: string;
  /** The unsaved mark, `<app>:user-preferences:unsynced`. */
  unsyncedKey: string;
  /** The last copy agreed, `<app>:user-preferences:server`. */
  serverKey: string;
  /** The same-tab change event, `<app>:preferences-changed`. */
  changedEvent: string;
  /** The app's legacy upgrade, run on every copy read (renamed keys, retired keys dropped). */
  upgrade: (raw: Record<string, unknown>) => P;
  /** The app's trim under the api's cap. */
  fit: (prefs: P) => P;
  get: (ownerId: string) => Promise<PreferencesRead>;
  put: (ownerId: string, patch: PreferencesBlob) => Promise<PreferencesSaveResult>;
  /** Whether this page is a workbench frame, whose choices stay in the frame. */
  confined?: () => boolean;
  /** How long a change waits for the next before it is sent; 0 sends at once. */
  debounceMs?: number;
}

export interface PreferencesStore<P extends object> {
  read(): P;
  write(prefs: P, ownerId?: string | null): void;
  rebase(snapshot: P, next: P): P;
  commit(snapshot: P, next: P, ownerId?: string | null): P;
  fetch(ownerId: string): Promise<P | null>;
  save(ownerId: string, prefs: P): void;
  flush(): void;
  unsynced(ownerId: string): boolean;
  /** Records what the server holds for `ownerId`, the base the next save's patch is taken from. */
  rememberServer(ownerId: string, prefs: PreferencesBlob): void;
  /** The deployment keeps no preferences for `ownerId`: nothing more is sent for it this page load. */
  keepLocally(ownerId: string): void;
  /** Test seam: forget the page's loads, its queue and what the server holds. */
  reset(): void;
}

interface Agreed {
  ownerId: string;
  prefs: PreferencesBlob;
}

function readAgreed(key: string): Agreed | null {
  const raw = readLocalStorageSafe(key);
  if (!raw) return null;
  try {
    const parsed = storedRecord(JSON.parse(raw));
    const prefs = storedRecord(parsed?.prefs);
    return parsed && typeof parsed.ownerId === 'string' && prefs
      ? { ownerId: parsed.ownerId, prefs }
      : null;
  } catch {
    return null;
  }
}

export function createPreferencesStore<P extends object>(
  config: PreferencesStoreConfig<P>,
): PreferencesStore<P> {
  const confined = config.confined ?? (() => false);
  const debounceMs = config.debounceMs ?? 0;

  function read(): P {
    const raw = readLocalStorageSafe(config.storageKey);
    if (!raw) return {} as P;
    try {
      const parsed = storedRecord(JSON.parse(raw));
      // Unknown keys are kept: a newer client may have written them.
      return parsed ? config.upgrade(parsed) : ({} as P);
    } catch {
      return {} as P;
    }
  }

  function unsynced(ownerId: string): boolean {
    return readLocalStorageSafe(config.unsyncedKey) === ownerId;
  }

  function keep(prefs: P): void {
    writeLocalStorageSafe(config.storageKey, JSON.stringify(prefs));
    if (!confined()) {
      syncOpenExplorerCookie((prefs as { autoOpenExplorer?: unknown }).autoOpenExplorer === true);
    }
    if (typeof window !== 'undefined') window.dispatchEvent(new Event(config.changedEvent));
  }

  // ---- Saving ----

  // What the server holds for each owner as far as this page knows: the load's answer, then each confirmed save.
  let server: Agreed | null = null;
  let inFlight = false;
  let waiting: { ownerId: string; prefs: PreferencesBlob } | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  // Bumped by the test seam, so a drain begun before a reset stops rather than taking the next save.
  let generation = 0;

  function agree(ownerId: string, prefs: PreferencesBlob): void {
    server = { ownerId, prefs };
    writeLocalStorageSafe(config.serverKey, JSON.stringify({ ownerId, prefs }));
  }

  function clearTimer(): void {
    if (timer !== null) clearTimeout(timer);
    timer = null;
  }

  function keepLocally(ownerId: string): void {
    rememberPreferencesKeptLocally(ownerId);
    if (waiting?.ownerId === ownerId) waiting = null;
    if (!waiting) clearTimer();
    if (unsynced(ownerId)) removeLocalStorageSafe(config.unsyncedKey);
  }

  async function drain(): Promise<void> {
    inFlight = true;
    const run = generation;
    try {
      while (waiting && run === generation) {
        const job = waiting;
        waiting = null;
        if (preferencesKeptLocally(job.ownerId)) continue;
        const base = server?.ownerId === job.ownerId ? server.prefs : null;
        const patch = preferencesPatch(base, job.prefs);
        const result: PreferencesSaveResult =
          Object.keys(patch).length === 0 ? 'saved' : await config.put(job.ownerId, patch);
        if (run !== generation) return;
        if (result === 'local') {
          keepLocally(job.ownerId);
        } else if (result === 'failed') {
          console.warn('[preferences] save-not-confirmed, device copy kept');
        } else {
          agree(job.ownerId, config.upgrade({ ...job.prefs }) as PreferencesBlob);
          if (!waiting) removeLocalStorageSafe(config.unsyncedKey);
        }
      }
    } finally {
      if (run === generation) inFlight = false;
    }
  }

  function sendNow(): void {
    clearTimer();
    if (!inFlight) void drain();
  }

  // Queue the copy for the server; only what changed is sent. Marked unsaved at once, so a tab closed before the save
  // lands keeps its copy on the next load.
  function save(ownerId: string, prefs: P): void {
    if (preferencesKeptLocally(ownerId)) return;
    writeLocalStorageSafe(config.unsyncedKey, ownerId);
    waiting = { ownerId, prefs: prefs as PreferencesBlob };
    if (debounceMs <= 0) {
      sendNow();
      return;
    }
    clearTimer();
    timer = setTimeout(sendNow, debounceMs);
  }

  function flush(): void {
    if (timer !== null) sendNow();
  }

  if (debounceMs > 0 && typeof window !== 'undefined') {
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') flush();
    });
  }

  // ---- Writing ----

  function write(prefs: P, ownerId?: string | null): void {
    const fitted = config.fit(prefs);
    keep(fitted);
    // A workbench frame's choices stay in the frame. Nor is anything sent under the 'self' placeholder a document kept
    // Offline opens with before the reader is known: that row would be everybody's. Without an owner the change stays
    // here, a key only this device changed, which the next load keeps.
    if (ownerId && ownerId !== 'self' && !confined()) save(ownerId, fitted);
  }

  function rebase(snapshot: P, next: P): P {
    const latest = readLocalStorageSafe(config.storageKey) === null ? snapshot : read();
    return rebasePreferences(latest, snapshot, next);
  }

  function commit(snapshot: P, next: P, ownerId?: string | null): P {
    const rebased = rebase(snapshot, next);
    write(rebased, ownerId);
    return rebased;
  }

  // ---- Loading ----

  const loads = new Map<string, Promise<P | null>>();

  async function load(ownerId: string): Promise<P | null> {
    const remote = await config.get(ownerId);
    if (remote === 'local') {
      debugLog('[preferences] kept in this browser only');
      keepLocally(ownerId);
      return null;
    }
    if (remote === null) return null;
    // Remembered as the server holds it, so the next save sends a null for each retired key the upgrade drops.
    server = { ownerId, prefs: remote };
    const upgraded = config.upgrade({ ...remote }) as PreferencesBlob;
    const agreed = readAgreed(config.serverKey);
    const pending = unsynced(ownerId);
    const merged = config.fit(
      mergePreferences({
        local: read() as PreferencesBlob,
        server: upgraded,
        base: agreed?.ownerId === ownerId ? agreed.prefs : null,
        unsynced: pending,
      }) as P,
    );
    writeLocalStorageSafe(config.serverKey, JSON.stringify({ ownerId, prefs: upgraded }));
    keep(merged);
    if (pending) {
      debugLog('[preferences] device copy kept over the server, resending');
      if (!confined()) save(ownerId, merged);
    }
    return merged;
  }

  // Once per page load and owner: a second caller waits for the first's answer, then reads the browser's copy (which
  // a change since may have moved on). A failed read is asked again next time.
  function fetch(ownerId: string): Promise<P | null> {
    const known = loads.get(ownerId);
    if (known) return known.then((merged) => (merged === null ? null : read()));
    const pending = load(ownerId);
    loads.set(ownerId, pending);
    void pending.then((merged) => {
      if (merged === null) loads.delete(ownerId);
    });
    return pending;
  }

  function reset(): void {
    generation += 1;
    clearTimer();
    inFlight = false;
    waiting = null;
    server = null;
    loads.clear();
    __resetPreferencesKeptLocally();
  }

  return {
    read,
    write,
    rebase,
    commit,
    fetch,
    save,
    flush,
    unsynced,
    rememberServer: (ownerId, prefs) => {
      server = { ownerId, prefs };
    },
    keepLocally,
    reset,
  };
}
