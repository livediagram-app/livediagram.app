// What each of the dashboard's topic tiles says (docs/specs/030-knowledgebase/insights.md "The dashboard"): the
// first few things to look at in each topic, from the one overview read. Pure.
import type { KnowledgeOverviewResponse } from '@liveknowledge/api-schema';
import { attentionItems, type AttentionItem } from './dashboard-figures';

/** How many rows a tile previews. */
export const TOPIC_PREVIEW_ROWS = 3;

/** A thing waiting, in one line: a conflict's question, a suggestion's page and reason, a question's words. */
export function attentionLine(item: AttentionItem): string {
  if (item.kind === 'conflict') return item.conflict.question || 'Two pages disagree';
  if (item.kind === 'suggestion') {
    const page = item.suggestion.title || 'Untitled Page';
    const reason = item.suggestion.summary || item.suggestion.reason.split('\n')[0];
    return reason ? `${page}: ${reason}` : page;
  }
  return item.question.question;
}

/** Needs Attention's tile: the first things waiting, most urgent first, and how many more there are. */
export function attentionPreview(
  overview: Pick<KnowledgeOverviewResponse, 'conflicts' | 'suggestions' | 'questions'>,
): { rows: AttentionItem[]; more: number } {
  const items = attentionItems(overview, 'all');
  return {
    rows: items.slice(0, TOPIC_PREVIEW_ROWS),
    more: Math.max(0, items.length - TOPIC_PREVIEW_ROWS),
  };
}

/** "4 pages not read in 90 days", "1 page not read in 30 days"; null with none, or from an older api. */
export function notReadText(
  notRead: KnowledgeOverviewResponse['notRead'],
  days: number,
): string | null {
  if (!notRead || notRead.total === 0) return null;
  const pages = notRead.total === 1 ? 'page' : 'pages';
  return `${notRead.total.toLocaleString('en')} ${pages} not read in ${days} days`;
}

/** "2 pages to read", "1 page to read"; null with none. */
export function requiredText(
  required: KnowledgeOverviewResponse['requiredReading'],
): string | null {
  if (!required || required.length === 0) return null;
  return `${required.length.toLocaleString('en')} ${required.length === 1 ? 'page' : 'pages'} asked to be read`;
}
