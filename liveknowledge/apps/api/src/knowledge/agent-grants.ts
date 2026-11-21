// What an API token may do in this knowledgebase (docs/specs/024-agents/knowledgebase-for-agents.md "Scopes";
// @liveknowledge/api-schema agent-scopes.ts). The platform's tokens are read-only or full and nothing between, so
// the step from `suggest` to `write` is kept here, in the knowledgebase's own room: `agent_grants`, one row a token
// an Editor has decided about. A token with no row holds the default, `read` and `suggest`.
//
// The grant is settled once a request, before the document's routes run, and narrows the role the token's person
// holds (routes/context.ts grantOn): every gate then reads the narrowed role, so no route checks a scope of its own.
import { parseAgentScopes, type AgentScope } from '@liveknowledge/api-schema';
import { json } from '../responses';
import { grantOn, type DocumentRouteContext } from '../routes/context';
import type { DocumentEnv } from '../types';
import { knowledgeDb } from './knowledge-db';

/** The longest token id a grant is kept for. */
const MAX_TOKEN_ID = 128;

export const isTokenId = (v: string): boolean => v.length > 0 && v.length <= MAX_TOKEN_ID;

/** A stored grant read back: the names joined by a space. */
export const scopesOfText = (scopes: string): AgentScope[] | null =>
  parseAgentScopes(scopes.split(' ').filter(Boolean));

/** The scopes an Editor granted a token here; null when nobody has decided (the default applies). */
export async function storedScopes(
  env: DocumentEnv,
  tokenId: string,
): Promise<AgentScope[] | null> {
  const row = await knowledgeDb(env)
    .prepare('SELECT scopes FROM agent_grants WHERE token_id = ?')
    .bind(tokenId)
    .first<{ scopes: string }>();
  return row ? scopesOfText(row.scopes) : null;
}

export async function writeScopes(
  env: DocumentEnv,
  tokenId: string,
  scopes: readonly AgentScope[],
  now = Date.now(),
): Promise<void> {
  await knowledgeDb(env)
    .prepare(
      `INSERT INTO agent_grants (token_id, scopes, updated_at) VALUES (?, ?, ?)
         ON CONFLICT (token_id) DO UPDATE SET scopes = excluded.scopes, updated_at = excluded.updated_at`,
    )
    .bind(tokenId, scopes.join(' '), now)
    .run();
}

/** The request with its token's grant settled: one keyed read for a full token, none for a read-only one (it
 *  holds `read` whatever was granted) or for a person. */
export async function withAgentGrant(ctx: DocumentRouteContext): Promise<DocumentRouteContext> {
  if (!ctx.token || ctx.agent !== undefined || ctx.segments.length < 3) return ctx;
  const readOnly = ctx.token.readOnly === true;
  const granted = readOnly ? null : await storedScopes(ctx.env, ctx.token.id);
  return { ...ctx, agent: { readOnly, granted } };
}

/**
 * A refusal an agent can act on. A route that answered a bare 403 to a token whose scopes hold it below its
 * person's own role is answered `scope_needed` instead, naming what the token holds here and the way on; any other
 * answer goes out as it is.
 */
export async function scopeRefusalOf(ctx: DocumentRouteContext, res: Response): Promise<Response> {
  if (res.status !== 403 || !ctx.agent) return res;
  const access = grantOn(ctx, ctx.segments[2] ?? '');
  if (!access?.scopes || access.role === access.personRole) return res;
  const body = (await res
    .clone()
    .json()
    .catch(() => null)) as { error?: unknown } | null;
  // The rules' routes answer a token below `write` as read-only (routes/automation-routes.ts): it needs `write`.
  const rules = body?.error === 'read_only_token' && ctx.agent.readOnly !== true;
  if (body?.error !== 'forbidden' && !rules) return res;
  const needs: AgentScope = rules || access.scopes.includes('suggest') ? 'write' : 'suggest';
  console.info('[knowledge] scope needed', {
    documentId: ctx.segments[2],
    tokenId: ctx.token?.id,
    needs,
  });
  return json(
    {
      error: 'scope_needed',
      needs,
      scopes: access.scopes,
      message: rules
        ? 'This connection holds the read and suggest scopes here, so it reads the knowledgebase’s rules and changes none. Ask an Editor of the knowledgebase to grant this connection the write scope.'
        : needs === 'write'
          ? 'This connection holds the read and suggest scopes here, so it does not change the knowledgebase directly. Suggest a change to a page instead with suggest_edit, or ask an Editor of the knowledgebase to grant this connection the write scope.'
          : 'This connection holds the read scope alone here. Ask an Editor of the knowledgebase to grant it the suggest scope.',
    },
    { status: 403 },
  );
}
