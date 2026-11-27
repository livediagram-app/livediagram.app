import { describe, expect, it, vi } from 'vitest';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Env } from '@liveworkspace/mcp-kit/env';
import type { TabSummary } from '@livediagram/api-schema';

// tools.ts reaches the resvg renderer through ./image-result, which plain node cannot load (tools.test.ts).
vi.mock('./image-result', () => ({
  imageResult: () => ({ content: [{ type: 'text', text: 'stub image' }] }),
}));

import { registerTools } from './tools';
import { restyledLine, targetTabs } from './style-tool';

// style_document (docs/specs/015-api/mcp-server.md §4.9f): one `style` changeset a tab.

type Registered = { name: string; handler: (args: unknown, extra: unknown) => Promise<unknown> };
type Answer = { isError?: boolean; content: { text: string }[] };
const AUTHED = { authInfo: { token: 'tok_test' } };

const DOC = {
  id: 'd1',
  name: 'Map',
  tabs: [
    { id: 't1', name: 'Flow', orderIndex: 0 },
    { id: 't2', name: 'Detail', orderIndex: 1 },
    { id: 't3', name: 'Linked', orderIndex: 2, connection: { kind: 'document', id: 'x' } },
  ],
};

function harness(changeset: (tabId: string) => Response = (tabId) => written(tabId, 5)) {
  const calls: { method: string; path: string; body: unknown }[] = [];
  const registered: Registered[] = [];
  const server = {
    registerTool: (name: string, _config: unknown, handler: Registered['handler']) => {
      registered.push({ name, handler });
    },
  } as unknown as McpServer;
  const env = {
    API: {
      fetch: async (request: Request) => {
        const url = new URL(request.url);
        if (url.pathname.endsWith('/events')) return new Response(null, { status: 204 });
        const text = await request.text();
        calls.push({
          method: request.method,
          path: url.pathname,
          body: text ? JSON.parse(text) : null,
        });
        const cs = /\/tabs\/([^/]+)\/changesets$/.exec(url.pathname);
        if (cs) return changeset(cs[1]!);
        const tab = /\/tabs\/([^/]+)$/.exec(url.pathname);
        if (tab) return Response.json({ tab: { id: tab[1], name: 'Flow', rev: 9, elements: [] } });
        return Response.json({ document: DOC });
      },
    },
  } as unknown as Env;
  registerTools(server, env);
  const tool = registered.find((r) => r.name === 'style_document')!;
  const call = async (args: Record<string, unknown>) =>
    (await tool.handler(args, AUTHED)) as Answer;
  const writes = () => calls.filter((c) => c.path.endsWith('/changesets'));
  return { calls, call, writes };
}

function written(tabId: string, rev: number): Response {
  return Response.json({
    dryRun: false,
    changeset: { id: 'cs_1', tabId, rev, previousRev: rev - 1, rebasedOver: 0 },
    results: [],
    text: '',
    warnings: [],
    lint: null,
  });
}

const json = (a: Answer) => JSON.parse(a.content[0]!.text) as Record<string, unknown>;

describe('style_document', () => {
  it('sends the style as one changeset on the named tab and answers its revision', async () => {
    const { call, writes } = harness();
    const answer = await call({ documentId: 'd1', tabId: 't1', theme: 'forest', finish: 'sketch' });
    expect(writes()).toEqual([
      {
        method: 'POST',
        path: '/api/documents/d1/tabs/t1/changesets',
        body: { style: { theme: 'forest', finish: 'sketch' } },
      },
    ]);
    expect(json(answer)).toEqual({
      documentId: 'd1',
      tabs: [{ tabId: 't1', name: 'Flow', rev: 5 }],
      lines: ['Restyled tab "Flow": theme forest, finish sketch.'],
    });
  });

  it("restyles every one of the document's own tabs without tabId, leaving connected tabs alone", async () => {
    const { call, writes } = harness();
    const answer = await call({ documentId: 'd1', font: 'inter' });
    expect(writes().map((w) => w.path)).toEqual([
      '/api/documents/d1/tabs/t1/changesets',
      '/api/documents/d1/tabs/t2/changesets',
    ]);
    expect((json(answer).tabs as { tabId: string }[]).map((t) => t.tabId)).toEqual(['t1', 't2']);
  });

  it('reads the revision when the restyle changed nothing', async () => {
    const { call } = harness(() =>
      Response.json({
        dryRun: false,
        changeset: null,
        results: [],
        text: '',
        warnings: [],
        lint: null,
      }),
    );
    const answer = await call({ documentId: 'd1', tabId: 't1', finish: 'marker' });
    expect(json(answer).tabs).toEqual([{ tabId: 't1', name: 'Flow', rev: 9 }]);
  });

  it('refuses no style, and an unknown id naming the valid ones, before any call', async () => {
    const { call, calls } = harness();
    const none = await call({ documentId: 'd1' });
    expect(none.isError).toBe(true);
    expect(none.content[0]!.text).toContain('at least one of "theme", "finish" or "font"');
    const theme = await call({ documentId: 'd1', theme: 'nope' });
    expect(theme.isError).toBe(true);
    expect(theme.content[0]!.text).toMatch(/^Unknown theme "nope"\. Valid themes: .*forest/);
    const finish = await call({ documentId: 'd1', finish: 'glossy' });
    expect(finish.content[0]!.text).toContain(
      'Valid finishes: flexible, professional, sketch, marker.',
    );
    const font = await call({ documentId: 'd1', font: 'comic' });
    expect(font.content[0]!.text).toMatch(/^Unknown font "comic"\. Valid fonts: /);
    expect(calls).toEqual([]);
  });

  it('refuses a tab the document lacks, naming its tabs', async () => {
    const { call, writes } = harness();
    const answer = await call({ documentId: 'd1', tabId: 'zz', theme: 'forest' });
    expect(answer.isError).toBe(true);
    expect(answer.content[0]!.text).toContain('No tab "zz" in this document. Tabs: Flow (t1)');
    expect(writes()).toEqual([]);
  });

  it('answers a refused changeset in words, saying which tabs were already restyled', async () => {
    const { call } = harness((tabId) =>
      tabId === 't1'
        ? written(tabId, 2)
        : Response.json({ error: 'tab_locked', message: 'the tab is locked' }, { status: 409 }),
    );
    const answer = await call({ documentId: 'd1', theme: 'forest' });
    expect(answer.isError).toBe(true);
    expect(answer.content[0]!.text).toBe(
      'Tab "Detail": tab_locked: the tab is locked Restyled tab "Flow": theme forest.',
    );
  });
});

describe('targetTabs and restyledLine', () => {
  it('finds a tab by its name too, and refuses a document with no tabs of its own', () => {
    const tabs = DOC.tabs.map((t) => ({ ...t, documentId: 'd1', updatedAt: 1 })) as TabSummary[];
    expect(targetTabs(tabs, 'Detail')).toEqual([tabs[1]]);
    expect(targetTabs([tabs[2]!], undefined)).toBe('That document has no tabs to restyle.');
  });

  it('says each field given, in order', () => {
    expect(restyledLine('Flow', { font: 'inter', theme: 'forest' })).toBe(
      'Restyled tab "Flow": theme forest, font inter.',
    );
  });
});
