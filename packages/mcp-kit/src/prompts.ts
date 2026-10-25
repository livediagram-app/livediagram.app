// The MCP prompt every product's server offers (each product's docs/specs/015-api/mcp-server.md §4.10): a pre-canned
// prompt template the client can surface (as a slash command / quick action) so a user discovers what the server is
// for without knowing the tool names. It returns a single user message that steers the model to the right tools.
// Pure text — no api calls, no auth needed to list it. A product with more prompts registers its own beside it.

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

export type ShowMyPrompt = {
  // The product, as the message names it ('livedesign').
  product: string;
  // The noun in its tool names: the prompt is show_my_<record>, and it steers to find_<record>s and read_<record>.
  record: string;
  // What the title and description call one and several ('canvas', 'canvases').
  shown: { one: string; many: string };
  // What the message calls one ('document').
  called: string;
};

// `show_my_<record>`: find one of yours by name and display it inline.
export function registerShowMyPrompt(server: McpServer, p: ShowMyPrompt): void {
  server.registerPrompt(
    `show_my_${p.record}`,
    {
      title: `Show my ${p.shown.one}`,
      description: `Find one of your ${p.shown.many} by name and display it inline.`,
      argsSchema: {
        name: z.string().describe(`Part of the ${p.shown.one}’s name.`),
      },
    },
    ({ name }) => ({
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text:
              `Find my ${p.product} ${p.called} matching "${name}" with find_${p.record}s, then ` +
              `read_${p.record} it to show me the image and a link. If several match, list them ` +
              `and ask which one.`,
          },
        },
      ],
    }),
  );
}
