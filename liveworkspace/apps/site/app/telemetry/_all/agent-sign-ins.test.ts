import { describe, expect, it } from 'vitest';
import type { TelemetrySummary } from '@liveworkspace/telemetry';
import { agentSignInFigures } from './agent-sign-ins';

// The Connections tab's figures from a summary that predates them: no daily series, no span before, other events beside.
const window = (rows: TelemetrySummary['windows']['today']['rows']) => ({ total: 0, rows });

describe("The Connections tab's figures", () => {
  it('reads the window alone, leaving out tokens made by hand and other events', () => {
    const summary: TelemetrySummary = {
      enabled: true,
      generatedAt: 0,
      windows: {
        today: window([
          { category: 'Token', action: 'Created', type: 'MCP', count: 2 },
          { category: 'Token', action: 'Created', type: 'Manual', count: 9 },
          { category: 'Token', action: 'Removed', type: 'Cli', count: 4 },
          { category: 'Mcp', action: 'Created', type: 'Cli', count: 5 },
        ]),
        last7: window([]),
        last30: window([]),
      },
    };
    const figures = agentSignInFigures(summary, 'today');
    expect(figures.totals.MCP).toEqual({ now: 2, before: 0 });
    expect(figures.totals.Cli).toEqual({ now: 0, before: 0 });
    expect(figures.daily.MCP).toEqual([]);
    expect(figures.counted).toBe(false);
  });

  it('reads each one a day, and the span before', () => {
    const summary: TelemetrySummary = {
      enabled: true,
      generatedAt: 0,
      windows: { today: window([]), last7: window([]), last30: window([]) },
      previousWindows: {
        today: window([{ category: 'Token', action: 'Created', type: 'Cli', count: 3 }]),
        last7: window([]),
        last30: window([]),
      },
      daily: {
        days: [1, 2],
        totals: [0, 0],
        byCategory: {},
        byMetric: { 'Token|Created|Cli': [1, 2] },
      },
    };
    const figures = agentSignInFigures(summary, 'today');
    expect(figures.daily.Cli).toEqual([1, 2]);
    expect(figures.daily.MCP).toEqual([0, 0]);
    expect(figures.totals.Cli).toEqual({ now: 0, before: 3 });
    expect(figures.counted).toBe(true);
  });
});
