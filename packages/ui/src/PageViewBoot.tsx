'use client';

import { siteTrack } from '@livediagram/telemetry-client';
import { PageViewTracker } from './PageViewTracker';

// Page view telemetry (spec/150) for the public sites (marketing, the help
// centre, the dashboard): the shared tracker wired to the shared siteTrack().
// A client component that owns its track() because a server layout can't pass
// a function to a client component; each root layout just mounts
// <PageViewBoot />. Page views are all it reports: the dashboard and marketing
// emit nothing else (spec/150), and help's article / error events go through
// the same siteTrack from its own call sites. The editor mounts
// PageViewTracker with its own emitter instead (apps/live PageViewBoot).
export function PageViewBoot() {
  return <PageViewTracker track={siteTrack} />;
}
