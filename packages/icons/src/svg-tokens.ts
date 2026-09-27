// A small linear-time reader for the SVG markup this package handles (vendored Lucide files, catalogue
// markup): element tags and their quoted attributes, in order. A hand-rolled scan rather than regexes, so
// hostile input can't trigger polynomial backtracking.

export type SvgElement = { tag: string; attrs: Record<string, string> };

const isNameStart = (c: string) => /[A-Za-z]/.test(c);
const isNameChar = (c: string) => /[\w:.-]/.test(c);
const isSpace = (c: string) => c === ' ' || c === '\n' || c === '\t' || c === '\r';

export function svgElements(markup: string): SvgElement[] {
  const out: SvgElement[] = [];
  const n = markup.length;
  let i = 0;
  while (i < n) {
    const lt = markup.indexOf('<', i);
    if (lt < 0) break;
    i = lt + 1;
    if (i >= n || !isNameStart(markup[i]!)) continue; // closing tag, comment, stray '<'
    const nameStart = i;
    while (i < n && isNameChar(markup[i]!)) i++;
    const tag = markup.slice(nameStart, i);
    const attrs: Record<string, string> = {};
    // Attributes until the tag closes; every step advances i, so the scan is linear.
    while (i < n && markup[i] !== '>') {
      const c = markup[i]!;
      if (!isNameStart(c)) {
        i++;
        continue;
      }
      const a = i;
      while (i < n && isNameChar(markup[i]!)) i++;
      const name = markup.slice(a, i);
      while (i < n && isSpace(markup[i]!)) i++;
      if (markup[i] !== '=') continue; // valueless attribute
      i++;
      while (i < n && isSpace(markup[i]!)) i++;
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
