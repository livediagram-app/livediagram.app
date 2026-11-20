// What a refused knowledge request says, in words (docs/specs/030-knowledgebase/verification.md, search-and-ask.md
// "Bounds", ai-knowledge.md "Always in Context"): never a status or a code.
import { SEARCH_MAX_QUERY_CHARS } from '@liveknowledge/knowledge';
import { ApiError } from '@liveworkspace/workbench/lib/api/api-error';
import { ContextBudgetError } from '@/lib/api/knowledge';

const count = (n: number) => n.toLocaleString('en');

/** Always in Context refused: the route's own reason, from the sizes it sent. */
export function contextBudgetText(sizes: { tokens: number; used: number; budget: number }): string {
  return `This page is ${count(sizes.tokens)} tokens and ${count(sizes.used)} of ${count(sizes.budget)} are in use. Take another page out of Always in Context first.`;
}

export type KnowledgeAction = 'verify' | 'owner' | 'interval' | 'context' | 'search';

const FALLBACK: Record<KnowledgeAction, string> = {
  verify: 'The page could not be verified. Try again.',
  owner: 'The owner could not be changed. Try again.',
  interval: 'The review interval could not be changed. Try again.',
  context: 'Always in Context could not be changed. Try again.',
  search: 'Search is not answering. Check your connection and try again.',
};

export function knowledgeFailureText(err: unknown, action: KnowledgeAction): string {
  if (err instanceof ContextBudgetError) return contextBudgetText(err);
  if (err instanceof ApiError) {
    if (err.code === 'owner_no_access')
      return 'The owner must be someone who can open this knowledgebase.';
    if (err.code === 'query_too_long')
      return `A search is at most ${SEARCH_MAX_QUERY_CHARS} characters.`;
    if (err.status === 429) return 'Too many searches at once. Wait a moment and try again.';
    if (err.code === 'tab_busy') return 'The page was being saved. Try again.';
    if (err.status === 403)
      return action === 'verify'
        ? 'Only an Editor signed in to an account can verify a page.'
        : 'Only an Editor can change this.';
  }
  return FALLBACK[action];
}
