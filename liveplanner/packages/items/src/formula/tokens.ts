// The formula tokenizer (docs/specs/026-plan/item-types.md "Formula fields"): one hand-written pass over the
// characters, no regular expressions over the text, so its cost is linear in the formula's length whatever it holds.
// A field is a run of plain words (`Story Points`) or anything in braces (`{Children Done (%)}`); in a stored formula
// the braces hold the field's id.

export type Token =
  | { t: 'num'; v: number; at: number; end: number }
  | { t: 'str'; v: string; at: number; end: number }
  // A field or function name; `braced` when written in braces (never a function, true or false).
  | { t: 'name'; v: string; braced: boolean; at: number; end: number }
  | { t: 'op'; v: Op; at: number; end: number }
  | { t: '(' | ')' | ','; at: number; end: number };

export type Op = '+' | '-' | '*' | '/' | '=' | '!=' | '<' | '<=' | '>' | '>=';

export interface FormulaSyntaxError {
  error: string;
  // Where, 0-based in the text it was read from.
  at: number;
}

// Where a problem is, as people count: the first character is 1.
export const column = (at: number) => at + 1;

const isDigit = (c: string) => c >= '0' && c <= '9';
// A letter of any script, or `_`: a name starts with one. One character at a time, never a regex over the text.
const isLetter = (c: string) => c === '_' || c.toLowerCase() !== c.toUpperCase();
const isWordChar = (c: string) => isLetter(c) || isDigit(c);
const isSpace = (c: string) => c === ' ' || c === '\t' || c === '\n' || c === '\r';

const TWO_CHAR_OPS: Readonly<Record<string, Op>> = {
  '<=': '<=',
  '>=': '>=',
  '!=': '!=',
  '<>': '!=',
  '==': '=',
};
const ONE_CHAR_OPS: Readonly<Record<string, Op>> = {
  '+': '+',
  '-': '-',
  '*': '*',
  '/': '/',
  '=': '=',
  '<': '<',
  '>': '>',
};

export function tokenize(src: string): Token[] | FormulaSyntaxError {
  const out: Token[] = [];
  let i = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i]!;
    if (isSpace(c)) {
      i += 1;
      continue;
    }
    const at = i;
    if (c === '(' || c === ')' || c === ',') {
      out.push({ t: c, at, end: i + 1 });
      i += 1;
      continue;
    }
    const two = TWO_CHAR_OPS[src.slice(i, i + 2)];
    if (two) {
      out.push({ t: 'op', v: two, at, end: i + 2 });
      i += 2;
      continue;
    }
    const one = ONE_CHAR_OPS[c];
    if (one) {
      out.push({ t: 'op', v: one, at, end: i + 1 });
      i += 1;
      continue;
    }
    if (isDigit(c) || (c === '.' && i + 1 < n && isDigit(src[i + 1]!))) {
      while (i < n && isDigit(src[i]!)) i += 1;
      if (i < n && src[i] === '.') {
        i += 1;
        while (i < n && isDigit(src[i]!)) i += 1;
      }
      out.push({ t: 'num', v: Number(src.slice(at, i)), at, end: i });
      continue;
    }
    if (c === '"') {
      // Text in double quotes, `""` for a quote inside.
      let text = '';
      i += 1;
      for (;;) {
        if (i >= n) return { error: 'Text has no closing quote', at };
        const ch = src[i]!;
        if (ch === '"') {
          if (src[i + 1] === '"') {
            text += '"';
            i += 2;
            continue;
          }
          i += 1;
          break;
        }
        text += ch;
        i += 1;
      }
      out.push({ t: 'str', v: text, at, end: i });
      continue;
    }
    if (c === '{') {
      const close = src.indexOf('}', i + 1);
      if (close < 0) return { error: `No closing } for the { at ${column(at)}`, at };
      const name = src.slice(i + 1, close).trim();
      if (!name) return { error: `Empty {} at ${column(at)}`, at };
      out.push({ t: 'name', v: name, braced: true, at, end: close + 1 });
      i = close + 1;
      continue;
    }
    if (isLetter(c)) {
      // Words joined by single spaces: `Story Points`, ending before an operator, a bracket or two spaces.
      i += 1;
      for (;;) {
        while (i < n && isWordChar(src[i]!)) i += 1;
        if (i + 1 < n && src[i] === ' ' && isWordChar(src[i + 1]!)) {
          i += 1;
          continue;
        }
        break;
      }
      out.push({ t: 'name', v: src.slice(at, i), braced: false, at, end: i });
      continue;
    }
    return { error: `Unexpected "${c}" at ${column(at)}`, at };
  }
  return out;
}
