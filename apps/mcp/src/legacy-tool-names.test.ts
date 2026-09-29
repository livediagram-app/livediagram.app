import { describe, expect, it, vi } from 'vitest';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Env } from './env';
import {
  LEGACY_TOOL_SUNSET,
  isDeprecatedDescription,
  legacyToolName,
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
      expect(alias.config.inputSchema).toBe(successor.config.inputSchema);
      expect(alias.config.outputSchema).toBe(successor.config.outputSchema);
    }
  });
});
