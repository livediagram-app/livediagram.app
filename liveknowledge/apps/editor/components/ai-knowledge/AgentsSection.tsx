'use client';

// Connected Agents (docs/specs/030-knowledgebase/ai-knowledge.md "Connected agents"): a card for each connection
// seen here in the last 30 days (AgentCard.tsx), at most AGENTS_CAP before Show All, and Connect an Agent.
import type { KnowledgeAgent } from '@liveknowledge/api-schema';
import { Button, CompactEmptyState } from '@liveknowledge/ui';
import { AgentCard, type AgentWriteAsk } from './AgentCard';
import { AddIcon, AgentIcon } from './ai-knowledge-icons';
import { AiSection } from './AiSection';
import { useShowAll } from './useShowAll';

export const AGENTS_CAP = 4;

export function AgentsSection({
  agents,
  canGrant,
  busy,
  now,
  onConnect,
  onOpenPage,
  onAskWrite,
}: {
  agents: readonly KnowledgeAgent[];
  canGrant: boolean;
  // The ids of the cards whose change is out.
  busy: ReadonlySet<string>;
  now: number;
  onConnect: () => void;
  onOpenPage: (tab: string) => void;
  onAskWrite: (ask: AgentWriteAsk) => void;
}) {
  const { shown, toggle } = useShowAll(agents, AGENTS_CAP);
  return (
    <AiSection
      id="ai-agents"
      title="Connected Agents"
      icon={<AgentIcon />}
      about="Agents that read or wrote here in the last 30 days. An agent can open only what its person or token can."
      count={agents.length}
      action={
        agents.length === 0 ? undefined : (
          <Button
            variant="secondary"
            size="xs"
            onClick={onConnect}
            className="cursor-pointer phone:min-h-11"
          >
            <AddIcon />
            Connect an Agent
          </Button>
        )
      }
    >
      {agents.length === 0 ? (
        <CompactEmptyState
          icon={<AgentIcon />}
          title="No Agents Yet"
          description="Connect a coding agent or an assistant and it can search and read these pages."
          action={
            <Button variant="secondary" size="xs" onClick={onConnect}>
              Connect an Agent
            </Button>
          }
        />
      ) : (
        <>
          <ul className="grid gap-3 sm:grid-cols-2">
            {shown.map((agent) => (
              <AgentCard
                key={agent.id}
                agent={agent}
                canGrant={canGrant}
                busy={busy.has(agent.id)}
                now={now}
                onOpenPage={onOpenPage}
                onAskWrite={onAskWrite}
              />
            ))}
          </ul>
          {toggle}
        </>
      )}
    </AiSection>
  );
}
