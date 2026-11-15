import { describe, expect, it, vi } from 'vitest';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Env } from '@liveworkspace/mcp-kit/env';

// The renderer cannot load here; the stub hands back the structured result.
vi.mock('./image-result', () => ({
  imageResult: (data: unknown) => ({ content: [], structuredContent: data }),
}));

import { registerTools } from './tools';

// The flow charts through the MCP doors (docs/specs/026-plan/plan-agents.md "Making a dashboard" and "Roles"):
// add_tab and update_project name the three by view id with their range, the default never sent; a range outside the
// four, or on another chart, is refused before anything is written; a plan view's range is set in ops mode; and the
// api's refusal of a Participant or a Viewer reaches the model as an error, never as a change made.

const view = {
  id: 'v1',
  type: 'shape',
  shape: 'plan-view',
  x: 0,
  y: 0,
  width: 600,
  height: 360,
  planView: { view: 'throughput' },
};

// `refuse`: the status the api answers every changeset with (403 for a Participant or Viewer), 0 to apply them.
function harness(refuse = 0) {
  const changesets: { path: string; body: Record<string, unknown> }[] = [];
  const handlers: Record<string, (args: unknown, extra: unknown) => Promise<unknown>> = {};
  const server = {
    registerTool: (name: string, _config: unknown, h: (typeof handlers)[string]) => {
      handlers[name] = h;
    },
  } as unknown as McpServer;
  const env = {
    API: {
      fetch: async (request: Request) => {
        const path = new URL(request.url).pathname.replace(/^\/api/, '');
        if (path === '/events') return new Response(null, { status: 204 });
        if (request.method === 'POST' && path.endsWith('/changesets')) {
          changesets.push({ path, body: await request.json<Record<string, unknown>>() });
          return refuse
            ? Response.json({ error: 'forbidden' }, { status: refuse })
            : Response.json({ changeset: { id: 'c1' }, text: 'ok' });
        }
        if (/\/projects\/[^/]+$/.test(path))
          return Response.json({ project: { id: 'p', tabs: [{ id: 't', name: 'Flow' }] } });
        if (/\/tabs\/[^/]+$/.test(path))
          return Response.json({
            tab: { id: 't', name: 'Flow', kind: 'dashboard', elements: [view], rev: 3 },
          });
        return new Response('nope', { status: 503 });
      },
    },
  } as unknown as Env;
  registerTools(server, env);
  const call = (name: string, args: unknown) =>
    handlers[name]!(args, { authInfo: { token: 'tok' } }) as Promise<{
      isError?: boolean;
      content?: { text?: string }[];
    }>;
  return { call, changesets };
}

const dashboardOf = (body: Record<string, unknown>) =>
  (body.replace as { dashboard?: { charts?: unknown[] } }).dashboard;

describe('a Dashboard of flow charts', () => {
  it('add_tab builds the three by view id, each with its range, the default not sent', async () => {
    const { call, changesets } = harness();
    const result = await call('add_tab', {
      projectId: 'p',
      name: 'Flow',
      dashboard: {
        charts: [
          { view: 'cycle-time', rangeDays: 90 },
          { view: 'throughput', rangeDays: 30 },
          { view: 'cumulative-flow', rangeDays: 180, name: 'Where work piles up' },
        ],
      },
    });
    expect(result.isError).toBeFalsy();
    expect(dashboardOf(changesets[0]!.body)?.charts).toEqual([
      { view: 'cycle-time', settings: { rangeDays: 90 } },
      { view: 'throughput' },
      { view: 'cumulative-flow', settings: { rangeDays: 180 }, name: 'Where work piles up' },
    ]);
  });

  it('update_project rebuilds a Dashboard with them', async () => {
    const { call, changesets } = harness();
    const result = await call('update_project', {
      projectId: 'p',
      tabId: 't',
      mode: 'replace',
      dashboard: { charts: [{ view: 'throughput', rangeDays: 14 }] },
    });
    expect(result.isError).toBeFalsy();
    expect(dashboardOf(changesets[0]!.body)?.charts).toEqual([
      { view: 'throughput', settings: { rangeDays: 14 } },
    ]);
  });

  it('refuses a range outside the four, or on another chart, before anything is written', async () => {
    const { call, changesets } = harness();
    for (const [chart, says] of [
      [{ view: 'throughput', rangeDays: 7 }, '14, 30, 90, 180 days'],
      [{ view: 'gantt', rangeDays: 90 }, "not gantt's"],
    ] as const) {
      const added = await call('add_tab', { projectId: 'p', dashboard: { charts: [chart] } });
      expect(added.isError).toBe(true);
      expect(added.content![0]!.text).toContain(says);
      const rebuilt = await call('update_project', {
        projectId: 'p',
        tabId: 't',
        mode: 'replace',
        dashboard: { charts: [chart] },
      });
      expect(rebuilt.isError).toBe(true);
    }
    expect(changesets).toHaveLength(0);
  });
});

describe("a flow chart's range in ops mode", () => {
  it('sends the set as an edit operation on the chart', async () => {
    const { call, changesets } = harness();
    const result = await call('update_project', {
      projectId: 'p',
      tabId: 't',
      mode: 'ops',
      edits: 'set v1 planView={"view":"throughput","rangeDays":90}',
    });
    expect(result.isError).toBeFalsy();
    expect(changesets[0]!.body.operations).toBe(
      'set v1 planView={"view":"throughput","rangeDays":90}',
    );
  });

  it('answers a Participant’s or a Viewer’s refusal as an error, never as a change made', async () => {
    const { call, changesets } = harness(403);
    for (const args of [
      { mode: 'ops', edits: 'set v1 planView={"view":"throughput","rangeDays":90}' },
      { mode: 'replace', dashboard: { charts: [{ view: 'cycle-time', rangeDays: 90 }] } },
    ]) {
      const result = await call('update_project', { projectId: 'p', tabId: 't', ...args });
      expect(result.isError).toBe(true);
      expect(result.content![0]!.text).toContain('forbidden');
    }
    expect(changesets).toHaveLength(2);
  });
});
