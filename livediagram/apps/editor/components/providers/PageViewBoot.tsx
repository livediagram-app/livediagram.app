'use client';

import { PageViewTracker } from '@livediagram/ui';
import { track } from '@/lib/telemetry';

// Page view telemetry (docs/specs/017-telemetry/page-view-telemetry.md): hands the shared tracker the editor's
// policy-wrapped track(). A client adapter because a server layout can't pass
// a function to a client component. Mounted once from the root layout. The
// public sites mount @livediagram/ui's PageViewBoot instead, which is wired
// to their shared siteTrack(); the editor keeps its own emitter (cached
// opt-out, configured api base), hence its own adapter.
export function PageViewBoot() {
  return <PageViewTracker track={track} />;
}
