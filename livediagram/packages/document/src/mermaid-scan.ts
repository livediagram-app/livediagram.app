import type { GraphEdge } from './graph-authoring';

type EdgeLine = NonNullable<GraphEdge['line']>;

// Hand-written scans for the Mermaid parser (mermaid.ts). The text is untrusted (any API token's
// changeset reaches the parser), so these replace regular expressions that backtracked
// quadratically over a long run of one character; each reads exactly what its pattern read.

const isSpace = (ch: string | undefined) => ch !== undefined && /\s/.test(ch);

// A flowchart header, `flowchart` or `graph` with an optional two-letter direction, as
// `^\s*(?:flowchart|graph)\b\s*([A-Za-z]{2})?\s*$`/i read it (its two `\s*` around the optional
// direction backtracked quadratically). The direction, '' for none, or null for no header.
export function readFlowchartHeader(line: string): string | null {
  const text = line.trim();
  const word = /^(?:flowchart|graph)/i.exec(text)?.[0];
  if (!word) return null;
  const rest = text.slice(word.length);
  if (rest !== '' && !isSpace(rest[0])) return null;
  const direction = rest.trim();
  if (direction === '') return '';
  return /^[A-Za-z]{2}$/.test(direction) ? direction : null;
}

// The inline-label edge forms: an opener, whitespace, the label, whitespace, then a closing run.
//   `-- text -->` / `-- text ---` / `-- text --o` …   (closing run `-{2,}`)
//   `-. text .->` / `-. text .-`                        (closing run `\.+-`)
//   `== text ==>` / `== text ===`                        (closing run `={2,}`)
const INLINE_LABEL_FORMS: {
  open: string;
  line: EdgeLine;
  close: (s: string, at: number) => number;
}[] = [
  { open: '--', line: 'solid', close: (s, at) => runOf(s, at, '-', 2) },
  {
    open: '-.',
    line: 'dashed',
    close: (s, at) => {
      const dots = runOf(s, at, '.', 1);
      return dots === -1 || s[dots] !== '-' ? -1 : dots + 1;
    },
  },
  { open: '==', line: 'thick', close: (s, at) => runOf(s, at, '=', 2) },
];

// The index after a run of at least `min` `ch` starting at `at`, or -1.
function runOf(s: string, at: number, ch: string, min: number): number {
  let end = at;
  while (s[end] === ch) end += 1;
  return end - at >= min ? end : -1;
}

// One inline-label edge off the front of `s`, as `^\s*([<ox])?<open>\s+(.+?)\s+<close>([>ox])?` read it:
// the label is the shortest text followed by a whitespace run and a closing run. A linear scan
// (the lazy label against `\s+` backtracked quadratically over a long whitespace run).
export function readInlineLabel(
  s: string,
): { label: string; lead?: string; trail?: string; line: EdgeLine; length: number } | null {
  let i = 0;
  while (isSpace(s[i])) i += 1;
  // A start marker (`<-- text -->`, `o-- text --o`, `x-. text .-x`), as on a plain operator: the
  // edge then has a head at its start too.
  const lead = s[i] === '<' || s[i] === 'o' || s[i] === 'x' ? s[i] : undefined;
  for (const form of INLINE_LABEL_FORMS) {
    const opensAt = lead && s.startsWith(form.open, i + 1) ? i + 1 : i;
    if (!s.startsWith(form.open, opensAt)) continue;
    let start = opensAt + form.open.length;
    if (!isSpace(s[start])) continue;
    while (isSpace(s[start])) start += 1;
    // Each whitespace run after the label's first character, in order: the first one a closing
    // run follows ends the label.
    for (let at = start + 1; at < s.length; at += 1) {
      if (!isSpace(s[at])) continue;
      let after = at;
      while (isSpace(s[after])) after += 1;
      const end = form.close(s, after);
      if (end !== -1) {
        const trail = s[end] === '>' || s[end] === 'o' || s[end] === 'x' ? s[end] : undefined;
        return {
          label: s.slice(start, at),
          ...(opensAt > i ? { lead } : {}),
          ...(trail ? { trail } : {}),
          line: form.line,
          length: trail ? end + 1 : end,
        };
      }
      at = after - 1;
    }
  }
  return null;
}

// The same edge written tight, as Mermaid's lexer also takes it: no whitespace needed after the opener or before the
// closing run (`A--text-->B`, `A-.text.->B`, `A==text==>B`, `A--text---B`). Called only when readInlineLabel finds no
// spaced form. An opener followed straight by a link character is a plain operator (`-->`, `--o`, `-.->`, `==>`),
// and the closing run must be a whole link (`---`, `-->`, `===`, `.-`), as Mermaid's LINK token is, so a plain
// `A--B` stays a bare edge. The label is the shortest text before such a closing run; one pass, as each run of one
// character either closes there or nowhere inside it.
const TIGHT_FORMS: {
  open: string;
  line: EdgeLine;
  plainNext: string;
  stopRun?: string;
  close: (s: string, at: number) => number;
}[] = [
  {
    open: '--',
    line: 'solid',
    plainNext: '-xo>',
    stopRun: '-',
    close: (s, at) => wholeRun(s, at, '-'),
  },
  { open: '-.', line: 'dashed', plainNext: '.-', close: INLINE_LABEL_FORMS[1]!.close },
  {
    open: '==',
    line: 'thick',
    plainNext: '=xo>',
    stopRun: '=',
    close: (s, at) => wholeRun(s, at, '='),
  },
];

// A closing run of `ch` that is a link by itself: three or more, or two with a head after them.
function wholeRun(s: string, at: number, ch: string): number {
  const end = runOf(s, at, ch, 2);
  if (end === -1) return -1;
  return end - at >= 3 || s[end] === '>' || s[end] === 'o' || s[end] === 'x' ? end : -1;
}

export function readTightInlineLabel(
  s: string,
): { label: string; lead?: string; trail?: string; line: EdgeLine; length: number } | null {
  let i = 0;
  while (isSpace(s[i])) i += 1;
  const lead = s[i] === '<' || s[i] === 'o' || s[i] === 'x' ? s[i] : undefined;
  for (const form of TIGHT_FORMS) {
    const opensAt = lead && s.startsWith(form.open, i + 1) ? i + 1 : i;
    if (!s.startsWith(form.open, opensAt)) continue;
    let start = opensAt + form.open.length;
    const next = s[start];
    if (next === undefined || (!isSpace(next) && form.plainNext.includes(next))) continue;
    while (isSpace(s[start])) start += 1;
    for (let at = start + 1; at < s.length;) {
      const end = form.close(s, at);
      if (end !== -1) {
        const trail = s[end] === '>' || s[end] === 'o' || s[end] === 'x' ? s[end] : undefined;
        return {
          label: s.slice(start, at).trimEnd(),
          ...(opensAt > i ? { lead } : {}),
          ...(trail ? { trail } : {}),
          line: form.line,
          length: trail ? end + 1 : end,
        };
      }
      const ch = s[at];
      const from = at;
      at += 1;
      while (s[at] === ch) at += 1;
      // Mermaid's label text never holds two of the opener's run (`--`, `==`) that don't close it: the edge ends
      // there unread, and the scan stops, so a chain of bare `A--B--C` hops costs each hop only its own text.
      if (form.stopRun && ch === form.stopRun && at - from >= 2) break;
    }
  }
  return null;
}
