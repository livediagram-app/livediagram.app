// Anonymous, first-party telemetry emitter for the help centre (spec/22).
//
// Mirrors the editor's emitter (apps/live/lib/telemetry.ts): three-field
// {category, action, type} events batched to POST /api/events on a short
// timer and on page-hide (sendBeacon). Strictly fire-and-forget so it can
// never affect the page. The help centre is the second app (besides the
// editor) that emits; both share the same closed vocabulary + ingest.
//
// Privacy (spec/22): only the closed {category, action, type} vocabulary
// leaves the browser, and `type` is ALWAYS a bounded reference token (the
// article slug), never user-generated content. No identity is sent.
//
// Gated by NEXT_PUBLIC_TELEMETRY_ENABLED (baked at build) so OSS forks /
// self-hosters and local dev emit nothing by default; the api worker's
// TELEMETRY_ENABLED is the authoritative gate. Also honours the editor's
// per-user opt-out (spec/20): the help centre shares the livediagram.app
// origin, so a visitor who turned telemetry off in the editor is respected
// here too.

import type { TelemetryAction, TelemetryCategory, TelemetryEvent } from '@livediagram/api-schema';

const ENABLED = process.env.NEXT_PUBLIC_TELEMETRY_ENABLED === 'true';
const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? '/api';
const FLUSH_DELAY_MS = 10_000;
const MAX_BUFFER = 25;
// The editor's per-user preferences key (apps/live/lib/user-preferences,
// spec/20). Same origin as the help centre, so the opt-out carries over.
const PREFS_KEY = 'livediagram:user-preferences:v1';

let buffer: TelemetryEvent[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let listenersAttached = false;

// Default on; opt-out only when the shared preference is explicitly false.
function optedIn(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const raw = window.localStorage.getItem(PREFS_KEY);
    if (!raw) return true;
    return (JSON.parse(raw) as { telemetryEnabled?: boolean }).telemetryEnabled !== false;
  } catch {
    return true;
  }
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
    // `keepalive` lets the POST outlive a navigation like a beacon would.
    void fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    }).catch(() => {});
  } catch {
    // Swallow - telemetry must never throw into the help centre.
  }
}

// Flush on the first hidden / unload so the tail of a visit isn't lost.
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
  if (!optedIn()) return;
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
