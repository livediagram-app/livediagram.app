// Anonymous, first-party product telemetry emitter (spec/22).
//
// The buffering / flush / page-hide engine lives in
// @livediagram/telemetry-client (shared with the help centre); this
// wrapper owns the editor's policy: the build-time
// NEXT_PUBLIC_TELEMETRY_ENABLED gate and the cached spec/20 per-user
// opt-out. See the package for the privacy rules — `type` is always a
// closed-vocabulary token, never user content.

import { createTelemetryEmitter, type TelemetryEmitter } from '@livediagram/telemetry-client';
import { API_BASE } from './api-client';
import {
  PREFERENCES_CHANGED_EVENT,
  readUserPreferences,
  STORAGE_KEY as PREFS_STORAGE_KEY,
} from './user-preferences';

const ENABLED = process.env.NEXT_PUBLIC_TELEMETRY_ENABLED === 'true';

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
  // Guarded: track() re-consults this after every cache invalidation,
  // and without the flag each call stacked a fresh listener pair for
  // the life of the page.
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

// Constructed lazily on the first track(): this module sits inside an
// import cycle (user-preferences -> api-client barrel), so reading
// API_BASE at module scope hit the TDZ during Next's build. Deferring
// to first use restores the old read-at-flush-time semantics.
let emitter: TelemetryEmitter | null = null;

export const track: TelemetryEmitter['track'] = (category, action, type) => {
  emitter ??= createTelemetryEmitter({
    apiBase: API_BASE,
    enabled: ENABLED,
    isOptedIn: () => {
      if (cachedOptIn === null) {
        cachedOptIn = readOptIn();
        ensurePreferenceListeners();
      }
      return cachedOptIn;
    },
  });
  emitter.track(category, action, type);
};

// Title-cases an app enum value for the `type` field so the dashboard
// reads "Square" rather than "square". Safe for ASCII enum tokens
// (shape kinds, formats); leaves the rest untouched.
export function titleCaseType(value: string): string {
  return value.length === 0 ? value : value[0]!.toUpperCase() + value.slice(1);
}
