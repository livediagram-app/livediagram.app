'use client';

// The AI Knowledge dashboard (docs/specs/030-knowledgebase/ai-knowledge.md "The view, as built"): the figures band,
// then two stacks of cards, the wide one (Needs Attention, Connected Agents) and the narrow one (Knowledge Health,
// Always in Context, Most Read, What an Agent Sees); one column below a laptop's width. Every figure is from the one
// overview read. A tile filters Needs Attention or brings its card into view and focuses it.
import { NOT_READ_DAYS } from '@liveknowledge/knowledge';
import { useMemo, useState } from 'react';
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
import { NotReadCard } from './NotReadCard';
import { RequiredReadingCard } from './RequiredReadingCard';
import { NeedsAttention } from './NeedsAttention';
import { useReviewEvery } from '@/components/knowledge-settings/useReviewEvery';
import { takeAskedAttentionFilter } from '@/lib/knowledge-ask/attention-filter-ask';

/** What the dashboard's controls do: AiKnowledgeView's handlers, each checking its right again. */
export type DashboardActions = {
  openPage: (tab: string, block?: string) => void;
  // With Pro on, Most Read's period (tiers.md "AI Knowledge History").
  setPeriod?: (days: number) => void;
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

// One column of cards: a stack of its own, spaced as the band above.
const COLUMN = 'flex min-w-0 flex-col gap-4 sm:gap-5';

export function AiDashboard({
  overview: read,
  documentId,
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
  /** The knowledgebase open: its Review Period is the live settings store's, as the rail's is, so a change of it
   *  (here, or the room's op) shows at once with no new read. Absent, the read's period stands. */
  documentId?: string;
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
  const live = useReviewEvery(documentId);
  const reviewEvery = documentId ? live : read.reviewEvery;
  // Whether verification is on (verification.md "Under a Review Period of Never") follows the period held now.
  const overview = useMemo(
    () => (read.reviewEvery === reviewEvery ? read : { ...read, reviewEvery }),
    [read, reviewEvery],
  );
  // A page's rail may ask for Suggested Edits as it opens this view (attention-filter-ask.ts).
  const [filter, setFilter] = useState<AttentionFilter>(() => takeAskedAttentionFilter() ?? 'all');
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
        overview={overview}
        filter={filter}
        onGo={go}
      />
      {/* Two equal columns on a wide screen (owner 2026-11-21; ai-knowledge.md "The view, as built"), each its own
          stack, so Knowledge Health heads the right one on a whole pixel. One column below lg, in the same order as
          the page reads and focus moves: the left column, then the right. */}
      <div className="flex flex-col gap-4 sm:gap-5 lg:grid lg:grid-cols-2 lg:items-start">
        <div className={COLUMN}>
          <NeedsAttention
            overview={overview}
            filter={filter}
            onFilter={setFilter}
            canResolve={rights.resolve}
            canAcceptSuggestions={rights.acceptSuggestions}
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
          <MostReadCard
            pages={overview.reads.mostRead}
            onOpenPage={actions.openPage}
            history={overview.history}
            onPeriod={actions.setPeriod}
          />
          {/* Absent from an older api: not drawn. */}
          {overview.notRead ? (
            <NotReadCard
              pages={overview.notRead.pages}
              total={overview.notRead.total}
              days={overview.notRead.days ?? NOT_READ_DAYS}
              now={now}
              onOpenPage={actions.openPage}
            />
          ) : null}
        </div>
        <div className={COLUMN}>
          <HealthSection
            health={overview.health}
            lowHealth={overview.lowHealth}
            onOpenPage={actions.openPage}
            canRemind={canEmailOwners}
            remindedAt={overview.reviewEmails.remindedAt}
            reminding={busy.has('remind-owners')}
            now={now}
            onRemind={actions.remindOwners}
            verificationOn={overview.reviewEvery !== 'never'}
          />
          {/* Under Knowledge Health (required-reading.md "Where it shows"); absent from an older api: not drawn. */}
          {overview.requiredReading ? (
            <RequiredReadingCard pages={overview.requiredReading} onOpenPage={actions.openPage} />
          ) : null}
          <ContextSection
            context={overview.context}
            canEdit={rights.context}
            busy={busy}
            onOpenPage={actions.openPage}
            onAdd={actions.addContext}
            onRemove={actions.removeContext}
          />
          <AgentSampleCard sample={agentSample(overview, now)} />
        </div>
      </div>
    </div>
  );
}
