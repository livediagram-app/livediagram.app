// A small linear-time reader for the SVG markup this package handles (vendored Lucide files, catalogue
// markup): element tags and their quoted attributes, in order. A hand-rolled scan rather than regexes, so
// hostile input can't trigger polynomial backtracking.

export type SvgElement = { tag: string; attrs: Record<string, string> };

// Character classes are tested by code unit, inline. A regex call per character was most of the
// scan's cost, enough to put a hostile input at the test's CPU budget under coverage
// instrumentation, where every call is counted.

// [A-Za-z], as a bitwise test: lower-casing folds A-Z onto a-z.
const ALPHA_MIN = 97; // a
const ALPHA_MAX = 122; // z

export function svgElements(markup: string): SvgElement[] {
  const out: SvgElement[] = [];
  const n = markup.length;
  let i = 0;
  while (i < n) {
    const lt = markup.indexOf('<', i);
    if (lt < 0) break;
    i = lt + 1;
    let k = markup.charCodeAt(i) | 32;
    if (i >= n || k < ALPHA_MIN || k > ALPHA_MAX) continue; // closing tag, comment, stray '<'
    const nameStart = i;
    i = nameEnd(markup, i, n);
    const tag = markup.slice(nameStart, i);
    const attrs: Record<string, string> = {};
    // Attributes until the tag closes; every step advances i, so the scan is linear.
    while (i < n) {
      const c = markup.charCodeAt(i);
      if (c === 62) break; // >
      k = c | 32;
      if (k < ALPHA_MIN || k > ALPHA_MAX) {
        i++;
        continue;
      }
      const a = i;
      i = nameEnd(markup, i, n);
      const name = markup.slice(a, i);
      i = spaceEnd(markup, i, n);
      if (markup.charCodeAt(i) !== 61) continue; // valueless attribute (no =)
      i = spaceEnd(markup, i + 1, n);
      const q = markup[i];
      if (q !== '"' && q !== "'") continue;
      const close = markup.indexOf(q, i + 1);
      if (close < 0) {
        i = n;
        break;
      }
      attrs[name] = markup.slice(i + 1, close);
      i = close + 1;
    }
    out.push({ tag, attrs });
    i++;
  }
  return out;
}

// The end of a name ([A-Za-z0-9_:.-]*) starting at i.
function nameEnd(s: string, i: number, n: number): number {
  while (i < n) {
    const c = s.charCodeAt(i);
    const k = c | 32;
    if (
      (k >= ALPHA_MIN && k <= ALPHA_MAX) ||
      (c >= 48 && c <= 58) ||
      c === 95 ||
      c === 46 ||
      c === 45
    )
      i++;
    else break;
  }
  return i;
}

// The end of a run of space, tab, newline and carriage return starting at i.
function spaceEnd(s: string, i: number, n: number): number {
  while (i < n) {
    const c = s.charCodeAt(i);
    if (c === 32 || c === 9 || c === 10 || c === 13) i++;
    else break;
  }
  return i;
}
