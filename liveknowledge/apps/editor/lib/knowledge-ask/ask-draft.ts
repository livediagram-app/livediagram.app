// A question waiting in Ask's field (docs/specs/030-knowledgebase/ai-knowledge.md "AI Context on a page"): Ask About
// This Page leaves "About <title>: " here and shows Ask, whose view takes it once when it mounts. In memory only, one
// at a time, for one knowledgebase, for a minute (Ask may first wait for its settings, or not open at all: no key);
// nothing is asked until the person sends it.

/** How long the words wait for Ask's field. */
export const ASK_DRAFT_TTL_MS = 60_000;

let waiting: { documentId: string; text: string; at: number } | null = null;

/** The words Ask About This Page puts in the field. */
export const askAboutPageText = (title: string): string =>
  `About ${title.replace(/\s+/g, ' ').trim() || 'This Page'}: `;

export function setAskDraft(documentId: string, text: string, now = Date.now()): void {
  waiting = { documentId, text, at: now };
}

/** The waiting words for this knowledgebase, taken (so they fill the field once); null when there are none. Words
 *  left for another knowledgebase, or too long ago, are dropped. */
export function takeAskDraft(documentId: string, now = Date.now()): string | null {
  const held = waiting;
  waiting = null;
  return held && held.documentId === documentId && now - held.at < ASK_DRAFT_TTL_MS
    ? held.text
    : null;
}
