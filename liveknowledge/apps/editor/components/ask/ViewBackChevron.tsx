'use client';

// The way back from Ask, Insights or Connect (docs/specs/030-knowledgebase/search-and-ask.md "The way back"): the back
// bar's chevron (`BackChevron`, back-bar.md "The header chevron") to the left of the view's name. It returns to the
// view this one was opened from, as it was left (the browser's Back over the view's own entry), and to Pages when the
// view was opened by its link. Navigation only: every role has it.
import { useSyncExternalStore } from 'react';
import { BackChevron, HoverCard } from '@liveknowledge/ui';
import { insightsStepsBack } from '@/lib/knowledge-ask/insights-topic';
import {
  backFromKnowledgeView,
  KNOWLEDGE_VIEWS,
  previousKnowledgeView,
  subscribeKnowledgeView,
  type KnowledgeView,
} from '@/lib/knowledge-ask/knowledge-view';

/** The name the chevron says it goes back to: the view's tab name. */
export const viewName = (view: KnowledgeView): string =>
  KNOWLEDGE_VIEWS.find((v) => v.view === view)!.label;

export function ViewBackChevron() {
  // On the server, as with no view before, it is Pages (previousKnowledgeView reads no window there).
  const previous = useSyncExternalStore(
    subscribeKnowledgeView,
    previousKnowledgeView,
    previousKnowledgeView,
  );
  const label = `Back to ${viewName(previous)}`;
  return (
    <HoverCard
      title={label}
      description="Returns to where you were, as you left it."
      className="mr-2.5 shrink-0 phone:mr-2"
    >
      <BackChevron label={label} onClick={() => backFromKnowledgeView(insightsStepsBack())} />
    </HoverCard>
  );
}
