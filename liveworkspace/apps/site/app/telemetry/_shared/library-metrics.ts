// The charts and sentences for the Library every canvas app shares (liveworkspace/docs/specs/006-media/libraries.md
// "Telemetry"): saving an item to it and placing one from it, each typed by whose library ('Personal' | 'Team'). Its
// code is shared (packages/workbench/src/components/library), and each app counts through its own `track`
// (livediagram, livedocuments and livedesign's EditorLibraryProvider). An app's config lists the stack, and its
// event-explanations spread the sentences.

import type { Metric, MetricStack } from './metric-series';

export const LIBRARY_SAVED: Metric = {
  category: 'Library',
  action: 'Created',
  allTypes: true,
  title: 'Saved to Library',
  blurb: 'A selection saved to the Library, ranked by whose library: Personal or a team’s.',
};

export const LIBRARY_PLACED: Metric = {
  category: 'Library',
  action: 'Added',
  allTypes: true,
  title: 'Placed from Library',
  blurb:
    'An item placed on the canvas from the Library, by a click or a drag, ranked by whose library it came from. Read against saves.',
};

export const LIBRARY: MetricStack = {
  stack: true,
  title: 'Library',
  blurb:
    'What people keep to use again: how often they save to their Library, and how often they place from it, Personal and team.',
  headline: LIBRARY_PLACED,
  members: [LIBRARY_PLACED, LIBRARY_SAVED],
};

// The sentences, in the shape each app's explanation tables take: `Category|Action` for BY_ACTION and
// `Category|Action|Type` for EXACT.
export const LIBRARY_BY_ACTION: Readonly<Record<string, string>> = {
  'Library|Created': 'Someone saved a selection to the Library.',
  'Library|Added': 'Someone placed an item from the Library on the canvas.',
};

export const LIBRARY_EXACT: Readonly<Record<string, string>> = {
  'Library|Created|Personal': 'Someone saved a selection to their Personal library.',
  'Library|Created|Team': 'Someone saved a selection to one of their teams’ libraries.',
  'Library|Added|Personal': 'Someone placed an item from their Personal library on the canvas.',
  'Library|Added|Team': 'Someone placed an item from a team’s library on the canvas.',
};
