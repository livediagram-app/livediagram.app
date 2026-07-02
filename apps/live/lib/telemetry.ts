// Anonymous, first-party product telemetry emitter (spec/22).
//
// `track(category, action, type?)` records a three-field event into a
// buffer that flushes — batched — to `POST /api/events` on a short
// timer and on page-hide (via `navigator.sendBeacon`). It is strictly
// fire-and-forget: every failure is swallowed, because telemetry must
// never affect the editor.
//
// Privacy (spec/22): only the closed-vocabulary {category, action,
// type} ever leaves the browser. NEVER pass user-generated content
// (diagram/tab/participant names, element text, ids, share codes) as
// `type` — the api worker also rejects anything outside the allowed
// vocabulary, but the rule starts here. No owner id is sent either:
// the ingest endpoint stores nothing identifying.
//
// Gated by NEXT_PUBLIC_TELEMETRY_ENABLED (baked at build): when it
// isn't "true", `track()` is a no-op and nothing is sent, so OSS forks
// / self-hosters and local dev emit nothing by default. The api
// worker's TELEMETRY_ENABLED is the authoritative gate; this is the
// client-side optimisation that avoids the request entirely.

import type { TelemetryAction, TelemetryCategory, TelemetryEvent } from '@livediagram/api-schema';
import { API_BASE } from './api-client';
import {
  PREFERENCES_CHANGED_EVENT,
  readUserPreferences,
  STORAGE_KEY as PREFS_STORAGE_KEY,
} from './user-preferences';

const ENABLED = process.env.NEXT_PUBLIC_TELEMETRY_ENABLED === 'true';
const FLUSH_DELAY_MS = 10_000;
const MAX_BUFFER = 25;

let buffer: TelemetryEvent[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let listenersAttached = false;
let preferenceListenersAttached = false;

// User-preference opt-out (spec/20). Cached so the hot path doesn't
// hit localStorage on every track() call (some events fire in bursts:
// undo/redo, zoom). Invalidated by the same-tab
// `livediagram:preferences-changed` event the writer dispatches, or
// by the browser's native `storage` event for cross-tab updates.
// `null` means "not yet read; consult localStorage on next track".
let cachedOptIn: boolean | null = null;

function readOptIn(): boolean {
  if (typeof window === 'undefined') return false;
  // Missing / undefined `telemetryEnabled` === true (default on).
  return readUserPreferences().telemetryEnabled !== false;
}

function ensurePreferenceListeners(): void {
  // Guard like ensureListeners: track() re-calls this after every cache
  // invalidation, and without the flag each call stacked a fresh
  // listener pair for the life of the page.
  if (preferenceListenersAttached || typeof window === 'undefined') return;
  preferenceListenersAttached = true;
  const invalidate = () => {
    cachedOptIn = null;
  };
  window.addEventListener(PREFERENCES_CHANGED_EVENT, invalidate);
  window.addEventListener('storage', (e) => {
    if (e.key === PREFS_STORAGE_KEY) invalidate();
  });
}

function flush(useBeacon = false): void {
  if (buffer.length === 0) return;
  const events = buffer;
  buffer = [];
  if (flushTimer !== null) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  const url = `${API_BASE}/events`;
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
    // Swallow — telemetry can never throw into the editor.
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

export function track(category: TelemetryCategory, action: TelemetryAction, type?: string): void {
  if (!ENABLED || typeof window === 'undefined') return;
  if (cachedOptIn === null) {
    cachedOptIn = readOptIn();
    ensurePreferenceListeners();
  }
  if (!cachedOptIn) return;
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

// Title-cases an app enum value for the `type` field so the dashboard
// reads "Square" rather than "square". Safe for ASCII enum tokens
// (shape kinds, formats); leaves the rest untouched.
export function titleCaseType(value: string): string {
  return value.length === 0 ? value : value[0]!.toUpperCase() + value.slice(1);
}
