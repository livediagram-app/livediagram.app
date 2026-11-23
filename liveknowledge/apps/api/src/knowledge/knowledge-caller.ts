// Who is asking, as the knowledge routes need it (docs/specs/030-knowledgebase/insights.md "Reads",
// search-and-ask.md "Share roles"): a person or a named agent, and whether a signed-in account stands behind the
// request. No route here decides access: that is the grant's (routes/context.ts).
import { agentName, type Reader } from '@liveknowledge/knowledge';
import { frontDoorOf } from '../changesets/front-door';
import type { RouteContext } from '../routes/context';

/** The header an agent's front door names its client in (the MCP client's name, "Claude Code"). Optional. */
export const AGENT_NAME_HEADER = 'X-Liveknowledge-Agent';

const DOOR_NAMES = { Mcp: 'MCP', Cli: 'CLI', Api: 'API Token', Editor: 'API Token' } as const;

/** The reader a request counts as: an agent when it bears an API token or comes through the MCP or the CLI, named
 *  by its client (the header), else by its token's name, else by its door; a person otherwise. The same name a
 *  page's Created and Updated keep for its writes (page-writer.ts writerOf; verification.md "An agent acting for a
 *  person"), so Connected Agents and the page name a CLI connection alike ("Claude Code", never "Agent"). */
export function readerOf(ctx: Pick<RouteContext, 'request' | 'token'>): Reader {
  const door = frontDoorOf(ctx.request);
  if (!ctx.token && door !== 'Mcp' && door !== 'Cli') return { kind: 'person' };
  const header = ctx.request.headers.get(AGENT_NAME_HEADER)?.trim();
  const token = ctx.token?.name?.trim();
  const name = header || token;
  return { kind: 'agent', name: name ? agentName(name) : DOOR_NAMES[door] };
}

/** The account behind the request: a signed-in person's, or the one an API token acts for. Null for a guest and for
 *  a visitor through a share link, who has none. */
export function accountOf(
  ctx: Pick<RouteContext, 'accountUserId' | 'verifiedUserId' | 'token'>,
): string | null {
  if (ctx.accountUserId) return ctx.accountUserId;
  return ctx.token && ctx.verifiedUserId ? ctx.verifiedUserId : null;
}

/** Who owns a page their save or create makes (docs/specs/030-knowledgebase/verification.md "The owner"): a signed-in
 *  person, or the person behind a workbench session. Never an API token's agent, a guest or a link visitor, who make
 *  a page with no owner. Read from the request's credentials alone, never from what the body says. */
export function pageCreatorOf(
  ctx: Pick<RouteContext, 'accountUserId' | 'token' | 'workbench' | 'resolveOwner'>,
): string | null {
  if (ctx.token) return null;
  if (ctx.accountUserId) return ctx.accountUserId;
  return ctx.workbench ? ctx.resolveOwner() : null;
}
