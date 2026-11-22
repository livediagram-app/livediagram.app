// What a connection may do in this knowledgebase, set by an Editor (docs/specs/015-api/api.md "Knowledge":
// `PUT agents/<tokenId>/scopes`; docs/specs/024-agents/knowledgebase-for-agents.md "Scopes"). One request through
// the shared funnel, beside lib/api/knowledge.ts, which holds the tab's reads.
import type { AgentScope, AgentScopesResponse } from '@liveknowledge/api-schema';
import { apiFetch, expectOk } from './core';
import { knowledgeHeaders, knowledgeSignal, knowledgeUrl, type KnowledgeCaller } from './knowledge';

// The refusal the card words itself.
const expected = (code: string | null) => code === 'forbidden';

export async function apiSetAgentScopes(
  who: KnowledgeCaller,
  documentId: string,
  tokenId: string,
  scopes: readonly AgentScope[],
): Promise<AgentScope[]> {
  const res = await apiFetch(
    knowledgeUrl(documentId, `agents/${encodeURIComponent(tokenId)}/scopes`),
    {
      method: 'PUT',
      headers: await knowledgeHeaders(who, true),
      body: JSON.stringify({ scopes }),
      signal: knowledgeSignal(),
    },
  );
  return (await expectOk<AgentScopesResponse>(res, 'set agent scopes', expected)).scopes;
}
