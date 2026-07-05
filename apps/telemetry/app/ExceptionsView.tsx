'use client';

import type { TelemetrySummary, TelemetryWindowKey } from '@livediagram/api-schema';
import { MetricGroups, type MetricGroup } from './MetricCards';
import { RankCard, rank } from './RankCard';
import { windowLabel } from './windows';

// Exceptions view (spec/22): error health. API failures observed by the
// editor's api-client (`Error·Api·Http<status>`), server-side crashes
// the api worker self-reports (`Error·Api·Internal`), and client-side
// uncaught exceptions / unhandled rejections from the editor + help
// centre (`Error·Client·*`). Every count is generic by construction —
// the closed vocabulary carries only status tokens and fixed kinds, so
// there is nothing personal to show. An empty view is the goal state.
const GROUPS: MetricGroup[] = [
  {
    title: 'Error volume',
    metrics: [
      {
        category: 'Error',
        action: 'Api',
        allTypes: true,
        title: 'API Errors',
        blurb:
          'Requests that failed: non-2xx responses seen by the editor, plus internal crashes the server reports about itself.',
      },
      {
        category: 'Error',
        action: 'Client',
        allTypes: true,
        title: 'Client Exceptions',
        blurb:
          'Uncaught exceptions and unhandled promise rejections in the editor and help centre.',
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
  const api = rank(rows, (r) => r.category === 'Error' && r.action === 'Api');
  const client = rank(rows, (r) => r.category === 'Error' && r.action === 'Client');

  return (
    <div className="mt-8">
      <p className="text-sm text-slate-500 dark:text-slate-400">
        Error health for <span className="font-medium">{windowLabel(active)}</span>: what failed,
        counted generically — a status or a kind, never a message, stack, or anything personal. An
        empty view here is the goal.
      </p>
      <MetricGroups groups={GROUPS} summary={summary} active={active} />

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <RankCard
          title="API failures"
          subtitle="By HTTP status as the editor saw it, plus server-reported internal crashes"
          category="Error"
          action="Api"
          items={api}
          daily={summary.daily}
          emptyLabel="No API errors in this window. Good."
        />
        <RankCard
          title="Client exceptions"
          subtitle="Uncaught exceptions vs unhandled promise rejections"
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
