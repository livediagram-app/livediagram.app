// Which paragraphs an agent's article write would change while a person holds them
// (docs/specs/024-agents/pages-for-agents.md "Held paragraphs"; blueprint "Route"). Pure: the write's article frames
// (the ops an editor's own edit sends) against the room's live holds. A room that could not answer (`null`) holds
// nothing.
import type { ArticleHoldRow, HeldParagraph, RoomOp } from '@livedocuments/api-schema';
import { articleRunsText, articlesOf, articleTableText, type Tab } from '@livedocuments/document';

// How much of a held paragraph the refusal quotes, and how many holders it names.
const OPENING_CHARS = 40;
const NAMED_MAX = 3;

const held = (h: ArticleHoldRow): HeldParagraph => ({
  flow: h.flow,
  blockId: h.blockId,
  ...(h.row !== undefined && h.col !== undefined ? { row: h.row, col: h.col } : {}),
  by: { name: h.name, color: h.color },
});

/** Each hold the write's frames meet, once: a put or remove of a block meets every hold in it (its own, or any of a
 *  table's cells), a cell's text meets that cell's hold and its block's, and a removed article every hold in it. */
export function heldArticleTargets(
  ops: readonly RoomOp[],
  holds: readonly ArticleHoldRow[] | null,
): HeldParagraph[] {
  if (!holds || holds.length === 0) return [];
  const met = new Set<ArticleHoldRow>();
  for (const op of ops) {
    if (op.kind !== 'article') continue;
    const inFlow = holds.filter((h) => h.flow === op.flow);
    if (inFlow.length === 0) continue;
    if ('removed' in op) {
      for (const h of inFlow) met.add(h);
      continue;
    }
    for (const a of op.ops) {
      if (a.kind === 'style') continue;
      const blockId = a.kind === 'put' ? a.block.id : a.kind === 'remove' ? a.id : a.block;
      for (const h of inFlow) {
        if (h.blockId !== blockId) continue;
        // A cell's text meets only its own cell's hold, or the hold of its block as a whole.
        if (a.kind === 'cell' && h.row !== undefined && (h.row !== a.row || h.col !== a.col))
          continue;
        met.add(h);
      }
    }
  }
  return holds.filter((h) => met.has(h)).map(held);
}

/** The refusal's words: who is writing where (a paragraph by its opening words), and what to do next. */
export function heldMessage(tab: Tab, held: readonly HeldParagraph[]): string {
  const articles = articlesOf(tab);
  const where = held.slice(0, NAMED_MAX).map((h) => {
    if (h.row !== undefined) return `${h.by.name} is writing in a table cell`;
    const block = articles[h.flow]?.blocks.find((b) => b.id === h.blockId);
    const text = !block
      ? ''
      : block.type === 'table'
        ? articleTableText(block)
        : 'runs' in block
          ? articleRunsText(block.runs)
          : '';
    const words = text.replace(/\s+/g, ' ').trim();
    if (!words) return `${h.by.name} is writing in a paragraph`;
    const opening =
      words.length > OPENING_CHARS ? `${words.slice(0, OPENING_CHARS).trimEnd()}…` : words;
    return `${h.by.name} is writing in "${opening}"`;
  });
  const more = held.length > NAMED_MAX ? ` (and ${held.length - NAMED_MAX} more)` : '';
  const leave = held.length > 1 ? 'those paragraphs as they are' : 'that paragraph as it is';
  return `${where.join('; ')}${more}. Try again once they pause, or leave ${leave}.`;
}
