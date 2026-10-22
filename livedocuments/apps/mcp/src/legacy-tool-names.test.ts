import { describe, expect, it, vi } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { z } from 'zod';
import type { Env } from './env';
import {
  LEGACY_INPUT_SHAPE,
  LEGACY_TOOL_SUNSET,
  deprecatedDescription,
  isDeprecatedDescription,
  legacyToolName,
  registerLegacyAlias,
  successorToolName,
} from './legacy-tool-names';
import { registerTools } from './tools';

// The image renderer loads a wasm module this suite never reaches (same stub as tools.test.ts).
vi.mock('./image-result', () => ({
  imageResult: () => ({ content: [{ type: 'text', text: 'stub image' }] }),
}));

type Registered = {
  name: string;
  config: {
    description?: string;
    annotations?: unknown;
    inputSchema?: unknown;
    outputSchema?: unknown;
  };
};

function registrations(): Registered[] {
  const registered: Registered[] = [];
  const server = {
    registerTool: (name: string, config: Registered['config']) => registered.push({ name, config }),
  } as unknown as McpServer;
  registerTools(server, {} as Env);
  return registered;
}

describe('legacy tool names', () => {
  it('maps each document tool to its old diagram name and back', () => {
    expect(legacyToolName('create_document')).toBe('create_diagram');
    expect(legacyToolName('find_documents')).toBe('find_diagrams');
    expect(legacyToolName('add_tab')).toBeNull();
    expect(successorToolName('find_diagrams')).toBe('find_documents');
    expect(successorToolName('add_tab')).toBe('add_tab');
  });

  it('keeps every renamed tool under its old name until the sunset, deprecated', () => {
    const registered = registrations();
    const legacy = registered.filter((r) => isDeprecatedDescription(r.config.description));
    expect(legacy.map((r) => r.name).sort()).toEqual([
      'create_diagram',
      'delete_diagram',
      'find_diagrams',
      'read_diagram',
      'rename_diagram',
      'restore_diagram',
      'share_diagram',
      'update_diagram',
    ]);
    for (const alias of legacy) {
      const successor = registered.find((r) => r.name === successorToolName(alias.name))!;
      expect(alias.config.description).toContain(successor.name);
      expect(alias.config.description).toContain(LEGACY_TOOL_SUNSET);
      expect(alias.config.annotations).toEqual(successor.config.annotations);
      // The input schema is listed once, under the successor; the alias's description points there.
      expect(alias.config.inputSchema).toBe(LEGACY_INPUT_SHAPE);
      expect(alias.config.outputSchema).toBe(successor.config.outputSchema);
      expect(alias.config.description).toBe(deprecatedDescription(successor.name));
    }
  });
});

// A real server and client, so the alias's input is checked the way a call reaches it.
describe('a deprecated alias', () => {
  async function connected(handler = vi.fn(async (args: unknown) => text(JSON.stringify(args)))) {
    const server = new McpServer({ name: 'test', version: '0' });
    registerLegacyAlias(
      server,
      {
        name: 'find_documents',
        title: 'Find Documents',
        inputSchema: { query: z.string().optional(), limit: z.number().int().default(20) },
      },
      { readOnlyHint: true },
      handler,
    );
    const [serverSide, clientSide] = InMemoryTransport.createLinkedPair();
    await server.connect(serverSide);
    const client = new Client({ name: 'test', version: '0' });
    await client.connect(clientSide);
    return { client, handler };
  }

  it('lists a one-line description and an open input', async () => {
    const { client } = await connected();
    const { tools } = await client.listTools();
    expect(tools).toHaveLength(1);
    expect(tools[0]).toMatchObject({
      name: 'find_diagrams',
      title: 'Find Documents (deprecated)',
      description: deprecatedDescription('find_documents'),
      annotations: { readOnlyHint: true },
    });
  });

  it('hands the handler the input as the successor parses it', async () => {
    const { client, handler } = await connected();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = await client.callTool({ name: 'find_diagrams', arguments: { query: 'q' } });
    expect(result.content).toEqual([{ type: 'text', text: '{"query":"q","limit":20}' }]);
    expect(handler).toHaveBeenCalledOnce();
    expect(warn).toHaveBeenCalledWith(
      '[mcp] deprecated tool name',
      'find_diagrams',
      '->',
      'find_documents',
    );
    warn.mockRestore();
  });

  it('reads no arguments as an empty input', async () => {
    const { client } = await connected();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = await client.callTool({ name: 'find_diagrams' });
    expect(result.content).toEqual([{ type: 'text', text: '{"limit":20}' }]);
    warn.mockRestore();
  });

  it('refuses input the successor refuses, as the SDK would, without calling the handler', async () => {
    const { client, handler } = await connected();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = await client.callTool({ name: 'find_diagrams', arguments: { limit: 'ten' } });
    expect(result.isError).toBe(true);
    expect((result.content as { text: string }[])[0]?.text).toMatch(
      /^MCP error -32602: Input validation error: Invalid arguments for tool find_diagrams: .*limit/s,
    );
    expect(handler).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('registers nothing for a tool that never had another name', () => {
    const registerTool = vi.fn();
    registerLegacyAlias(
      { registerTool } as unknown as McpServer,
      { name: 'add_tab', title: 'Add Tab', inputSchema: {} },
      { readOnlyHint: false },
      vi.fn() as never,
    );
    expect(registerTool).not.toHaveBeenCalled();
  });
});

function text(t: string) {
  return { content: [{ type: 'text' as const, text: t }] };
}
