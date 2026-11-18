import { describe, expect, it } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { registerPrompts } from './prompts';

// docs/specs/015-api/mcp-server.md §4.10 Prompts; docs/specs/026-plan/plan-agents.md "Cards handed to an assistant".
async function client(): Promise<Client> {
  const server = new McpServer({ name: 'test', version: '0.0.0' });
  registerPrompts(server);
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  await server.connect(serverSide);
  const c = new Client({ name: 'test-client', version: '0.0.0' });
  await c.connect(clientSide);
  return c;
}

describe('the MCP prompts', () => {
  it('lists work_my_cards beside the others', async () => {
    const { prompts } = await (await client()).listPrompts();
    expect(prompts.map((p) => p.name)).toEqual(
      expect.arrayContaining(['plan_this', 'board_from_tasks', 'work_my_cards']),
    );
  });

  it('steers work_my_cards to list the cards handed to it, comment, move and hand each back', async () => {
    const { messages } = await (
      await client()
    ).getPrompt({
      name: 'work_my_cards',
      arguments: { plan: 'Launch' },
    });
    const text = (messages[0]!.content as { text: string }).text;
    expect(text).toContain('"Launch"');
    for (const word of ['handedToMe: true', 'change_threads', 'hand_back', 'find_projects'])
      expect(text).toContain(word);
  });
});
