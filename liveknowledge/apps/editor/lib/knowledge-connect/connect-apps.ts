// The AI apps Connect walks through (docs/specs/030-knowledgebase/mcp-connect.md "The view" 1 and 2): the Build with
// AI page's own client list (@liveworkspace/marketing-site aiClients, pure data), so the steps are written once for
// both, narrowed to the six the view offers and pointed at this deployment's MCP address. Pure, but for the pick kept
// in this browser.
import { aiClients, type AiClient } from '@liveworkspace/marketing-site/lib/ai-clients';

export type ConnectAppId = 'claude' | 'claude-code' | 'chatgpt' | 'cursor' | 'vscode' | 'other';

export const CONNECT_APP_IDS: readonly ConnectAppId[] = [
  'claude',
  'claude-code',
  'chatgpt',
  'cursor',
  'vscode',
  'other',
];

export type ConnectApp = AiClient & { id: ConnectAppId };

// The client list's "Any client" reads as an app among apps here.
const NAMES: Partial<Record<ConnectAppId, string>> = { other: 'Other App' };

/** The six apps in the view's order, each step's address, command and JSON naming `mcpUrl`. */
export function connectApps(mcpUrl: string): readonly ConnectApp[] {
  const clients = aiClients({ name: 'liveknowledge', mcpUrl });
  return CONNECT_APP_IDS.map((id) => {
    const client = clients.find((c) => c.id === id);
    if (!client) throw new Error(`No AI client "${id}" in the Build with AI list`);
    return { ...client, id, name: NAMES[id] ?? client.name };
  });
}

/** Where the pick is kept: in this browser, for every knowledgebase. */
export const CONNECT_APP_KEY = 'liveknowledge:connect-app';

const known = (value: unknown): value is ConnectAppId =>
  typeof value === 'string' && (CONNECT_APP_IDS as readonly string[]).includes(value);

/** The app picked last in this browser, or Claude. A store that cannot be read is Claude. */
export function keptConnectApp(): ConnectAppId {
  try {
    const value = window.localStorage.getItem(CONNECT_APP_KEY);
    return known(value) ? value : 'claude';
  } catch {
    return 'claude';
  }
}

/** Keep the pick; a store that refuses leaves it for this visit only. */
export function keepConnectApp(id: ConnectAppId): void {
  try {
    window.localStorage.setItem(CONNECT_APP_KEY, id);
  } catch {
    // Private mode or a full store: the pick holds while the view is open.
  }
}
