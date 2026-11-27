'use client';

import { useSyncExternalStore } from 'react';
import type { AttentionFilter } from './dashboard-figures';
import { attentionShowOf, insightsTopicOf, type InsightsTopic } from './insights-topic';
import { subscribeKnowledgeView } from './knowledge-view';

const search = () => window.location.search;
const serverSearch = () => '';

/** The Insights topic and Needs Attention filter the address names, re-rendering on a press, Back or Forward. */
export function useInsightsTopic(): { topic: InsightsTopic | null; show: AttentionFilter } {
  const query = useSyncExternalStore(subscribeKnowledgeView, search, serverSearch);
  return { topic: insightsTopicOf(query), show: attentionShowOf(query) };
}
