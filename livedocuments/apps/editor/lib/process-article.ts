// Add to Knowledgebase's trigger (docs/specs/013-workspace/suggestions.md): an article that explains a process. It does
// when it holds a run of PROCESS_STEPS_MIN numbered items, or PROCESS_STEPS_MIN headings that start with "Step", or a
// title or heading that starts "How to", "How we" or "How do" with a run of PROCESS_STEPS_MIN list items of any kind.
// One pass over the blocks, each heading's first words read left to right (no regular expression).
import type { ArticleBlock, ArticleFlow } from '@livedocuments/document';

/** Steps that make a process. */
export const PROCESS_STEPS_MIN = 3;

const HEADING_STYLES = new Set(['title', 'subtitle', 'h1', 'h2', 'h3']);

// A block's first `max` words, lower case.
function firstWords(block: { runs: readonly { text: string }[] }, max: number): string[] {
  const out: string[] = [];
  let word = '';
  for (const run of block.runs) {
    for (let i = 0; i < run.text.length; i++) {
      const c = run.text[i]!;
      const lower = c.toLowerCase();
      if (lower !== c.toUpperCase() || (c >= '0' && c <= '9')) word += lower;
      else if (word) {
        out.push(word);
        word = '';
        if (out.length >= max) return out;
      }
    }
  }
  if (word && out.length < max) out.push(word);
  return out;
}

const isHeading = (b: ArticleBlock): b is Extract<ArticleBlock, { type: 'paragraph' }> =>
  b.type === 'paragraph' && b.style !== undefined && HEADING_STYLES.has(b.style);

/** Whether the article's blocks explain a process. */
export function explainsProcess(flows: readonly ArticleFlow[]): boolean {
  let howTo = false;
  let stepHeadings = 0;
  for (const flow of flows) {
    let numbered = 0;
    let listed = 0;
    for (const b of flow.blocks) {
      if (b.type === 'list' && (b.level ?? 0) === 0) {
        numbered = b.list === 'numbered' ? numbered + 1 : 0;
        listed += 1;
        if (numbered >= PROCESS_STEPS_MIN) return true;
        if (howTo && listed >= PROCESS_STEPS_MIN) return true;
        continue;
      }
      if (b.type === 'list') continue;
      numbered = 0;
      listed = 0;
      if (!isHeading(b)) continue;
      const [first, second] = firstWords(b, 2);
      if (first === 'step' && ++stepHeadings >= PROCESS_STEPS_MIN) return true;
      if (first === 'how' && (second === 'to' || second === 'we' || second === 'do')) howTo = true;
    }
  }
  return false;
}
