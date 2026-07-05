// Anonymous, first-party telemetry emitter for the help centre (spec/22).
//
// The buffering / flush / page-hide engine lives in
// @livediagram/telemetry-client (shared with the editor); this wrapper
// owns the help centre's policy: the build-time
// NEXT_PUBLIC_TELEMETRY_ENABLED gate and honouring the editor's
// per-user opt-out (spec/20) — the help centre shares the
// livediagram.app origin, so a visitor who turned telemetry off in the
// editor is respected here too. `type` is ALWAYS a bounded reference
// token (the article slug), never user-generated content.

import { createTelemetryEmitter, type TelemetryEmitter } from '@livediagram/telemetry-client';

const ENABLED = process.env.NEXT_PUBLIC_TELEMETRY_ENABLED === 'true';
const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? '/api';
// The editor's per-user preferences key (apps/live/lib/user-preferences,
// spec/20). Same origin as the help centre, so the opt-out carries over.
const PREFS_KEY = 'livediagram:user-preferences:v1';

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

// Lazy for symmetry with the editor wrapper (which sits inside an
// import cycle); here it simply defers work until the first event.
let emitter: TelemetryEmitter | null = null;

export const track: TelemetryEmitter['track'] = (category, action, type) => {
  emitter ??= createTelemetryEmitter({ apiBase: API_BASE, enabled: ENABLED, isOptedIn: optedIn });
  emitter.track(category, action, type);
};
