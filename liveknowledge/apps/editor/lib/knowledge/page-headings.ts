// The headings of a page's writing, for On This Page (docs/specs/030-knowledgebase/verification.md "Page Health",
// the right rail). Read from the committed blocks, so the list changes when the writing is committed (a pause in
// typing), never per keystroke; the last answer is kept per block list, so a render that changed nothing reads none.
import { articleRunsText, type ArticleBlock } from '@liveknowledge/document';

export type PageHeading = { id: string; level: 1 | 2 | 3; text: string };

const LEVELS: Record<string, 1 | 2 | 3> = { h1: 1, h2: 2, h3: 3 };

const cache = new WeakMap<readonly ArticleBlock[], PageHeading[]>();

export function pageHeadings(blocks: readonly ArticleBlock[]): PageHeading[] {
  const held = cache.get(blocks);
  if (held) return held;
  const out: PageHeading[] = [];
  for (const block of blocks) {
    if (block.type !== 'paragraph') continue;
    const level = LEVELS[block.style ?? 'body'];
    if (!level) continue;
    const text = articleRunsText(block.runs).replace(/\s+/g, ' ').trim();
    if (text) out.push({ id: block.id, level, text });
  }
  cache.set(blocks, out);
  return out;
}

/** Whether two lists show the same headings: a commit that changed no heading renders no list. */
export function sameHeadings(a: readonly PageHeading[], b: readonly PageHeading[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  return a.every((h, i) => h.id === b[i]!.id && h.level === b[i]!.level && h.text === b[i]!.text);
}

/** The heading the reader is in: the last one whose top is at or above `line`; the first while none is. */
export function currentHeading(
  tops: readonly { id: string; top: number }[],
  line: number,
): string | undefined {
  let current = tops[0]?.id;
  for (const heading of tops) {
    if (heading.top <= line) current = heading.id;
    else break;
  }
  return current;
}
