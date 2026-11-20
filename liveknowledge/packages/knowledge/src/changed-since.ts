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

/** A print holds at most this many sentences; writing past them is compared by its length alone, as writing past
 *  CHANGED_SINCE_MAX_CHARS is. It bounds what the room stores for a page: about 13 bytes a sentence, so 104 KB. */
export const WRITING_PRINT_MAX_SENTENCES = 8_000;
const PRINT_HASH_CHARS = 8;

/** What "Changed since verified" needs of the writing as it stood: not the words, only how many characters each
 *  distinct sentence held (by a short hash) and how much lay past the bounds. */
export type WritingPrint = {
  /** Characters of each sentence, summed over its repeats, by the sentence's hash. */
  kept: Map<string, number>;
  /** Characters of every sentence measured. */
  chars: number;
  /** Characters past the bounds, compared by their count alone. */
  tail: number;
};

// The sentences inside the bounds, each with its hash, and what lay past them.
function measure(text: string, each: (key: string, length: number) => void): number {
  const bounded = text.slice(0, CHANGED_SINCE_MAX_CHARS);
  let seen = 0;
  let read = 0;
  for (const sentence of sentences(bounded)) {
    if (seen === WRITING_PRINT_MAX_SENTENCES) break;
    seen++;
    read = bounded.indexOf(sentence, read) + sentence.length;
    each(stableHash(sentence).slice(0, PRINT_HASH_CHARS), sentence.length);
  }
  return seen === WRITING_PRINT_MAX_SENTENCES ? text.length - read : text.length - bounded.length;
}

/** The print of a version of the writing. One pass, linear in its length. */
export function writingPrint(text: string): WritingPrint {
  const kept = new Map<string, number>();
  let chars = 0;
  const tail = measure(text, (key, length) => {
    kept.set(key, (kept.get(key) ?? 0) + length);
    chars += length;
  });
  return { kept, chars, tail };
}

/** A print as the room stores it: `<tail>;<hash><characters>,...`, the numbers in base 36. */
export function sealWritingPrint(print: WritingPrint): string {
  const parts: string[] = [];
  for (const [key, length] of print.kept) parts.push(key + length.toString(36));
  return `${print.tail.toString(36)};${parts.join(',')}`;
}

/** A stored print read back; undefined for anything that is not one. */
export function openWritingPrint(stored: unknown): WritingPrint | undefined {
  if (typeof stored !== 'string') return undefined;
  const at = stored.indexOf(';');
  const tail = at < 0 ? Number.NaN : Number.parseInt(stored.slice(0, at), 36);
  if (!Number.isFinite(tail) || tail < 0) return undefined;
  const kept = new Map<string, number>();
  let chars = 0;
  for (const part of stored.slice(at + 1).split(',')) {
    if (!part) continue;
    const length = Number.parseInt(part.slice(PRINT_HASH_CHARS), 36);
    if (part.length <= PRINT_HASH_CHARS || !Number.isFinite(length) || length <= 0)
      return undefined;
    kept.set(part.slice(0, PRINT_HASH_CHARS), length);
    chars += length;
  }
  return { kept, chars, tail };
}

/** The share of the writing's characters that changed since `print` was taken, 0 to 1. */
export function changedFractionSince(print: WritingPrint, after: string): number {
  // What is left of each sentence of the earlier version; a sentence written twice counts twice.
  const left = new Map(print.kept);
  let afterChars = 0;
  let same = 0;
  const afterTail = measure(after, (key, length) => {
    afterChars += length;
    const kept = left.get(key) ?? 0;
    if (kept < length) return;
    left.set(key, kept - length);
    same += length;
  });
  // What was cut off by the bounds counts by its length: writing that grew or shrank past them changed that much.
  const cut = Math.abs(print.tail - afterTail);
  const longer = Math.max(print.chars, afterChars) + cut;
  return longer === 0 ? 0 : (longer - same) / longer;
}

/** The share of the writing's characters that changed between two versions, 0 to 1. */
export function changedFraction(before: string, after: string): number {
  return changedFractionSince(writingPrint(before), after);
}

/** Whether the writing changed enough since it was verified to say so beside the tick. */
export const changedSinceVerified = (before: string, after: string): boolean =>
  changedFraction(before, after) > CHANGED_SINCE_FRACTION;

/** The same, from the print the room kept when the page was verified. */
export const changedSincePrint = (print: WritingPrint, after: string): boolean =>
  changedFractionSince(print, after) > CHANGED_SINCE_FRACTION;
