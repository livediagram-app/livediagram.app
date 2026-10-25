// The browser checks (docs/specs/007-editor/load-recovery.md "Diagnostics"): the platform features the
// editor's load leans on, each answered yes / no, for the diagnostics report support reads. Run on
// demand (a button press, the Repair page opening), never on the editor's own load. Each product names
// its probe (`<product>-probe`, inside the prefix its repair clears) and binds runBrowserChecks to it.

/** How long the IndexedDB probe waits for `open` to settle: the offline store's own limit. */
export const INDEXED_DB_PROBE_TIMEOUT_MS = 4_000;

/** The name a product's probes use when it names none: its own throwaway database and storage key. */
const DEFAULT_PROBE = 'liveworkspace-probe';

export type IndexedDbCheck = 'ok' | 'unavailable' | 'error' | 'blocked' | 'timeout';

export type BrowserChecks = {
  localStorage: boolean;
  sessionStorage: boolean;
  cookies: boolean;
  indexedDb: IndexedDbCheck;
  randomUuid: boolean;
  online: boolean;
  userAgent: string;
};

function storageWritable(get: () => Storage, k: string): boolean {
  try {
    const s = get();
    s.setItem(k, '1');
    s.removeItem(k);
    return true;
  } catch {
    return false;
  }
}

/**
 * Open (and delete) a throwaway database, bounded by `timeoutMs`. `probeDb` is its own, so it never upgrades
 * or blocks the offline store.
 */
export function probeIndexedDb(
  idb: IDBFactory | undefined = typeof indexedDB === 'undefined' ? undefined : indexedDB,
  timeoutMs = INDEXED_DB_PROBE_TIMEOUT_MS,
  probeDb = DEFAULT_PROBE,
): Promise<IndexedDbCheck> {
  if (!idb) return Promise.resolve('unavailable');
  return new Promise((resolve) => {
    let settled = false;
    const done = (r: IndexedDbCheck) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(r);
    };
    const timer = setTimeout(() => done('timeout'), timeoutMs);
    let req: IDBOpenDBRequest;
    try {
      req = idb.open(probeDb);
    } catch {
      done('error');
      return;
    }
    req.onsuccess = () => {
      req.result.close();
      try {
        idb.deleteDatabase(probeDb);
      } catch {
        // The probe answered; a leftover empty database is harmless.
      }
      done('ok');
    };
    req.onerror = () => done('error');
    req.onblocked = () => done('blocked');
  });
}

/** Every check, in one go. `probe` names the throwaway storage key and database. */
export async function runBrowserChecks(
  win: Window = window,
  probe = DEFAULT_PROBE,
): Promise<BrowserChecks> {
  return {
    localStorage: storageWritable(() => win.localStorage, probe),
    sessionStorage: storageWritable(() => win.sessionStorage, probe),
    cookies: win.navigator.cookieEnabled,
    indexedDb: await probeIndexedDb(win.indexedDB, INDEXED_DB_PROBE_TIMEOUT_MS, probe),
    randomUuid: typeof win.crypto?.randomUUID === 'function',
    online: win.navigator.onLine,
    userAgent: win.navigator.userAgent,
  };
}

const yesNo = (b: boolean) => (b ? 'yes' : 'NO');

/** The checks as report lines, `Label: value`, a failing check in capitals so it stands out. */
export function formatBrowserChecks(c: BrowserChecks): string[] {
  return [
    `Browser: ${c.userAgent}`,
    `Online: ${yesNo(c.online)}`,
    `Local storage writable: ${yesNo(c.localStorage)}`,
    `Session storage writable: ${yesNo(c.sessionStorage)}`,
    `Cookies enabled: ${yesNo(c.cookies)}`,
    `IndexedDB: ${c.indexedDb === 'ok' ? 'ok' : c.indexedDb.toUpperCase()}`,
    `crypto.randomUUID: ${c.randomUuid ? 'yes' : 'NO (out-of-date browser)'}`,
  ];
}
