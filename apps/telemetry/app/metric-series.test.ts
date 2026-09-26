import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { GROUPS as DASHBOARD } from './DashboardView';
import { EMAIL_KIND_METRICS, NEW_VISITORS, RETURNING_VISITORS } from './metric-catalogue';
import { groupMetrics, isStack, type MetricGroup } from './metric-series';

describe('chart stacks', () => {
  const stack = {
    stack: true as const,
    title: 'All Visitors',
    blurb: '',
    members: [NEW_VISITORS, RETURNING_VISITORS],
  };

  it('opens stacks up so every chart a group shows is listed', () => {
    const group: MetricGroup = { title: 'Visitors', metrics: [stack, NEW_VISITORS] };
    expect(groupMetrics(group)).toEqual([NEW_VISITORS, RETURNING_VISITORS, NEW_VISITORS]);
  });

  it('references its charts rather than owning them', () => {
    // The same chart object can sit in a second stack, untouched by the first.
    const other = { ...stack, title: 'Returns', members: [RETURNING_VISITORS] };
    expect(other.members[0]).toBe(stack.members[1]);
    expect(isStack(stack)).toBe(true);
    expect(isStack(NEW_VISITORS)).toBe(false);
  });
});

describe('the Emails Sent stack', () => {
  // The head's total is the sum of its members, so a template with no chart
  // would silently drop out of it. Read the api's EmailKind union as source.
  const source = readFileSync(resolve(__dirname, '../../api/src/email/templates.ts'), 'utf8');
  const union = /export type EmailKind =([^;]+);/.exec(source)?.[1] ?? '';
  const kinds = [...union.matchAll(/'([A-Za-z0-9]+)'/g)].map((m) => m[1]);

  it('reads the template kinds', () => {
    expect(kinds.length).toBeGreaterThan(10);
  });

  it('has one chart per email template', () => {
    const charted = EMAIL_KIND_METRICS.map((m) => m.type);
    expect([...charted].sort()).toEqual([...kinds].sort());
  });

  it('is what Dashboard stacks', () => {
    const stack = DASHBOARD.flatMap((g) => g.metrics).find(
      (item) => isStack(item) && item.title === 'Emails Sent',
    );
    expect(stack && isStack(stack) ? stack.members : []).toEqual(EMAIL_KIND_METRICS);
  });
});

describe('stack headlines', () => {
  it('name one of their own members', async () => {
    const catalogue = await import('./metric-catalogue');
    for (const item of Object.values(catalogue).flat()) {
      if (!isStack(item) || !item.headline) continue;
      for (const m of [item.headline].flat()) expect(item.members).toContain(m);
    }
  });
});

describe('the Elements Added stack', () => {
  it('buckets every element type into exactly one chart', async () => {
    const { ELEMENTS_ADDED } = await import('./metric-catalogue');
    const { PALETTE_TELEMETRY_TYPES } = await import('@livediagram/api-schema');
    const samples = [
      ...Object.values(PALETTE_TELEMETRY_TYPES).flat(),
      'Code-block', // an old spelling folds into its tab
      'Image',
      'SomethingNew',
      null,
    ];
    for (const type of samples) {
      const hits = ELEMENTS_ADDED.members.filter((m) => m.typeIn?.(type));
      expect(
        hits.map((m) => m.title),
        String(type),
      ).toHaveLength(1);
    }
  });
});

describe('the MCP Tool Calls stack', () => {
  it('has one chart per tool the MCP server registers', async () => {
    const { MCP_TOOL_METRICS } = await import('./metric-catalogue');
    const { pascalToken } = await import('@livediagram/api-schema');
    const source = readFileSync(resolve(__dirname, '../../mcp/src/tools.ts'), 'utf8');
    // registerTool(server, env, '<name>', ...
    const names = [...source.matchAll(/registerTool\(\s*server,\s*env,\s*'([a-z_]+)'/g)].map(
      (m) => m[1]!,
    );
    expect(names.length).toBeGreaterThan(5);
    expect(MCP_TOOL_METRICS.map((m) => m.type).sort()).toEqual(names.map(pascalToken).sort());
  });
});

describe('previousCount (trend arrows)', () => {
  const window = (count: number) => ({
    total: count,
    rows: [{ category: 'Participant', action: 'Created', type: null, count }],
  });
  const summary = {
    enabled: true,
    generatedAt: 0,
    windows: { today: window(5), last7: window(20), last30: window(90) },
    previousWindows: { today: window(4), last7: window(10), last30: window(60) },
  };

  it('reads the api previous window, the last 30 days included', async () => {
    const { previousCount } = await import('./metric-series');
    expect(previousCount(summary, 'last30', NEW_VISITORS, 30)).toBe(60);
    expect(previousCount(summary, 'today', NEW_VISITORS, 1)).toBe(4);
  });

  it('has nothing to compare the last 30 days against without it', async () => {
    const { previousCount } = await import('./metric-series');
    const older = { ...summary, previousWindows: undefined };
    expect(previousCount(older, 'last30', NEW_VISITORS, 30)).toBeNull();
  });
});
