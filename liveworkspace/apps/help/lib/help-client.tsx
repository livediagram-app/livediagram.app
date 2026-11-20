'use client';

import { useMemo, type ReactNode } from 'react';
import { HelpClientProvider, type HelpClient } from '@liveworkspace/help-site/client';
import type { HelpFacts } from '@liveworkspace/help-site/site';
import { rankArticles, type SearchEntry } from '@liveworkspace/help-registry/registry';
import { helpPathTelemetryId, helpTrack, installErrorTracking } from './bindings.generated';

// The browser half of the help centre's binding (lib/help-site.tsx is the server half), mounted once by the root
// layout. Help reports through the scope's track (lib/bindings/<scope>): an app's own siteTrack on the app's address,
// the one PageViewBoot reports through, or liveworkspace.app's under All Apps. The batch's app is the scope; `type` is
// always a bounded token (an article id, a search outcome, `Scope.<scope>`), never user content.

// The search indexes (app/search-index.json, app/search-all.json), static files the build writes: the scope's own on
// the reader's first search, every app's only when an app's "From Other Apps" group is wanted. A page ships neither.
// The basePath is the help centre's `/help` (withHelpSite).
const fetchSearch = (file: string) => async () => {
  const res = await fetch(`/help/${file}`);
  if (!res.ok) throw new Error(`[help-search] ${file}: ${res.status}`);
  const index = (await res.json()) as SearchEntry[];
  return (query: string) => rankArticles(index, query);
};
const loadSearch = fetchSearch('search-index.json');
const loadSearchAll = fetchSearch('search-all.json');
const install = () => installErrorTracking(helpTrack);

export function HelpProvider({ facts, children }: { facts: HelpFacts; children: ReactNode }) {
  const value = useMemo<HelpClient>(
    () => ({
      facts,
      track: helpTrack,
      helpPathTelemetryId,
      loadSearch,
      ...(facts.scope !== 'all' && { loadSearchAll }),
    }),
    [facts],
  );
  return (
    <HelpClientProvider value={value} installErrorTracking={install}>
      {children}
    </HelpClientProvider>
  );
}
