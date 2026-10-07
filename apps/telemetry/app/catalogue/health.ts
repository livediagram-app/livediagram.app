// Error health and the help centre (docs/specs/017-telemetry/telemetry.md).
// Part of the metric catalogue: import from ../metric-catalogue.

import { isRecovery, isServerCrash, kindOf } from '../error-kinds';
import type { Metric, MetricStack } from '../metric-series';
import { chart } from './helpers';

// Error health (Exceptions tab). One side of each failure only: a server crash
// is reported twice, the api worker's Internal.<Method>.<Route> and the Http500
// its caller saw, so Failed Requests and Server Crashes are read side by side,
// never added.
export const FAILED_REQUESTS: Metric = {
  rising: 'bad',
  category: 'Error',
  action: 'Api',
  typeIn: (type) => !isServerCrash(type),
  title: 'Failed Requests',
  blurb:
    'Requests a caller saw fail: non-2xx responses and dropped requests in the editor, failed api calls inside MCP tools, and failed email sends. A server crash appears here as the Http500 its caller saw.',
};

export const SERVER_CRASHES: Metric = {
  rising: 'bad',
  category: 'Error',
  action: 'Api',
  typeIn: isServerCrash,
  title: 'Server Crashes',
  blurb:
    'Crashes the livediagram server reported about itself, by endpoint. Most also appear as an Http500 in Failed Requests, so read the two side by side rather than adding them.',
};

export const CLIENT_EXCEPTIONS: Metric = {
  rising: 'bad',
  category: 'Error',
  action: 'Client',
  typeIn: (type) => !isRecovery(type),
  title: 'Client Exceptions',
  blurb:
    'Uncaught exceptions, unhandled promise rejections, and editor areas that failed to render, in the editor and help centre.',
};

export const REALTIME_RESYNCS: Metric = {
  rising: 'bad',
  category: 'Error',
  action: 'Client',
  typeIn: (type) => kindOf(type) === 'RealtimeResync',
  title: 'Realtime Resyncs',
  blurb:
    'Not an exception: the editor noticed it had missed live updates and refetched the document to catch up. A rising line means the realtime room is dropping updates.',
};

export const STALE_CHUNK_RELOADS: Metric = {
  rising: 'neutral',
  category: 'Error',
  action: 'Client',
  typeIn: (type) => kindOf(type) === 'StaleChunkReload',
  title: 'Stale Build Reloads',
  blurb:
    'Not an exception: a tab still running an earlier build asked for code the last deploy removed, and loaded the page in full instead of crashing. Expect a small rise after each deploy.',
};

export const WARNINGS: Metric = {
  rising: 'bad',
  category: 'Error',
  action: 'Warning',
  // Every kind of warning: each names its fallback (AiQuota.BrowserReader, …).
  typeIn: () => true,
  title: 'Warnings',
  blurb:
    'Not a failure: a degradation the author was carried through, such as a spent AI budget reading the photo on the device instead. A rising line means a fallback is doing more of the work.',
};

// Headed by the errors someone actually hit, each once: failed requests plus
// client exceptions. Server crashes would count those failures a second time
// and resyncs are recoveries, so neither joins the headline.
export const EXCEPTIONS: MetricStack = {
  rising: 'bad',
  stack: true,
  title: 'Exceptions',
  blurb:
    'Errors people hit, from failed requests and client exceptions, beside the server crashes behind them, the realtime resyncs and stale build reloads that recovered, and the warnings the author was carried through. Zero is the goal.',
  members: [
    FAILED_REQUESTS,
    SERVER_CRASHES,
    CLIENT_EXCEPTIONS,
    REALTIME_RESYNCS,
    STALE_CHUNK_RELOADS,
    WARNINGS,
  ],
  headline: [FAILED_REQUESTS, CLIENT_EXCEPTIONS],
  seeAlso: { view: 'exceptions', label: 'See Each Error on the Exceptions Tab' },
};

// Load recovery (docs/specs/007-editor/load-recovery.md): what people did on the load-error screen
// and the help centre's Repair page. The load's own timeouts and fallbacks are Warnings above.
const isDiagnostics = (t: string | null) => t === 'Diagnostics' || t === 'Diagnostics.Help';

export const DIAGNOSTICS_COPIED = chart(
  'UI',
  'Copied',
  'Diagnostics Copied',
  'A diagnostics report copied for support, from a failed load or the Repair page.',
  { typeIn: isDiagnostics, rising: 'bad' },
);

export const BROWSER_REPAIRS = chart(
  'UI',
  'Cleared',
  'Browser Repairs',
  "A browser's livediagram settings and caches cleared to get a document loading again.",
  { rising: 'bad' },
);

export const LOAD_RECOVERY: MetricStack = {
  rising: 'bad',
  stack: true,
  title: 'Load Recovery',
  blurb:
    'Diagnostics copied and browsers repaired when a document would not load. A rising line means people are getting stuck opening documents.',
  members: [DIAGNOSTICS_COPIED, BROWSER_REPAIRS],
  headline: BROWSER_REPAIRS,
};

// Help centre (Help tab has the rankings).
export const ARTICLE_VIEWS = chart(
  'Help',
  'View',
  'Article Views',
  'Help-centre articles opened, across every article.',
);

export const MARKED_HELPFUL = chart(
  'Help',
  'Helpful',
  'Marked Helpful',
  'Readers who tapped "yes, this helped" on an article.',
);

export const MARKED_NOT_HELPFUL = chart(
  'Help',
  'Unhelpful',
  'Marked Not Helpful',
  'Readers who tapped "not really": the articles worth rewriting.',
  { rising: 'bad' },
);

export const HELP_SEARCHES = chart(
  'Help',
  'Searched',
  'Help Searches',
  'Searches in the help centre that found something.',
  { types: ['Results'] },
);

export const DRY_HELP_SEARCHES = chart(
  'Help',
  'Searched',
  'Dry Help Searches',
  'Help searches that found nothing: the articles that do not exist yet.',
  { types: ['NoResults'], rising: 'bad' },
);

export const HELP_CENTRE: MetricStack = {
  stack: true,
  title: 'Help Centre',
  blurb: 'Articles read, votes cast on them, and what people searched for.',
  members: [ARTICLE_VIEWS, MARKED_HELPFUL, MARKED_NOT_HELPFUL, HELP_SEARCHES, DRY_HELP_SEARCHES],
  headline: ARTICLE_VIEWS,
  seeAlso: { view: 'help', label: 'See Each Article on the Help Tab' },
};
