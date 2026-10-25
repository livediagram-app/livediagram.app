// The Build with AI page's clients and starter prompts (docs/specs/019-marketing/build-with-ai.md "The clients").
// One address, MCP_URL, feeds every snippet, so the page can never show two. It is this deployment's MCP worker: a
// self-hosted build set with NEXT_PUBLIC_MCP_ORIGIN shows its own, never the hosted one. The client list is
// @liveworkspace/marketing-site's, bound to this product; the starter prompts are livedocuments's own.

import { mcpEndpoint, resolveMcpOrigin } from '@livedocuments/api-schema';
import {
  aiClients,
  type AiProduct,
  type StarterPrompt,
} from '@liveworkspace/marketing-site/lib/ai-clients';

export const MCP_URL = mcpEndpoint(resolveMcpOrigin(process.env.NEXT_PUBLIC_MCP_ORIGIN));

export const AI_PRODUCT: AiProduct = {
  name: 'livedocuments',
  mcpUrl: MCP_URL,
  hostedMcpHost: 'mcp.livedocuments.app',
};

export const AI_CLIENTS = aiClients(AI_PRODUCT);

// Each maps to a shipped MCP tool (docs/specs/015-api/mcp-server.md §4): write_article, change_pages with slide
// layouts, an infographic page from a layout, create_document from a template, find + read_document, share_document.
export const STARTER_PROMPTS: readonly StarterPrompt[] = [
  {
    title: 'Write it up',
    prompt:
      'Write up the decisions from this conversation as a livedocuments article, with a short summary first and a section per decision.',
  },
  {
    title: 'Build a deck',
    prompt:
      'Build a five-slide livedocuments deck that explains our product to a new hire: the problem, who it is for, how it works, what is next, and how to get help.',
  },
  {
    title: 'Make a one-pager',
    prompt:
      'Turn these numbers into a livedocuments infographic: a headline, three big figures and a short line under each, on one page.',
  },
  {
    title: 'Design a poster',
    prompt:
      'Lay out a livedocuments event poster for a bakery called Bloom opening its doors on Saturday: a big headline, the time and place, and warm colours.',
  },
  {
    title: 'Start from a template',
    prompt:
      'Make me a livedocuments resume from the resume template, filled in from the profile I paste below, and share a link I can send.',
  },
  {
    title: 'Find and improve',
    prompt:
      'Find my livedocuments document about onboarding, show it to me, and suggest three ways to make it clearer. Make the changes once I agree.',
  },
];
