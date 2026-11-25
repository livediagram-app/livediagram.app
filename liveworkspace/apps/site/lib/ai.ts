// liveworkspace.app's Build with AI page (liveworkspace/docs/specs/010-site/site.md "Build with AI"): the shared page
// (@liveworkspace/marketing-site BuildWithAi) bound to the one MCP, for every app at once. One address, MCP_URL,
// feeds every snippet: this build's NEXT_PUBLIC_MCP_ORIGIN (staging's one MCP on staging) or the hosted one.

import { mcpEndpoint, resolveOneMcpOrigin } from '@liveworkspace/api-schema/mcp-origin';
import {
  aiClients,
  type AiProduct,
  type StarterPrompt,
} from '@liveworkspace/marketing-site/lib/ai-clients';
import { listedApps, type ListedApp } from './apps';
import { MCP_APPS, type McpApp } from './mcp-connect';

export const MCP_URL = mcpEndpoint(resolveOneMcpOrigin(process.env.NEXT_PUBLIC_MCP_ORIGIN));

// Every app, so the approval step names none, and no CLI: liveworkspace has none (each app has its own).
export const AI_PRODUCT: AiProduct = {
  name: 'liveworkspace',
  mcpUrl: MCP_URL,
  ticked: 'every app you want',
  cli: false,
};

export const AI_CLIENTS = aiClients(AI_PRODUCT);

// Each starts in one app and finishes in another, and names both, so the tool picks the right one. The first five are
// the help article's "Ask Across Apps" (Connecting AI Tools); each runs on the one MCP's core tools (find_items,
// read_item, create_item, share_item) and the apps' own through list_app_tools.
export const STARTER_PROMPTS: readonly StarterPrompt[] = [
  {
    title: 'Kick off a project',
    prompt:
      'Set up our website relaunch: a liveplanner board with the tasks, a livediagram sitemap of the new pages and a livedocuments kickoff deck. Share each one with the team.',
  },
  {
    title: 'Write up a plan',
    prompt:
      'Find my liveplanner plan about the launch, then write its status up as a livedocuments article and share a link.',
  },
  {
    title: 'Retro to mind map',
    prompt: 'Turn the cards in my liveplanner retro board into a livediagram mind map.',
  },
  {
    title: 'Runbook to flowchart',
    prompt:
      'Read the Release Runbook in our liveknowledge knowledgebase and draw its steps as a livediagram flowchart.',
  },
  {
    title: 'Diagram to deck',
    prompt: 'Make a five-slide livedocuments deck from my livediagram diagram about onboarding.',
  },
  {
    title: 'Close the gaps',
    prompt:
      'Search our liveknowledge knowledgebase for how we handle refunds, then add a card for each gap to my liveplanner support board.',
  },
];

/** What a connected AI makes in each app the one MCP reaches, in a sentence. */
const MAKES: Record<McpApp, string> = {
  livediagram:
    'Diagrams, flowcharts, mind maps and workshop boards from a sentence or from Mermaid, laid out for you.',
  liveplanner:
    'Boards of cards, sheets, forms and dashboards, and it moves the cards and fills in the cells as the work changes.',
  livedocuments:
    'Slide decks, articles and infographics, written up from your notes or from what another app holds.',
  livedesign: 'App screens, logos and wireframes on artboards, ready to click through and export.',
  liveknowledge:
    'Pages it searches and reads before it answers, and keeps up to date, so answers come from what your team wrote.',
};

export type AiApp = { app: ListedApp; makes: string };

/** The apps the one connection reaches (livehuddle has no MCP), in the site's order, each with what it makes. */
export function aiApps(): AiApp[] {
  const reached = new Map<string, McpApp>(MCP_APPS.map((m) => [m.site, m.app]));
  return listedApps().flatMap((app) => {
    const mcp = reached.get(app.id);
    return mcp ? [{ app, makes: MAKES[mcp] }] : [];
  });
}
