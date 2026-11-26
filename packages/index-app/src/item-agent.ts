// Which agent, if any, a request to an app writes for its person (liveworkspace/docs/specs/004-index/
// one-explorer-contracts.md "The event log", Work Tracker 1381): every app's create and room read it the same way, so
// History names an agent alike whichever app it wrote in. An agent is any request with an API token (the MCP
// server's tools, the CLI, a script with a token), as liveknowledge's page stamps and liveplanner's card history
// already count one. A signed-in person's editor, a guest and a link visitor carry no token and are people.
import { cleanItemAgentName, type ItemAgent, type ItemAgentVia } from '@liveworkspace/index-client';
import { agentCommentMarks } from '@liveworkspace/model-core/comment-ai';

// An agent that names neither its client nor its token, named by its door (liveknowledge's knowledge-caller.ts names
// its readers so too).
const DOOR_NAMES: Record<ItemAgentVia, string> = { mcp: 'MCP', cli: 'CLI', api: 'API Token' };

/** The headers an app's front doors speak: `client`, the door (`X-Livediagram-Client`: `mcp`, `cli` or `editor`),
 *  and `agent`, the agent's client name where the app's MCP sends one (liveknowledge's `X-Liveknowledge-Agent`). */
export type AgentHeaders = { client: string; agent?: string };

/** The agent `request` writes for its person, or null for a person's own request (no API token). Named by its
 *  client (the agent header), else by its token's name, else by its door; `via` is the door it came through, any
 *  door but the MCP and the CLI being the API (an editor's door with a token is still an API caller). */
export function itemAgentOf(
  request: Request,
  token: { name?: string | null } | null | undefined,
  headers: AgentHeaders,
): ItemAgent | null {
  if (!token) return null;
  const door = request.headers.get(headers.client)?.trim().toLowerCase();
  const via: ItemAgentVia = door === 'mcp' || door === 'cli' ? door : 'api';
  const named = headers.agent ? cleanItemAgentName(request.headers.get(headers.agent)) : null;
  return { name: named ?? cleanItemAgentName(token.name) ?? DOOR_NAMES[via], via };
}

/** The marks an agent's new comment carries (liveworkspace/docs/specs/004-index/inbox-reading.md "AI comments"): the
 *  assistant's name as `itemAgentOf` names it, and `needsResponse` when the body asks with `true`. A person's request
 *  (no API token) carries none, whatever its body says. */
export function agentCommentMarksOf(
  request: Request,
  token: { name?: string | null } | null | undefined,
  headers: AgentHeaders,
  body: { needsResponse?: unknown },
): { agent?: string; needsResponse?: true } {
  if (!token) return {};
  return agentCommentMarks(itemAgentOf(request, token, headers)?.name, body);
}
