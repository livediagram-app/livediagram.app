// A paragraph held by its writer, on the wire (docs/specs/007-editor/article-pages.md "Holding a paragraph"): the
// block (or table cell) someone is typing in, which nobody else types in until they let go. Presence: never logged
// or replayed, arbitrated by the room (first claim wins), answered to the claimant alone and relayed only once
// given. A peer's op is checked field by field before anything holds by it.
import { isArticleId } from '@livedocuments/document';

// A hold frees after this long without typing in its block (the spec's ~8 s).
export const ARTICLE_HOLD_IDLE_MS = 8_000;
// While its writer keeps typing, a hold is said again at most this often, so someone who joins mid-sentence sees it.
export const ARTICLE_HOLD_REFRESH_MS = 2_000;
// A hold not said again within this long is gone, in the room and on every screen: the idle time, a refresh and
// 2 s of grace, so a lost release or a frozen tab never holds a paragraph for longer. Safe range: 10 s to 30 s.
export const ARTICLE_HOLD_EXPIRE_MS = 12_000;
// The longest tab id a hold names: the room's clamp on tab ids (MAX_TAB_ID_LEN).
const ARTICLE_HOLD_TAB_ID_MAX = 128;

/** Where a hold is: an article's block, and for a table cell its row's and column's ids. */
export type ArticleHoldPlace = { flow: string; blockId: string; row?: string; col?: string };

/** A live hold as the room answers the api (`GET /holds`): where, and who holds it. */
export type ArticleHoldRow = ArticleHoldPlace & { name: string; color: string };

/** One hold an agent's article write met (`409 paragraphs_held`, docs/specs/024-agents/pages-for-agents.md
 *  "Held paragraphs"). */
export type HeldParagraph = ArticleHoldPlace & { by: { name: string; color: string } };

/** An `article-hold` op as read: a claim on a place, or (flow null) the sender letting go. */
export type ArticleHold = ({ tabId: string } & ArticleHoldPlace) | { tabId: string; flow: null };

/** Two places the same hold covers: one block, or one cell of it. */
export function sameHoldPlace(a: ArticleHoldPlace, b: ArticleHoldPlace): boolean {
  return a.flow === b.flow && a.blockId === b.blockId && a.row === b.row && a.col === b.col;
}

/** The hold an `article-hold` op carries, or null when the op is malformed (an id too long or missing, a row
 *  without its column). Built field by field: nothing else on the op is kept. */
export function parseArticleHold(op: unknown): ArticleHold | null {
  if (typeof op !== 'object' || op === null) return null;
  const o = op as Record<string, unknown>;
  const tabId = o.tabId;
  if (typeof tabId !== 'string' || tabId.length === 0 || tabId.length > ARTICLE_HOLD_TAB_ID_MAX)
    return null;
  if (o.flow === null) return { tabId, flow: null };
  if (!isArticleId(o.flow) || !isArticleId(o.blockId)) return null;
  const hasRow = o.row !== undefined;
  const hasCol = o.col !== undefined;
  if (hasRow !== hasCol) return null;
  if (!hasRow) return { tabId, flow: o.flow, blockId: o.blockId };
  if (!isArticleId(o.row) || !isArticleId(o.col)) return null;
  return { tabId, flow: o.flow, blockId: o.blockId, row: o.row, col: o.col };
}
