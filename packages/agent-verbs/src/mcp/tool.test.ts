import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { mcpTool } from './tool';

describe('mcpTool', () => {
  it('makes a verb of a tool: its id, words, behaviour, schemas and the raw shapes the SDK takes', () => {
    const inputSchema = { query: z.string().optional() };
    const outputSchema = { found: z.number() };
    const verb = mcpTool('find_sketches', {
      behaviour: 'read',
      title: 'Find sketches',
      description: 'Finds the sketches the caller can reach.',
      inputSchema,
      outputSchema,
    });

    expect(verb).toMatchObject({
      id: 'mcp.find_sketches',
      summary: 'Find sketches',
      description: 'Finds the sketches the caller can reach.',
      behaviour: 'read',
      mcp: { tool: 'find_sketches', title: 'Find sketches' },
    });
    expect(verb.mcpShapes.input).toBe(inputSchema);
    expect(verb.mcpShapes.output).toBe(outputSchema);
    expect(verb.input.parse({ query: 'a' })).toEqual({ query: 'a' });
    expect(verb.output.safeParse({}).success).toBe(false);
  });
});
