// The Build with AI page's clients and starter prompts, as data (docs/specs/019-marketing/build-with-ai.md
// "The clients"). One address, MCP_URL, feeds every snippet, so the page can never show two. It is this
// deployment's MCP worker: a self-hosted build set with NEXT_PUBLIC_MCP_ORIGIN shows its own, never the hosted one.

import { mcpEndpoint, resolveMcpOrigin } from '@livediagram/api-schema';

export const MCP_URL = mcpEndpoint(resolveMcpOrigin(process.env.NEXT_PUBLIC_MCP_ORIGIN));
const MCP_NAME = 'livediagram';

export type AiClientGroup = 'Chat apps' | 'Coding agents' | 'Editors' | 'Anything else';

export const AI_CLIENT_GROUPS: readonly AiClientGroup[] = [
  'Chat apps',
  'Coding agents',
  'Editors',
  'Anything else',
];

export type AiClientStep = {
  /** The instruction, one sentence. `**bold**` marks a menu or button name. */
  text: string;
  /** A command or config to copy. */
  code?: { lang: 'bash' | 'json' | 'toml' | 'text'; code: string; label?: string };
  /** A button that opens the place the step happens (a settings page, a one-click install). */
  action?: { href: string; label: string; external?: boolean };
};

export type AiClient = {
  /** Stable, also the URL hash that opens this tab (`/ai#cursor`). */
  id: string;
  name: string;
  group: AiClientGroup;
  blurb: string;
  steps: AiClientStep[];
  /** A closing line: where to look when a third-party label has moved, or a plan caveat. */
  note?: string;
};

// Cursor's one-click install: base64 of the same JSON its mcp.json takes for one server
// (cursor.com/docs/context/mcp/install-links).
export function cursorInstallLink(url: string = MCP_URL, name: string = MCP_NAME): string {
  const config = btoa(JSON.stringify({ url }));
  return `cursor://anysphere.cursor-deeplink/mcp/install?name=${encodeURIComponent(name)}&config=${encodeURIComponent(config)}`;
}

// VS Code's URL handler: the server's JSON, stringified and URL-encoded
// (code.visualstudio.com/api/extension-guides/ai/mcp).
export function vscodeInstallLink(url: string = MCP_URL, name: string = MCP_NAME): string {
  return `vscode:mcp/install?${encodeURIComponent(JSON.stringify({ name, type: 'http', url }))}`;
}

const json = (value: unknown) => JSON.stringify(value, null, 2);

export const AI_CLIENTS: readonly AiClient[] = [
  {
    id: 'claude',
    name: 'Claude',
    group: 'Chat apps',
    blurb: 'On the web and the desktop app',
    steps: [
      {
        text: 'Open **Settings**, then **Connectors**, in Claude.',
        action: {
          href: 'https://claude.ai/settings/connectors',
          label: 'Open Claude connectors',
          external: true,
        },
      },
      {
        text: 'Choose **Add custom connector**, name it livediagram and paste the address as its URL.',
        code: { lang: 'text', code: MCP_URL, label: 'URL' },
      },
      {
        text: 'Choose **Connect**, then approve on the livediagram page that opens.',
      },
    ],
    note: 'A connector you add on the web shows up in Claude Desktop too. On a Team or Enterprise plan, an owner may need to add it first.',
  },
  {
    id: 'chatgpt',
    name: 'ChatGPT',
    group: 'Chat apps',
    blurb: 'Connectors in developer mode',
    steps: [
      {
        text: 'In ChatGPT, open **Settings**, then **Apps & Connectors**, then **Advanced settings**, and switch on **Developer mode**.',
        action: {
          href: 'https://chatgpt.com/#settings/Connectors',
          label: 'Open ChatGPT settings',
          external: true,
        },
      },
      {
        text: 'Choose **Create**, name it livediagram, paste the address as the MCP server URL and pick **OAuth**.',
        code: { lang: 'text', code: MCP_URL, label: 'URL' },
      },
      {
        text: 'Approve on the livediagram page that opens, then pick livediagram from the tools menu in a new chat.',
      },
    ],
    note: 'Developer mode depends on your ChatGPT plan, and OpenAI moves its menus now and then: look for custom connectors in Settings.',
  },
  {
    id: 'claude-code',
    name: 'Claude Code',
    group: 'Coding agents',
    blurb: 'One command in your terminal',
    steps: [
      {
        text: 'Add livediagram for every project:',
        code: {
          lang: 'bash',
          code: `claude mcp add --transport http --scope user ${MCP_NAME} ${MCP_URL}`,
        },
      },
      {
        text: 'In a Claude Code session, run **/mcp**, choose livediagram and **Authenticate**. Approve in the browser.',
        code: { lang: 'text', code: '/mcp', label: 'In Claude Code' },
      },
    ],
    note: 'Working in a repository? The livediagram CLI is another way in, on the same account.',
  },
  {
    id: 'codex',
    name: 'Codex',
    group: 'Coding agents',
    blurb: "OpenAI's coding agent",
    steps: [
      {
        text: 'Add the server:',
        code: { lang: 'bash', code: `codex mcp add ${MCP_NAME} --url ${MCP_URL}` },
      },
      {
        text: 'Sign in, and approve in the browser:',
        code: { lang: 'bash', code: `codex mcp login ${MCP_NAME}` },
      },
    ],
    note: `Prefer config files? Add [mcp_servers.${MCP_NAME}] with url = "${MCP_URL}" to ~/.codex/config.toml.`,
  },
  {
    id: 'gemini',
    name: 'Gemini CLI',
    group: 'Coding agents',
    blurb: "Google's agent in your terminal",
    steps: [
      {
        text: 'Add the server:',
        code: { lang: 'bash', code: `gemini mcp add --transport http ${MCP_NAME} ${MCP_URL}` },
      },
      {
        text: 'In Gemini CLI, sign in and approve in the browser:',
        code: { lang: 'text', code: `/mcp auth ${MCP_NAME}`, label: 'In Gemini CLI' },
      },
    ],
  },
  {
    id: 'cursor',
    name: 'Cursor',
    group: 'Editors',
    blurb: 'One click, or one line of config',
    steps: [
      {
        text: 'Add livediagram to Cursor in one click:',
        action: { href: cursorInstallLink(), label: 'Add to Cursor' },
      },
      {
        text: 'Or add it by hand to **~/.cursor/mcp.json**:',
        code: {
          label: 'mcp.json',
          lang: 'json',
          code: json({ mcpServers: { [MCP_NAME]: { url: MCP_URL } } }),
        },
      },
      {
        text: 'In Cursor’s MCP settings, choose to sign in to livediagram, then approve in the browser.',
      },
    ],
  },
  {
    id: 'vscode',
    name: 'VS Code',
    group: 'Editors',
    blurb: 'GitHub Copilot’s agent mode',
    steps: [
      {
        text: 'Add livediagram to VS Code in one click:',
        action: { href: vscodeInstallLink(), label: 'Add to VS Code' },
      },
      {
        text: 'Or add it by hand to **.vscode/mcp.json**:',
        code: {
          lang: 'json',
          code: json({ servers: { [MCP_NAME]: { type: 'http', url: MCP_URL } } }),
        },
      },
      {
        text: 'Start the server when VS Code asks, allow the sign-in, and use it from Copilot Chat in agent mode.',
      },
    ],
  },
  {
    id: 'windsurf',
    name: 'Windsurf',
    group: 'Editors',
    blurb: 'Cascade’s MCP config',
    steps: [
      {
        text: 'In Cascade, open the MCP settings and choose to view the raw config (**mcp_config.json**).',
      },
      {
        text: 'Add livediagram to it:',
        code: { lang: 'json', code: json({ mcpServers: { [MCP_NAME]: { serverUrl: MCP_URL } } }) },
      },
      {
        text: 'Refresh the servers, then sign in to livediagram and approve in the browser.',
      },
    ],
  },
  {
    id: 'other',
    name: 'Any client',
    group: 'Anything else',
    blurb: 'Anything that speaks remote MCP',
    steps: [
      {
        text: 'Add a remote MCP server (HTTP, sometimes called Streamable HTTP) with this address:',
        code: { lang: 'text', code: MCP_URL, label: 'URL' },
      },
      {
        text: 'If the tool can sign in to servers (OAuth), it finds livediagram’s sign-in by itself: there is no client id or secret to enter.',
      },
      {
        text: 'If it can’t, create an API token in livediagram’s **Settings**, under **Account**, **API Tokens**, and send it as a header:',
        code: { lang: 'text', code: 'Authorization: Bearer lwt_…', label: 'Header' },
      },
    ],
    note: 'Running your own livediagram? Use your own MCP host in place of mcp.livediagram.app, still ending in /mcp.',
  },
];

type StarterPrompt = { title: string; prompt: string };

// Each maps to a shipped MCP tool (docs/specs/015-api/mcp-server.md §4): create_document with a graph,
// a template, find + read_document.
export const STARTER_PROMPTS: readonly StarterPrompt[] = [
  {
    title: 'Map a codebase',
    prompt:
      'Read this repository and draw its architecture as a livediagram diagram: the main services, what each one owns, and how requests flow between them.',
  },
  {
    title: 'Turn steps into a flowchart',
    prompt:
      'Make a livediagram flowchart of how a new customer signs up, from landing page to first invoice, with a decision for each place they can drop off.',
  },
  {
    title: 'Plan a launch',
    prompt:
      'Create a livediagram Gantt chart for launching our new website, with bars for design, copy, build, testing and go-live, and share a link I can send the team.',
  },
  {
    title: 'Brainstorm an offsite',
    prompt:
      'Make a livediagram mind map of ideas for our team offsite, with a branch each for the venue, the agenda, the budget and the activities.',
  },
  {
    title: 'Run a retro',
    prompt:
      'Set up a livediagram retrospective for our sprint, with what went well, what to improve and actions, and share a participant link so the team can add their notes.',
  },
  {
    title: 'Find and improve',
    prompt:
      'Find my livediagram document about onboarding, show it to me, and suggest three ways to make it clearer. Make the changes once I agree.',
  },
];
