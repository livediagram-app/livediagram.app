'use client';

import type { TelemetrySummary, TelemetryWindowKey } from '@livediagram/api-schema';
import { MetricGroups, type MetricGroup } from './MetricCards';
import { RankCard, rank } from './RankCard';
import { windowLabel } from './windows';

// External Connections view (spec/22): programmatic access into livediagram.
// API tokens (minted by hand or via the MCP OAuth flow, then revoked) and the
// MCP server's actual tool usage. Token lifecycle comes from `Token`; MCP tool
// calls from `Mcp·Used·<tool>`, both the headline count and a per-tool ranking.
export const GROUPS: MetricGroup[] = [
  {
    title: 'API tokens',
    metrics: [
      {
        category: 'Token',
        action: 'Created',
        type: 'Manual',
        title: 'Tokens Created',
        blurb: 'Personal API tokens minted by hand from the Explorer.',
      },
      {
        category: 'Token',
        action: 'Created',
        type: 'MCP',
        title: 'AI Tools Connected',
        blurb: 'AI assistants that connected through the MCP OAuth consent screen.',
      },
      {
        category: 'Token',
        action: 'Removed',
        type: null,
        title: 'Tokens Revoked',
        blurb: 'API tokens revoked, whether minted by hand or by an AI tool.',
      },
    ],
  },
  {
    title: 'MCP usage',
    metrics: [
      {
        category: 'Mcp',
        action: 'Used',
        allTypes: true,
        title: 'MCP Tool Calls',
        blurb: 'AI assistants calling the livediagram MCP server tools, across every tool.',
      },
    ],
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
