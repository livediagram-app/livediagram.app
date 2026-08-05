import { describe, expect, it, vi } from 'vitest';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Env } from './env';
// `./image-result` reaches the resvg WASM renderer, which cannot load in the
// plain-node test environment — the reason that file exists as its own module in
// the first place (see its header). Stubbing it is what makes tools.ts
// importable at all; rasterising is render.ts's concern, not this suite's.
vi.mock('./image-result', () => ({
  imageResult: () => ({ content: [{ type: 'text', text: 'stub image' }] }),
}));

import { registerTools } from './tools';

// Every registered MCP tool must report itself (spec/62 §4, spec/22).
//
// The promise spec/22 makes is "every registered tool emits", and there is no
// runtime signal when that stops being true: telemetry is fire-and-forget and
// the public dashboard only renders what ARRIVED, so a tool nobody instrumented
// is indistinguishable from a tool nobody used. spec/22 records this exact
// failure from the editor side — `Video` had no telemetry bucket, so from the
// day embeds shipped their adds were counted nowhere and every test passed.
//
// This drives the real `registerTools`, capturing registrations through a stub
// server and telemetry through the stub `env.API` the emitter posts to, so it
// proves the emit RUNS inside the handler rather than that the string appears in
// the file. Each handler is invoked with a bearer token and an api binding that
// refuses every non-telemetry request, so it bails immediately after reporting
// itself — which is where the emit has to be anyway, since a tool that only
// counted itself on success would under-report exactly the calls worth seeing.
//
// Not checked here: that spec/22's Mcp bullet lists the same nine tokens. This
// workspace targets the Workers runtime and carries no node types, so a test in
// it cannot read the spec off disk, and restating the nine tokens locally to
// compare against would just be the copy this file exists to avoid.

type Registered = {
  name: string;
  config: { title?: string; description?: string };
  handler: (args: unknown, extra: unknown) => Promise<unknown>;
};

type Emitted = { category: string; action: string; type: string };

function harness() {
  const registered: Registered[] = [];
  const emitted: Emitted[] = [];
  const server = {
    registerTool: (name: string, config: Registered['config'], handler: Registered['handler']) => {
      registered.push({ name, config, handler });
    },
  } as unknown as McpServer;

  const env = {
    API: {
      fetch: async (request: Request) => {
        if (new URL(request.url).pathname.endsWith('/events')) {
          const body = (await request.json()) as { events: Emitted[] };
          emitted.push(...body.events);
          return new Response(null, { status: 204 });
        }
        // Anything else fails, so each handler stops just past its own emit.
        throw new Error('api unavailable in this test');
      },
    },
  } as unknown as Env;

  registerTools(server, env);
  return { registered, emitted };
}

// find_diagrams -> FindDiagrams. The tool name is snake_case on the wire (MCP
// convention) and the telemetry token is PascalCase (spec/22 bounds `type` to a
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
// enough to reach the emit on the first line or two.
const ARGS = {
  query: 'anything',
  diagramId: 'd_1',
  tabId: 't_1',
  name: 'A diagram',
  elements: [],
  limit: 5,
};

const AUTHED = { authInfo: { token: 'tok_test' } };

// postTelemetry is fire-and-forget (`void env.API.fetch(…)`), so the event lands
// a microtask or two after the handler returns or throws. Without this the
// harness reads `emitted` too early and reports a perfectly instrumented tool as
// missing — a false alarm, not a finding.
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('registerTools', () => {
  it('registers the nine documented tools, each with a description', () => {
    const { registered } = harness();
    expect(registered.map((r) => r.name).sort()).toEqual([
      'add_tab',
      'create_diagram',
      'delete_diagram',
      'find_diagrams',
      'list_templates',
      'read_diagram',
      'rename_diagram',
      'share_diagram',
      'update_diagram',
    ]);
    // The description is what the calling model reads to pick a tool, so an
    // undescribed tool is effectively unreachable.
    for (const r of registered) expect(r.config.description ?? '').not.toBe('');
  });

  it('registers each name exactly once', () => {
    const names = harness().registered.map((r) => r.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('reports every tool under Mcp·Used with its own token', async () => {
    const { registered, emitted } = harness();
    const seen: Record<string, Emitted[]> = {};
    for (const tool of registered) {
      const before = emitted.length;
      await tool.handler(ARGS, AUTHED).catch(() => undefined);
      await flush();
      // Mcp events only: the stubbed api binding rejects, which correctly also
      // fires spec/62 §4.12's Error·Api·Internal report. That the failure is
      // reported too is a good sign, and it is a different assertion.
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

  it('reports an api failure separately, without losing the tool event', async () => {
    // Both facts have to reach the wire: the tool ran, and the call it made
    // failed (spec/62 §4.12 — a worker-side failure is invisible otherwise).
    const { registered, emitted } = harness();
    const readDiagram = registered.find((r) => r.name === 'read_diagram')!;
    await readDiagram.handler(ARGS, AUTHED).catch(() => undefined);
    await flush();
    expect(emitted).toContainEqual({ category: 'Mcp', action: 'Used', type: 'ReadDiagram' });
    expect(emitted.some((e) => e.category === 'Error')).toBe(true);
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
