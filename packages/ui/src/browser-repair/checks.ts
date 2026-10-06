// The browser checks (docs/specs/007-editor/load-recovery.md "Diagnostics"): the platform features the
// editor's load leans on, each answered yes / no, for the diagnostics report support reads. Run on
// demand (a button press, the Repair page opening), never on the editor's own load.

/** How long the IndexedDB probe waits for `open` to settle: the offline store's own limit. */
export const INDEXED_DB_PROBE_TIMEOUT_MS = 4_000;

/** The database the probe opens: its own throwaway one, so it never upgrades or blocks the offline store. */
const PROBE_DB = 'livediagram-probe';

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

function storageWritable(get: () => Storage): boolean {
  try {
    const s = get();
    const k = 'livediagram-probe';
    s.setItem(k, '1');
    s.removeItem(k);
    return true;
  } catch {
    return false;
  }
}

/** Open (and delete) a throwaway database, bounded by `timeoutMs`. */
export function probeIndexedDb(
  idb: IDBFactory | undefined = typeof indexedDB === 'undefined' ? undefined : indexedDB,
  timeoutMs = INDEXED_DB_PROBE_TIMEOUT_MS,
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
      req = idb.open(PROBE_DB);
    } catch {
      done('error');
      return;
    }
    req.onsuccess = () => {
      req.result.close();
      try {
        idb.deleteDatabase(PROBE_DB);
      } catch {
        // The probe answered; a leftover empty database is harmless.
      }
      done('ok');
    };
    req.onerror = () => done('error');
    req.onblocked = () => done('blocked');
  });
}

/** Every check, in one go. */
export async function runBrowserChecks(win: Window = window): Promise<BrowserChecks> {
  return {
    localStorage: storageWritable(() => win.localStorage),
    sessionStorage: storageWritable(() => win.sessionStorage),
    cookies: win.navigator.cookieEnabled,
    indexedDb: await probeIndexedDb(win.indexedDB),
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
