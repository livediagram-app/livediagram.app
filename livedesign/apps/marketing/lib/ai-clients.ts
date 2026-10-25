// The Build with AI page's clients and starter prompts (docs/specs/019-marketing/build-with-ai.md "The clients").
// One address, MCP_URL, feeds every snippet, so the page can never show two. It is this deployment's MCP worker: a
// build set with NEXT_PUBLIC_MCP_ORIGIN (staging, local dev) shows its own, never the hosted one. The client list is
// @liveworkspace/marketing-site's, bound to this product; the starter prompts are livedesign's own.

import { mcpEndpoint, resolveMcpOrigin } from '@livedesign/api-schema';
import {
  aiClients,
  type AiProduct,
  type StarterPrompt,
} from '@liveworkspace/marketing-site/lib/ai-clients';

export const MCP_URL = mcpEndpoint(resolveMcpOrigin(process.env.NEXT_PUBLIC_MCP_ORIGIN));

export const AI_PRODUCT: AiProduct = {
  name: 'livedesign',
  mcpUrl: MCP_URL,
};

export const AI_CLIENTS = aiClients(AI_PRODUCT);

// Each maps to a shipped MCP tool (docs/specs/015-api/mcp-server.md §4): change_pages for wireframe
// and logo pages, create_design from a template, find + read_design, share_design.
export const STARTER_PROMPTS: readonly StarterPrompt[] = [
  {
    title: 'Wireframe a website',
    prompt:
      'Wireframe our product site as livedesign website pages in a browser frame: a landing page, pricing and sign in.',
  },
  {
    title: 'Sketch the screen',
    prompt:
      'Wireframe the sign-up screen we just discussed as a livedesign phone wireframe: the fields, the button and the error states.',
  },
  {
    title: 'Sketch a logo',
    prompt:
      'Add a livedesign logo page for a bakery called Bloom: a simple symmetrical mark above the name, in warm colours.',
  },
  {
    title: 'Start from a template',
    prompt:
      'Start a livedesign design from the template that suits an app launch, fill it in from the notes I paste below, and share a link I can send.',
  },
  {
    title: 'Find and improve',
    prompt:
      'Find my livedesign design about onboarding, show it to me, and suggest three ways to make it clearer. Make the changes once I agree.',
  },
];
