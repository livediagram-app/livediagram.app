// A writer's caret on the wire (docs/specs/007-editor/article-pages.md "Collaboration"): the article
// (`flow`), the top-level block it is in and how many characters into that block's text, so a
// collaborator draws it in their own copy of the writing. Presence: relayed unordered, never logged,
// never replayed. A peer's op is checked field by field before anyone draws it.

// Longer ids than any the editor mints are refused rather than drawn.
export const ARTICLE_CARET_MAX_ID_LEN = 256;
// A caret further into one block than this is not one the editor could have sent.
export const ARTICLE_CARET_MAX_OFFSET = 1_000_000;

export type ArticleCaret =
  { tabId: string; flow: string; blockId: string; offset: number } | { tabId: string; flow: null };

const id = (v: unknown): v is string =>
  typeof v === 'string' && v.length > 0 && v.length <= ARTICLE_CARET_MAX_ID_LEN;

/** The caret an `article-caret` op carries, or null when the op is malformed. */
export function parseArticleCaret(op: unknown): ArticleCaret | null {
  if (typeof op !== 'object' || op === null) return null;
  const o = op as Record<string, unknown>;
  if (!id(o.tabId)) return null;
  if (o.flow === null) return { tabId: o.tabId, flow: null };
  if (!id(o.flow) || !id(o.blockId)) return null;
  const offset = o.offset;
  if (typeof offset !== 'number' || !Number.isInteger(offset)) return null;
  if (offset < 0 || offset > ARTICLE_CARET_MAX_OFFSET) return null;
  return { tabId: o.tabId, flow: o.flow, blockId: o.blockId, offset };
}
