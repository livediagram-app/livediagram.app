// Needs Attention's filter asked for by a door outside Insights (docs/specs/030-knowledgebase/insights.md "On
// the page": a page rail's Review All in Insights opens it at Suggested Edits). Held until the dashboard reads it
// as it opens, then gone, so it never sticks to a later visit.
import type { AttentionFilter } from './dashboard-figures';

let asked: AttentionFilter | null = null;

/** Open Insights' Needs Attention at `filter` the next time the dashboard starts. */
export function askAttentionFilter(filter: AttentionFilter): void {
  asked = filter;
}

/** The filter asked for, once. */
export function takeAskedAttentionFilter(): AttentionFilter | null {
  const filter = asked;
  asked = null;
  return filter;
}
