// Whether the app being connected has arrived (docs/specs/030-knowledgebase/mcp-connect.md "The view" 4): the
// connections Insights counts, compared with what they were when the view first read them. Pure.
import type { KnowledgeAgent } from '@liveknowledge/api-schema';

/** How often the view checks while it waits, and for how long after it opens or Check Now is pressed. */
export const CHECK_EVERY_MS = 10_000;
export const CHECK_FOR_MS = 5 * 60_000;

/** What a connection had done when the view first read it: its reads this week and when it was last seen. */
export type AgentMarks = ReadonlyMap<string, { reads: number; seen: number }>;

export function agentMarks(agents: readonly KnowledgeAgent[]): AgentMarks {
  return new Map(
    agents.map((agent) => [agent.id, { reads: agent.readsThisWeek, seen: agent.lastSeenAt ?? 0 }]),
  );
}

/** The first connection that is new since `baseline`, or that read or was seen again since; null when none. */
export function newConnection(
  baseline: AgentMarks,
  agents: readonly KnowledgeAgent[],
): KnowledgeAgent | null {
  for (const agent of agents) {
    const before = baseline.get(agent.id);
    if (!before) return agent;
    if (agent.readsThisWeek > before.reads || (agent.lastSeenAt ?? 0) > before.seen) return agent;
  }
  return null;
}
