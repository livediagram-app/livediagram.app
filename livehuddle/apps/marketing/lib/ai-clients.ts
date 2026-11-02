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

// Each maps to a shipped MCP tool (docs/specs/015-api/mcp-server.md §4): create_document with a graph,
// a template, find + read_document.
export const STARTER_PROMPTS: readonly StarterPrompt[] = [
  {
    title: 'Map a codebase',
    prompt:
      'Read this repository and draw its architecture as a livehuddle diagram: the main services, what each one owns, and how requests flow between them.',
  },
  {
    title: 'Turn steps into a flowchart',
    prompt:
      'Make a livehuddle flowchart of how a new customer signs up, from landing page to first invoice, with a decision for each place they can drop off.',
  },
  {
    title: 'Plan a launch',
    prompt:
      'Create a livehuddle Gantt chart for launching our new website, with bars for design, copy, build, testing and go-live, and share a link I can send the team.',
  },
  {
    title: 'Brainstorm an offsite',
    prompt:
      'Make a livehuddle mind map of ideas for our team offsite, with a branch each for the venue, the agenda, the budget and the activities.',
  },
  {
    title: 'Run a retro',
    prompt:
      'Set up a livehuddle retrospective for our sprint, with what went well, what to improve and actions, and share a participant link so the team can add their notes.',
  },
  {
    title: 'Find and improve',
    prompt:
      'Find my livehuddle canvas about onboarding, show it to me, and suggest three ways to make it clearer. Make the changes once I agree.',
  },
];
