'use client';

import type { TelemetrySummary, TelemetryWindowKey } from '@livediagram/api-schema';
import { MetricGroups, type MetricGroup } from './MetricCards';
import { CardColumns } from './CardColumns';
import { isRecovery, isServerCrash } from './error-kinds';
import {
  CLIENT_EXCEPTIONS,
  FAILED_REQUESTS,
  REALTIME_RESYNCS,
  SERVER_CRASHES,
} from './metric-catalogue';
import { RankCard, rank } from './RankCard';
import { rankTrend, windowLabel } from './windows';

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
export { RECOVERY_TYPES, isRecovery, isServerCrash } from './error-kinds';

export const GROUPS: MetricGroup[] = [
  {
    title: 'Error volume',
    metrics: [FAILED_REQUESTS, SERVER_CRASHES, CLIENT_EXCEPTIONS, REALTIME_RESYNCS],
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
  const trend = rankTrend(summary, active);
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

      <div className="mt-6">
        <CardColumns>
          <RankCard
            trend={trend}
            title="Failed Requests"
            subtitle="By status and the request, route, or MCP tool that failed, as the caller saw it"
            category="Error"
            action="Api"
            items={failed}
            daily={summary.daily}
            emptyLabel="No failed requests in this window. Good."
          />
          <RankCard
            trend={trend}
            title="Server Crashes"
            subtitle="By the route the api worker was serving when it threw"
            category="Error"
            action="Api"
            items={crashes}
            daily={summary.daily}
            emptyLabel="No server crashes in this window. Good."
          />
          <RankCard
            trend={trend}
            title="Client Exceptions"
            subtitle="By kind, the page or editor area it happened in, and the error type"
            category="Error"
            action="Client"
            items={client}
            daily={summary.daily}
            emptyLabel="No client exceptions in this window. Good."
          />
        </CardColumns>
      </div>
    </div>
  );
}
