import { describe, expect, it, vi } from 'vitest';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Env } from '@liveworkspace/mcp-kit/env';
import { buildTemplateTabs, templateCatalogue } from '@liveplanner/templates';
import { tabKindOf } from '@liveplanner/project';

// The renderer cannot load here; the stub hands back the structured result.
vi.mock('./image-result', () => ({
  imageResult: (data: unknown) => ({ content: [], structuredContent: data }),
}));

import { registerTools } from './tools';

// Elements given beside a template (docs/specs/015-api/mcp-server.md §4.3): added to the template's first tab as
// update_project's add ops would, not dropped; a dashboard is given alone.

const view = {
  id: 'v1',
  type: 'shape',
  shape: 'plan-view',
  x: 0,
  y: 900,
  width: 500,
  height: 360,
  planView: { view: 'gantt' },
};

function harness(refuseAt = 0) {
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
        const url = new URL(request.url);
        const path = url.pathname.replace(/^\/api/, '');
        if (path === '/events') return new Response(null, { status: 204 });
        if (request.method === 'POST' && path === '/projects') return Response.json({});
        if (request.method === 'POST' && path.endsWith('/changesets')) {
          changesets.push({ path, body: await request.json<Record<string, unknown>>() });
          return changesets.length === refuseAt
            ? Response.json({ error: 'nope' }, { status: 409 })
            : Response.json({ changeset: { id: 'c1' }, text: 'ok' });
        }
        if (/\/projects\/[^/]+$/.test(path))
          return Response.json({ project: { id: 'p', tabs: [{ id: 't', name: 'T' }] } });
        if (/\/tabs\/[^/]+$/.test(path))
          return Response.json({ tab: { id: 't', name: 'T', elements: [], rev: 3 } });
        return new Response('nope', { status: 503 });
      },
    },
  } as unknown as Env;
  registerTools(server, env);
  const call = (name: string, args: unknown) =>
    handlers[name]!(args, { authInfo: { token: 'tok' } }) as Promise<{
      isError?: boolean;
      content?: { text?: string }[];
      structuredContent?: unknown;
    }>;
  return { call, changesets };
}

describe('create_project with a template and elements', () => {
  it.each(['kanban', 'budget-planner'])(
    'adds the elements to the %s template’s first tab',
    async (template) => {
      const { call, changesets } = harness();
      const result = await call('create_project', {
        name: 'Plan',
        tabs: [{ name: 'T', template, elements: [view] }],
      });
      expect(result.isError).toBeFalsy();
      expect(changesets).toHaveLength(1);
      expect(changesets[0]!.body.operations).toEqual([
        { op: 'add', element: expect.objectContaining({ id: 'v1', shape: 'plan-view' }) },
      ]);
      expect(changesets[0]!.body.base).toEqual({ rev: 3, elements: {} });
    },
  );

  it('writes no changeset for a template alone or empty elements', async () => {
    const { call, changesets } = harness();
    await call('create_project', { name: 'Plan', tabs: [{ template: 'kanban' }] });
    await call('create_project', { name: 'Plan', tabs: [{ template: 'kanban', elements: [] }] });
    expect(changesets).toHaveLength(0);
  });

  it('refuses an element no tab holds before anything is made', async () => {
    const { call, changesets } = harness();
    const result = await call('create_project', {
      name: 'Plan',
      tabs: [{ name: 'T', template: 'kanban', elements: [{ ...view, shape: 'rectangle' }] }],
    });
    expect(result.isError).toBe(true);
    expect(result.content![0]!.text).toContain('Tab "T"');
    expect(changesets).toHaveLength(0);
  });

  it('names the made plan when the api refuses the elements', async () => {
    const { call } = harness(1);
    const result = await call('create_project', {
      name: 'Plan',
      tabs: [{ name: 'T', template: 'kanban', elements: [view] }],
    });
    expect(result.isError).toBe(true);
    expect(result.content![0]!.text).toContain('The plan was made');
  });

  it('refuses a dashboard given with a template or elements, naming the tab', async () => {
    const { call } = harness();
    for (const extra of [{ template: 'kanban' }, { elements: [view] }]) {
      const result = await call('create_project', {
        name: 'Plan',
        tabs: [{ name: 'Overview', dashboard: { metrics: ['item-count'] }, ...extra }],
      });
      expect(result.isError).toBe(true);
      expect(result.content![0]!.text).toContain('Tab "Overview"');
      expect(result.content![0]!.text).toContain('give it alone');
    }
  });
});

describe('add_tab with a template and elements', () => {
  it('adds the elements to the new tab after the template is built', async () => {
    const { call, changesets } = harness();
    const result = await call('add_tab', {
      projectId: 'p',
      name: 'T',
      template: 'kanban',
      elements: [view],
    });
    expect(result.isError).toBeFalsy();
    expect(changesets).toHaveLength(2);
    expect(changesets[0]!.body.replace).toEqual(expect.objectContaining({ template: 'kanban' }));
    expect(changesets[1]!.body.operations).toEqual([
      { op: 'add', element: expect.objectContaining({ id: 'v1' }) },
    ]);
  });

  it('names the made tab when the api refuses the elements', async () => {
    const { call } = harness(2);
    const result = await call('add_tab', { projectId: 'p', template: 'kanban', elements: [view] });
    expect(result.isError).toBe(true);
    expect(result.content![0]!.text).toContain('The tab was made');
  });

  it('refuses a dashboard given with a template or elements before anything is written', async () => {
    const { call, changesets } = harness();
    const result = await call('add_tab', {
      projectId: 'p',
      template: 'kanban',
      dashboard: { metrics: ['item-count'] },
    });
    expect(result.isError).toBe(true);
    expect(result.content![0]!.text).toContain('give it alone');
    expect(changesets).toHaveLength(0);
  });
});

// Elements land on a template's first tab; a Dashboard is built whole from its rows and could not hold them, so a
// template whose first tab is one would need a refusal (docs/specs/015-api/mcp-server.md §4.3).
describe('every template’s first tab', () => {
  it('is never a Dashboard', () => {
    const dashboards = templateCatalogue()
      .templates.map((t) => t.kind)
      .filter((kind) => {
        const [first] = buildTemplateTabs({ id: 'a', name: 'A' }, kind, () => crypto.randomUUID());
        return tabKindOf(first) === 'dashboard';
      });
    expect(dashboards).toEqual([]);
  });
});
