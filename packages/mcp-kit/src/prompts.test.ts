import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { describe, expect, it } from 'vitest';
import { registerShowMyPrompt, type ShowMyPrompt } from './prompts';

async function connected(p: ShowMyPrompt): Promise<Client> {
  const server = new McpServer({ name: 'test', version: '0.0.0' });
  registerShowMyPrompt(server, p);
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  await server.connect(serverSide);
  const client = new Client({ name: 'test-client', version: '0.0.0' });
  await client.connect(clientSide);
  return client;
}

// The wording each product's prompt had in its own copy, so moving it here changed no client's slash command.
describe('show_my_<record>', () => {
  it('names the tools by the record and the thing by what the product shows', async () => {
    const client = await connected({
      product: 'livediagram',
      record: 'document',
      shown: { one: 'canvas', many: 'canvases' },
      called: 'document',
    });

    const { prompts } = await client.listPrompts();
    expect(prompts).toEqual([
      {
        name: 'show_my_document',
        title: 'Show my canvas',
        description: 'Find one of your canvases by name and display it inline.',
        arguments: [{ name: 'name', description: 'Part of the canvas’s name.', required: true }],
      },
    ]);

    const { messages } = await client.getPrompt({
      name: 'show_my_document',
      arguments: { name: 'Q3' },
    });
    expect(messages).toEqual([
      {
        role: 'user',
        content: {
          type: 'text',
          text:
            'Find my livediagram document matching "Q3" with find_documents, then read_document it to show ' +
            'me the image and a link. If several match, list them and ask which one.',
        },
      },
    ]);
  });

  it('reads the same for a product whose record and shown noun differ', async () => {
    const client = await connected({
      product: 'liveplanner',
      record: 'project',
      shown: { one: 'plan', many: 'plans' },
      called: 'plan',
    });

    const { messages } = await client.getPrompt({
      name: 'show_my_project',
      arguments: { name: 'Launch' },
    });
    expect(messages[0]!.content).toEqual({
      type: 'text',
      text:
        'Find my liveplanner plan matching "Launch" with find_projects, then read_project it to show me the ' +
        'image and a link. If several match, list them and ask which one.',
    });
  });
});
