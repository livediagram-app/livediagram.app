// AI Tools & CLI's figures (liveworkspace/docs/specs/008-telemetry/telemetry.md "The dashboard"): liveworkspace.app's
// own token events (PLATFORM_OWN_TELEMETRY_EVENTS `Token·Created`), an AI tool connected through the one MCP's consent
// page (`MCP`) and an app's CLI signed in there or on the device page (`Cli`), as each one's total in a window and the
// span before it, and as a 30-day daily series. The rows the apps sent in their own names before the fold add in.

import {
  metricKey,
  PLATFORM_OWN_TELEMETRY_EVENTS,
  type TelemetrySummary,
  type TelemetryWindow,
  type TelemetryWindowKey,
} from '@liveworkspace/telemetry';

export const TOKEN_CATEGORY = 'Token';
export const TOKEN_CREATED = 'Created';

export type AgentSignInType = (typeof PLATFORM_OWN_TELEMETRY_EVENTS)['Token·Created'][number];
export const AGENT_SIGN_IN_TYPES: readonly AgentSignInType[] =
  PLATFORM_OWN_TELEMETRY_EVENTS['Token·Created'];

export type AgentSignInFigures = {
  totals: Record<AgentSignInType, { now: number; before: number }>;
  // Each one's count a day, oldest first.
  daily: Record<AgentSignInType, number[]>;
  // Anything at all in the 30 days.
  counted: boolean;
};

function windowCounts(window: TelemetryWindow | undefined): Record<AgentSignInType, number> {
  const out = { MCP: 0, Cli: 0 } satisfies Record<AgentSignInType, number>;
  for (const row of window?.rows ?? []) {
    if (row.category !== TOKEN_CATEGORY || row.action !== TOKEN_CREATED) continue;
    const type = row.type as AgentSignInType;
    if (type in out) out[type] += row.count;
  }
  return out;
}

export function agentSignInFigures(
  summary: TelemetrySummary,
  active: TelemetryWindowKey,
): AgentSignInFigures {
  const now = windowCounts(summary.windows[active]);
  const before = windowCounts(summary.previousWindows?.[active]);
  const days = summary.daily?.days.length ?? 0;
  const byMetric = summary.daily?.byMetric ?? {};
  const series = (type: AgentSignInType) =>
    byMetric[metricKey(TOKEN_CATEGORY, TOKEN_CREATED, type)] ??
    Array.from({ length: days }, () => 0);
  const daily = { MCP: series('MCP'), Cli: series('Cli') };
  return {
    totals: {
      MCP: { now: now.MCP, before: before.MCP },
      Cli: { now: now.Cli, before: before.Cli },
    },
    daily,
    counted: AGENT_SIGN_IN_TYPES.some((t) => daily[t].some((n) => n > 0)),
  };
}
