// Anonymous, first-party telemetry emitter for the help centre (spec/22).
//
// The buffering / flush / page-hide engine lives in
// @livediagram/telemetry-client (shared with the editor); this wrapper
// owns the help centre's policy: the build-time
// NEXT_PUBLIC_TELEMETRY_ENABLED gate and honouring the editor's
// per-user opt-out (spec/20) — the help centre shares the
// livediagram.app origin, so a visitor who turned telemetry off in the
// editor is respected here too. `type` is ALWAYS a bounded reference
// token (the article slug, or a page path for a page view, spec/150),
// never user-generated content.

import { createLazyTrack } from '@livediagram/telemetry-client';

export const track = createLazyTrack({
  apiBase: process.env.NEXT_PUBLIC_API_BASE ?? '/api',
  enabled: process.env.NEXT_PUBLIC_TELEMETRY_ENABLED === 'true',
});
