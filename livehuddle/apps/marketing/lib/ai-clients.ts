// The Build with AI page's clients and starter prompts (docs/specs/019-marketing/build-with-ai.md "The clients").
// One address, MCP_URL, feeds every snippet, so the page can never show two. It is this deployment's MCP worker: a
// build set with NEXT_PUBLIC_MCP_ORIGIN (staging, say) shows its own, never the hosted one. The client list is
// @liveworkspace/marketing-site's, bound to this product; the starter prompts are livehuddle's own.

import { mcpEndpoint, resolveMcpOrigin } from '@livehuddle/api-schema';
import {
  aiClients,
  type AiProduct,
  type StarterPrompt,
} from '@liveworkspace/marketing-site/lib/ai-clients';

export const MCP_URL = mcpEndpoint(resolveMcpOrigin(process.env.NEXT_PUBLIC_MCP_ORIGIN));

export const AI_PRODUCT: AiProduct = {
  name: 'livehuddle',
  mcpUrl: MCP_URL,
};

export const AI_CLIENTS = aiClients(AI_PRODUCT);

// Each maps to a shipped MCP tool (docs/specs/015-api/mcp-server.md §4): create_document with a template or a graph,
// share_document, find + read_document.
export const STARTER_PROMPTS: readonly StarterPrompt[] = [
  {
    title: 'Set up a stand-up',
    prompt:
      'Make a livehuddle Space for our daily stand-up: an agenda with yesterday, today and blockers, a timer, and a sticky for each person on the team.',
  },
  {
    title: 'Run a retro',
    prompt:
      'Set up a livehuddle retrospective for our sprint, with what went well, what to improve and actions, and share a participant link so the team can add their notes.',
  },
  {
    title: 'Plan a workshop',
    prompt:
      'Create a livehuddle Space for a two-hour planning workshop: an agenda with times, a brainstorm board, a poll on the ideas and a decision record.',
  },
  {
    title: 'Brainstorm an offsite',
    prompt:
      'Make a livehuddle lean coffee board for ideas for our team offsite, with starter stickies for the venue, the agenda, the budget and the activities.',
  },
  {
    title: 'Open a team office',
    prompt:
      'Make a livehuddle virtual office for a team of eight, with a desk each, a meeting room and a coffee corner, and share a link I can send the team.',
  },
  {
    title: 'Find and improve',
    prompt:
      'Find my livehuddle Space for our onboarding session, show it to me, and suggest three ways to make it clearer. Make the changes once I agree.',
  },
];
