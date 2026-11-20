'use client';

// Connected Agents (docs/specs/030-knowledgebase/ai-knowledge.md "Connected agents"): a card for each connection
// seen here in the last 30 days (AgentCard.tsx).
import type { KnowledgeAgent } from '@liveknowledge/api-schema';
import { Button, CompactEmptyState } from '@liveknowledge/ui';
import { AgentCard, type AgentWriteAsk } from './AgentCard';
import { AgentIcon } from './ai-knowledge-icons';
import { AiSection } from './AiSection';

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
  return (
    <AiSection
      id="ai-agents"
      title="Connected Agents"
      about="Agents that read or wrote here in the last 30 days. An agent can open only what its person or token can."
      count={agents.length}
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
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {agents.map((agent) => (
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
      )}
    </AiSection>
  );
}
