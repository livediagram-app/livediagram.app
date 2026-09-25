// Anonymous, first-party telemetry emitter for the marketing site
// (spec/22, spec/150). Its ONLY event is the page view: the marketing site
// reports which pages are read and nothing else. Same policy as the help
// centre: the build-time NEXT_PUBLIC_TELEMETRY_ENABLED gate plus the
// spec/20 opt-out, which this origin shares with the editor, so a visitor
// who turned telemetry off there is respected here too.

import { createLazyTrack } from '@livediagram/telemetry-client';

export const track = createLazyTrack({
  apiBase: process.env.NEXT_PUBLIC_API_BASE ?? '/api',
  enabled: process.env.NEXT_PUBLIC_TELEMETRY_ENABLED === 'true',
});
