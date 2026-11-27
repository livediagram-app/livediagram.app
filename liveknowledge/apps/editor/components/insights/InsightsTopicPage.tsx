'use client';

// A topic's page on Insights (docs/specs/030-knowledgebase/insights.md "A topic's page"): the BackBar to the
// dashboard, then every card of the topic whole, with all its rows and actions. Needs Attention's page leads with
// its figure tiles, which filter the card; the others lay their cards in two columns from a laptop's width.
import { NOT_READ_DAYS } from '@liveknowledge/knowledge';
import { forwardRef, type ReactNode } from 'react';
import type { KnowledgeAgent, KnowledgeOverviewResponse } from '@liveknowledge/api-schema';
import { BackBar, prefersReducedMotion } from '@liveknowledge/ui';
import type { AskRights } from '@/lib/knowledge-ask/ask-rights';
import { dashboardFigures, type AttentionFilter } from '@/lib/knowledge-ask/dashboard-figures';
import {
  backToInsightsDashboard,
  insightsTopicLabel,
  type InsightsTopic,
} from '@/lib/knowledge-ask/insights-topic';
import { agentSample } from '@/lib/knowledge-ask/overview-words';
import { AgentsSection } from './AgentsSection';
import { AttentionTiles } from './FigureTiles';
import { AgentSampleCard, ContextSection, HealthSection } from './HealthAndContext';
import type { DashboardActions } from './InsightsDashboard';
import { MostReadCard } from './MostReadCard';
import { ATTENTION_PAGE_CAP, NeedsAttention } from './NeedsAttention';
import { NotReadCard } from './NotReadCard';
import { ReadsTrendCard } from './ReadsTrendCard';
import { RequiredReadingCard } from './RequiredReadingCard';

// One column of cards: a stack of its own, so a card's height never moves a card in the other.
const COLUMN = 'flex min-w-0 flex-col gap-4 sm:gap-5';

function Columns({ left, right }: { left: ReactNode; right: ReactNode }) {
  return (
    <div className="flex flex-col gap-4 sm:gap-5 lg:grid lg:grid-cols-2 lg:items-start">
      <div className={COLUMN}>{left}</div>
      <div className={COLUMN}>{right}</div>
    </div>
  );
}

// Needs Attention brought into view and focused after a figure tile filters it.
function goToAttention(): void {
  const card = document.querySelector<HTMLElement>('[data-ai-section="ai-attention"]');
  if (!card) return;
  card.scrollIntoView?.({ block: 'start', behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
  card.focus({ preventScroll: true });
}

type TopicPageProps = {
  topic: InsightsTopic;
  show: AttentionFilter;
  onShow: (show: AttentionFilter) => void;
  overview: KnowledgeOverviewResponse;
  rights: AskRights;
  agents: readonly KnowledgeAgent[];
  agentsBusy: ReadonlySet<string>;
  busy: ReadonlySet<string>;
  drafting: string | null;
  canEmailOwners: boolean;
  now: number;
  actions: DashboardActions;
  connectingLikely: string | null;
};

export const InsightsTopicPage = forwardRef<HTMLDivElement, TopicPageProps>(
  function InsightsTopicPage(props, ref) {
    const label = insightsTopicLabel(props.topic);
    return (
      <div
        ref={ref}
        role="region"
        aria-label={`Insights, ${label}`}
        tabIndex={-1}
        data-insights-topic={props.topic}
        className="flex flex-col gap-4 outline-none sm:gap-5"
      >
        <BackBar label="Insights" current={label} onClick={backToInsightsDashboard} gap="none" />
        <TopicCards {...props} />
      </div>
    );
  },
);

function TopicCards({
  topic,
  show,
  onShow,
  overview,
  rights,
  agents,
  agentsBusy,
  busy,
  drafting,
  canEmailOwners,
  now,
  actions,
  connectingLikely,
}: TopicPageProps) {
  if (topic === 'attention')
    return (
      <>
        <AttentionTiles
          overview={overview}
          filter={show}
          onFilter={(to) => {
            onShow(to);
            goToAttention();
          }}
        />
        <NeedsAttention
          overview={overview}
          filter={show}
          onFilter={onShow}
          cap={ATTENTION_PAGE_CAP}
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
          onConnectLikely={actions.connectLikely}
          connectingLikely={connectingLikely}
          onAccept={actions.accept}
          onDismissSuggestion={actions.dismissSuggestion}
          onOpenAiSettings={actions.openAiSettings}
        />
      </>
    );
  if (topic === 'health')
    return (
      <Columns
        left={
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
        }
        right={
          // Absent from an older api: not drawn.
          overview.notRead ? (
            <NotReadCard
              pages={overview.notRead.pages}
              total={overview.notRead.total}
              days={overview.notRead.days ?? NOT_READ_DAYS}
              now={now}
              onOpenPage={actions.openPage}
            />
          ) : null
        }
      />
    );
  if (topic === 'reads')
    return (
      <>
        <ReadsTrendCard days={overview.reads.days} week={dashboardFigures(overview).readsWeek} />
        <Columns
          left={
            <MostReadCard
              pages={overview.reads.mostRead}
              onOpenPage={actions.openPage}
              history={overview.history}
              onPeriod={actions.setPeriod}
            />
          }
          right={
            // Absent from an older api: not drawn.
            overview.requiredReading ? (
              <RequiredReadingCard pages={overview.requiredReading} onOpenPage={actions.openPage} />
            ) : null
          }
        />
      </>
    );
  return (
    <Columns
      left={
        <AgentsSection
          agents={agents}
          canGrant={rights.grantAgents}
          busy={agentsBusy}
          now={now}
          onConnect={actions.connect}
          onOpenPage={actions.openPage}
          onAskWrite={actions.askWrite}
        />
      }
      right={
        <>
          <ContextSection
            context={overview.context}
            canEdit={rights.context}
            busy={busy}
            onOpenPage={actions.openPage}
            onAdd={actions.addContext}
            onRemove={actions.removeContext}
          />
          <AgentSampleCard sample={agentSample(overview, now)} />
        </>
      }
    />
  );
}
