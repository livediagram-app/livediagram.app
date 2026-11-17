// Claude's connector directory rules for every tool this server lists (docs/specs/015-api/mcp-server.md "Claude
// connector directory"): a title, the read-only or destructive hint, a name of 64 characters or fewer and a
// description that says what it does. Read from the server card, which lists exactly what /mcp offers, so a new tool
// that misses one fails here before review would.
import { describe, expect, it, vi } from 'vitest';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { directoryProblems } from '@liveworkspace/mcp-kit/directory';
import { serverCard } from '@liveworkspace/mcp-kit/listing';
import type { Env } from '@liveworkspace/mcp-kit/env';

// The resvg WASM renderer cannot load in plain node (see tools.test.ts); listing never renders.
vi.mock('./image-result', () => ({ imageResult: () => ({ content: [] }) }));

import { LISTING } from './listing';
import { buildServer } from './server';

describe('livediagram tools in the connector directory', () => {
  it('every listed tool has a title, its hint, a short name and a description', async () => {
    const env = { API: { fetch: async () => new Response('{}') } } as unknown as Env;
    const card = await serverCard(LISTING, buildServer(env), 'https://mcp.livediagram.app');
    const tools = card.tools as Tool[];
    expect(tools.length).toBeGreaterThan(10);
    expect(directoryProblems(tools)).toEqual([]);
  });
});
