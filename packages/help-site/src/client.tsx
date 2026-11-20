'use client';

import type { SearchEntry } from '@liveworkspace/help-registry';
import { createContext, useContext, useEffect, type ReactNode } from 'react';
import type { HelpFacts } from './types';

// The product's half of the help centre's browser code (README.md "Client"). The client components here
// (the article shell, the search box, the vote) need three things only the product has: its telemetry
// `track`, its article telemetry ids, and a way to load its catalogue's search. Functions cannot cross from a
// server component to a client one, so the app's root layout mounts its own small client provider once,
// around every page, and these components read what it hands over. Each of the three was already on every
// page (the page-view boot, the header's search box), so the provider ships nothing a page did not have.

/** The telemetry events the help centre's components send, through the product's siteTrack. `Changed` is the app
 *  switch's move to another scope (`Scope.<scope>`, liveworkspace/docs/specs/017-help/blueprints/help-centre.md
 *  "Telemetry"). */
export type HelpTrack = (
  category: 'Help',
  action: 'View' | 'Searched' | 'Helpful' | 'Unhelpful' | 'Changed',
  type?: string,
) => void;

/** A search over an index of articles, best match first (the registry's rankArticles). */
export type HelpSearch = (query: string) => SearchEntry[];

export interface HelpClient {
  facts: HelpFacts;
  track: HelpTrack;
  /** The product's article telemetry id for a help path (its help-registry's helpPathTelemetryId). */
  helpPathTelemetryId: (path: string) => string;
  /** Loads the scope's search on first use: its own articles only (every article under All Apps), since the
   *  catalogue is too big for every page's JavaScript. */
  loadSearch: () => Promise<HelpSearch>;
  /** Loads the search over every app's articles, for an app's "From Other Apps" group: fetched only once the
   *  scope's results show (liveworkspace/docs/specs/017-help/help-centre.md "Search"). Absent under All Apps, whose
   *  own search is already every article. */
  loadSearchAll?: () => Promise<HelpSearch>;
}

const HelpClientContext = createContext<HelpClient | null>(null);

export function useHelpClient(): HelpClient {
  const client = useContext(HelpClientContext);
  if (!client)
    throw new Error('A help component rendered outside HelpClientProvider (app/layout.tsx).');
  return client;
}

/**
 * The provider every help app's root layout wraps its body in. `installErrorTracking` wires window-level
 * uncaught errors into the product's telemetry (its installClientErrorTracking, docs/specs/017-telemetry/telemetry.md
 * 'Error'), once per page load.
 */
export function HelpClientProvider({
  value,
  installErrorTracking,
  children,
}: {
  value: HelpClient;
  installErrorTracking?: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    installErrorTracking?.();
  }, [installErrorTracking]);
  return <HelpClientContext value={value}>{children}</HelpClientContext>;
}
