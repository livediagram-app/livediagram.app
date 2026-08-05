// The shared browser telemetry engine (spec/22), extracted from the
// duplicated emitters in apps/live and apps/help: three-field
// {category, action, type} events buffered and flushed — batched — to
// POST <apiBase>/events on a short timer and on page-hide (via
// navigator.sendBeacon). Strictly fire-and-forget: every failure is
// swallowed, because telemetry must never affect the host app.
//
// Privacy (spec/22): only the closed-vocabulary {category, action,
// type} ever leaves the browser. NEVER pass user-generated content
// (names, element text, ids, share codes) as `type` — the api worker
// also rejects anything outside the allowed vocabulary, but the rule
// starts at the call sites. No identity is sent.
//
// Each app constructs its emitter with its own build-time `enabled`
// gate (NEXT_PUBLIC_TELEMETRY_ENABLED) and its own `isOptedIn` read of
// the shared spec/20 preference — the editor caches it behind its
// preference-change events, the help centre reads localStorage
// directly — so the HOW stays app-owned and the plumbing shared. What
// they must not each decide for themselves is WHERE the opt-out is
// stored and which way it defaults; those are below.

import type { TelemetryAction, TelemetryCategory, TelemetryEvent } from '@livediagram/api-schema';

const FLUSH_DELAY_MS = 10_000;
const MAX_BUFFER = 25;

// Where the editor keeps its per-user preferences (spec/20). The help
// centre shares the livediagram.app origin, so an opt-out made in the
// editor has to be visible here — which means both apps read this exact
// string, and a copy in each is a silent privacy bug waiting to happen:
// version the key in the editor (`:v2`, an ordinary schema migration) and
// the help centre goes on reading the dead `:v1`, finds nothing, and falls
// back to its default of ON for a user who explicitly opted out.
//
// It sits in this package for want of a better shared home — the blob it
// names is broader than telemetry, but api-schema (where the /api/preferences
// DTO would belong) isn't a dependency of apps/help, and telemetry is the
// only field of it the help centre reads. If preferences ever need sharing
// beyond the opt-out, this constant should move with them.
export const USER_PREFERENCES_STORAGE_KEY = 'livediagram:user-preferences:v1';

/**
 * The spec/20 opt-out rule applied to the raw stored preferences JSON:
 * telemetry is ON unless `telemetryEnabled` is explicitly `false`. Missing
 * key, unparseable JSON and an absent field all mean on, so a corrupted blob
 * can't silently disable collection — and, more importantly, the one shape
 * that means "off" is spelled the same way in every app.
 */
export function telemetryOptInFromRaw(raw: string | null): boolean {
  if (!raw) return true;
  try {
    return (JSON.parse(raw) as { telemetryEnabled?: boolean }).telemetryEnabled !== false;
  } catch {
    return true;
  }
}

/**
 * The uncached read: pull the preferences blob straight out of localStorage
 * and apply the rule above. For a host with no preference-change plumbing of
 * its own (the help centre). Callers that read this on a hot path should
 * cache it and invalidate on `storage` events, the way the editor does.
 */
export function readTelemetryOptIn(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return telemetryOptInFromRaw(window.localStorage.getItem(USER_PREFERENCES_STORAGE_KEY));
  } catch {
    // Private-window / storage-disabled: no stored opt-out to honour.
    return true;
  }
}

export type TelemetryEmitter = {
  track: (category: TelemetryCategory, action: TelemetryAction, type?: string) => void;
};

export function createTelemetryEmitter(opts: {
  // POST target base, e.g. '/api' — events go to `${apiBase}/events`.
  apiBase: string;
  // Build-time kill switch: false makes track() a permanent no-op.
  enabled: boolean;
  // Per-user opt-out (spec/20), consulted on every track() call. The
  // caller owns caching / invalidation if the read is hot.
  isOptedIn: () => boolean;
}): TelemetryEmitter {
  const { apiBase, enabled, isOptedIn } = opts;

  let buffer: TelemetryEvent[] = [];
  // Events from exactly one failed flush, waiting for one more attempt.
  // Kept separate from `buffer` so "has this already been retried?" is a
  // property of which list an event is in, rather than a flag we'd have to
  // carry on the wire or track by index (spec/22).
  let retryBuffer: TelemetryEvent[] = [];
  let flushTimer: ReturnType<typeof setTimeout> | null = null;
  let listenersAttached = false;

  function armTimer(): void {
    if (flushTimer !== null) return;
    flushTimer = setTimeout(() => {
      flushTimer = null;
      flush();
    }, FLUSH_DELAY_MS);
  }

  // A network-level failure means the request never got a response, so the
  // events almost certainly didn't land — worth one more attempt. Retried
  // events go to the FRONT of the next batch so the wire order still
  // matches the order they happened in.
  //
  // Deliberately one attempt and no more. A retry trades a small chance of
  // over-counting (the request reached the server and only the response was
  // lost) against a systematic under-count, and that trade is only worth
  // making once: an endlessly retried batch on a dead network would grow
  // the buffer, duplicate on every recovery, and still be lost at unload.
  function requeue(events: TelemetryEvent[], alreadyRetried: number): void {
    // Drop the portion that had already used its one retry.
    const fresh = events.slice(alreadyRetried);
    if (fresh.length === 0) return;
    // Bound it exactly like the live buffer. On overflow the OLDEST go,
    // because they're the ones that have already had their chance and the
    // newest events are the ones still worth reporting.
    retryBuffer = [...retryBuffer, ...fresh].slice(-MAX_BUFFER);
    // Nothing else may be scheduled (a failure with an idle buffer arms no
    // timer), so make sure the retry actually gets a moment to happen.
    armTimer();
  }

  function flush(useBeacon = false): void {
    if (buffer.length === 0 && retryBuffer.length === 0) return;
    const retriedCount = retryBuffer.length;
    const events = [...retryBuffer, ...buffer];
    retryBuffer = [];
    buffer = [];
    if (flushTimer !== null) {
      clearTimeout(flushTimer);
      flushTimer = null;
    }
    const url = `${apiBase}/events`;
    const body = JSON.stringify({ events });
    try {
      if (
        useBeacon &&
        typeof navigator !== 'undefined' &&
        typeof navigator.sendBeacon === 'function'
      ) {
        // sendBeacon returns false when the UA's queue is full, and that
        // batch is simply gone. It used to be ignored; fall through to the
        // keepalive fetch instead, which is the same "outlive the page"
        // guarantee by another route. No requeue on this path either way —
        // we're unloading, so there's no later to retry in.
        if (navigator.sendBeacon(url, new Blob([body], { type: 'application/json' }))) return;
      }
      // `keepalive` lets the POST outlive a navigation the same way a
      // beacon would, for the timer-driven flush path.
      void fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        keepalive: true,
      }).catch(() => {
        // Only on a REJECTION — a network failure, where the request never
        // got a response. A non-2xx is deliberately not retried: the server
        // answered, so re-sending risks duplicating something it already
        // stored, and a 429 would only make the thing it's complaining
        // about worse.
        if (!useBeacon) requeue(events, retriedCount);
      });
    } catch {
      // Swallow — telemetry can never throw into the host app.
    }
  }

  // Flush on the first hidden/unload so the tail of a session isn't lost.
  function ensureListeners(): void {
    if (listenersAttached || typeof document === 'undefined') return;
    listenersAttached = true;
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') flush(true);
    });
    window.addEventListener('pagehide', () => flush(true));
  }

  function track(category: TelemetryCategory, action: TelemetryAction, type?: string): void {
    if (!enabled || typeof window === 'undefined') return;
    if (!isOptedIn()) return;
    buffer.push({ category, action, type: type ?? null });
    ensureListeners();
    if (buffer.length >= MAX_BUFFER) {
      flush();
      return;
    }
    armTimer();
  }

  return { track };
}

// ---------------------------------------------------------------------
// Client error tracking (spec/22 'Error' category)
// ---------------------------------------------------------------------
//
// Window-level uncaught exceptions + unhandled promise rejections,
// counted GENERICALLY: only the fixed kind token is emitted — never the
// message, stack, or URL. Capped per kind per page load so a render /
// retry loop that throws every frame can't flood the pipeline (the
// count signal saturates at the cap; the dashboard reads presence +
// order of magnitude, not exact storm size). Shared by the editor and
// the help centre; each passes its own policy-wrapped track().

const ERROR_EMIT_CAP_PER_KIND = 10;

let errorTrackingInstalled = false;

export function installClientErrorTracking(
  track: (category: 'Error', action: 'Client', type: string) => void,
): void {
  if (errorTrackingInstalled || typeof window === 'undefined') return;
  errorTrackingInstalled = true;
  const emitted: Record<string, number> = {};
  const emit = (kind: 'Uncaught' | 'UnhandledRejection') => {
    const n = emitted[kind] ?? 0;
    if (n >= ERROR_EMIT_CAP_PER_KIND) return;
    emitted[kind] = n + 1;
    try {
      track('Error', 'Client', kind);
    } catch {
      // Telemetry must never throw into the host app's error path —
      // doubly so here, where we ARE the error path.
    }
  };
  // Bubble-phase 'error' on window sees uncaught JS exceptions only
  // (resource-load errors don't bubble), which is exactly the scope.
  window.addEventListener('error', () => emit('Uncaught'));
  window.addEventListener('unhandledrejection', () => emit('UnhandledRejection'));
}
