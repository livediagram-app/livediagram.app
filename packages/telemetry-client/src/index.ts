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
// directly — so the policy stays app-owned and the plumbing shared.

import type { TelemetryAction, TelemetryCategory, TelemetryEvent } from '@livediagram/api-schema';

const FLUSH_DELAY_MS = 10_000;
const MAX_BUFFER = 25;

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
  let flushTimer: ReturnType<typeof setTimeout> | null = null;
  let listenersAttached = false;

  function flush(useBeacon = false): void {
    if (buffer.length === 0) return;
    const events = buffer;
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
        navigator.sendBeacon(url, new Blob([body], { type: 'application/json' }));
        return;
      }
      // `keepalive` lets the POST outlive a navigation the same way a
      // beacon would, for the timer-driven flush path.
      void fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        keepalive: true,
      }).catch(() => {});
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
    if (flushTimer === null) {
      flushTimer = setTimeout(() => {
        flushTimer = null;
        flush();
      }, FLUSH_DELAY_MS);
    }
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
