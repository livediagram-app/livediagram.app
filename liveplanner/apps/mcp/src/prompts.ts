// MCP prompts (docs/specs/015-api/mcp-server.md §4.10): pre-canned prompt templates the client can
// surface (as slash commands / quick actions) so a user discovers what the
// server is for without knowing the tool names. Each returns a single user
// message that steers the model to the right tools.
// Pure text — no api calls, no auth needed to list them.

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

export function registerPrompts(server: McpServer): void {
  server.registerPrompt(
    'plan_this',
    {
      title: 'Plan this',
      description: 'Turn a goal or a piece of work into a new liveplanner plan.',
      argsSchema: {
        description: z.string().describe('What to plan: a plan, a launch, a piece of work.'),
      },
    },
    ({ description }) => ({
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text:
              `Plan the following as a liveplanner plan, then give me a link to open it:\n\n` +
              `${description}\n\n` +
              `Pick a fitting template from list_templates and make the plan with create_project, then ` +
              `add the real tasks as cards with change_items, in the columns they belong in.`,
          },
        },
      ],
    }),
  );

  server.registerPrompt(
    'board_from_tasks',
    {
      title: 'Board from tasks',
      description: 'Turn a list of tasks into cards on a board.',
      argsSchema: {
        tasks: z.string().describe('The tasks, one per line; note any owners, dates or status.'),
      },
    },
    ({ tasks }) => ({
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text:
              `Put these tasks on a liveplanner board and give me a link:\n\n` +
              `${tasks}\n\n` +
              `Make a plan from the "kanban" template with create_project, then add one card per ` +
              `task with change_items, setting the column, assignee and due date the list gives.`,
          },
        },
      ],
    }),
  );

  server.registerPrompt(
    'show_my_project',
    {
      title: 'Show my plan',
      description: 'Find one of your plans by name and display it inline.',
      argsSchema: {
        name: z.string().describe('Part of the plan’s name.'),
      },
    },
    ({ name }) => ({
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text:
              `Find my liveplanner plan matching "${name}" with find_projects, then ` +
              `read_project it to show me the image and a link. If several match, list them ` +
              `and ask which one.`,
          },
        },
      ],
    }),
  );
}
