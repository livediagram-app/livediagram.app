'use client';

// Allow Writing and Stop Writing (docs/specs/024-agents/knowledgebase-for-agents.md "Scopes"): the Editor is asked
// first, then the card shows the new scopes at once while `PUT agents/<token>/scopes` is out. A refusal puts the
// card back as it was and says so in a toast; a success reads the overview again.
import { useCallback, useState } from 'react';
import type { AgentScope, KnowledgeAgent } from '@liveknowledge/api-schema';
import { ApiError } from '@liveworkspace/workbench/lib/api/api-error';
import { apiSetAgentScopes } from '@/lib/api/knowledge-agents';
import type { KnowledgeCaller } from '@/lib/api/knowledge';
import { track } from '@/lib/telemetry';
import type { AgentWriteAsk } from './AgentCard';

const SCOPES: Record<AgentWriteAsk['kind'], AgentScope[]> = {
  allow: ['read', 'suggest', 'write'],
  stop: ['read', 'suggest'],
};

type Pending = { scopes: AgentScope[]; landedOn?: readonly KnowledgeAgent[] | null };

export function agentWriteFailureText(err: unknown, kind: AgentWriteAsk['kind']): string {
  if (err instanceof ApiError && err.status === 403)
    return 'Only an Editor of this knowledgebase can change what an agent may do.';
  return kind === 'allow'
    ? 'Writing could not be allowed. Check your connection and try again.'
    : 'Writing could not be stopped. Check your connection and try again.';
}

export function useAgentWrite(input: {
  who: KnowledgeCaller;
  documentId: string;
  allowed: boolean;
  agents: readonly KnowledgeAgent[] | null;
  refresh: () => void;
  onFailure: (text: string) => void;
}) {
  const { who, documentId, allowed, agents, refresh, onFailure } = input;
  const [asking, setAsking] = useState<AgentWriteAsk | null>(null);
  // What each card shows ahead of the read, by the row's id. `landedOn` is unset while the request is out; once
  // it has landed it is the read the change was asked over, and the entry gives way to the next read.
  const [pending, setPending] = useState<ReadonlyMap<string, Pending>>(() => new Map());

  const confirm = useCallback(async () => {
    const ask = asking;
    setAsking(null);
    if (!ask || !allowed) return;
    const { id } = ask.agent;
    const scopes = SCOPES[ask.kind];
    track('UI', 'Used', ask.kind === 'allow' ? 'AgentWriteAllowed' : 'AgentWriteStopped');
    setPending((held) => new Map(held).set(id, { scopes }));
    try {
      await apiSetAgentScopes(who, documentId, ask.tokenId, scopes);
      setPending((held) => new Map(held).set(id, { scopes, landedOn: agents }));
      refresh();
    } catch (err) {
      setPending((held) => {
        const next = new Map(held);
        next.delete(id);
        return next;
      });
      onFailure(agentWriteFailureText(err, ask.kind));
    }
  }, [asking, allowed, agents, who, documentId, refresh, onFailure]);

  const ahead = (id: string): Pending | undefined => {
    const entry = pending.get(id);
    return entry && (entry.landedOn === undefined || entry.landedOn === agents) ? entry : undefined;
  };
  return {
    asking,
    ask: (next: AgentWriteAsk) => {
      if (allowed) setAsking(next);
    },
    cancel: () => setAsking(null),
    confirm,
    /** The agents as the cards show them: a pending change over what was read. */
    shown: (agents ?? []).map((agent) => {
      const entry = ahead(agent.id);
      return entry ? { ...agent, scopes: entry.scopes } : agent;
    }),
    busy: new Set(
      [...pending].filter(([, entry]) => entry.landedOn === undefined).map(([id]) => id),
    ),
  };
}
