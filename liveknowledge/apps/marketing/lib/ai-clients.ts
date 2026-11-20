// The Build with AI page's clients and starter prompts (docs/specs/019-marketing/build-with-ai.md "The clients").
// One address, MCP_URL, feeds every snippet, so the page can never show two. It is this deployment's MCP worker: a
// build set with NEXT_PUBLIC_MCP_ORIGIN (staging, local dev) shows its own, never the hosted one. The client list is
// @liveworkspace/marketing-site's, bound to this product; the starter prompts are liveknowledge's own.

import { mcpEndpoint, resolveMcpOrigin } from '@liveknowledge/api-schema';
import {
  aiClients,
  type AiProduct,
  type StarterPrompt,
} from '@liveworkspace/marketing-site/lib/ai-clients';

export const MCP_URL = mcpEndpoint(resolveMcpOrigin(process.env.NEXT_PUBLIC_MCP_ORIGIN));

export const AI_PRODUCT: AiProduct = {
  name: 'liveknowledge',
  mcpUrl: MCP_URL,
};

export const AI_CLIENTS = aiClients(AI_PRODUCT);

// Each maps to a shipped MCP tool (docs/specs/024-agents/knowledgebase-for-agents.md "MCP tools"): get_context,
// search_pages and read_page, suggest_edit, report_gap, create_page, and list_pages with its trust fields.
export const STARTER_PROMPTS: readonly StarterPrompt[] = [
  {
    title: 'Answer From the Pages',
    prompt:
      'Using our liveknowledge knowledgebase, answer this: how do we roll back a release? Quote the passage, name its page, and tell me whether that page is verified.',
  },
  {
    title: 'Start With Context',
    prompt:
      'Read the Always in Context pages of our liveknowledge knowledgebase before you start, then tell me in five lines what you now know about how this team works.',
  },
  {
    title: 'Suggest a Fix',
    prompt:
      'The Release Runbook in liveknowledge still says deploys go out any weekday. Suggest an edit that says Monday to Thursday, with the reason, and leave it for me to accept.',
  },
  {
    title: 'Report What Is Missing',
    prompt:
      'Search our liveknowledge knowledgebase for how to rotate the API key. If no page covers it, report the gap so someone can write the page, and do not guess.',
  },
  {
    title: 'Write It Down',
    prompt:
      'Write up the decisions from this conversation as a new liveknowledge page under Engineering, with a short summary first and a heading per decision.',
  },
  {
    title: 'Find What Is Stale',
    prompt:
      'List the pages of our liveknowledge knowledgebase whose review is due, oldest first, with each page’s owner.',
  },
];
