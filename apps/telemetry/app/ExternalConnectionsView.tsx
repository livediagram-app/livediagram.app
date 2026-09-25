'use client';

import type { TelemetrySummary, TelemetryWindowKey } from '@livediagram/api-schema';
import { API_TOKENS_AND_MCP } from './metric-catalogue';
import { MetricGroups, type MetricGroup } from './MetricCards';
import { RankCard, rank } from './RankCard';
import { windowLabel } from './windows';

// External Connections view (spec/22): programmatic access into livediagram.
// API tokens (minted by hand or via the MCP OAuth flow, then revoked) and the
// MCP server's actual tool usage, as one chart stack (spec/22). Token
// lifecycle comes from `Token`; MCP tool calls from `Mcp·Used·<tool>`, both
// in the stack and as a per-tool ranking.
export const GROUPS: MetricGroup[] = [
  {
    title: 'Connections',
    metrics: [API_TOKENS_AND_MCP],
  },
];

export function ExternalConnectionsView({
  summary,
  active,
}: {
  summary: TelemetrySummary;
  active: TelemetryWindowKey;
}) {
  const rows = summary.windows[active].rows;
  const mcpTools = rank(rows, (r) => r.category === 'Mcp' && r.action === 'Used');

  return (
    <div className="mt-8">
      <p className="text-sm text-slate-500 dark:text-slate-400">
        Programmatic access into livediagram, for{' '}
        <span className="font-medium">{windowLabel(active)}</span>: API tokens and MCP tool usage.
      </p>
      <MetricGroups groups={GROUPS} summary={summary} active={active} />

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <RankCard
          title="MCP tools"
          subtitle="Which MCP server tools AI assistants call, most to least"
          category="Mcp"
          action="Used"
          items={mcpTools}
          daily={summary.daily}
          emptyLabel="No MCP tool calls in this window yet."
        />
      </div>
    </div>
  );
}
