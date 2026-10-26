// The browser's batching emitter (liveworkspace/docs/specs/008-telemetry/telemetry.md "Sending events"), one engine for
// every sender: each app's `@<app>/telemetry-client` wraps it with its own vocabulary's types, and
// liveworkspace.app's Explorer uses it as it is. Three-field events are buffered and flushed, batched,
// to the central service (POST <url>/events) on a short timer and on page hide (by
// navigator.sendBeacon). A flush sends one batch per app its events speak for, so a page whose events
// count for several apps (the Explorer, filtered to one app or All) still sends one request per app at
// most every 10 seconds, never one per event.
//
// Strictly fire-and-forget: every failure is swallowed, because telemetry must never affect the page.
// Only the closed-vocabulary {category, action, type} ever leaves the browser; never pass anything a
// person wrote (names, element text, ids, share codes) as `type`. No identity is sent.

import type { TelemetrySender } from './apps';
import { TELEMETRY_EVENTS_PATH, type TelemetryWireEvent } from './wire';

export const TELEMETRY_FLUSH_DELAY_MS = 10_000;
// The most events held between flushes; reaching it flushes at once.
export const TELEMETRY_MAX_BUFFER = 25;

type Held = { app: TelemetrySender; event: TelemetryWireEvent };

export type TelemetryEngine = {
  /** One event for `app`. A no-op when the build turned telemetry off or the person opted out. */
  track: (app: TelemetrySender, category: string, action: string, type?: string | null) => void;
};

export function createTelemetryEngine(opts: {
  // The central service's URL, e.g. 'https://www.liveworkspace.app/api/telemetry'; batches go to
  // `${url}/events`.
  url: string;
  // Build-time kill switch: false makes track() a permanent no-op.
  enabled: boolean;
  // The person's opt-out, consulted on every track() call. The caller owns caching it if the read is
  // hot.
  isOptedIn: () => boolean;
}): TelemetryEngine {
  const { url: serviceUrl, enabled, isOptedIn } = opts;

  let buffer: Held[] = [];
  // Events from exactly one failed flush, waiting for one more attempt. Kept apart from `buffer` so
  // "has this already been retried?" is a matter of which list an event is in.
  let retryBuffer: Held[] = [];
  let flushTimer: ReturnType<typeof setTimeout> | null = null;
  let listenersAttached = false;
  let hiddenFlushQueued = false;

  function armTimer(): void {
    if (flushTimer !== null) return;
    flushTimer = setTimeout(() => {
      flushTimer = null;
      flush();
    }, TELEMETRY_FLUSH_DELAY_MS);
  }

  // A network failure means the request never got an answer, so the events almost certainly didn't
  // land: worth one more attempt, at the front of the next batch so the order still matches. One
  // attempt and no more: an endlessly retried batch on a dead network would grow, duplicate on every
  // recovery, and still be lost at unload.
  function requeue(events: Held[]): void {
    if (events.length === 0) return;
    // Bounded like the live buffer: on overflow the oldest go.
    retryBuffer = [...retryBuffer, ...events].slice(-TELEMETRY_MAX_BUFFER);
    armTimer();
  }

  function send(app: TelemetrySender, held: Held[], fresh: Held[], useBeacon: boolean): void {
    const url = `${serviceUrl}${TELEMETRY_EVENTS_PATH}`;
    const body = JSON.stringify({ app, events: held.map((h) => h.event) });
    try {
      if (
        useBeacon &&
        typeof navigator !== 'undefined' &&
        typeof navigator.sendBeacon === 'function'
      ) {
        // A full beacon queue (false) or a throwing beacon falls through to the keepalive fetch, the
        // same "outlive the page" promise by another route. text/plain keeps a cross-site beacon a
        // CORS simple request: no preflight.
        try {
          if (navigator.sendBeacon(url, new Blob([body], { type: 'text/plain' }))) return;
        } catch {
          // Fall through to the keepalive fetch.
        }
      }
      // text/plain and no credentials: a simple request with no preflight and no cookies.
      void fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body,
        keepalive: true,
        credentials: 'omit',
      }).catch(() => {
        // Only on a rejection, where the request never got an answer. A non-2xx is not retried: the
        // service answered, so a resend risks counting twice. Nothing is retried while unloading.
        if (!useBeacon) requeue(fresh);
      });
    } catch {
      // Telemetry never throws into the page.
    }
  }

  function flush(useBeacon = false): void {
    if (buffer.length === 0 && retryBuffer.length === 0) return;
    const retried = new Set(retryBuffer);
    const all = [...retryBuffer, ...buffer];
    retryBuffer = [];
    buffer = [];
    if (flushTimer !== null) {
      clearTimeout(flushTimer);
      flushTimer = null;
    }
    // One batch per app, in the order each app first appears.
    const byApp = new Map<TelemetrySender, Held[]>();
    for (const held of all) {
      const list = byApp.get(held.app);
      if (list) list.push(held);
      else byApp.set(held.app, [held]);
    }
    for (const [app, held] of byApp) {
      send(
        app,
        held,
        held.filter((h) => !retried.has(h)),
        useBeacon,
      );
    }
  }

  // Flush on the first hide or unload, so the tail of a visit isn't lost.
  function ensureListeners(): void {
    if (listenersAttached || typeof document === 'undefined') return;
    listenersAttached = true;
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') flush(true);
    });
    window.addEventListener('pagehide', () => flush(true));
  }

  function track(
    app: TelemetrySender,
    category: string,
    action: string,
    type?: string | null,
  ): void {
    if (!enabled || typeof window === 'undefined') return;
    if (!isOptedIn()) return;
    buffer.push({ app, event: { category, action, type: type ?? null } });
    ensureListeners();
    // Tracked while the page is hidden: the hide flush has already run and the page may never come
    // back, so send by beacon at the end of this task. A burst (the Web Vitals that finalise on hide)
    // goes as one beacon, not one each.
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
      if (!hiddenFlushQueued) {
        hiddenFlushQueued = true;
        queueMicrotask(() => {
          hiddenFlushQueued = false;
          flush(true);
        });
      }
      return;
    }
    if (buffer.length >= TELEMETRY_MAX_BUFFER) {
      flush();
      return;
    }
    armTimer();
  }

  return { track };
}
