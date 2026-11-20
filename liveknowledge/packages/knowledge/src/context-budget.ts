// Always in Context (docs/specs/030-knowledgebase/ai-knowledge.md): the pages every agent is handed before it
// starts, measured in estimated tokens against one budget for the knowledgebase.

export const CONTEXT_BUDGET_TOKENS = 8000;
const CHARS_PER_TOKEN = 4;
const TOKEN_STEP = 10;

/** A text's size in tokens as the list shows it: characters / 4, rounded up to 10. No tokenizer and no model
 *  call: an estimate a person can check. */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN / TOKEN_STEP) * TOKEN_STEP;
}

/** Whether a page of `pageTokens` can be added when `usedTokens` of the budget are taken. */
export const fitsContextBudget = (
  pageTokens: number,
  usedTokens: number,
  budget = CONTEXT_BUDGET_TOKENS,
): boolean => usedTokens + pageTokens <= budget;

export type ContextPage = { id: string; title: string; markdown: string };
export type MeasuredContextPage = ContextPage & { tokens: number };

export type AssembledContext = {
  /** The pages handed over, in tree order. */
  pages: MeasuredContextPage[];
  /** Their tokens together, never more than the budget. */
  tokens: number;
  /** Pages marked Always in Context that no longer fit (they grew after they were added), in tree order. */
  leftOut: { id: string; title: string; tokens: number }[];
};

/** The context an agent is handed: `pages` are the knowledgebase's Always in Context pages in tree order, and each
 *  is taken while it fits what is left of the budget. A page that does not fit is left out and named, and a
 *  smaller page after it may still fit. */
export function assembleContext(
  pages: readonly ContextPage[],
  budget = CONTEXT_BUDGET_TOKENS,
): AssembledContext {
  const context: AssembledContext = { pages: [], tokens: 0, leftOut: [] };
  for (const page of pages) {
    const tokens = estimateTokens(page.markdown);
    if (fitsContextBudget(tokens, context.tokens, budget)) {
      context.pages.push({ ...page, tokens });
      context.tokens += tokens;
    } else {
      context.leftOut.push({ id: page.id, title: page.title, tokens });
    }
  }
  return context;
}
