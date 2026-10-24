'use client';

import { useMemo, type ReactNode } from 'react';
import { HelpClientProvider, type HelpClient } from '@liveworkspace/help-site/client';
import type { HelpFacts } from '@liveworkspace/help-site/site';
import { helpPathTelemetryId } from '@liveplanner/help-registry/telemetry';
import { installClientErrorTracking, siteTrack } from '@liveplanner/telemetry-client';

// The browser half of the help centre's binding (lib/help-site.tsx is the server half), mounted once by the root
// layout. The help centre reports through the public sites' shared siteTrack (docs/specs/017-telemetry/telemetry.md),
// the instance PageViewBoot reports page views through, so help runs one buffer; `type` is always a bounded
// reference token (an article id), never user content. Window-level errors go to the 'Error' category through
// installClientErrorTracking (generic kind tokens only, capped per kind per page load).

// The article registry, with its descriptions and keywords, loads on the reader's first search only.
const loadSearch = () => import('./articles').then((m) => m.searchArticles);
const installErrorTracking = () => installClientErrorTracking(siteTrack);

export function HelpProvider({ facts, children }: { facts: HelpFacts; children: ReactNode }) {
  const value = useMemo<HelpClient>(
    () => ({ facts, track: siteTrack, helpPathTelemetryId, loadSearch }),
    [facts],
  );
  return (
    <HelpClientProvider value={value} installErrorTracking={installErrorTracking}>
      {children}
    </HelpClientProvider>
  );
}
