import { describe, expect, it, vi } from 'vitest';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Env } from '@liveworkspace/mcp-kit/env';

// The renderer cannot load here; the stub hands back the structured result.
vi.mock('./image-result', () => ({
  imageResult: (data: unknown) => ({ content: [], structuredContent: data }),
}));

import { registerTools } from './tools';

// Elements given beside a template (docs/specs/015-api/mcp-server.md §4.3): added to the new tab's first
// page as update_document's add ops would, not dropped.

const picture = {
  id: 'pic',
  type: 'shape',
  x: 40,
  y: 40,
  width: 200,
  height: 100,
  label: 'Hello',
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
        if (url.searchParams.get('view') === 'lint') return new Response('down', { status: 503 });
        if (request.method === 'POST' && path === '/documents') return Response.json({});
        if (request.method === 'POST' && path.endsWith('/changesets')) {
          changesets.push({ path, body: await request.json<Record<string, unknown>>() });
          return changesets.length === refuseAt
            ? Response.json({ error: 'nope' }, { status: 409 })
            : Response.json({ changeset: { id: 'c1' }, text: 'ok' });
        }
        if (/\/documents\/[^/]+$/.test(path))
          return Response.json({ document: { id: 'd', tabs: [{ id: 't', name: 'T' }] } });
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

describe('create_document with a template and elements', () => {
  it.each(['blank-infographic', 'blank-slide-deck'])(
    'adds the elements to the new %s tab',
    async (template) => {
      const { call, changesets } = harness();
      const result = await call('create_document', {
        name: 'Doc',
        tabs: [{ name: 'T', template, elements: [picture] }],
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
    await call('create_document', { name: 'Doc', tabs: [{ template: 'blank-infographic' }] });
    await call('create_document', {
      name: 'Doc',
      tabs: [{ template: 'blank-infographic', elements: [] }],
    });
    expect(changesets).toHaveLength(0);
  });

  it('refuses a malformed element before anything is made', async () => {
    const { call, changesets } = harness();
    const result = await call('create_document', {
      name: 'Doc',
      tabs: [{ name: 'T', template: 'blank-infographic', elements: [{ ...picture, bogus: 1 }] }],
    });
    expect(result.isError).toBe(true);
    expect(result.content![0]!.text).toContain('Tab "T"');
    expect(changesets).toHaveLength(0);
  });

  it('names the made document when the api refuses the elements', async () => {
    const { call } = harness(1);
    const result = await call('create_document', {
      name: 'Doc',
      tabs: [{ name: 'T', template: 'blank-infographic', elements: [picture] }],
    });
    expect(result.isError).toBe(true);
    expect(result.content![0]!.text).toContain('The document was made');
  });
});

describe('add_tab with a template and elements', () => {
  it('adds the elements to the new tab after the template is built', async () => {
    const { call, changesets } = harness();
    const result = await call('add_tab', {
      documentId: 'd',
      name: 'T',
      template: 'blank-infographic',
      elements: [picture],
    });
    expect(result.isError).toBeFalsy();
    expect(changesets).toHaveLength(2);
    expect(changesets[1]!.body.operations).toEqual([
      { op: 'add', element: expect.objectContaining({ id: 'pic' }) },
    ]);
  });

  it('names the made tab when the api refuses the elements', async () => {
    const { call } = harness(2);
    const result = await call('add_tab', {
      documentId: 'd',
      template: 'blank-infographic',
      elements: [picture],
    });
    expect(result.isError).toBe(true);
    expect(result.content![0]!.text).toContain('The tab was made');
  });

  it('names the made tab when an element is malformed', async () => {
    const { call } = harness();
    const result = await call('add_tab', {
      documentId: 'd',
      template: 'blank-infographic',
      elements: [{ ...picture, type: 'arrow', from: 'nowhere', to: 'pic' }],
    });
    expect(result.isError).toBe(true);
  });
});
