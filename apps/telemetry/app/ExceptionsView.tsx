'use client';

import type { TelemetrySummary, TelemetryWindowKey } from '@livediagram/api-schema';
import { MetricGroups, type MetricGroup } from './MetricCards';
import { RankCard, rank } from './RankCard';
import { windowLabel } from './windows';

// Exceptions view (spec/22): error health, each row saying where it
// failed. API failures observed by the editor's api-client
// (`Error·Api·Http<status>.<Action>`, `Network.<Method>.<Route>`), server-side
// crashes the api worker self-reports (`Internal.<Method>.<Route>`), MCP
// failures by tool (`Http503.<Tool>`), and client-side exceptions from the
// editor + help centre (`Error·Client·Uncaught.<Page>.<ErrorName>`,
// `Render.<Area>.<ErrorName>`). Every count is generic by construction —
// statuses, route words, pages, areas and a closed list of error names, so
// there is nothing personal to show. An empty view is the goal state.
export const GROUPS: MetricGroup[] = [
  {
    title: 'Error volume',
    metrics: [
      {
        category: 'Error',
        action: 'Api',
        allTypes: true,
        title: 'API Errors',
        blurb:
          'Requests that failed: non-2xx responses and dropped requests seen by the editor, MCP tool failures, and internal crashes the server reports about itself.',
      },
      {
        category: 'Error',
        action: 'Client',
        allTypes: true,
        title: 'Client Exceptions',
        blurb:
          'Uncaught exceptions, unhandled promise rejections, and editor areas that failed to render, in the editor and help centre.',
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
        Error health for <span className="font-medium">{windowLabel(active)}</span>: what failed and
        where, counted generically (a status or kind plus the request, route, page, or area), never
        a message, stack, or anything personal. An empty view here is the goal.
      </p>
      <MetricGroups groups={GROUPS} summary={summary} active={active} />

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <RankCard
          title="API failures"
          subtitle="By status and the request, route, or MCP tool that failed"
          category="Error"
          action="Api"
          items={api}
          daily={summary.daily}
          emptyLabel="No API errors in this window. Good."
        />
        <RankCard
          title="Client exceptions"
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
