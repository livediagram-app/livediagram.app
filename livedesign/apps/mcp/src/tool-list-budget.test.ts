// The tools/list answer's size (docs/specs/015-api/mcp-server.md §4.18 "A byte budget"): what a client loads each
// session, measured as the Worker sends it (compacted, output schemas shallow). Its budget holds the cut made by
// Work Tracker 1325 (129,584 characters before, 92,170 after); a change that grows the list past it says so
// here, with the new number and why, rather than in silence.
import { describe, expect, it, vi } from 'vitest';
vi.mock('./image-result', () => ({
  imageResult: (value: Record<string, unknown>) => ({
    content: [{ type: 'text', text: JSON.stringify(value) }],
    structuredContent: value,
  }),
}));
import { compactToolList } from '@liveworkspace/mcp-kit/tool-list-compact';
import { connectTestClient } from './mcp-test-client';

export const TOOL_LIST_BUDGET_BYTES = 100_000;
const SCHEMA_RESOURCE = 'livedesign://schema/elements';

type Listed = {
  name: string;
  inputSchema: { properties?: Record<string, unknown> };
  outputSchema?: { properties?: Record<string, unknown>; required?: string[] };
};

async function listed() {
  const client = await connectTestClient(async () => Response.json({}));
  const { tools } = await client.listTools();
  const body = compactToolList({ jsonrpc: '2.0', id: 1, result: { tools } }) as {
    result: { tools: Listed[] };
  };
  return { full: tools as unknown as Listed[], body, listedTools: body.result.tools };
}

describe('tools/list size', () => {
  it('stays within its byte budget', async () => {
    const { body } = await listed();
    const bytes = new TextEncoder().encode(JSON.stringify(body)).length;
    expect(bytes).toBeLessThanOrEqual(TOOL_LIST_BUDGET_BYTES);
  });

  it('carries the element format on each tool that takes elements, pointing at the resource for the rest', async () => {
    const { listedTools } = await listed();
    for (const name of ['create_design', 'add_tab', 'update_design']) {
      const tool = listedTools.find((t) => t.name === name);
      expect(tool, name).toBeDefined();
      const text = JSON.stringify(tool!.inputSchema);
      // What a first call needs: every element's fields, a node, text and an arrow's ends.
      for (const words of [
        '\\"id\\"',
        '\\"type\\"',
        '\\"shape\\"',
        '\\"width\\"',
        'pinned',
        '\\"elementId\\"',
      ])
        expect(text, `${name} names ${words}`).toContain(words);
      expect(text, `${name} points at the resource`).toContain(SCHEMA_RESOURCE);
    }
  });

  it('lists each output schema with its top level whole', async () => {
    const { full, listedTools } = await listed();
    for (const tool of full) {
      if (!tool.outputSchema) continue;
      const shown = listedTools.find((t) => t.name === tool.name)!.outputSchema!;
      expect(Object.keys(shown.properties ?? {}), tool.name).toEqual(
        Object.keys(tool.outputSchema.properties ?? {}),
      );
      expect(shown.required, tool.name).toEqual(tool.outputSchema.required);
    }
  });
});
