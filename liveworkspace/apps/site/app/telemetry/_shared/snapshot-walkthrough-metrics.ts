// The charts and sentences for two shared features, defined once for every app that has them: Snapshots (all five
// apps) and Walkthroughs (the four canvas apps). Their code is shared (packages/snapshots, packages/walkthrough), so
// the events are the same in each app, sent under that app's own name through the workbench's `track`
// (liveworkspace/docs/specs/014-snapshots/snapshots.md "Telemetry", liveworkspace/docs/specs/006-media/walkthroughs.md
// "Telemetry"). An app's config lists the stack, and its event-explanations spread the sentences.

import type { Metric, MetricStack } from './metric-series';

// Snapshots: taken by hand, reverted to, deleted. No type: never a name, an id or a size.
export const SNAPSHOTS_TAKEN: Metric = {
  category: 'Snapshot',
  action: 'Created',
  title: 'Snapshots Taken',
  blurb: 'A snapshot taken by hand from History, to come back to later.',
};

export const SNAPSHOTS_REVERTED: Metric = {
  category: 'Snapshot',
  action: 'Reverted',
  title: 'Snapshots Reverted',
  blurb: 'Someone put the whole file back as a snapshot had it. Read against snapshots taken.',
};

export const SNAPSHOTS_DELETED: Metric = {
  category: 'Snapshot',
  action: 'Deleted',
  title: 'Snapshots Deleted',
  blurb: 'A snapshot deleted from History by hand.',
  rising: 'neutral',
};

export const SNAPSHOTS: MetricStack = {
  stack: true,
  title: 'Snapshots',
  blurb: 'Named copies of a whole file: how often they are taken, gone back to and deleted.',
  headline: SNAPSHOTS_TAKEN,
  members: [SNAPSHOTS_TAKEN, SNAPSHOTS_REVERTED, SNAPSHOTS_DELETED],
};

// Walkthroughs: recorded, saved, played and deleted, and where recording stopped short. A refusal's type is the limit.
export const WALKTHROUGHS_STARTED: Metric = {
  category: 'Walkthrough',
  action: 'Started',
  title: 'Recordings Started',
  blurb: 'A walkthrough recording began, after the three-second count.',
};

export const WALKTHROUGHS_SAVED: Metric = {
  category: 'Walkthrough',
  action: 'Created',
  title: 'Walkthroughs Saved',
  blurb: 'A recording saved as a walkthrough. Read against recordings started.',
};

export const WALKTHROUGHS_ABANDONED: Metric = {
  category: 'Walkthrough',
  action: 'Abandoned',
  title: 'Recordings Abandoned',
  blurb: 'A recording that was begun and then thrown away without saving.',
  rising: 'bad',
};

export const WALKTHROUGHS_PLAYED: Metric = {
  category: 'Walkthrough',
  action: 'Played',
  title: 'Walkthroughs Played',
  blurb: 'A saved walkthrough opened to play.',
};

export const WALKTHROUGHS_DELETED: Metric = {
  category: 'Walkthrough',
  action: 'Deleted',
  title: 'Walkthroughs Deleted',
  blurb: 'A saved walkthrough deleted.',
  rising: 'neutral',
};

export const WALKTHROUGHS_REFUSED: Metric = {
  category: 'Walkthrough',
  action: 'Refused',
  allTypes: true,
  title: 'Stopped By a Limit',
  blurb:
    'A recording stopped, or a save turned away, because it reached a limit: ten minutes, the size cap, or the number of walkthroughs allowed. Ranked by which limit.',
  rising: 'bad',
};

export const WALKTHROUGHS: MetricStack = {
  stack: true,
  title: 'Walkthroughs',
  blurb:
    'Narrated recordings of a file: how many are started and saved, how many are thrown away or stopped by a limit, and how often they are played.',
  headline: WALKTHROUGHS_STARTED,
  members: [
    WALKTHROUGHS_STARTED,
    WALKTHROUGHS_SAVED,
    WALKTHROUGHS_ABANDONED,
    WALKTHROUGHS_REFUSED,
    WALKTHROUGHS_PLAYED,
    WALKTHROUGHS_DELETED,
  ],
};

// The sentences, in the shape each app's explanation tables take: `Category|Action` for BY_ACTION (any type, and an
// event with none) and `Category|Action|Type` for EXACT.
export const SNAPSHOT_BY_ACTION: Readonly<Record<string, string>> = {
  'Snapshot|Created': 'Someone took a snapshot of the file from History.',
  'Snapshot|Reverted': 'Someone put the whole file back as one of its snapshots had it.',
  'Snapshot|Deleted': 'Someone deleted a snapshot from History.',
};

export const WALKTHROUGH_BY_ACTION: Readonly<Record<string, string>> = {
  'Walkthrough|Started': 'Someone began recording a walkthrough, once the count reached zero.',
  'Walkthrough|Created': 'Someone saved a walkthrough they had recorded.',
  'Walkthrough|Abandoned': 'Someone threw away a recording they had begun, without saving it.',
  'Walkthrough|Played': 'Someone opened a saved walkthrough to play it.',
  'Walkthrough|Deleted': 'Someone deleted a saved walkthrough.',
  'Walkthrough|Refused':
    'A recording stopped, or a save was turned away, because it reached a limit on walkthroughs.',
};

// The limits a walkthrough can meet, as `Walkthrough·Refused` names them (packages/walkthrough/src/telemetry.ts).
export const WALKTHROUGH_LIMITS = ['TooLong', 'TooLarge', 'ItemFull', 'AccountFull'] as const;

export const WALKTHROUGH_EXACT: Readonly<Record<string, string>> = {
  'Walkthrough|Refused|TooLong': 'A recording reached the ten minute limit and stopped itself.',
  'Walkthrough|Refused|TooLarge': 'A recording reached the size limit and stopped itself.',
  'Walkthrough|Refused|ItemFull':
    'A save was turned away because the file already holds the most walkthroughs it may.',
  'Walkthrough|Refused|AccountFull':
    'A save was turned away because the person had used all the walkthroughs or space they are allowed.',
};
