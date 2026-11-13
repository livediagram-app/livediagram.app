import { describe, expect, it, vi } from 'vitest';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Env } from '@liveworkspace/mcp-kit/env';

// The renderer cannot load here; the stub hands back the structured result.
vi.mock('./image-result', () => ({
  imageResult: (data: unknown) => ({ content: [], structuredContent: data }),
}));

import { registerTools } from './tools';

// Elements given beside a template (docs/specs/015-api/mcp-server.md §4.3): added to the template's tab as
// update_design's add ops would, not dropped.

const box = { id: 'pic', type: 'shape', x: 40, y: 40, width: 200, height: 100, label: 'Hello' };
// An element the template built, as the stored tab holds it, for an arrow to pin to.
const scaffold = {
  id: 'tpl',
  type: 'shape',
  x: 400,
  y: 40,
  width: 200,
  height: 100,
  label: 'Step',
};
const pin = (elementId: string) => ({ kind: 'pinned', elementId });

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
        if (url.searchParams.get('view') === 'lint') return new Response('down', { status: 503 });
        if (request.method === 'POST' && path === '/designs') return Response.json({});
        if (request.method === 'POST' && path.endsWith('/changesets')) {
          changesets.push({ path, body: await request.json<Record<string, unknown>>() });
          return changesets.length === refuseAt
            ? Response.json({ error: 'nope' }, { status: 409 })
            : Response.json({ changeset: { id: 'c1' }, text: 'ok' });
        }
        if (/\/designs\/[^/]+$/.test(path))
          return Response.json({ design: { id: 'd', tabs: [{ id: 't', name: 'T' }] } });
        if (/\/tabs\/[^/]+$/.test(path))
          return Response.json({ tab: { id: 't', name: 'T', elements: [scaffold], rev: 3 } });
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

describe('create_design with a template and elements', () => {
  it.each(['blank-logo', 'wireframe-mobile-app'])(
    'adds the elements to the new %s tab',
    async (template) => {
      const { call, changesets } = harness();
      const result = await call('create_design', {
        name: 'Design',
        tabs: [{ name: 'T', template, elements: [box] }],
      });
      expect(result.isError).toBeFalsy();
      expect(changesets).toHaveLength(1);
      expect(changesets[0]!.body.operations).toEqual([
        { op: 'add', element: expect.objectContaining({ id: 'pic', label: 'Hello' }) },
      ]);
      expect(changesets[0]!.body.base).toEqual({ rev: 3, elements: {} });
    },
  );

  it('writes no changeset for a template alone or empty elements', async () => {
    const { call, changesets } = harness();
    await call('create_design', { name: 'Design', tabs: [{ template: 'blank-logo' }] });
    await call('create_design', {
      name: 'Design',
      tabs: [{ template: 'blank-logo', elements: [] }],
    });
    expect(changesets).toHaveLength(0);
  });

  it('refuses a malformed element before anything is made', async () => {
    const { call, changesets } = harness();
    const result = await call('create_design', {
      name: 'Design',
      tabs: [{ name: 'T', template: 'blank-logo', elements: [{ ...box, bogus: 1 }] }],
    });
    expect(result.isError).toBe(true);
    expect(result.content![0]!.text).toContain('Tab "T"');
    expect(changesets).toHaveLength(0);
  });

  it('names the made design when the api refuses the elements', async () => {
    const { call } = harness(1);
    const result = await call('create_design', {
      name: 'Design',
      tabs: [{ name: 'T', template: 'blank-logo', elements: [box] }],
    });
    expect(result.isError).toBe(true);
    expect(result.content![0]!.text).toContain('The design was made');
  });
});

describe('add_tab with a template and elements', () => {
  it('adds the elements to the new tab after the template is built', async () => {
    const { call, changesets } = harness();
    const result = await call('add_tab', {
      designId: 'd',
      name: 'T',
      template: 'blank-logo',
      elements: [box],
    });
    expect(result.isError).toBeFalsy();
    expect(changesets).toHaveLength(2);
    expect(changesets[0]!.body.replace).toEqual(
      expect.objectContaining({ template: 'blank-logo' }),
    );
    expect(changesets[1]!.body.operations).toEqual([
      { op: 'add', element: expect.objectContaining({ id: 'pic' }) },
    ]);
  });

  it('lets an arrow pin to one of the template elements', async () => {
    const { call, changesets } = harness();
    const arrow = { id: 'a', type: 'arrow', from: pin('pic'), to: pin('tpl') };
    const result = await call('add_tab', {
      designId: 'd',
      template: 'blank-logo',
      elements: [box, arrow],
    });
    expect(result.isError).toBeFalsy();
    expect(changesets[1]!.body.operations).toHaveLength(2);
  });

  it('names the made tab when the api refuses the elements', async () => {
    const { call } = harness(2);
    const result = await call('add_tab', {
      designId: 'd',
      template: 'blank-logo',
      elements: [box],
    });
    expect(result.isError).toBe(true);
    expect(result.content![0]!.text).toContain('The tab was made');
  });

  it('names the made tab when an arrow pins to nothing', async () => {
    const { call } = harness();
    const result = await call('add_tab', {
      designId: 'd',
      template: 'blank-logo',
      elements: [box, { id: 'a', type: 'arrow', from: pin('nowhere'), to: pin('pic') }],
    });
    expect(result.isError).toBe(true);
    expect(result.content![0]!.text).toContain('The tab was made, but its elements');
  });
});
