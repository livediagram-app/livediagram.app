import { describe, expect, it, vi } from 'vitest';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { MCP_TOOL_VERBS } from '@livediagram/agent-verbs/mcp';
import { VERBS } from '@livediagram/agent-verbs';
import type { Env } from './env';
import { legacyToolName } from './legacy-tool-names';
import { TOOL_ANNOTATIONS } from './tool-annotations';
import { registerTools } from './tools';

// One catalogue (docs/specs/015-api/cli.md "One catalogue for the CLI and the MCP", blueprint "The verb"): every tool
// the server registers is its verb, word for word and schema for schema, and every tool verb is registered.

// The wasm rasteriser does not load under Node; registering tools never renders.
vi.mock('./render', () => ({ svgToPngBase64: async () => '' }));

type Registered = { name: string; config: Record<string, unknown> };

function registrations(): Registered[] {
  const seen: Registered[] = [];
  const server = {
    registerTool: (name: string, config: Record<string, unknown>) =>
      void seen.push({ name, config }),
  } as unknown as McpServer;
  registerTools(server, {} as Env);
  return seen;
}

describe('the MCP tools and their verbs', () => {
  const registered = registrations();
  const current = registered.filter(
    (r) => !r.name.includes('deprecated') && !String(r.config.title).endsWith('(deprecated)'),
  );

  it('registers exactly the tool verbs, in their order', () => {
    expect(current.map((r) => r.name)).toEqual(MCP_TOOL_VERBS.map((v) => v.mcp.tool));
  });

  it('publishes each tool as its verb declares it', () => {
    for (const verb of MCP_TOOL_VERBS) {
      const tool = current.find((r) => r.name === verb.mcp.tool)!;
      expect(tool.config.title).toBe(verb.mcp.title);
      expect(tool.config.description).toBe(verb.description);
      expect(tool.config.inputSchema).toBe(verb.mcpShapes.input);
      expect(tool.config.outputSchema).toBe(verb.mcpShapes.output);
      expect(tool.config.annotations).toEqual(TOOL_ANNOTATIONS[verb.behaviour]);
      expect(Object.keys(verb.input.shape)).toEqual(Object.keys(verb.mcpShapes.input));
    }
  });

  it('registers a deprecated alias only for a tool that had another name', () => {
    const aliases = registered
      .filter((r) => String(r.config.title).endsWith('(deprecated)'))
      .map((r) => r.name);
    expect(aliases).toEqual(MCP_TOOL_VERBS.flatMap((v) => legacyToolName(v.mcp.tool) ?? []));
  });

  it('keeps tool verbs apart from the CLI’s commands, under ids of their own', () => {
    const ids = new Set(VERBS.map((v) => v.id));
    expect(MCP_TOOL_VERBS.every((v) => v.id === `mcp.${v.mcp.tool}` && !ids.has(v.id))).toBe(true);
    expect(new Set(MCP_TOOL_VERBS.map((v) => v.mcp.tool)).size).toBe(MCP_TOOL_VERBS.length);
  });
});
