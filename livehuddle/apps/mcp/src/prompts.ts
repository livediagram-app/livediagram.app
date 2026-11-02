// MCP prompts (docs/specs/015-api/mcp-server.md §4.10): pre-canned prompt templates the client can
// surface (as slash commands / quick actions) so a user discovers what the
// server is for without knowing the tool names. Each returns a single user
// message that steers the model to the right tools: templates for a session, the graph for boxes and arrows.
// Pure text — no api calls, no auth needed to list them.

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerShowMyPrompt } from '@liveworkspace/mcp-kit/prompts';
import { z } from 'zod';

// What a clear board asks of its author (docs/specs/015-api/mcp-server.md §4.7). A prompt is a message
// the USER sends, so unlike a tool description it can ask for this: short
// headings in the boxes, the detail in each node's note, related nodes grouped,
// a layout that fits the subject.
const CONCISE =
  'Keep each node label a short heading of a few words (a noun phrase like ' +
  '"Check stock", not a sentence) and put any explanation in the node\'s "note". ' +
  'Group related nodes with "groups", and pick "direction" / "style" to fit (a ' +
  'hierarchy is a "tree"). Pick a fitting theme. Don\'t set element colours.';

export function registerPrompts(server: McpServer): void {
  server.registerPrompt(
    'set_up_session',
    {
      title: 'Set up a session',
      description: 'Turn a plan for a meeting or workshop into a new livehuddle Space.',
      argsSchema: {
        description: z
          .string()
          .describe(
            'The session: what it is for, who comes, how long it runs and the parts it goes through.',
          ),
      },
    },
    ({ description }) => ({
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text:
              `Set up a livehuddle Space for this session, then give me a link to open it:\n\n` +
              `${description}\n\n` +
              `Find fitting session boards with list_templates (a retrospective, a meeting agenda, ` +
              `an icebreaker) and make the Space with create_document, one tab per part of the ` +
              `session, each from its "template". Then fill in real labels with update_document. ` +
              `Pick a fitting theme. Don't set element colours.`,
          },
        },
      ],
    }),
  );

  server.registerPrompt(
    'flowchart_from_steps',
    {
      title: 'Flowchart from steps',
      description: 'Turn an ordered list of steps (with any branches) into a flowchart.',
      argsSchema: {
        steps: z.string().describe('The steps, one per line; note any decisions or branches.'),
      },
    },
    ({ steps }) => ({
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text:
              `Build a flowchart in livehuddle from these steps and give me a link:\n\n` +
              `${steps}\n\n` +
              `Use create_document with the "graph" input: one node per step (use shape ` +
              `"diamond" for a decision, "stadium" for start/end, "square" otherwise) and ` +
              `an edge for each transition, labelling branch edges (e.g. "yes"/"no"). ${CONCISE}`,
          },
        },
      ],
    }),
  );

  // @liveworkspace/mcp-kit's, every product's.
  registerShowMyPrompt(server, {
    product: 'livehuddle',
    record: 'document',
    shown: { one: 'Space', many: 'Spaces' },
    called: 'Space',
  });
}
