'use client';

import { PageViewTracker } from '@livediagram/ui';
import { track } from '@/lib/telemetry';

// Page view telemetry (spec/150): hands the shared tracker the editor's
// policy-wrapped track(). A client adapter because a server layout can't pass
// a function to a client component. Mounted once from the root layout.
export function PageViewBoot() {
  return <PageViewTracker track={track} />;
}
