// The line form's words (docs/specs/024-agents/blueprints/edit-operations.md "Line form"): split on
// whitespace, `"…"` with JSON's escapes (\" \\ \n \t and the rest), `'…'` literal, and a quote may open mid-word
// (`label="Sign in"`), so each word keeps its segments and which of them were quoted.

export type Segment = { text: string; quoted: boolean };

export type Word = {
  // The word with quotes removed and escapes read.
  value: string;
  segments: Segment[];
  // 1-based column of its first character in the line.
  column: number;
  // The word as written, quotes and all: what a selector carries into the JSON form.
  raw: string;
};

export type TokeniseError = { column: number; expected: string };

// JSON's escapes, so a JSON value's strings read the same in a word as in JSON.
const ESCAPES: Readonly<Record<string, string>> = {
  '"': '"',
  '\\': '\\',
  '/': '/',
  b: '\b',
  f: '\f',
  n: '\n',
  r: '\r',
  t: '\t',
};
const UNICODE_ESCAPE = /^u[0-9a-fA-F]{4}/;
const isSpace = (ch: string) => ch === ' ' || ch === '\t';

export function tokeniseLine(line: string): { words: Word[] } | { error: TokeniseError } {
  const words: Word[] = [];
  let i = 0;
  while (i < line.length) {
    if (isSpace(line[i]!)) {
      i++;
      continue;
    }
    const start = i;
    const segments: Segment[] = [];
    let plain = '';
    const flush = () => {
      if (plain !== '') segments.push({ text: plain, quoted: false });
      plain = '';
    };
    while (i < line.length && !isSpace(line[i]!)) {
      const ch = line[i]!;
      if (ch !== '"' && ch !== "'") {
        plain += ch;
        i++;
        continue;
      }
      flush();
      const open = i;
      let text = '';
      i++;
      while (i < line.length && line[i] !== ch) {
        if (ch === '"' && line[i] === '\\') {
          const rest = line.slice(i + 1, i + 6);
          if (UNICODE_ESCAPE.test(rest)) {
            text += String.fromCharCode(parseInt(rest.slice(1), 16));
            i += 6;
            continue;
          }
          const escaped = ESCAPES[line[i + 1] ?? ''];
          if (escaped === undefined)
            return { error: { column: i + 1, expected: 'an escape: \\" \\\\ \\n \\t or \\uXXXX' } };
          text += escaped;
          i += 2;
          continue;
        }
        text += line[i];
        i++;
      }
      if (i >= line.length) return { error: { column: open + 1, expected: `a closing ${ch}` } };
      i++;
      segments.push({ text, quoted: true });
    }
    flush();
    words.push({
      value: segments.map((s) => s.text).join(''),
      segments,
      column: start + 1,
      raw: line.slice(start, i),
    });
  }
  return { words };
}

// The text before the first quoted segment: where a word's key, `->` or `~` may sit.
export function unquotedPrefix(word: Word): string {
  const first = word.segments.findIndex((s) => s.quoted);
  return (first < 0 ? word.segments : word.segments.slice(0, first)).map((s) => s.text).join('');
}

// True when the word is one quoted value and nothing else: a label.
export function isQuotedWord(word: Word): boolean {
  return word.segments.length === 1 && word.segments[0]!.quoted;
}

// True when any part of the word was quoted.
export function hasQuotes(word: Word): boolean {
  return word.segments.some((s) => s.quoted);
}

// A word's raw text split at each `->` outside quotes (`"Sign in"->"Pay"` is two parts), or null when it has none.
// Each part is raw, quotes kept, so it reads as a selector word of its own.
export function arrowParts(word: Word): string[] | null {
  const { raw } = word;
  const parts: string[] = [];
  let start = 0;
  let quote: string | null = null;
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i]!;
    if (quote) {
      if (quote === '"' && ch === '\\') i++;
      else if (ch === quote) quote = null;
    } else if (ch === '"' || ch === "'") quote = ch;
    else if (ch === '-' && raw[i + 1] === '>') {
      parts.push(raw.slice(start, i));
      start = i + 2;
      i++;
    }
  }
  if (parts.length === 0) return null;
  parts.push(raw.slice(start));
  return parts;
}
