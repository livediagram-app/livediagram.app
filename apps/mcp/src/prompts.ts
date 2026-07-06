// MCP prompts (spec/62 §4.10): pre-canned prompt templates the client can
// surface (as slash commands / quick actions) so a user discovers what the
// server is for without knowing the tool names. Each returns a single user
// message that steers the model to the right tools + the graph-first path.
// Pure text — no api calls, no auth needed to list them.

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

export function registerPrompts(server: McpServer): void {
  server.registerPrompt(
    'diagram_this',
    {
      title: 'Diagram this',
      description: 'Turn a description into a new livediagram diagram.',
      argsSchema: {
        description: z
          .string()
          .describe('What to diagram — a system, a process, a set of relationships.'),
      },
    },
    ({ description }) => ({
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text:
              `Create a livediagram diagram of the following, then give me a link to open it:\n\n` +
              `${description}\n\n` +
              `Use the create_diagram tool. Prefer the "graph" input (nodes + edges by id) ` +
              `so the server lays it out — you only need to express which nodes exist and ` +
              `what connects to what. Pick a fitting theme. Don't set element colours.`,
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
              `Build a flowchart in livediagram from these steps and give me a link:\n\n` +
              `${steps}\n\n` +
              `Use create_diagram with the "graph" input: one node per step (use shape ` +
              `"diamond" for a decision, "stadium" for start/end, "square" otherwise) and ` +
              `an edge for each transition, labelling branch edges (e.g. "yes"/"no").`,
          },
        },
      ],
    }),
  );

  server.registerPrompt(
    'show_my_diagram',
    {
      title: 'Show my diagram',
      description: 'Find one of your diagrams by name and display it inline.',
      argsSchema: {
        name: z.string().describe('Part of the diagram’s name.'),
      },
    },
    ({ name }) => ({
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text:
              `Find my livediagram diagram matching "${name}" with find_diagrams, then ` +
              `read_diagram it to show me the image and a link. If several match, list them ` +
              `and ask which one.`,
          },
        },
      ],
    }),
  );
}
