// The one MCP end to end through its Worker entry (liveworkspace/docs/specs/021-mcp/mcp.md): each app's MCP package
// is a stub answering JSON-RPC from its recorded tool list, so these pin the routing, the renames in answers, the
// core verbs' mapping, per-app consent and a refused token.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { APPS, type AppId, type Binding } from './apps';
import { forgetCatalogues } from './app-client';
import type { Env } from './env';
import { oneMcp } from './one-mcp';

// The Worker with each app's package swapped for the stubs below, which the test env carries under the binding names.
const worker = oneMcp<Env>((e) => e);

type Call = {
  app: AppId;
  method: string;
  name?: string;
  args?: Record<string, unknown>;
  auth: string | null;
};

function mockKV(): KVNamespace {
  const m = new Map<string, string>();
  return {
    get: async (k: string, type?: string): Promise<unknown> => {
      const v = m.get(k);
      if (v == null) return null;
      return type === 'json' ? JSON.parse(v) : v;
    },
    put: async (k: string, v: string) => {
      m.set(k, v);
    },
    delete: async (k: string) => {
      m.delete(k);
    },
  } as unknown as KVNamespace;
}

function recorded(app: string): unknown[] {
  const text = readFileSync(
    join(import.meta.dirname, '..', 'eval', 'tools', `${app}.json`),
    'utf8',
  );
  const parsed: unknown = JSON.parse(text);
  return Array.isArray(parsed) ? parsed : [];
}

let calls: Call[];
// What an app's tool answers, by app and its own tool name; a default answer otherwise.
let answers: Partial<Record<string, (args: Record<string, unknown>) => unknown>>;
let refusing: AppId | null;
let failing: AppId | null;
// An app whose MCP can't be reached at all.
let down: AppId | null;
let env: Env;

function appWorker(app: AppId): Fetcher {
  return {
    fetch: async (input: RequestInfo, init?: RequestInit) => {
      if (down === app) throw new Error('network connection lost');
      const request = new Request(input, init);
      const auth = request.headers.get('Authorization');
      const body = await request.json<{
        id: number;
        method: string;
        params: { name?: string; arguments?: Record<string, unknown> };
      }>();
      calls.push({
        app,
        method: body.method,
        name: body.params.name,
        args: body.params.arguments,
        auth,
      });
      if (refusing === app) return Response.json({ error: 'invalid_token' }, { status: 401 });
      const reply = (result: unknown) => Response.json({ jsonrpc: '2.0', id: body.id, result });
      const extra = appExtras(app, body.method, body.params);
      if (extra === 'none')
        return Response.json({
          jsonrpc: '2.0',
          id: body.id,
          error: { code: -32601, message: 'Method not found' },
        });
      if (extra === 'invalid')
        return Response.json({
          jsonrpc: '2.0',
          id: body.id,
          error: {
            code: -32602,
            message: 'MCP error -32602: Invalid arguments for prompt diagram_this',
          },
        });
      if (extra !== undefined) return reply(extra);
      if (body.method === 'tools/list')
        return Response.json({ jsonrpc: '2.0', id: body.id, result: { tools: recorded(app) } });
      if (failing === app) return new Response('boom', { status: 503 });
      const answer = answers[`${app}.${body.params.name}`];
      const value = answer ? answer(body.params.arguments ?? {}) : { ok: true };
      // An answer can be a whole tool result (a refusal, a plain text view) under `result`.
      const whole = (value as { result?: unknown }).result;
      return Response.json({
        jsonrpc: '2.0',
        id: body.id,
        result:
          whole !== undefined
            ? whole
            : {
                content: [{ type: 'text', text: JSON.stringify(value) }],
                structuredContent: value,
              },
      });
    },
    connect: () => {
      throw new Error('no sockets');
    },
  };
}

// What each app's MCP answers beside its tools: its instructions, prompts and resources. livedesign has no prompts.
function appExtras(app: AppId, method: string, params: Record<string, unknown>): unknown {
  switch (method) {
    case 'initialize':
      return {
        protocolVersion: '2025-06-18',
        instructions: `${app}: call update_document to edit.`,
      };
    case 'prompts/list':
      if (app === 'livedesign') return 'none';
      return {
        prompts: [
          {
            name: `show_my_${APPS.find((a) => a.app === app)!.itemWord}`,
            description: 'Find one with find_documents.',
          },
          ...(app === 'livediagram' ? [{ name: 'diagram_this', description: 'A diagram.' }] : []),
        ],
      };
    case 'prompts/get':
      // A prompt's required argument left out: the app's MCP refuses it as invalid params.
      if (params.name === 'diagram_this' && !(params.arguments as { text?: unknown })?.text)
        return 'invalid';
      return {
        messages: [
          {
            role: 'user',
            content: { type: 'text', text: `${String(params.name)}: use read_document.` },
          },
        ],
      };
    case 'resources/list':
      return { resources: [{ uri: `${app}://schema/elements`, name: `${app} elements` }] };
    case 'resources/templates/list':
      return { resourceTemplates: [] };
    case 'resources/read':
      return {
        contents: [
          { uri: params.uri, mimeType: 'text/html', text: "callTool({ name: 'view_tab' })" },
        ],
      };
    default:
      return undefined;
  }
}

const ctx = {
  waitUntil: () => {},
  passThroughOnException: () => {},
  props: {},
} as unknown as ExecutionContext;

async function rpc(
  method: string,
  params: Record<string, unknown> = {},
  opts: { all?: boolean; token?: string; host?: string } = {},
) {
  const query = new URLSearchParams();
  if (opts.all) query.set('tools', 'all');
  const url = `https://${opts.host ?? 'mcp.liveworkspace.test'}/mcp${query.size ? `?${query.toString()}` : ''}`;
  const response = await worker.fetch(
    new Request(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${opts.token ?? 'lwt_person'}`,
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
      },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    }),
    env,
    ctx,
  );
  return response;
}

async function tool(
  name: string,
  args: Record<string, unknown> = {},
  opts: { all?: boolean; token?: string } = {},
) {
  const response = await rpc('tools/call', { name, arguments: args }, opts);
  const body = await response.json<{
    result: {
      content: { text: string }[];
      structuredContent?: Record<string, unknown>;
      isError?: boolean;
    };
  }>();
  return body.result;
}

async function listNames(
  opts: { all?: boolean; token?: string; host?: string } = {},
): Promise<string[]> {
  const body = await (
    await rpc('tools/list', {}, opts)
  ).json<{ result: { tools: { name: string }[] } }>();
  return body.result.tools.map((t) => t.name);
}

beforeEach(() => {
  forgetCatalogues();
  calls = [];
  answers = {};
  refusing = null;
  failing = null;
  down = null;
  const bindings = Object.fromEntries(APPS.map((a) => [a.binding, appWorker(a.app)])) as Record<
    Binding,
    Fetcher
  >;
  env = { ...bindings, OAUTH_KV: mockKV(), CONSENT_BASE_URL: 'https://www.liveworkspace.test' };
});

describe('tools/list', () => {
  it('lists the ten core verbs by default', async () => {
    expect(await listNames()).toEqual([
      'find_items',
      'read_item',
      'create_item',
      'share_item',
      'rename_item',
      'trash_item',
      'restore_item',
      'list_app_tools',
      'read_with_app_tool',
      'change_with_app_tool',
    ]);
  });

  it('names each kind’s tools in list_app_tools, read-only apart, so one call fetches the schemas', async () => {
    const response = await rpc('tools/list', {});
    const { result } = await response.json<{
      result: { tools: { name: string; description: string }[] };
    }>();
    const description = result.tools.find((t) => t.name === 'list_app_tools')!.description;
    expect(description).toMatch(/plan: reads [^;]*list_cards[^;]*; changes [^.]*change_cards/);
    expect(description).toContain('knowledgebase: reads');
    down = 'livedocuments';
    forgetCatalogues();
    const without = await rpc('tools/list', {});
    const tools = (
      await without.json<{ result: { tools: { name: string; description: string }[] } }>()
    ).result.tools;
    expect(tools).toHaveLength(10);
    expect(tools.find((t) => t.name === 'list_app_tools')!.description).not.toContain('doc: reads');
  });

  it('lists the other names when a guessed tool name is wrong', async () => {
    const listed = await tool('list_app_tools', { kind: 'plan', tools: ['read_plan_sheet'] });
    const value = listed.structuredContent as { unknown: string[]; available: { name: string }[] };
    expect(value.unknown).toEqual(['read_plan_sheet']);
    expect(value.available.map((t) => t.name)).toContain('read_sheet');
  });

  it('lists every renamed editing tool with tools=all', async () => {
    const names = await listNames({ all: true });
    expect(names).toContain('update_diagram');
    expect(names).toContain('change_cards');
    expect(names).toContain('write_article');
    expect(names).toContain('search_knowledge_pages');
    expect(names).not.toContain('update_document');
    expect(new Set(names).size).toBe(names.length);
  });

  it('leaves out an app whose tool list can’t be read, and still finds the others’ tools', async () => {
    down = 'livedocuments';
    const names = await listNames({ all: true });
    expect(names).toContain('update_diagram');
    expect(names).not.toContain('write_article');
    await tool('change_with_app_tool', { tool: 'change_cards', arguments: { projectId: 'P1' } });
    expect(calls.find((c) => c.method === 'tools/call')).toMatchObject({ app: 'liveplanner' });
  });

  it('answers 401 when an app refuses the token while listing, readable from a page', async () => {
    refusing = 'liveplanner';
    const response = await rpc('tools/list', {}, { all: true });
    expect(response.status).toBe(401);
    // A client in a page reads the challenge only when CORS lets it.
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(response.headers.get('Access-Control-Expose-Headers')).toContain('WWW-Authenticate');
  });

  it('gives every tool a title and its hints in full, as Claude’s connector directory requires', async () => {
    const response = await rpc('tools/list', {}, { all: true });
    const { result } = await response.json<{
      result: { tools: { name: string; title?: string; annotations?: Record<string, unknown> }[] };
    }>();
    const missing = result.tools.filter(
      (t) =>
        !t.title ||
        !(
          t.annotations?.readOnlyHint === true ||
          (t.annotations?.readOnlyHint === false &&
            typeof t.annotations.destructiveHint === 'boolean')
        ),
    );
    expect(missing.map((t) => t.name)).toEqual([]);
    expect(JSON.stringify(result.tools)).not.toContain('additionalItems');
  });

  it('marks each editing tool readOnly or not in list_app_tools', async () => {
    const listed = await tool('list_app_tools', { kind: 'plan' });
    const tools = (listed.structuredContent as { tools: { name: string; readOnly: boolean }[] })
      .tools;
    expect(tools.find((t) => t.name === 'list_cards')!.readOnly).toBe(true);
    expect(tools.find((t) => t.name === 'change_cards')!.readOnly).toBe(false);
  });

  it('reads each app’s tool list once per isolate', async () => {
    await listNames({ all: true });
    await listNames({ all: true });
    expect(calls.filter((c) => c.method === 'tools/list')).toHaveLength(APPS.length);
  });
});

describe('routing', () => {
  it('calls an editing tool on its app by its own name, as the person, and rewrites names in the answer', async () => {
    answers['livediagram.update_document'] = () => ({ next: 'Call read_document to check it.' });
    const result = await tool('change_with_app_tool', {
      tool: 'update_diagram',
      arguments: { documentId: 'D1', elements: [] },
    });
    const call = calls.find((c) => c.method === 'tools/call')!;
    expect(call).toMatchObject({
      app: 'livediagram',
      name: 'update_document',
      auth: 'Bearer lwt_person',
    });
    expect(call.args).toEqual({ documentId: 'D1', elements: [] });
    expect(result.content[0]!.text).toContain('read_diagram');
    expect(result.content[0]!.text).not.toContain('read_document');
  });

  it('never rewrites what a person wrote, only the answer’s guidance and its refusals', async () => {
    const markdown = 'Ask the agent to call get_context first.';
    answers['liveknowledge.read_page'] = () => ({
      page: { title: 'get_context', markdown, tags: ['read_page'] },
      next: 'suggest_edit proposes a change to this page.',
    });
    const read = await tool('read_with_app_tool', {
      tool: 'read_knowledge_page',
      arguments: { documentId: 'K1', page: 'p1' },
    });
    const text = JSON.parse(read.content[0]!.text) as Record<string, unknown>;
    for (const value of [text, read.structuredContent!])
      expect(value).toEqual({
        page: { title: 'get_context', markdown, tags: ['read_page'] },
        next: 'suggest_knowledge_edit proposes a change to this page.',
      });
    answers['liveknowledge.list_pages'] = () => ({ pages: [{ title: 'search_pages' }] });
    const listed = await tool('read_with_app_tool', {
      tool: 'list_knowledge_pages',
      arguments: { documentId: 'K1' },
    });
    expect(listed.content[0]!.text).toBe(JSON.stringify({ pages: [{ title: 'search_pages' }] }));
    answers['liveknowledge.write_page'] = () => ({
      result: {
        content: [{ type: 'text', text: 'No such page: list_pages lists them.' }],
        isError: true,
      },
    });
    const refused = await tool('change_with_app_tool', {
      tool: 'write_knowledge_page',
      arguments: { documentId: 'K1', page: 'p9', markdown: 'x' },
    });
    expect(refused.content[0]!.text).toBe('No such page: list_knowledge_pages lists them.');
    answers['livediagram.read_document'] = () => ({
      result: { content: [{ type: 'text', text: 'Box "read_document"\n{"id":"D1"}' }] },
    });
    const view = await tool('read_item', { ref: 'diagram:D1' });
    expect(view.content[0]!.text).toBe('Box "read_document"\n{"id":"D1"}');
  });

  it('calls an editing tool directly with tools=all', async () => {
    await tool('change_cards', { projectId: 'P1', changes: [] }, { all: true });
    expect(calls.find((c) => c.method === 'tools/call')).toMatchObject({
      app: 'liveplanner',
      name: 'change_items',
    });
  });

  it('keeps reading and changing apart: each verb refuses the other’s tools and names the right one', async () => {
    const wrongWay = await tool('read_with_app_tool', {
      tool: 'change_cards',
      arguments: { projectId: 'P1' },
    });
    expect(wrongWay.isError).toBe(true);
    expect(wrongWay.content[0]!.text).toContain('change_with_app_tool');
    const otherWay = await tool('change_with_app_tool', {
      tool: 'list_cards',
      arguments: { projectId: 'P1' },
    });
    expect(otherWay.isError).toBe(true);
    expect(otherWay.content[0]!.text).toContain('read_with_app_tool');
    expect(calls.filter((c) => c.method === 'tools/call')).toEqual([]);
    await tool('read_with_app_tool', { tool: 'list_cards', arguments: { projectId: 'P1' } });
    expect(calls.find((c) => c.method === 'tools/call')).toMatchObject({
      app: 'liveplanner',
      name: 'list_items',
    });
  });

  it('puts a ref where the app wants its own id, from the verb, the arguments or the kind’s name', async () => {
    await tool('read_with_app_tool', { tool: 'list_cards', ref: 'plan:P1' });
    await tool('read_with_app_tool', { tool: 'list_cards', arguments: { ref: 'plan:P2' } });
    await tool('read_with_app_tool', { tool: 'list_cards', arguments: { plan: 'P3' } });
    await tool('read_with_app_tool', { tool: 'list_cards', arguments: { projectId: 'plan:P4' } });
    await tool('read_with_app_tool', {
      tool: 'list_cards',
      arguments: { projectId: 'P5' },
      ref: 'plan:P9',
    });
    expect(calls.filter((c) => c.method === 'tools/call').map((c) => c.args)).toEqual([
      { projectId: 'P1' },
      { projectId: 'P2' },
      { projectId: 'P3' },
      { projectId: 'P4' },
      { projectId: 'P5' },
    ]);
  });

  it('refuses an unknown editing tool in words', async () => {
    const result = await tool('change_with_app_tool', { tool: 'update_document' });
    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain('list_app_tools');
  });

  it('answers 401 with the sign-in challenge when an app refuses the token', async () => {
    refusing = 'livediagram';
    const response = await rpc('tools/call', {
      name: 'read_item',
      arguments: { ref: 'diagram:D1' },
    });
    expect(response.status).toBe(401);
    expect(response.headers.get('WWW-Authenticate')).toContain('invalid_token');
  });

  it('answers 401 with no token at all', async () => {
    const response = await worker.fetch(
      new Request('https://mcp.liveworkspace.test/mcp', { method: 'POST', body: '{}' }),
      env,
      ctx,
    );
    expect(response.status).toBe(401);
  });
});

describe('core verbs', () => {
  it('find_items asks every app and marks each match with its ref', async () => {
    answers['livediagram.find_documents'] = () => ({
      count: 1,
      documents: [{ id: 'D1', name: 'Checkout' }],
    });
    answers['liveplanner.find_projects'] = () => ({
      count: 1,
      projects: [{ id: 'P1', name: 'Checkout plan' }],
    });
    const result = await tool('find_items', { query: 'checkout' });
    const items = result.structuredContent!.items as Record<string, unknown>[];
    expect(items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ ref: 'diagram:D1', kind: 'diagram', name: 'Checkout' }),
        expect.objectContaining({ ref: 'plan:P1', kind: 'plan', name: 'Checkout plan' }),
      ]),
    );
    const finds = calls.filter((c) => c.method === 'tools/call');
    expect(finds.map((c) => `${c.app}.${c.name}`).toSorted()).toEqual([
      'livedesign.find_designs',
      'livediagram.find_documents',
      'livedocuments.find_documents',
      'liveknowledge.find_documents',
      'liveplanner.find_projects',
    ]);
    expect(finds.every((c) => c.args!.query === 'checkout')).toBe(true);
  });

  it('find_items names an app that failed and still answers with the rest', async () => {
    failing = 'livedesign';
    answers['livediagram.find_documents'] = () => ({
      count: 1,
      documents: [{ id: 'D1', name: 'A' }],
    });
    const result = await tool('find_items', {});
    expect(result.structuredContent!.count).toBe(1);
    expect(result.structuredContent!.failed).toEqual([expect.objectContaining({ kind: 'design' })]);
  });

  it('find_items with kind and where "trash" reads that app’s Trash', async () => {
    answers['liveplanner.list_trash'] = () => ({ items: [{ id: 'P9', name: 'Old' }] });
    const result = await tool('find_items', { kind: 'plan', where: 'trash' });
    expect(calls.filter((c) => c.method === 'tools/call').map((c) => c.name)).toEqual([
      'list_trash',
    ]);
    expect(result.structuredContent!.items).toEqual([expect.objectContaining({ ref: 'plan:P9' })]);
  });

  it('create_item makes a deck from livedocuments’ blank slide deck and answers its ref', async () => {
    answers['livedocuments.create_document'] = () => ({ documentId: 'L1', url: 'https://x' });
    const result = await tool('create_item', { kind: 'deck', name: 'Q3 review' });
    expect(calls.find((c) => c.method === 'tools/call')).toMatchObject({
      app: 'livedocuments',
      name: 'create_document',
      args: { name: 'Q3 review', tabs: [{ template: 'blank-slide-deck' }] },
    });
    expect(result.structuredContent!.ref).toBe('doc:L1');
  });

  it('create_item starts a plan from the kanban template and a diagram with a blank tab', async () => {
    await tool('create_item', { kind: 'plan', name: 'Redesign' });
    await tool('create_item', { kind: 'diagram', name: 'Signup' });
    expect(calls.filter((c) => c.method === 'tools/call').map((c) => c.args)).toEqual([
      { name: 'Redesign', tabs: [{ template: 'kanban' }] },
      { name: 'Signup', tabs: [{ elements: [] }] },
    ]);
  });

  it('create_item makes a knowledgebase from a template without tabs', async () => {
    await tool('create_item', {
      kind: 'knowledgebase',
      name: 'Handbook',
      template: 'team-handbook',
    });
    expect(calls.find((c) => c.method === 'tools/call')).toMatchObject({
      app: 'liveknowledge',
      name: 'create_document',
      args: { name: 'Handbook', template: 'team-handbook' },
    });
  });

  it.each([
    [
      'read_item',
      { ref: 'plan:P1', tabId: 'T1' },
      'liveplanner',
      'read_project',
      { projectId: 'P1', tabId: 'T1' },
    ],
    ['read_item', { ref: 'knowledgebase:K1' }, 'liveknowledge', 'list_pages', { documentId: 'K1' }],
    [
      'share_item',
      { ref: 'design:G1', role: 'view' },
      'livedesign',
      'share_design',
      { designId: 'G1', role: 'view' },
    ],
    [
      'rename_item',
      { ref: 'doc:L1', name: 'New' },
      'livedocuments',
      'rename_document',
      { documentId: 'L1', name: 'New' },
    ],
    ['trash_item', { ref: 'diagram:D1' }, 'livediagram', 'delete_document', { documentId: 'D1' }],
    [
      'restore_item',
      { ref: 'diagram:D1' },
      'livediagram',
      'restore_document',
      { documentId: 'D1' },
    ],
  ] as const)('%s %j calls %s %s', async (name, args, app, appTool, appArgs) => {
    await tool(name, args);
    expect(calls.find((c) => c.method === 'tools/call')).toMatchObject({
      app,
      name: appTool,
      args: appArgs,
    });
  });

  it('refuses a ref that is not one', async () => {
    const result = await tool('read_item', { ref: 'D1' });
    expect(result.isError).toBe(true);
    expect(calls).toEqual([]);
  });

  it('list_app_tools lists a kind’s tools in a line each, then in full', async () => {
    const short = await tool('list_app_tools', { kind: 'plan' });
    const tools = short.structuredContent!.tools as { name: string; does: string }[];
    expect(tools.map((t) => t.name)).toContain('change_cards');
    expect(tools.every((t) => !t.does.startsWith('For '))).toBe(true);
    const full = await tool('list_app_tools', { kind: 'plan', tools: ['change_cards', 'nope'] });
    expect(full.structuredContent!.tools).toEqual([
      expect.objectContaining({ name: 'change_cards', inputSchema: expect.any(Object) }),
    ]);
    expect(full.structuredContent!.unknown).toEqual(['nope']);
  });
});

async function grant(apps: string[], token: string): Promise<string> {
  // The OAuth flow's last steps, as the consent page drives them.
  await env.OAUTH_KV.put(
    'session:s1',
    JSON.stringify({
      clientId: 'c1',
      redirectUri: 'https://claude.test/cb',
      codeChallenge: 'x'.repeat(43),
      clientName: 'Claude',
    }),
  );
  const response = await worker.fetch(
    new Request('https://mcp.liveworkspace.test/oauth/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session: 's1', token, apps }),
    }),
    env,
    ctx,
  );
  expect(response.status).toBe(200);
  return token;
}

describe('everything an app’s MCP offers', () => {
  async function result<T>(method: string, params: Record<string, unknown> = {}, token?: string) {
    const body = await (await rpc(method, params, { token })).json<{ result: T }>();
    return body.result;
  }

  it('list_app_tools gives the app’s own guidance, old tool names rewritten', async () => {
    const listed = await tool('list_app_tools', { kind: 'diagram' });
    expect(listed.structuredContent!.guide).toBe('livediagram: call update_diagram to edit.');
    await tool('list_app_tools', { kind: 'diagram' });
    expect(calls.filter((c) => c.method === 'initialize')).toHaveLength(1);
  });

  it('lists every app’s prompts under their noun, and runs one through its app', async () => {
    const { prompts } = await result<{ prompts: { name: string; description: string }[] }>(
      'prompts/list',
    );
    expect(prompts.map((p) => p.name).toSorted()).toEqual(
      [
        'diagram_this',
        'show_my_diagram',
        'show_my_doc',
        'show_my_knowledgebase',
        'show_my_plan',
      ].toSorted(),
    );
    expect(prompts.find((p) => p.name === 'show_my_diagram')!.description).toBe(
      'Find one with find_diagrams.',
    );
    const got = await result<{ messages: { content: { text: string } }[] }>('prompts/get', {
      name: 'show_my_diagram',
    });
    expect(got.messages[0]!.content.text).toBe('show_my_document: use read_diagram.');
    expect(calls.find((c) => c.method === 'prompts/get')).toMatchObject({ app: 'livediagram' });
  });

  it('passes on an app’s refusal of a prompt’s arguments as invalid params, not an internal error', async () => {
    const response = await rpc('prompts/get', { name: 'diagram_this', arguments: {} });
    const { error } = await response.json<{ error: { code: number; message: string } }>();
    expect(error.code).toBe(-32602);
    expect(error.message).toBe(
      'MCP error -32602: livediagram: Invalid arguments for prompt diagram_this',
    );
  });

  it('answers 401 when an app refuses the token while reading a resource', async () => {
    refusing = 'livediagram';
    const response = await rpc('resources/read', { uri: 'ui://livediagram/view.html' });
    expect(response.status).toBe(401);
  });

  it('lists every app’s resources and reads one through the app that owns it, names rewritten', async () => {
    const { resources } = await result<{ resources: { uri: string }[] }>('resources/list');
    expect(resources.map((r) => r.uri)).toContain('liveknowledge://schema/elements');
    const read = await result<{ contents: { text: string }[] }>('resources/read', {
      uri: 'ui://livediagram/view.html',
    });
    expect(read.contents[0]!.text).toBe("callTool({ name: 'view_diagram_tab' })");
    expect(calls.find((c) => c.method === 'resources/read')).toMatchObject({ app: 'livediagram' });
  });

  it('offers only the allowed apps’ prompts and resources', async () => {
    await grant(['livediagram', 'liveplanner'], 'lwt_two');
    const { prompts } = await result<{ prompts: { name: string }[] }>(
      'prompts/list',
      {},
      'lwt_two',
    );
    expect(prompts.map((p) => p.name).toSorted()).toEqual([
      'diagram_this',
      'show_my_diagram',
      'show_my_plan',
    ]);
    const refused = await (
      await rpc('resources/read', { uri: 'livedesign://schema/elements' }, { token: 'lwt_two' })
    ).json<{ error?: { message: string } }>();
    expect(refused.error?.message).toContain('not found');
  });
});

describe('per-app consent', () => {
  it('keeps a connection to the apps ticked', async () => {
    const token = await grant(['livediagram', 'liveplanner'], 'lwt_two');
    const names = await listNames({ all: true, token });
    expect(names).toContain('update_diagram');
    expect(names).toContain('change_cards');
    expect(names).not.toContain('write_article');
    const result = await tool('read_item', { ref: 'doc:L1' }, { token });
    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain('left unticked');
    const found = await tool('find_items', {}, { token });
    expect(found.isError).toBeUndefined();
    expect(
      calls
        .filter((c) => c.method === 'tools/call')
        .map((c) => c.app)
        .toSorted(),
    ).toEqual(['livediagram', 'liveplanner']);
  });

  it('answers 503 rather than every app when the grant can’t be read', async () => {
    await grant(['livediagram'], 'lwt_narrow');
    const kv = env.OAUTH_KV;
    env = {
      ...env,
      OAUTH_KV: {
        ...kv,
        get: async () => {
          throw new Error('KV GET failed: 503');
        },
      },
    };
    const response = await rpc('tools/list', {}, { all: true, token: 'lwt_narrow' });
    expect(response.status).toBe(503);
    expect(calls).toEqual([]);
  });

  it('keeps nothing when every app is ticked, or none is named', async () => {
    const all = (await listNames({ all: true })).length;
    expect(
      await listNames({
        all: true,
        token: await grant(
          APPS.map((a) => a.app),
          'lwt_every',
        ),
      }),
    ).toHaveLength(all);
    expect(await listNames({ all: true, token: await grant([], 'lwt_none') })).toHaveLength(all);
  });
});

describe('an app’s old address (mcp.<app>.app)', () => {
  const host = (app: AppId) => `mcp.${app}.app`;
  const own = (app: AppId) => recorded(app) as { name: string; description?: string }[];

  it.each(APPS.map((a) => a.app))(
    '%s: lists the app’s own tools, names and texts as they were',
    async (app) => {
      const body = await (
        await rpc('tools/list', {}, { host: host(app) })
      ).json<{ result: { tools: { name: string; description?: string }[] } }>();
      expect(body.result.tools.map((t) => t.name)).toEqual(own(app).map((t) => t.name));
      expect(body.result.tools.map((t) => t.description)).toEqual(
        own(app).map((t) => t.description),
      );
      expect(body.result.tools.map((t) => t.name)).not.toContain('find_items');
    },
  );

  it.each(APPS.map((a) => a.app))('%s: calls a tool by its own name', async (app) => {
    const name = own(app)[0]!.name;
    const response = await rpc(
      'tools/call',
      { name, arguments: { a: 1 } },
      { host: host(app), token: 'lwt_old' },
    );
    expect(response.status).toBe(200);
    const body = await response.json<{ result?: unknown; error?: unknown }>();
    expect(body.error).toBeUndefined();
    expect(calls).toEqual([
      { app, method: 'tools/call', name, args: { a: 1 }, auth: 'Bearer lwt_old' },
    ]);
  });

  it('calls liveknowledge’s list_pages, the name an old connection holds', async () => {
    const response = await rpc(
      'tools/call',
      { name: 'list_pages', arguments: {} },
      { host: 'mcp.liveknowledge.app' },
    );
    expect(await response.json()).not.toHaveProperty('error');
    expect(calls.map((c) => `${c.app}.${c.name}`)).toEqual(['liveknowledge.list_pages']);
  });

  it('gives the app’s own instructions, prompts and resources, unrenamed', async () => {
    const init = await (
      await rpc('initialize', {}, { host: 'mcp.livediagram.app' })
    ).json<{ result: { instructions: string } }>();
    expect(init.result.instructions).toBe('livediagram: call update_document to edit.');
    const prompts = await (
      await rpc('prompts/list', {}, { host: 'mcp.livediagram.app' })
    ).json<{ result: { prompts: { name: string }[] } }>();
    expect(prompts.result.prompts.map((p) => p.name)).toContain('show_my_document');
  });

  it('never widens what the token was granted', async () => {
    const token = await grant(['liveplanner'], 'lwt_planner');
    const refused = await rpc('tools/list', {}, { token, host: 'mcp.livediagram.app' });
    expect(refused.status).toBe(401);
    expect(await refused.text()).toContain('https://mcp.liveworkspace.app/mcp');
    expect(calls).toEqual([]);
    expect(await listNames({ token, host: 'mcp.liveplanner.app' })).toContain('change_items');
  });

  it('answers a token the app refused with the pointer, not a sign-in', async () => {
    refusing = 'livediagram';
    const response = await rpc('tools/list', {}, { host: 'mcp.livediagram.app' });
    expect(response.status).toBe(401);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(await response.text()).toContain('https://mcp.liveworkspace.app/mcp');
  });

  it('answers a page’s preflight and its sign-in refusals with CORS, as the one MCP does', async () => {
    const preflight = await worker.fetch(
      new Request('https://mcp.livediagram.app/mcp', {
        method: 'OPTIONS',
        headers: {
          Origin: 'https://inspector.test',
          'Access-Control-Request-Method': 'POST',
          'Access-Control-Request-Headers': 'authorization, content-type',
        },
      }),
      env,
      ctx,
    );
    expect(preflight.status).toBe(204);
    expect(preflight.headers.get('Access-Control-Allow-Origin')).toBe('*');
    const register = await worker.fetch(
      new Request('https://mcp.livediagram.app/oauth/register', { method: 'POST', body: '{}' }),
      env,
      ctx,
    );
    expect(register.status).toBe(400);
    expect(register.headers.get('Access-Control-Allow-Origin')).toBe('*');
    const noToken = await worker.fetch(
      new Request('https://mcp.livediagram.app/mcp', { method: 'POST', body: '{}' }),
      env,
      ctx,
    );
    expect(noToken.status).toBe(401);
    expect(noToken.headers.get('Access-Control-Expose-Headers')).toContain('WWW-Authenticate');
  });

  it('points a staging address’s refusal at staging’s one MCP', async () => {
    refusing = 'livedesign';
    const response = await rpc('tools/list', {}, { host: 'mcp-staging.livedesign.app' });
    expect(await response.text()).toContain('https://mcp-staging.liveworkspace.app/mcp');
  });
});
