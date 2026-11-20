// Who is asking, as the knowledge routes need it (docs/specs/030-knowledgebase/ai-knowledge.md "Reads",
// search-and-ask.md "Share roles"): a person or a named agent, and whether a signed-in account stands behind the
// request. No route here decides access: that is the grant's (routes/context.ts).
import { agentName, type Reader } from '@liveknowledge/knowledge';
import { frontDoorOf } from '../changesets/front-door';
import type { RouteContext } from '../routes/context';

/** The header an agent's front door names its client in (the MCP client's name, "Claude Code"). Optional. */
export const AGENT_NAME_HEADER = 'X-Liveknowledge-Agent';

const DOOR_NAMES = { Mcp: 'MCP', Cli: 'CLI', Api: 'API Token', Editor: 'API Token' } as const;

/** The reader a request counts as: an agent when it bears an API token or comes through the MCP or the CLI, named
 *  by its client (the header), else by its door; a person otherwise. */
export function readerOf(ctx: Pick<RouteContext, 'request' | 'token'>): Reader {
  const door = frontDoorOf(ctx.request);
  if (!ctx.token && door !== 'Mcp' && door !== 'Cli') return { kind: 'person' };
  const named = agentName(ctx.request.headers.get(AGENT_NAME_HEADER) ?? '');
  return { kind: 'agent', name: named || DOOR_NAMES[door] };
}

/** The account behind the request: a signed-in person's, or the one an API token acts for. Null for a guest and for
 *  a visitor through a share link, who has none. */
export function accountOf(
  ctx: Pick<RouteContext, 'accountUserId' | 'verifiedUserId' | 'token'>,
): string | null {
  if (ctx.accountUserId) return ctx.accountUserId;
  return ctx.token && ctx.verifiedUserId ? ctx.verifiedUserId : null;
}
