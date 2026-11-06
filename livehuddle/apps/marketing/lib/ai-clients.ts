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

// Each maps to a shipped MCP tool (docs/specs/015-api/mcp-server.md §4): create_document from a Space template
// (team-pod, virtual-office, all-hands-hall, coworking-space) with sticky notes and text by update_document, add_tab
// for another floor, share_document (a participant link by default), and find + read_document. The MCP has no timer
// of its own, so no prompt asks it to start one.
export const STARTER_PROMPTS: readonly StarterPrompt[] = [
  {
    title: 'Set up a stand-up',
    prompt:
      'Set up a livehuddle Team Pod for our daily stand-up, with a sticky note for each person on the team: Asha, Ben, Chloe and Dev. Then share a participant link I can post in our chat.',
  },
  {
    title: 'Open a team office',
    prompt:
      'Build a livehuddle Virtual Office for our company, with a floor for each team (design, engineering and sales) and a welcome note at the door of each, and share a link I can send everyone.',
  },
  {
    title: 'Plan an all-hands',
    prompt:
      'Set up a livehuddle All-Hands Hall for Friday’s company meeting, with a title on the stage and a sticky note for each update: the quarter, the new starters and the summer party.',
  },
  {
    title: 'Make a coworking room',
    prompt:
      'Make a livehuddle Coworking Space for our Thursday focus sessions, with a note on the wall that says what the session is for and how long it runs.',
  },
  {
    title: 'Share a Space',
    prompt:
      'Find my livehuddle Space for the design team and share it as a participant link, so the team can walk in, talk and comment without moving the furniture.',
  },
  {
    title: 'Find and improve',
    prompt:
      'Find my livehuddle Space for our onboarding day, show it to me, and suggest three ways to make its rooms easier to find. Make the changes once I agree.',
  },
];
