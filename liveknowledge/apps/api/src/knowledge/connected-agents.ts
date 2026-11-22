// Connected Agents as `GET knowledge` answers them (docs/specs/030-knowledgebase/ai-knowledge.md "Connected
// agents"): the connections the room has seen by token (agent-seen.ts), each with the reads counted under its name,
// then any agent known only by its reads (counted before the room kept tokens). Pure.
import type { KnowledgeAgent } from '@liveknowledge/api-schema';
import { stableHash, type AgentReads } from '@liveknowledge/knowledge';
import type { SeenAgent } from './agent-seen';

export function connectedAgents(input: {
  seen: readonly SeenAgent[];
  reads: readonly AgentReads[];
  titleOf: (tab: string) => string;
  /** Whether the caller may call the scopes route: an Editor in person. Only then is a token's id sent. */
  canGrant: boolean;
}): KnowledgeAgent[] {
  const readsOf = new Map(input.reads.map((r) => [r.agent, r]));
  const counted = (name: string) => {
    const reads = readsOf.get(name);
    return {
      readsThisWeek: reads?.readsThisWeek ?? 0,
      topPages: (reads?.topPages ?? []).map((tab) => ({ tab, title: input.titleOf(tab) })),
    };
  };
  const named = new Set(input.seen.map((s) => s.name));
  return [
    ...input.seen.map((s) => ({
      id: s.id,
      name: s.name,
      door: s.door,
      scopes: s.scopes,
      lastSeenAt: s.lastSeenAt,
      canHoldWrite: s.canHoldWrite,
      ...(input.canGrant ? { tokenId: s.tokenId } : {}),
      ...counted(s.name),
    })),
    ...input.reads
      .filter((r) => !named.has(r.agent))
      .map((r) => ({ id: stableHash('agent-name', r.agent), name: r.agent, ...counted(r.agent) })),
  ];
}
