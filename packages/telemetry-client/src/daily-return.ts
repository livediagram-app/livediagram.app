// The once-per-UTC-day "returning visitor" gate (a product's docs/specs/017-telemetry/telemetry.md,
// `Participant·Returned`), shared by every editor and by liveworkspace's Explorer on an app's own address
// (liveworkspace/docs/specs/008-telemetry/telemetry.md "The Explorer on liveworkspace.app"). Both read and write the same
// `<app>:v2:last-active-day` key on the app's origin, so the first open of the day wins wherever it happens
// and the rest no-op: a person who lands on the Explorer and then opens a project counts once.
//
// A browser's FIRST observed day only seeds the key and reports nothing: a first visit is a new visitor
// (`Participant·Created`) or a sign-up, not a return. The key is per app, so a browser new to this app is
// new here even when it has used another one.
//
// The caller sends the event itself, with literal category and action, so each dashboard's emitter scan
// reads the call where it is. No identifier ever leaves the browser: the dedup is entirely local.

/** `YYYY-MM-DD` of `at` in UTC, matching the dashboard's `date(ts/1000,'unixepoch')` day buckets. */
const utcDay = (at: number) => new Date(at).toISOString().slice(0, 10);

function storage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

/**
 * The gate for one app: call it on every app open with whether the person is signed in; it calls `report`
 * at most once per browser per UTC day, and never on the browser's first observed day. With storage
 * unavailable (a private window) nothing can be remembered, so nothing is reported rather than a return
 * on every page load.
 */
export function createDailyReturn(opts: {
  // The app's last-active-day key (`liveplanner:v2:last-active-day`).
  storageKey: string;
  report: (authenticated: boolean) => void;
  now?: () => number;
}): (authenticated: boolean) => void {
  return (authenticated) => {
    const store = storage();
    if (!store) return;
    const today = utcDay((opts.now ?? Date.now)());
    let last: string | null;
    try {
      last = store.getItem(opts.storageKey);
      if (last === today) return;
      store.setItem(opts.storageKey, today);
    } catch {
      return;
    }
    if (last === null) return;
    opts.report(authenticated);
  };
}
