import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
// The resvg WASM renderer cannot load in plain node (see tools.test.ts). The
// stub keeps the structured result, which is what this suite checks.
vi.mock('./image-result', () => ({
  imageResult: (value: Record<string, unknown>) => ({
    content: [{ type: 'text', text: JSON.stringify(value) }],
    structuredContent: value,
  }),
}));

import { connectTestClient } from './mcp-test-client';
import * as outputs from './output-schema';

// Structured output and described parameters (docs/specs/015-api/mcp-server.md §4.17), end to end
// through a real SDK client and server: the server validates each success's
// structuredContent against the tool's outputSchema, the client validates it
// again after listTools, and the strict parse below catches the one drift
// neither SDK side does, a result field the schema never declared.

const TAB = { id: 't1', name: 'Tab 1', elements: [] };
const DIAGRAM = { id: 'd1', name: 'Roadmap', tabs: [{ id: 't1', name: 'Tab 1' }] };

// A plausible api with non-empty lists, so the array item schemas are exercised.
async function api(request: Request): Promise<Response> {
  const path = new URL(request.url).pathname.replace(/^\/api/, '');
  if (request.method === 'DELETE') return new Response(null, { status: 204 });
  const json = (body: unknown) => Response.json(body);
  if (path === '/diagrams' && request.method === 'GET') {
    return json({ diagrams: [{ id: 'd1', name: 'Roadmap', savedAt: 1_700_000_000_000 }] });
  }
  if (path === '/teams') return json({ teams: [] });
  if (path === '/trash') {
    return json({
      trash: [{ id: 'd2', name: 'Old', teamId: null, trashedAt: 1, purgeAt: 2, reason: 'empty' }],
    });
  }
  if (path.endsWith('/restore')) return json({ diagram: DIAGRAM });
  if (path.endsWith('/share'))
    return json({ link: { code: 'abc', role: 'view', expiresAt: null } });
  if (/\/tabs\/[^/]+$/.test(path)) return json({ tab: TAB });
  return json({ diagram: DIAGRAM });
}

// Each tool, with both result branches of rename and delete.
const CALLS: { tool: string; output: keyof typeof outputs; args: Record<string, unknown> }[] = [
  { tool: 'find_diagrams', output: 'findDiagramsOutput', args: {} },
  { tool: 'read_diagram', output: 'readDiagramOutput', args: { diagramId: 'd1' } },
  { tool: 'list_templates', output: 'listTemplatesOutput', args: {} },
  {
    tool: 'create_diagram',
    output: 'createDiagramOutput',
    args: { name: 'New', tabs: [{ name: 'Tab', elements: [] }] },
  },
  {
    tool: 'add_tab',
    output: 'addTabOutput',
    args: { diagramId: 'd1', name: 'Detail', elements: [] },
  },
  {
    tool: 'update_diagram',
    output: 'updateDiagramOutput',
    args: { diagramId: 'd1', mode: 'replace', elements: [] },
  },
  { tool: 'share_diagram', output: 'shareDiagramOutput', args: { diagramId: 'd1' } },
  {
    tool: 'rename_diagram',
    output: 'renameDiagramOutput',
    args: { diagramId: 'd1', name: 'Renamed' },
  },
  {
    tool: 'rename_diagram',
    output: 'renameDiagramOutput',
    args: { diagramId: 'd1', tabId: 't1', name: 'Renamed' },
  },
  { tool: 'delete_diagram', output: 'deleteDiagramOutput', args: { diagramId: 'd1' } },
  {
    tool: 'delete_diagram',
    output: 'deleteDiagramOutput',
    args: { diagramId: 'd1', tabId: 't1' },
  },
  { tool: 'list_trash', output: 'listTrashOutput', args: {} },
  { tool: 'restore_diagram', output: 'restoreDiagramOutput', args: { diagramId: 'd2' } },
];

describe('tool output schemas', () => {
  it('advertises an outputSchema on every tool', async () => {
    const client = await connectTestClient(api);
    const { tools } = await client.listTools();
    const missing = tools.filter((t) => !t.outputSchema).map((t) => t.name);
    expect(missing).toEqual([]);
  });

  it('covers every tool in this suite', async () => {
    // A new tool must be added to CALLS, or its schema is never exercised.
    const client = await connectTestClient(api);
    const { tools } = await client.listTools();
    expect(new Set(CALLS.map((c) => c.tool))).toEqual(new Set(tools.map((t) => t.name)));
  });

  for (const { tool, output, args } of CALLS) {
    it(`${tool} ${JSON.stringify(args)} returns structured content matching its schema`, async () => {
      const client = await connectTestClient(api);
      // listTools primes the client's own outputSchema validation of callTool.
      await client.listTools();
      const result = await client.callTool({ name: tool, arguments: args });
      expect(result.isError, JSON.stringify(result.content)).toBeFalsy();
      const structured = result.structuredContent;
      z.object(outputs[output]).strict().parse(structured);
      // The text block carries the same object for clients that ignore structuredContent.
      const [first] = result.content as { type: string; text: string }[];
      expect(JSON.parse(first!.text)).toEqual(structured);
    });
  }

  it('sends no structuredContent on an error result', async () => {
    const client = await connectTestClient(api);
    const result = await client.callTool({
      name: 'create_diagram',
      arguments: { name: 'New', tabs: [{ name: 'Tab', template: 'no-such-template' }] },
    });
    expect(result.isError).toBe(true);
    expect(result.structuredContent).toBeUndefined();
  });
});

describe('tool parameter descriptions', () => {
  type JsonSchema = {
    description?: string;
    properties?: Record<string, JsonSchema>;
    items?: JsonSchema;
    anyOf?: JsonSchema[];
  };

  // Every property path, nested objects and array items included, with no description.
  function undescribed(schema: JsonSchema | undefined, path: string): string[] {
    if (!schema) return [];
    const nested = [schema.items, ...(schema.anyOf ?? [])].flatMap((s) => undescribed(s, path));
    const own = Object.entries(schema.properties ?? {}).flatMap(([key, prop]) => [
      ...(prop.description ? [] : [`${path}.${key}`]),
      ...undescribed(prop, `${path}.${key}`),
    ]);
    return [...own, ...nested];
  }

  it('describes every input parameter', async () => {
    const client = await connectTestClient(api);
    const { tools } = await client.listTools();
    const missing = tools.flatMap((t) => undescribed(t.inputSchema as JsonSchema, t.name));
    expect(missing).toEqual([]);
  });

  it('describes every output field', async () => {
    const client = await connectTestClient(api);
    const { tools } = await client.listTools();
    const missing = tools.flatMap((t) => undescribed(t.outputSchema as JsonSchema, t.name));
    expect(missing).toEqual([]);
  });
});
