'use client';

// Insights, ready (docs/specs/030-knowledgebase/insights.md "The view, as built"): the dashboard of topics, or the
// page of the topic the address names. Every figure is from the one overview read, so moving between them reads
// nothing. A change of topic starts the scroll at the top, and a topic's page takes the focus.
import { useEffect, useMemo, useRef } from 'react';
import type {
  KnowledgeAgent,
  KnowledgeLikelySource,
  KnowledgeOverviewResponse,
  KnowledgeQuestion,
  KnowledgeSuggestion,
} from '@liveknowledge/api-schema';
import type { AskRights } from '@/lib/knowledge-ask/ask-rights';
import type { AttentionFilter } from '@/lib/knowledge-ask/dashboard-figures';
import { showInsightsTopic, type InsightsTopic } from '@/lib/knowledge-ask/insights-topic';
import { useInsightsTopic } from '@/lib/knowledge-ask/useInsightsTopic';
import { track } from '@/lib/telemetry';
import { useReviewEvery } from '@/components/knowledge-settings/useReviewEvery';
import type { AgentWriteAsk } from './AgentCard';
import { InsightsTopicPage } from './InsightsTopicPage';
import { InsightsTopics } from './InsightsTopics';

/** What the dashboard's controls do: InsightsView's handlers, each checking its right again. */
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
  /** Connect an unanswered question's likely item: an Editor's, absent otherwise. */
  connectLikely?: ((likely: KnowledgeLikelySource) => void) | undefined;
  accept: (suggestion: KnowledgeSuggestion) => void;
  dismissSuggestion: (suggestion: KnowledgeSuggestion) => void;
  remindOwners: () => void;
  addContext: () => void;
  removeContext: (tab: string) => void;
  askWrite: (ask: AgentWriteAsk) => void;
};

export function InsightsDashboard({
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
  connectingLikely = null,
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
  connectingLikely?: string | null;
}) {
  const live = useReviewEvery(documentId);
  const reviewEvery = documentId ? live : read.reviewEvery;
  // Whether verification is on (verification.md "Under a Review Period of Never") follows the period held now.
  const overview = useMemo(
    () => (read.reviewEvery === reviewEvery ? read : { ...read, reviewEvery }),
    [read, reviewEvery],
  );
  const { topic, show } = useInsightsTopic();
  const root = useRef<HTMLDivElement>(null);
  const topicPage = useRef<HTMLDivElement>(null);
  const drawn = useRef<InsightsTopic | null | undefined>(undefined);
  // On a change of topic (not the first draw, nor a read landing): the scroll box back to its top, and a topic's page
  // focused, so a screen reader says where they are and Tab starts in it.
  useEffect(() => {
    const first = drawn.current === undefined;
    drawn.current = topic;
    if (first) return;
    root.current?.closest('[data-insights]')?.scrollTo?.({ top: 0 });
    topicPage.current?.focus({ preventScroll: true });
  }, [topic]);
  const open = (to: InsightsTopic, at?: AttentionFilter) => {
    track('UI', 'Opened', 'InsightsTopic');
    showInsightsTopic(to, at ? { show: at } : {});
  };
  return (
    <div ref={root} className="flex flex-col gap-4 sm:gap-5">
      {topic ? (
        <InsightsTopicPage
          ref={topicPage}
          topic={topic}
          show={show}
          // The filter replaces the address: a press is no history entry.
          onShow={(to) => showInsightsTopic('attention', { show: to, replace: true })}
          overview={overview}
          rights={rights}
          agents={agents}
          agentsBusy={agentsBusy}
          busy={busy}
          drafting={drafting}
          canEmailOwners={canEmailOwners}
          now={now}
          actions={actions}
          connectingLikely={connectingLikely}
        />
      ) : (
        <InsightsTopics overview={overview} onOpen={open} />
      )}
    </div>
  );
}
