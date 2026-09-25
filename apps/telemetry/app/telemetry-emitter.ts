// Anonymous, first-party telemetry emitter for the dashboard (spec/22,
// spec/150). Its ONLY event is the page view of the dashboard itself. Same
// policy as the help centre: the build-time NEXT_PUBLIC_TELEMETRY_ENABLED
// gate plus the spec/20 opt-out shared across the origin.

import { createLazyTrack } from '@livediagram/telemetry-client';

export const track = createLazyTrack({
  apiBase: process.env.NEXT_PUBLIC_API_BASE ?? '/api',
  enabled: process.env.NEXT_PUBLIC_TELEMETRY_ENABLED === 'true',
});
