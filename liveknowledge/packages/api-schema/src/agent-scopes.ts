// What an agent may do in a knowledgebase (docs/specs/024-agents/knowledgebase-for-agents.md "Scopes"), over the
// platform's API tokens, which are read-only or full and nothing between (public-api-and-tokens.md):
//   - a read-only token holds `read`, whatever anyone grants it;
//   - a full token holds `read` and `suggest` until an Editor of the knowledgebase grants it `write` there;
//   - the role of the person the token acts for narrows both: a Viewer's agent only reads, and only an Editor's
//     agent may hold `write`.
import type { AgentScope } from './knowledge';

export const AGENT_SCOPES: readonly AgentScope[] = ['read', 'suggest', 'write'];
/** What a new connection holds. */
export const DEFAULT_AGENT_SCOPES: readonly AgentScope[] = ['read', 'suggest'];

export const isAgentScope = (v: unknown): v is AgentScope =>
  typeof v === 'string' && (AGENT_SCOPES as readonly string[]).includes(v);

/** Scopes as a list in the canonical order, each once; `read` is always held. Null for anything that is no list of
 *  scopes. */
export function parseAgentScopes(v: unknown): AgentScope[] | null {
  if (!Array.isArray(v) || !v.every(isAgentScope)) return null;
  return AGENT_SCOPES.filter((scope) => scope === 'read' || v.includes(scope));
}

/** The scopes an agent holds: what its token was granted (the default when nothing was), cut down by a read-only
 *  token and by the role of the person it acts for. */
export function agentScopesFor(caller: {
  readOnly: boolean;
  role: 'edit' | 'participate' | 'view';
  granted?: readonly AgentScope[] | null;
}): AgentScope[] {
  if (caller.readOnly || caller.role === 'view') return ['read'];
  const granted = caller.granted ?? DEFAULT_AGENT_SCOPES;
  return AGENT_SCOPES.filter(
    (scope) =>
      scope === 'read' ||
      (granted.includes(scope) && (scope !== 'write' || caller.role === 'edit')),
  );
}
