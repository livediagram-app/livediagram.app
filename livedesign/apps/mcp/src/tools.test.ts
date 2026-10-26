import { afterEach, describe, expect, it, vi } from 'vitest';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Env } from '@liveworkspace/mcp-kit/env';
// `./image-result` reaches the resvg WASM renderer, which cannot load in the
// plain-node test environment — the reason that file exists as its own module in
// the first place (see its header). Stubbing it is what makes tools.ts
// importable at all; rasterising is render.ts's concern, not this suite's.
vi.mock('./image-result', () => ({
  imageResult: () => ({ content: [{ type: 'text', text: 'stub image' }] }),
}));

import { registerTools } from './tools';
import { deleteDesignShape } from '@livedesign/agent-verbs/mcp';
import { TOOL_ANNOTATIONS, type ToolBehaviour } from './tool-annotations';
import type { ToolAnnotations } from '@modelcontextprotocol/sdk/types.js';

// Every registered MCP tool must report itself (docs/specs/015-api/mcp-server.md §4, docs/specs/017-telemetry/telemetry.md).
//
// The promise docs/specs/017-telemetry/telemetry.md makes is "every registered tool emits", and there is no
// runtime signal when that stops being true: telemetry is fire-and-forget and
// the public dashboard only renders what ARRIVED, so a tool nobody instrumented
// is indistinguishable from a tool nobody used. docs/specs/017-telemetry/telemetry.md records this exact
// failure from the editor side — `Video` had no telemetry bucket, so from the
// day embeds shipped their adds were counted nowhere and every test passed.
//
// This drives the real `registerTools`, capturing registrations through a stub
// server and telemetry through the stub `env.API` the emitter posts to, so it
// proves the emit RUNS rather than that the string appears in the file. The
// emit lives in `registerTool` and fires only when the tool SUCCEEDED
// (docs/specs/017-telemetry/telemetry.md's success-path rule), so the harness has two api bindings: one that
// answers every route plausibly (each tool must then report itself exactly
// once) and one that refuses everything (no tool may then count a use, while
// the failure still reaches the Exceptions dashboard as `Error·Api`).
//
// Not checked here: that docs/specs/017-telemetry/telemetry.md's Mcp bullet lists the same eleven tokens. This
// workspace targets the Workers runtime and carries no node types, so a test in
// it cannot read the spec off disk, and restating the eleven tokens locally to
// compare against would just be the copy this file exists to avoid.

type Registered = {
  name: string;
  config: {
    title?: string;
    description?: string;
    annotations?: ToolAnnotations;
    inputSchema?: unknown;
    outputSchema?: unknown;
  };
  handler: (args: unknown, extra: unknown) => Promise<unknown>;
};

type Emitted = { category: string; action: string; type: string };

const TAB = { id: 't_1', name: 'Tab 1', rev: 1, elements: [] };
const LIVE_DOC = {
  id: 'd_1',
  name: 'A design',
  tabs: [{ id: 't_1', name: 'Tab 1', orderIndex: 0 }],
};

// A plausible api: enough of each route's response shape for every tool to
// run to its success result.
function okResponse(request: Request): Response {
  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/api/, '');
  if (url.searchParams.has('view')) {
    return new Response('tab t_1 "Tab 1" · 0 elements · rev 1', { headers: { ETag: 'W/"1"' } });
  }
  if (request.method === 'DELETE') return new Response(null, { status: 204 });
  const json = (body: unknown) => Response.json(body);
  if (path === '/designs' && request.method === 'GET') return json({ designs: [] });
  if (path === '/teams') return json({ teams: [] });
  if (path === '/trash') return json({ trash: [] });
  if (path.endsWith('/restore')) return json({ design: LIVE_DOC });
  if (path.endsWith('/share')) {
    return json({ link: { code: 'abc', role: 'view', expiresAt: null } });
  }
  // A Pages edit (docs/specs/024-agents/pages-for-agents.md "The route").
  if (path.endsWith('/pages')) {
    return json({
      tab: { id: 't_1', rev: 2 },
      lines: [],
      pages: [],
      changesetId: null,
    });
  }
  // Tab writes are changesets and the tab name route (docs/specs/024-agents/agent-changesets.md).
  if (path.endsWith('/changesets')) {
    return json({
      dryRun: false,
      changeset: null,
      results: [],
      text: '',
      warnings: [],
      lint: null,
    });
  }
  if (path.endsWith('/name')) return json({ tab: { id: 't_1', name: 'A design', orderIndex: 0 } });
  if (/\/tabs\/[^/]+$/.test(path)) return json({ tab: TAB });
  if (/^\/designs\/[^/]+$/.test(path)) return json({ design: LIVE_DOC });
  return json({});
}

function harness(api: 'ok' | 'down' = 'down') {
  const registered: Registered[] = [];
  const emitted: Emitted[] = [];
  const server = {
    registerTool: (name: string, config: Registered['config'], handler: Registered['handler']) => {
      registered.push({ name, config, handler });
    },
  } as unknown as McpServer;

  // The api over its binding, and the central telemetry service over plain fetch, answered by one handler.
  const handle = async (input: Request | string, init?: RequestInit) => {
    const request = typeof input === 'string' ? new Request(input, init) : input;
    if (new URL(request.url).pathname.endsWith('/events')) {
      const body = (await request.json()) as { events: Emitted[] };
      emitted.push(...body.events);
      return new Response(null, { status: 204 });
    }
    if (api === 'ok') return okResponse(request);
    // Anything else fails, so each handler stops at its first api call.
    throw new Error('api unavailable in this test');
  };
  vi.stubGlobal('fetch', handle);
  const env = { API: { fetch: handle }, TELEMETRY_KEY: 'k' } as unknown as Env;

  registerTools(server, env);
  return { registered, emitted };
}

// find_designs -> FindDesigns. The tool name is snake_case on the wire (MCP
// convention) and the telemetry token is PascalCase (docs/specs/017-telemetry/telemetry.md bounds `type` to a
// short token), so the two spellings have to be derived from each other rather
// than typed twice.
function expectedToken(toolName: string): string {
  return toolName
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

// A superset of every tool's arguments. The handlers are called directly here,
// bypassing the SDK's schema validation, so this only has to be plausible
// enough for each tool to run to its success result against the 'ok' api.
const ARGS = {
  query: 'anything',
  designId: 'd_1',
  tabId: 't_1',
  name: 'A design',
  elements: [],
  tabs: [{ name: 'Tab 1', elements: [] }],
  mode: 'ops',
  ops: [],
  limit: 5,
  changes: [],
};

const AUTHED = { authInfo: { token: 'tok_test' } };

// postTelemetry is fire-and-forget (the post is handed to the request's
// waitUntil, never awaited), so the event lands a microtask or two after the
// handler returns or throws. Without this the harness reads `emitted` too
// early and reports a perfectly instrumented tool as missing: a false alarm,
// not a finding.
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

afterEach(() => vi.unstubAllGlobals());

describe('registerTools', () => {
  it('registers the fifteen documented tools, each with a description', () => {
    const { registered } = harness();
    expect(registered.map((r) => r.name).sort()).toEqual([
      'add_tab',
      'change_pages',
      'create_design',
      'delete_design',
      'find_designs',
      'list_images',
      'list_templates',
      'list_trash',
      'read_design',
      'rename_design',
      'restore_design',
      'search_icons',
      'share_design',
      'update_design',
    ]);
    // The description is what the calling model reads to pick a tool, so an
    // undescribed tool is effectively unreachable.
    for (const r of registered) expect(r.config.description ?? '').not.toBe('');
  });

  it('registers each name exactly once', () => {
    const names = harness().registered.map((r) => r.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('reports every successful tool call under Mcp·Used with its own token', async () => {
    const { registered, emitted } = harness('ok');
    const seen: Record<string, Emitted[]> = {};
    for (const tool of registered) {
      const before = emitted.length;
      const result = (await tool.handler(ARGS, AUTHED)) as { isError?: boolean };
      // Guards the harness itself: a tool that failed here would pass the
      // "no emit" half vacuously.
      expect(result.isError, tool.name).not.toBe(true);
      await flush();
      seen[tool.name] = emitted.slice(before).filter((e) => e.category === 'Mcp');
    }
    const missing = registered.filter((t) => seen[t.name]!.length === 0).map((t) => t.name);
    expect(missing).toEqual([]);
    for (const tool of registered) {
      expect(seen[tool.name]).toEqual([
        { category: 'Mcp', action: 'Used', type: expectedToken(tool.name) },
      ]);
    }
  });

  it('counts no use when the tool failed, but reports the api failure', async () => {
    // docs/specs/017-telemetry/telemetry.md's success-path rule: a call that errored isn't a use. The
    // failure itself still reaches the Exceptions dashboard (docs/specs/015-api/mcp-server.md §4.12),
    // labelled with the tool it came from via registerTool's scope.
    const { registered, emitted } = harness('down');
    for (const tool of registered) {
      // These need no api, so cannot fail here.
      if (tool.name === 'list_templates' || tool.name === 'search_icons') continue;
      await tool.handler(ARGS, AUTHED).catch(() => undefined);
    }
    await flush();
    expect(emitted.filter((e) => e.category === 'Mcp')).toEqual([]);
    expect(emitted).toContainEqual({
      category: 'Error',
      action: 'Api',
      type: 'Internal.ReadDesign',
    });
  });

  it('counts no use for an isError result (input the model has to correct)', async () => {
    const { registered, emitted } = harness('ok');
    const create = registered.find((r) => r.name === 'create_design')!;
    const result = (await create.handler({ name: 'x', tabs: [] }, AUTHED)) as {
      isError?: boolean;
    };
    expect(result.isError).toBe(true);
    await flush();
    expect(emitted).toEqual([]);
  });

  it('reports nothing for an unauthenticated call', async () => {
    const { registered, emitted } = harness();
    for (const tool of registered) {
      await tool.handler(ARGS, { authInfo: undefined }).catch(() => undefined);
    }
    await flush();
    // A caller with no bearer token never reached the tool, so counting it as a
    // use would inflate the numbers with rejected connection attempts.
    expect(emitted).toEqual([]);
  });
});

// Every registered tool must declare its behaviour as MCP annotations
// (docs/specs/015-api/mcp-server.md §4.14).
//
// Same shape of promise as the telemetry suite above, and the same absence of a
// runtime signal: a tool with no annotations still works, it just asks the user
// for permission it shouldn't need (or, worse, doesn't ask before overwriting
// their design), and connector directories reject the whole server over it.
// That is invisible from inside the worker, which is exactly how all nine then
// shipped unannotated until a listing review caught it.
//
// `registerTool`'s config type already makes `behaviour` required, so the
// common mistake (adding a tool and forgetting) is a type error. This covers
// the other route in: calling `server.registerTool` directly and hand-rolling
// an annotations block, which types can't catch.
describe('tool annotations', () => {
  const BEHAVIOURS: Record<string, ToolBehaviour> = {
    find_designs: 'read',
    read_design: 'read',
    list_templates: 'read',
    search_icons: 'read',
    create_design: 'write',
    add_tab: 'write',
    share_design: 'write',
    rename_design: 'write',
    list_trash: 'read',
    restore_design: 'write',
    // docs/specs/015-api/mcp-server.md §4.5b: the gallery is read, never written.
    list_images: 'read',
    update_design: 'destructive',
    delete_design: 'destructive',
    // docs/specs/024-agents/pages-for-agents.md: change_pages deletes pages and replaces their
    // content.
    change_pages: 'destructive',
  };

  it('gives every tool one of the three documented presets', () => {
    const { registered } = harness();
    const unannotated = registered.filter((r) => !r.config.annotations).map((r) => r.name);
    expect(unannotated).toEqual([]);
    // Matching a preset by value (not just "has some annotations") is what
    // stops a hand-rolled block drifting from the table in docs/specs/015-api/mcp-server.md §4.14.
    const presets = Object.values(TOOL_ANNOTATIONS);
    for (const r of registered) {
      expect(presets, `${r.name} uses an off-catalogue annotations block`).toContainEqual(
        r.config.annotations,
      );
    }
  });

  it('annotates each tool with the behaviour docs/specs/015-api/mcp-server.md §4.14 assigns it', () => {
    const { registered } = harness();
    for (const r of registered) {
      const behaviour = BEHAVIOURS[r.name];
      // A tool missing from the table is a new tool whose behaviour nobody has
      // decided yet. Decide it here and in the spec; don't delete this line.
      expect(behaviour, `${r.name} has no documented behaviour`).toBeDefined();
      expect(r.config.annotations).toEqual(TOOL_ANNOTATIONS[behaviour!]);
    }
  });

  it('marks the read tools read-only and the writers not', () => {
    // The read/write split has to match docs/specs/015-api/mcp-server.md §4.11's read-only-token
    // boundary: a `read_only = 1` token can reach exactly the read tools, so a
    // tool annotated read-only that the api would reject as a write (or the
    // reverse) is a lie to the client either way.
    const { registered } = harness();
    const readOnly = registered
      .filter((r) => r.config.annotations?.readOnlyHint === true)
      .map((r) => r.name)
      .sort();
    expect(readOnly).toEqual([
      'find_designs',
      'list_images',
      'list_templates',
      'list_trash',
      'read_design',
      'search_icons',
    ]);

    // Destructive is only meaningful on a writer, and MCP defaults it to TRUE
    // when unset, so every writer has to state it, including the additive ones.
    for (const r of registered) {
      if (r.config.annotations?.readOnlyHint) {
        expect(r.config.annotations.destructiveHint).toBeUndefined();
      } else {
        expect(typeof r.config.annotations?.destructiveHint).toBe('boolean');
      }
    }

    const destructive = registered
      .filter((r) => r.config.annotations?.destructiveHint === true)
      .map((r) => r.name)
      .sort();
    expect(destructive).toEqual(['change_pages', 'delete_design', 'update_design']);
  });
});

// delete_design only ever moves a design to the Trash; restore_design and
// list_trash are the way back (docs/specs/015-api/mcp-server.md §4.9,
// docs/specs/013-workspace/trash.md). A permanent delete is the REST API's.
describe('the Trash tools', () => {
  function trashHarness(
    answer: (method: string, path: string) => Response = () => new Response(null, { status: 204 }),
  ) {
    const calls: string[] = [];
    const registered: Registered[] = [];
    const server = {
      registerTool: (
        name: string,
        config: Registered['config'],
        handler: Registered['handler'],
      ) => {
        registered.push({ name, config, handler });
      },
    } as unknown as McpServer;
    const env = {
      API: {
        fetch: async (request: Request) => {
          const url = new URL(request.url);
          if (url.pathname.endsWith('/events')) return new Response(null, { status: 204 });
          calls.push(`${request.method} ${url.pathname}${url.search}`);
          return answer(request.method, url.pathname);
        },
      },
    } as unknown as Env;
    registerTools(server, env);
    const tool = (name: string) => registered.find((r) => r.name === name)!;
    return { calls, tool };
  }
  const text = (result: unknown) =>
    JSON.parse((result as { content: { text: string }[] }).content[0]!.text) as unknown;

  it('delete_design moves the design to the Trash', async () => {
    const { calls, tool } = trashHarness();
    const result = await tool('delete_design').handler({ designId: 'd_1' }, AUTHED);
    expect(calls).toEqual(['DELETE /api/designs/d_1']);
    expect(text(result)).toEqual({
      deleted: 'design',
      designId: 'd_1',
      trashed: true,
      restorableForDays: 30,
    });
  });

  // A design id can be steered by injected content the model has read, so
  // it must stay one path segment: no query string, no `..` to another route.
  it('delete_design keeps a hostile id inside its own path segment', async () => {
    const { calls, tool } = trashHarness();
    await tool('delete_design').handler({ designId: 'd_1?permanent=true' }, AUTHED);
    await tool('delete_design').handler({ designId: '../folders/f_1' }, AUTHED);
    expect(calls).toEqual([
      'DELETE /api/designs/d_1%3Fpermanent%3Dtrue',
      'DELETE /api/designs/..%2Ffolders%2Ff_1',
    ]);
  });

  it('delete_design has no permanent option, and ignores one sent anyway', async () => {
    const { calls, tool } = trashHarness();
    expect(Object.keys(deleteDesignShape)).toEqual(['designId', 'tabId']);
    await tool('delete_design').handler({ designId: 'd_1', permanent: true }, AUTHED);
    expect(calls).toEqual(['DELETE /api/designs/d_1']);
    expect(tool('delete_design').config.description).toContain('restore_design');
  });

  it('delete_design still deletes one tab outright', async () => {
    const { calls, tool } = trashHarness();
    await tool('delete_design').handler({ designId: 'd_1', tabId: 't_1' }, AUTHED);
    expect(calls).toEqual(['DELETE /api/designs/d_1/tabs/t_1']);
  });

  it('list_trash lists what the user may restore', async () => {
    const T = Date.UTC(2026, 0, 10);
    const { calls, tool } = trashHarness(() =>
      Response.json({
        trash: [
          {
            id: 'd_1',
            name: 'Plan',
            teamId: null,
            teamName: null,
            trashedAt: T,
            purgeAt: T + 30 * 86_400_000,
            reason: 'deleted',
          },
          {
            id: 'd_2',
            name: 'Ops',
            teamId: 'tm',
            teamName: 'Crew',
            trashedAt: T,
            purgeAt: T + 30 * 86_400_000,
            reason: 'empty',
          },
        ],
      }),
    );
    const result = await tool('list_trash').handler({}, AUTHED);
    expect(calls).toEqual(['GET /api/trash']);
    expect(text(result)).toEqual({
      trash: [
        {
          id: 'd_1',
          name: 'Plan',
          library: 'personal',
          reason: 'deleted',
          deletedAt: '2026-01-10T00:00:00.000Z',
          purgeAt: '2026-02-09T00:00:00.000Z',
        },
        {
          id: 'd_2',
          name: 'Ops',
          library: 'Crew',
          reason: 'empty',
          deletedAt: '2026-01-10T00:00:00.000Z',
          purgeAt: '2026-02-09T00:00:00.000Z',
        },
      ],
    });
  });

  it('restore_design restores through the api and links to it', async () => {
    const { calls, tool } = trashHarness(() =>
      Response.json({ design: { id: 'd_1', name: 'Plan' } }),
    );
    const result = await tool('restore_design').handler({ designId: 'd_1' }, AUTHED);
    expect(calls).toEqual(['POST /api/trash/d_1/restore']);
    expect(text(result)).toEqual({
      restored: 'design',
      id: 'd_1',
      name: 'Plan',
      url: 'https://www.livedesign.app/design/d_1',
    });
  });

  it('restore_design explains a design that is not in the Trash', async () => {
    const { tool } = trashHarness(() => Response.json({ error: 'not_found' }, { status: 404 }));
    const result = (await tool('restore_design').handler({ designId: 'x' }, AUTHED)) as {
      isError: boolean;
      content: { text: string }[];
    };
    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain('list_trash');
  });
});

describe('delete_design on a design already in the Trash', () => {
  it('says so, and how to delete it for good', async () => {
    const registered: Registered[] = [];
    const server = {
      registerTool: (
        name: string,
        config: Registered['config'],
        handler: Registered['handler'],
      ) => {
        registered.push({ name, config, handler });
      },
    } as unknown as McpServer;
    const env = {
      API: {
        fetch: async (request: Request) =>
          new URL(request.url).pathname.endsWith('/events')
            ? new Response(null, { status: 204 })
            : Response.json({ error: 'design_trashed' }, { status: 410 }),
      },
    } as unknown as Env;
    registerTools(server, env);
    const tool = registered.find((r) => r.name === 'delete_design')!;
    const result = (await tool.handler({ designId: 'd_1' }, AUTHED)) as {
      isError: boolean;
      content: { text: string }[];
    };
    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain('already in the Trash');
  });
});
