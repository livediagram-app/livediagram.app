// What the api answered for one document in a pass (docs/specs/027-repositories/blueprints/repository-link.md "One
// sync pass" step 5): its overview, and at `files` its envelope fields; or trashed, unreadable, or a transient
// failure that keeps its files (RL14).

import type { OverviewView } from '@livediagram/api-schema';

// What a mirror file holds of a document besides its tabs' contents (RL37).
export type EnvelopeFields = {
  name: string;
  presentation: string | null;
  tabs: { id: string; orderIndex: number; folder?: string }[];
};

export type RemoteFact =
  | { kind: 'readable'; overview: OverviewView; envelope: EnvelopeFields | null }
  | { kind: 'trashed' }
  | { kind: 'unreadable' }
  // `failure` completes `! "<name>": <failure>; files kept`.
  | { kind: 'transient'; failure: string; exit: 6 | 7; reason: string };

// The overview's tabs as header facts, each with its id and revision.
export const remoteTabsOf = (overview: OverviewView) =>
  overview.tabs.flatMap((t) => (t.outOfScope ? [] : [t]));
