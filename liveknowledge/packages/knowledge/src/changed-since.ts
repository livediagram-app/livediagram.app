// "Changed since verified" (docs/specs/030-knowledgebase/verification.md): whether more than a fifth of a page's
// characters changed since it was verified. Not a diff: the writing is cut into sentences, and the characters of
// the sentences both versions hold are what did not change. One pass over each version, so it is linear in their
// length, and bounded: writing past CHANGED_SINCE_MAX_CHARS is compared by its length alone.
import { stableHash } from './hash';

export const CHANGED_SINCE_FRACTION = 0.2;
/** As long as the Markdown an article reads (ARTICLE_MARKDOWN_MAX in @liveknowledge/document). */
export const CHANGED_SINCE_MAX_CHARS = 400_000;

// A sentence ends at '.', '!' or '?' before a space, or at a line break.
function* sentences(text: string): Generator<string> {
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    const ends =
      code === 10 || ((code === 46 || code === 33 || code === 63) && text.charCodeAt(i + 1) === 32);
    if (!ends) continue;
    const sentence = text.slice(start, i + 1).trim();
    if (sentence) yield sentence;
    start = i + 1;
  }
  const rest = text.slice(start).trim();
  if (rest) yield rest;
}

/** The share of the writing's characters that changed between two versions, 0 to 1. */
export function changedFraction(before: string, after: string): number {
  const a = before.slice(0, CHANGED_SINCE_MAX_CHARS);
  const b = after.slice(0, CHANGED_SINCE_MAX_CHARS);
  // Characters of each sentence of the earlier version, by the sentence's hash; a sentence written twice counts twice.
  const kept = new Map<string, number>();
  let beforeChars = 0;
  for (const sentence of sentences(a)) {
    const key = stableHash(sentence);
    kept.set(key, (kept.get(key) ?? 0) + 1);
    beforeChars += sentence.length;
  }
  let afterChars = 0;
  let same = 0;
  for (const sentence of sentences(b)) {
    afterChars += sentence.length;
    const key = stableHash(sentence);
    const left = kept.get(key) ?? 0;
    if (left === 0) continue;
    kept.set(key, left - 1);
    same += sentence.length;
  }
  // What was cut off by the bound counts by its length: writing that grew or shrank past it changed that much.
  const cut = Math.abs(before.length - a.length - (after.length - b.length));
  const longer = Math.max(beforeChars, afterChars) + cut;
  return longer === 0 ? 0 : (longer - same) / longer;
}

/** Whether the writing changed enough since it was verified to say so beside the tick. */
export const changedSinceVerified = (before: string, after: string): boolean =>
  changedFraction(before, after) > CHANGED_SINCE_FRACTION;
