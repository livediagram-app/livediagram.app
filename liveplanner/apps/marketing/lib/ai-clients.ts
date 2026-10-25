// The Build with AI page's clients and starter prompts (docs/specs/019-marketing/build-with-ai.md "The clients").
// One address, MCP_URL, feeds every snippet, so the page can never show two. It is this deployment's MCP worker: a
// build set with NEXT_PUBLIC_MCP_ORIGIN (staging, local dev) shows its own, never the hosted one. The client list is
// @liveworkspace/marketing-site's, bound to this product; the starter prompts are liveplanner's own.

import { mcpEndpoint, resolveMcpOrigin } from '@liveplanner/api-schema';
import {
  aiClients,
  type AiProduct,
  type StarterPrompt,
} from '@liveworkspace/marketing-site/lib/ai-clients';

export const MCP_URL = mcpEndpoint(resolveMcpOrigin(process.env.NEXT_PUBLIC_MCP_ORIGIN));

export const AI_PRODUCT: AiProduct = {
  name: 'liveplanner',
  mcpUrl: MCP_URL,
  hostedMcpHost: 'mcp.liveplanner.app',
};

export const AI_CLIENTS = aiClients(AI_PRODUCT);

// Each maps to a shipped MCP tool (docs/specs/015-api/mcp-server.md §4): a Plan template with change_items,
// add_sheet, add_form + share_form, change_card_types, find + list_items, add_tab for a dashboard.
export const STARTER_PROMPTS: readonly StarterPrompt[] = [
  {
    title: 'Plan a launch',
    prompt:
      'Create a liveplanner kanban board for launching our new website, with cards for design, copy, build, testing and go-live, and share a link I can send the team.',
  },
  {
    title: 'Turn notes into cards',
    prompt:
      'Read the action points from this conversation and add each one as a card to my liveplanner board, with an owner and a due date where we agreed one.',
  },
  {
    title: 'Build a budget sheet',
    prompt:
      'Add a liveplanner sheet for our Q3 budget, with a row per cost line, a column per month, and totals that add themselves up.',
  },
  {
    title: 'Collect feedback',
    prompt:
      'Make a liveplanner feedback form with a rating, what people liked and what to improve, send the answers to a board as cards, and give me the link to share.',
  },
  {
    title: 'Shape the card types',
    prompt:
      'Add a Bug card type to my liveplanner plan with fields for severity, area and steps to reproduce, and move the bug cards on the board to use it.',
  },
  {
    title: 'Catch up on a plan',
    prompt:
      'Find my liveplanner plan about onboarding, tell me which cards are overdue or stuck, and suggest what to move next. Make the changes once I agree.',
  },
];
