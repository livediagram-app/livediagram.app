'use client';

import type { TelemetrySummary, TelemetryWindowKey } from '@livediagram/api-schema';
import { MetricGroups, type MetricGroup } from './MetricCards';
import { RankCard, rank } from './RankCard';
import { windowLabel } from './windows';

// Exceptions view (spec/22): error health, each row saying where it
// failed. API failures observed by the editor's api-client
// (`Error·Api·Http<status>.<Action>`, `Network.<Method>.<Route>`), server-side
// crashes the api worker self-reports (`Internal.<Method>.<Route>`), MCP
// failures by tool (`Http503.<Tool>`, `Internal.<Tool>`), and client-side
// exceptions from the editor + help centre
// (`Error·Client·Uncaught.<Page>.<ErrorName>`, `Render.<Area>.<ErrorName>`).
// Every count is generic by construction (statuses, route words, pages, areas
// and a closed list of error names), so there is nothing personal to show. An
// empty view is the goal state.
//
// Types took their `<Kind>.<Where>` shape in #112; rows stored before that are
// the bare kind (`Http500`, `Internal`, `Uncaught`). The predicates below read
// the kind as the first dot-part, so both shapes land in the same card.

const kindOf = (type: string | null) => (type ?? '').split('.')[0] ?? '';

// Error·Client types that are not exceptions. RealtimeResync is the editor
// recovering on its own: the realtime room told it it had missed updates and
// it refetched (useRoomResync). Worth watching, since a lot of them means the
// room is dropping ops, but it is a recovery, not a crash, so it gets its own
// card instead of inflating Client Exceptions.
export const RECOVERY_TYPES: readonly string[] = ['RealtimeResync'];
export const isRecovery = (type: string | null) => RECOVERY_TYPES.includes(kindOf(type));

// The api worker's own crash report: `Internal.<Method>.<Route>`, where the
// second part is an HTTP method (apiRouteLabel). The MCP worker also reports
// `Internal.<Tool>` when its call to the api never completed; that is a
// request a caller saw fail, like the editor's Network kind, so it stays with
// the failed requests. A bare `Internal` predates #112 and is counted as a
// server crash, the api worker having been its main source.
const HTTP_METHODS = new Set(['Get', 'Post', 'Put', 'Patch', 'Delete', 'Head', 'Options']);
export function isServerCrash(type: string | null): boolean {
  const [kind, second] = (type ?? '').split('.');
  return kind === 'Internal' && (second === undefined || HTTP_METHODS.has(second));
}

export const GROUPS: MetricGroup[] = [
  {
    title: 'Error volume',
    metrics: [
      // One side of each failure only. A server crash is reported twice: the
      // api worker writes Internal.<Method>.<Route>, and the editor that sent
      // the request sees an Http500.<Action>. Summing Error·Api counted every
      // crash twice, so the caller-observed failures and the worker's own
      // crash reports are separate cards, not to be added together.
      {
        category: 'Error',
        action: 'Api',
        typeIn: (type) => !isServerCrash(type),
        title: 'Failed Requests',
        blurb:
          'Requests a caller saw fail: non-2xx responses and dropped requests in the editor, failed api calls inside MCP tools, and failed email sends. A server crash appears here as the Http500 its caller saw.',
      },
      {
        category: 'Error',
        action: 'Api',
        typeIn: isServerCrash,
        title: 'Server Crashes',
        blurb:
          'Unhandled exceptions the api worker reported about itself, by route. Most also appear as an Http500 in Failed Requests, so read the two side by side rather than adding them.',
      },
      {
        category: 'Error',
        action: 'Client',
        typeIn: (type) => !isRecovery(type),
        title: 'Client Exceptions',
        blurb:
          'Uncaught exceptions, unhandled promise rejections, and editor areas that failed to render, in the editor and help centre.',
      },
      {
        category: 'Error',
        action: 'Client',
        typeIn: isRecovery,
        title: 'Realtime Resyncs',
        blurb:
          'Not an exception: the editor noticed it had missed live updates and refetched the diagram to catch up. A rising line means the realtime room is dropping updates.',
      },
    ],
  },
];

export function ExceptionsView({
  summary,
  active,
}: {
  summary: TelemetrySummary;
  active: TelemetryWindowKey;
}) {
  const rows = summary.windows[active].rows;
  const isApi = (r: { category: string; action: string }) =>
    r.category === 'Error' && r.action === 'Api';
  const failed = rank(rows, (r) => isApi(r) && !isServerCrash(r.type));
  const crashes = rank(rows, (r) => isApi(r) && isServerCrash(r.type));
  const client = rank(
    rows,
    (r) => r.category === 'Error' && r.action === 'Client' && !isRecovery(r.type),
  );

  return (
    <div className="mt-8">
      <p className="text-sm text-slate-500 dark:text-slate-400">
        Error health for <span className="font-medium">{windowLabel(active)}</span>: what failed and
        where, counted generically (a status or kind plus the request, route, page, or area), never
        a message, stack, or anything personal. An empty view here is the goal.
      </p>
      <MetricGroups groups={GROUPS} summary={summary} active={active} />

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <RankCard
          title="Failed Requests"
          subtitle="By status and the request, route, or MCP tool that failed, as the caller saw it"
          category="Error"
          action="Api"
          items={failed}
          daily={summary.daily}
          emptyLabel="No failed requests in this window. Good."
        />
        <RankCard
          title="Server Crashes"
          subtitle="By the route the api worker was serving when it threw"
          category="Error"
          action="Api"
          items={crashes}
          daily={summary.daily}
          emptyLabel="No server crashes in this window. Good."
        />
        <RankCard
          title="Client Exceptions"
          subtitle="By kind, the page or editor area it happened in, and the error type"
          category="Error"
          action="Client"
          items={client}
          daily={summary.daily}
          emptyLabel="No client exceptions in this window. Good."
        />
      </div>
    </div>
  );
}
