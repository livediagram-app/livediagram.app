// Per-user editor preference flags. See spec/20.
//
// Storage:
//   - D1 (`user_preferences` table) is the authoritative store, fetched
//     once at editor mount via fetchUserPreferences() so a signed-in
//     user's flags follow them across devices.
//   - `localStorage` under `livediagram:user-preferences:v1` is a warm
//     cache so the editor never blocks on the network at boot. Reads
//     are synchronous; writes go to BOTH localStorage and the api
//     (fire-and-forget PUT). Last-write-wins per device.
//
// Cross-tab consistency: callers can listen for the native `storage`
// event on STORAGE_KEY. Same-tab writes also fire a window event
// `livediagram:preferences-changed` so listeners that can't observe
// their own `localStorage.setItem` (like `lib/telemetry.ts`'s
// in-memory gate cache) still refresh promptly.

import { apiGetPreferences, apiPutPreferences } from './api-client';
import { readLocalStorageSafe, writeLocalStorageSafe } from './local-storage-safe';

export type UserPreferences = {
  // When `false`, the editor skips the auto arrow-rebind pass on
  // move (spec/19's `rebindArrowAnchorsAfterMove` in
  // packages/diagram). Missing / undefined === auto-rebind on.
  autoRebindArrows?: boolean;
  // When `false`, `track()` in lib/telemetry is a no-op (the user
  // opted out of analytics). Distinct from the build-time
  // NEXT_PUBLIC_TELEMETRY_ENABLED gate and the api worker's
  // TELEMETRY_ENABLED gate. Missing / undefined === on.
  telemetryEnabled?: boolean;
  // Pencil tool's shape-recognition toggle (spec/09 Pencil
  // subsection). When `true`, every freehand commit while the
  // pencil banner is up runs the polyline through recogniseShape
  // and may mint a primitive instead of a FreehandElement. The
  // toggle ALSO lives in the pencil ModeBanner as an icon button:
  // flipping it from the banner writes here so the preference
  // survives across sessions, but the flag is deliberately NOT
  // surfaced in the Settings dialog (Settings is for global
  // editor behaviour; this is a per-tool toggle that belongs
  // where the tool is). Missing / undefined / false === raw-
  // sketch mode, the historical default.
  recogniseShapes?: boolean;
  // AI Assistance panel (spec/25). When `true`, the AI panel is
  // rendered in the editor. Defaults to false (opt-in). Only
  // surfaced in Settings when the api worker reports aiEnabled:true
  // (i.e. OPENAI_API_KEY is configured). Missing / undefined / false
  // === panel hidden.
  aiAssistanceEnabled?: boolean;
  // Minimal panel layout (spec/09). When `true`, the floating panels
  // (Explorer, Palette, Editor, AI) are replaced by a compact button
  // row that opens each panel as a popover on click. Always active on
  // mobile regardless of this setting. Missing / undefined / false ===
  // standard floating panels on desktop.
  minimalPanels?: boolean;
  // Alignment guides (spec/09). When `false`, the editor skips the
  // faint guide lines drawn along the edges / centres a dragged or
  // resized element shares with its neighbours (the snap itself is
  // unaffected; only the visual hint is suppressed). Missing /
  // undefined === guides on, the default.
  alignmentGuides?: boolean;
  // Reduce motion (accessibility, spec/20). When `true`, the editor adds
  // `.reduce-motion` to <html> so the CSS in globals.css collapses every
  // decorative animation + transition to ~instant. Independent of the OS
  // `prefers-reduced-motion` media query (which is always honoured): this
  // lets a user force the calm UI even when their OS setting is off, and
  // syncs across their devices. Missing / undefined / false === full
  // motion (subject to the OS setting), the default.
  reduceMotion?: boolean;
};

export const STORAGE_KEY = 'livediagram:user-preferences:v1';
export const PREFERENCES_CHANGED_EVENT = 'livediagram:preferences-changed';

// Read the current preferences from localStorage. Returns `{}` on
// missing key, an SSR / private-window environment without
// `localStorage`, or a parse error (corrupted JSON). Synchronous so
// the editor can use it during render; the network fetch via
// fetchUserPreferences happens separately at mount and merges its
// result back into the cache when it arrives.
export function readUserPreferences(): UserPreferences {
  const raw = readLocalStorageSafe(STORAGE_KEY);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== 'object' || parsed === null) return {};
    // Keep unknown keys: forward-compat for future-versioned flags
    // a different client may have written.
    return parsed as UserPreferences;
  } catch {
    return {};
  }
}

// Write preferences back. Best-effort: a quota / private-window
// failure is swallowed (the dialog state still applies in-memory
// for the session; the user just loses the persistence). The
// network sync to D1 is fire-and-forget when `ownerId` is supplied:
// the cache write happens synchronously so the UI updates without
// waiting, and the PUT runs in the background. Callers without an
// ownerId (e.g. unit tests, the editor before identity resolves)
// skip the network step. On success a same-tab
// `livediagram:preferences-changed` event fires so in-process
// listeners refresh without polling. The browser handles cross-tab
// via its native `storage` event.
export function writeUserPreferences(prefs: UserPreferences, ownerId?: string | null): void {
  writeLocalStorageSafe(STORAGE_KEY, JSON.stringify(prefs));
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(PREFERENCES_CHANGED_EVENT));
  }
  if (ownerId) {
    // Cast to the wider Record shape the api-client expects.
    // UserPreferences is the typed surface in this app; the wire
    // is intentionally opaque so adding a flag doesn't need an
    // api-schema bump.
    void apiPutPreferences(ownerId, prefs as Record<string, unknown>);
  }
}

// Fetch preferences from D1, merge over the localStorage cache, and
// dispatch `livediagram:preferences-changed` so in-process listeners
// pick up the merged value. Returns the merged preferences (or null
// when the fetch failed; the caller can treat that as "stick with
// the cache"). Called once at editor mount per spec/20's sync flow.
//
// Server-wins on conflict: the server holds the most-recently-saved
// state across all of this owner's devices, so any key present on
// both sides takes the server's value. Keys only in the cache (a
// PUT that hasn't reached the server yet, or a write made offline)
// are preserved by the spread order below.
export async function fetchUserPreferences(ownerId: string): Promise<UserPreferences | null> {
  const remote = await apiGetPreferences(ownerId);
  if (remote === null) return null;
  const local = readUserPreferences();
  const merged: UserPreferences = { ...local, ...(remote as UserPreferences) };
  writeLocalStorageSafe(STORAGE_KEY, JSON.stringify(merged));
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(PREFERENCES_CHANGED_EVENT));
  }
  return merged;
}
