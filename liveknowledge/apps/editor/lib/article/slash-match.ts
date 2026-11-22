// How the slash menu matches what is typed after the `/` (docs/specs/030-knowledgebase/page-surface.md "The slash
// menu", "Filtering"): an entry's name first, loosely (its letters in order, gaps allowed), then its keywords. Each
// match has a rank and the name's matched letters, to draw bold. Pure, and cheap: a few dozen short names per key.

/** A match: higher `score` ranks first; `marks` are the indices of the name's matched characters. */
export type SlashMatch = { score: number; marks: readonly number[] };

// The ranks, each band above the next whatever its bonuses: a name starting with the query, a word of the name
// starting with it, a name holding it, the name's letters in order, a keyword starting with it.
const NAME_STARTS = 5000;
const WORD_STARTS = 4000;
const NAME_HOLDS = 3000;
const LOOSE = 2000;
const KEYWORD = 1000;
// Within the loose band: a letter at a word's start, a letter straight after the last, each gap's cost.
const AT_WORD = 12;
const IN_A_ROW = 8;
const GAP = 1;

const range = (from: number, length: number) => Array.from({ length }, (_, i) => from + i);
const isWordStart = (name: string, i: number) => i === 0 || /[\s\-/]/.test(name[i - 1]!);

// The name's letters in order, greedily from `start`: each next letter straight after the last when it is there,
// else at the next word's start when one holds it, else wherever it comes next ("hd2" takes Heading 2's "2" as a
// word, "bl" Bulleted List's "l" of List). `words` false takes the plain next place (the fallback when preferring a
// word start ran out of name). Null when the letters are not all there.
function lettersFrom(name: string, q: string, start: number, words: boolean): number[] | null {
  const marks = [start];
  let at = start;
  for (let k = 1; k < q.length; k++) {
    const c = q[k]!;
    let pick = name[at + 1] === c ? at + 1 : -1;
    if (pick === -1 && words)
      for (let j = at + 1; j < name.length; j++)
        if (name[j] === c && isWordStart(name, j)) {
          pick = j;
          break;
        }
    if (pick === -1) pick = name.indexOf(c, at + 1);
    if (pick === -1) return null;
    marks.push(pick);
    at = pick;
  }
  return marks;
}

function scoreOf(name: string, marks: readonly number[]): number {
  let score = LOOSE - marks[0]! * GAP;
  marks.forEach((m, i) => {
    if (isWordStart(name, m)) score += AT_WORD;
    if (i > 0 && m === marks[i - 1]! + 1) score += IN_A_ROW;
    if (i > 0) score -= (m - marks[i - 1]! - 1) * GAP;
  });
  return score;
}

// The best loose match over every place the first letter can go.
function loose(name: string, q: string): SlashMatch | null {
  let best: SlashMatch | null = null;
  for (let start = name.indexOf(q[0]!); start !== -1; start = name.indexOf(q[0]!, start + 1)) {
    const marks = lettersFrom(name, q, start, true) ?? lettersFrom(name, q, start, false);
    if (!marks) continue;
    const score = scoreOf(name, marks);
    if (!best || score > best.score) best = { score, marks };
  }
  return best;
}

/** How `query` matches an entry named `label` with `keywords` (space-separated), or null when it does not. Within a
 *  band, the name the query covers more of ranks first ("tbl" puts Table before Table of Contents); equals keep the
 *  catalogue's order. An empty query matches everything, unmarked. */
export function matchSlash(label: string, keywords: string, query: string): SlashMatch | null {
  const q = query.trim().toLowerCase();
  if (!q) return { score: 0, marks: [] };
  const name = label.toLowerCase();
  // At most 10: never past a band's step.
  const cover = (10 * q.length) / Math.max(q.length, name.length);
  if (name.startsWith(q)) return { score: NAME_STARTS + cover, marks: range(0, q.length) };
  for (let i = name.indexOf(q); i !== -1; i = name.indexOf(q, i + 1))
    if (isWordStart(name, i)) return { score: WORD_STARTS + cover, marks: range(i, q.length) };
  const at = name.indexOf(q);
  if (at !== -1) return { score: NAME_HOLDS + cover, marks: range(at, q.length) };
  // Spaces typed are part of the name's words, never letters to find on their own.
  const letters = q.replace(/\s+/g, '');
  const found = letters ? loose(name, letters) : null;
  if (found) return { score: found.score + cover, marks: found.marks };
  if (keywords.split(' ').some((k) => k && k.toLowerCase().startsWith(q)))
    return { score: KEYWORD + cover, marks: [] };
  return null;
}
