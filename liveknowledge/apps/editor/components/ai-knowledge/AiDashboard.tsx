'use client';

// The AI Knowledge dashboard (docs/specs/030-knowledgebase/ai-knowledge.md "The view, as built"): the figures band,
// then two stacks of cards, the wide one (Needs Attention, Connected Agents) and the narrow one (Knowledge Health,
// Always in Context, Most Read, What an Agent Sees); one column below a laptop's width. Every figure is from the one
// overview read. A tile filters Needs Attention or brings its card into view and focuses it.
import { useState } from 'react';
import type {
  KnowledgeAgent,
  KnowledgeOverviewResponse,
  KnowledgeQuestion,
  KnowledgeSuggestion,
} from '@liveknowledge/api-schema';
import { prefersReducedMotion } from '@liveknowledge/ui';
import type { AskRights } from '@/lib/knowledge-ask/ask-rights';
import { dashboardFigures, type AttentionFilter } from '@/lib/knowledge-ask/dashboard-figures';
import { agentSample } from '@/lib/knowledge-ask/overview-words';
import type { AgentWriteAsk } from './AgentCard';
import { AgentsSection } from './AgentsSection';
import { FigureTiles, type TileTarget } from './FigureTiles';
import { AgentSampleCard, ContextSection, HealthSection } from './HealthAndContext';
import { MostReadCard } from './MostReadCard';
import { NeedsAttention } from './NeedsAttention';

/** What the dashboard's controls do: AiKnowledgeView's handlers, each checking its right again. */
export type DashboardActions = {
  openPage: (tab: string, block?: string) => void;
  connect: () => void;
  openAiSettings: () => void;
  dismissConflict: (id: string) => void;
  askOwners: (id: string) => void;
  draft: (question: KnowledgeQuestion) => void;
  dismissQuestion: (key: string) => void;
  accept: (suggestion: KnowledgeSuggestion) => void;
  dismissSuggestion: (suggestion: KnowledgeSuggestion) => void;
  remindOwners: () => void;
  addContext: () => void;
  removeContext: (tab: string) => void;
  askWrite: (ask: AgentWriteAsk) => void;
};

// A card brought into view by its tile, then focused so a keyboard or a screen reader goes on from it.
function goToCard(id: string): void {
  const card = document.querySelector<HTMLElement>(`[data-ai-section="${id}"]`);
  if (!card) return;
  card.scrollIntoView?.({ block: 'start', behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
  card.focus({ preventScroll: true });
}

const CARD_OF: Record<'reads' | 'agents' | 'health', string> = {
  reads: 'ai-reads',
  agents: 'ai-agents',
  health: 'ai-health',
};

export function AiDashboard({
  overview,
  rights,
  agents,
  agentsBusy,
  busy,
  drafting,
  canEmailOwners,
  now,
  actions,
}: {
  overview: KnowledgeOverviewResponse;
  rights: AskRights;
  // The agents as shown, a pending write change already on its card (useAgentWrite).
  agents: readonly KnowledgeAgent[];
  agentsBusy: ReadonlySet<string>;
  busy: ReadonlySet<string>;
  drafting: string | null;
  canEmailOwners: boolean;
  now: number;
  actions: DashboardActions;
}) {
  const [filter, setFilter] = useState<AttentionFilter>('all');
  const go = (target: TileTarget) => {
    if ('filter' in target) {
      setFilter(target.filter);
      goToCard('ai-attention');
    } else goToCard(CARD_OF[target.card]);
  };
  return (
    <div className="flex flex-col gap-4 sm:gap-5">
      <FigureTiles
        figures={dashboardFigures(overview)}
        days={overview.reads.days}
        filter={filter}
        onGo={go}
      />
      <div className="grid items-start gap-4 sm:gap-5 lg:grid-cols-3">
        <div className="flex min-w-0 flex-col gap-4 sm:gap-5 lg:col-span-2">
          <NeedsAttention
            overview={overview}
            filter={filter}
            onFilter={setFilter}
            canResolve={rights.resolve}
            canDraft={rights.makePages}
            canManageAi={rights.manageAi}
            canAskOwners={canEmailOwners}
            busy={busy}
            drafting={drafting}
            now={now}
            onOpenPage={actions.openPage}
            onDismissConflict={actions.dismissConflict}
            onAskOwners={actions.askOwners}
            onDraft={actions.draft}
            onDismissQuestion={actions.dismissQuestion}
            onAccept={actions.accept}
            onDismissSuggestion={actions.dismissSuggestion}
            onOpenAiSettings={actions.openAiSettings}
          />
          <AgentsSection
            agents={agents}
            canGrant={rights.grantAgents}
            busy={agentsBusy}
            now={now}
            onConnect={actions.connect}
            onOpenPage={actions.openPage}
            onAskWrite={actions.askWrite}
          />
        </div>
        <div className="flex min-w-0 flex-col gap-4 sm:gap-5">
          <HealthSection
            health={overview.health}
            lowHealth={overview.lowHealth}
            onOpenPage={actions.openPage}
            canRemind={canEmailOwners}
            remindedAt={overview.reviewEmails.remindedAt}
            reminding={busy.has('remind-owners')}
            now={now}
            onRemind={actions.remindOwners}
          />
          <ContextSection
            context={overview.context}
            canEdit={rights.context}
            busy={busy}
            onOpenPage={actions.openPage}
            onAdd={actions.addContext}
            onRemove={actions.removeContext}
          />
          <MostReadCard pages={overview.reads.mostRead} onOpenPage={actions.openPage} />
          <AgentSampleCard sample={agentSample(overview, now)} />
        </div>
      </div>
    </div>
  );
}
