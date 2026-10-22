// What a regular expression can cost on a text, worst case (docs/specs/029-sheets/formulas.md "Functions": Text).
// JavaScript's engine backtracks and cannot be interrupted, so the bound has to be known before it runs. A pattern
// with k open-ended repeats side by side (`.*a.*b`) can split n characters about n^k / k! ways; a repeat of a repeat
// (`(a+)+`) or of a choice (`(a|ab)*`) about h^n ways, h being how deep the repeats nest. `regexWork` is that count,
// for the caller to hold to REGEX_BACKTRACK_MAX. Pure.

/** The shape of a pattern that sets its cost: its open-ended repeats, and how deep repeats nest (1 when none do). */
export type RegexShape = { repeats: number; height: number };

// A `{n,m}` past this many is as good as open-ended for the cost.
const WIDE_RANGE = 10;

// A group being read: the deepest repeat inside it, and whether it chooses between branches.
type Frame = { height: number; chooses: boolean };

// The quantifier at `i` (if any): its length in characters, whether it is open-ended, and whether it varies (a fixed
// count like `{3}` matches one way; `?`, `*`, `+` and a range can match several).
function quantifierAt(
  source: string,
  i: number,
): { length: number; open: boolean; varies: boolean; loops: boolean } | null {
  const ch = source[i];
  const lazy = source[i + 1] === '?' ? 1 : 0;
  if (ch === '*' || ch === '+') return { length: 1 + lazy, open: true, varies: true, loops: true };
  if (ch === '?') return { length: 1 + lazy, open: false, varies: true, loops: false };
  if (ch !== '{') return null;
  const m = /^\{(\d+)(,(\d*))?\}\??/.exec(source.slice(i));
  if (!m) return null;
  const least = Number(m[1]);
  const most = m[2] === undefined ? least : m[3] === '' ? Infinity : Number(m[3]);
  return { length: m[0].length, open: most > WIDE_RANGE, varies: most > least, loops: most > 1 };
}

// The length of a group's kind after its `(`: `?:`, `?=`, `?!`, `?<=`, `?<!` or `?<name>`; 0 for a plain group.
function groupPrefix(source: string, i: number): number {
  if (source[i] !== '?') return 0;
  const m = /^\?(:|=|!|<=|<!|<[A-Za-z_$][\w$]*>)/.exec(source.slice(i));
  return m ? m[0].length : 0;
}

/** Reads a regular expression's source for its repeats. Lenient: a pattern the engine refuses is the engine's to
 *  report, so anything unexpected is read as a plain character. */
export function regexShape(source: string): RegexShape {
  const stack: Frame[] = [{ height: 0, chooses: false }];
  let repeats = 0;
  // What a quantifier right here applies to: the group just closed, else one character or class.
  let lastGroup: Frame | null = null;
  for (let i = 0; i < source.length;) {
    const ch = source[i]!;
    const top = stack[stack.length - 1]!;
    const q = quantifierAt(source, i);
    if (q) {
      if (q.open) repeats++;
      if (q.varies) {
        // A repeated group repeats whatever repeats inside it, and a choice counts as a repeat of its own; an
        // optional one (`?`) runs it at most once, so it adds a way to match without nesting anything deeper.
        const inner = lastGroup ? Math.max(lastGroup.height, lastGroup.chooses ? 1 : 0) : 0;
        top.height = Math.max(top.height, q.loops ? inner + 1 : Math.max(inner, 1));
      }
      lastGroup = null;
      i += q.length;
      continue;
    }
    lastGroup = null;
    if (ch === '\\') {
      i += 2;
      continue;
    }
    if (ch === '[') {
      // A class is one character, whatever is in it.
      i++;
      if (source[i] === '^') i++;
      if (source[i] === ']') i++;
      while (i < source.length && source[i] !== ']') i += source[i] === '\\' ? 2 : 1;
      i++;
      continue;
    }
    if (ch === '(') {
      stack.push({ height: 0, chooses: false });
      i += 1 + groupPrefix(source, i + 1);
      continue;
    }
    if (ch === ')' && stack.length > 1) {
      const closed = stack.pop()!;
      const parent = stack[stack.length - 1]!;
      parent.height = Math.max(parent.height, closed.height);
      lastGroup = closed;
      i++;
      continue;
    }
    if (ch === '|') top.chooses = true;
    i++;
  }
  return { repeats, height: Math.max(1, stack[0]!.height) };
}

/** The worst-case backtracking steps a pattern of `shape` can take on `textLength` characters. One or two side-by-side
 *  repeats are cheap at any length a cell holds (an email pattern on 10,000 characters: 53 ms), so they count as one
 *  pass; from three, the splits add up as n^k / k!. */
export function regexWork(shape: RegexShape, textLength: number): number {
  const n = Math.max(1, textLength);
  if (shape.height > 1) return shape.height ** Math.min(n, 1024);
  if (shape.repeats < 3) return n;
  let ways = 1;
  for (let k = 1; k <= shape.repeats; k++) ways = (ways * n) / k;
  return ways;
}
