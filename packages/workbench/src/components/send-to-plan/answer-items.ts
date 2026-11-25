// An Ask AI answer's items for Send to Plan (liveworkspace/docs/specs/020-ask/ask.md "Sending an answer on"): each
// top-level item of every list in the answer is one card's words, its nested items and continued lines with it. An
// answer with no list is one card of its whole words. Read left to right, a line at a time, with no regular
// expression: linear in the answer, however it is written. Bold and code marks are taken out; the caller takes out
// its own citation markers first.

const isBlank = (ch: string | undefined): boolean => ch === ' ' || ch === '\t';
const isDigit = (ch: string | undefined): boolean => ch !== undefined && ch >= '0' && ch <= '9';
const BULLETS = new Set(['-', '*', '+', '•']);
// An ordered item's number is at most this many digits ("1." to "999."), as the answer's renderer reads it.
const NUMBER_DIGITS_MAX = 3;

/** Where a line's words start: past its indent (a tab counts four). */
function indentOf(line: string): { width: number; at: number } {
  let width = 0;
  let at = 0;
  while (at < line.length && isBlank(line[at])) {
    width += line[at] === '\t' ? 4 : 1;
    at++;
  }
  return { width, at };
}

/** Where a list item's words start, when the line is one ("- ", "1. ", "1) "); else -1. */
export function itemStart(line: string, at: number): number {
  const ch = line[at];
  if (ch !== undefined && BULLETS.has(ch)) return isBlank(line[at + 1]) ? at + 2 : -1;
  let end = at;
  while (end < line.length && end - at < NUMBER_DIGITS_MAX && isDigit(line[end])) end++;
  if (end === at || (line[end] !== '.' && line[end] !== ')')) return -1;
  return isBlank(line[end + 1]) ? end + 2 : -1;
}

/** The words with their bold and code marks taken out ("**", "__", "`"), the rest as written. */
export function plainWords(text: string): string {
  let out = '';
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (ch === '`') continue;
    if ((ch === '*' || ch === '_') && text[i + 1] === ch) {
      i++;
      continue;
    }
    out += ch;
  }
  return out;
}

/** The answer's cards' words: one a top-level list item, or the whole answer when it holds no list. */
export function answerItems(markdown: string): string[] {
  const items: string[][] = [];
  // The open item's lines, the indent its list's items sit at, and whether a blank line came since its last line.
  let open: string[] | null = null;
  let top = 0;
  let gap = false;
  for (const raw of markdown.split('\n')) {
    const line = raw.endsWith('\r') ? raw.slice(0, -1) : raw;
    const { width, at } = indentOf(line);
    if (at === line.length) {
      gap = open !== null;
      continue;
    }
    const start = itemStart(line, at);
    if (start >= 0 && (open === null || width <= top)) {
      open = [line.slice(start).trim()];
      items.push(open);
      top = width;
      gap = false;
    } else if (open !== null && start >= 0) {
      // A nested item stays with its parent, as a line of its own.
      open.push(`- ${line.slice(start).trim()}`);
      gap = false;
    } else if (open !== null && line[at] !== '#' && (width > top || !gap)) {
      open.push(line.slice(at).trim());
      gap = false;
    } else {
      // A paragraph or a heading after the list ends it.
      open = null;
    }
  }
  const words = items.map((lines) => plainWords(lines.join('\n')).trim()).filter(Boolean);
  if (words.length > 0) return words;
  const whole = plainWords(markdown).trim();
  return whole ? [whole] : [];
}
