// Insights' topics and their address (docs/specs/030-knowledgebase/insights.md "The topics", "A topic's page"):
// the dashboard is `?view=insights`, a topic's page `?view=insights&topic=<id>`, and Needs Attention's filter
// `&show=<filter>`, so a topic can be linked to and survives a reload.
import type { AttentionFilter } from './dashboard-figures';
import { currentKnowledgeView, showKnowledgeView } from './knowledge-view';

export type InsightsTopic = 'attention' | 'health' | 'reads' | 'agents';

const INSIGHTS_TOPIC_PARAM = 'topic';
const ATTENTION_SHOW_PARAM = 'show';

/** The four topics, in the dashboard's order, each with its name and one line about it. */
export const INSIGHTS_TOPICS: readonly { topic: InsightsTopic; label: string; about: string }[] = [
  {
    topic: 'attention',
    label: 'Needs Attention',
    about: 'Questions nobody could answer, pages that disagree and edits agents suggested.',
  },
  {
    topic: 'health',
    label: 'Page Health',
    about: 'How far the pages can be trusted, and the pages to review, update or retire.',
  },
  {
    topic: 'reads',
    label: 'Reading',
    about: 'What people and agents read, and the pages everyone is asked to read.',
  },
  {
    topic: 'agents',
    label: 'Agents',
    about: 'The agents connected, what they may do, and what every agent is handed first.',
  },
];

const TOPICS: ReadonlySet<string> = new Set(INSIGHTS_TOPICS.map(({ topic }) => topic));
const FILTERS: ReadonlySet<string> = new Set(['questions', 'conflicts', 'suggestions']);

/** A topic's name. */
export const insightsTopicLabel = (topic: InsightsTopic): string =>
  INSIGHTS_TOPICS.find((t) => t.topic === topic)!.label;

/** The topic an address names; null for none, or one it does not know (the dashboard). */
export function insightsTopicOf(search: string): InsightsTopic | null {
  const named = new URLSearchParams(search).get(INSIGHTS_TOPIC_PARAM);
  return named !== null && TOPICS.has(named) ? (named as InsightsTopic) : null;
}

/** Needs Attention's filter an address names; All for none, or one it does not know. */
export function attentionShowOf(search: string): AttentionFilter {
  const named = new URLSearchParams(search).get(ATTENTION_SHOW_PARAM);
  return named !== null && FILTERS.has(named) ? (named as AttentionFilter) : 'all';
}

/** The pairs a topic's address adds to `?view=insights`; none for the dashboard. */
export function insightsTopicQuery(
  topic: InsightsTopic | null,
  show: AttentionFilter = 'all',
): Record<string, string> {
  if (!topic) return {};
  return topic === 'attention' && show !== 'all'
    ? { [INSIGHTS_TOPIC_PARAM]: topic, [ATTENTION_SHOW_PARAM]: show }
    : { [INSIGHTS_TOPIC_PARAM]: topic };
}

// Whether the topic showing was opened from the dashboard by a new entry, so the dashboard is the entry before it.
let pushed = false;

const topicHere = (): InsightsTopic | null =>
  typeof window === 'undefined' ? null : insightsTopicOf(window.location.search);

/** Opens a topic's page (or the dashboard, for null), as a new history entry unless `replace`. */
export function showInsightsTopic(
  topic: InsightsTopic | null,
  opts: { show?: AttentionFilter; replace?: boolean } = {},
): void {
  const fromDashboard = currentKnowledgeView() === 'insights' && topicHere() === null;
  showKnowledgeView('insights', {
    query: insightsTopicQuery(topic, opts.show),
    ...(opts.replace ? { replace: true } : {}),
  });
  // A replace keeps the entry behind as it was; a new entry from the dashboard puts the dashboard behind.
  if (!opts.replace) pushed = topic !== null && fromDashboard;
}

/** The BackBar's way back: the browser's Back to the dashboard behind this topic, else the dashboard in this entry's
 *  place (a topic opened by its address has no dashboard behind it). */
export function backToInsightsDashboard(): void {
  if (pushed && topicHere() !== null) {
    pushed = false;
    window.history.back();
    return;
  }
  showInsightsTopic(null, { replace: true });
}

/** How many entries of Insights' own stand on the view's first: 1 while a topic opened from the dashboard shows. */
export const insightsStepsBack = (): number => (pushed && topicHere() !== null ? 1 : 0);

/** Forgets the dashboard entry (a test's reset). */
export function resetInsightsTopic(): void {
  pushed = false;
}
