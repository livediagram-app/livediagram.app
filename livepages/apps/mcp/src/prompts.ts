// MCP prompts (docs/specs/015-api/mcp-server.md §4.10): pre-canned prompt templates the client can
// surface (as slash commands / quick actions) so a user discovers what the
// server is for without knowing the tool names. Each returns a single user
// message that steers the model to the right tools.
// Pure text — no api calls, no auth needed to list them.

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

export function registerPrompts(server: McpServer): void {
  server.registerPrompt(
    'show_my_document',
    {
      title: 'Show my document',
      description: 'Find one of your documents by name and display it inline.',
      argsSchema: {
        name: z.string().describe('Part of the document’s name.'),
      },
    },
    ({ name }) => ({
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text:
              `Find my livepages document matching "${name}" with find_documents, then ` +
              `read_document it to show me the image and a link. If several match, list them ` +
              `and ask which one.`,
          },
        },
      ],
    }),
  );
}
