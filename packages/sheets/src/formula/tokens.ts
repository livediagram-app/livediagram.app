// The formula tokenizer (blueprint sheets-engine.md "Tokens"). Every token keeps its source offsets, so the editor
// colours references where they were typed and the compiler replaces them in place. Identifiers are classified by
// the parser (a cell, a column, a function, a name), since only context tells "A" the column from "A" a name.
import { ERROR_CODES, type ErrorCode } from './values';

export type TokenKind =
  | 'num'
  | 'str'
  | 'err'
  | 'ident'
  | 'sheet' // `Name!` or `'Quoted Name'!`: v is the title
  | 'op'
  | 'lparen'
  | 'rparen'
  | 'comma'
  | 'semi'
  | 'lbrace'
  | 'rbrace'
  | 'hash' // the spill suffix: `B2#`
  | 'stored' // `@n`, only in stored templates
  | 'ws'
  | 'bad'; // a character no token starts with

export type Token = { k: TokenKind; v: string; start: number; end: number };

const OPS = ['<=', '>=', '<>', '+', '-', '*', '/', '^', '&', '=', '<', '>', '%', ':'];
const IDENT_START = /[A-Za-z_$\\]/;
const IDENT_PART = /[A-Za-z0-9_.$]/;

function readError(text: string, i: number): ErrorCode | null {
  const rest = text.slice(i).toUpperCase();
  for (const code of ERROR_CODES) if (rest.startsWith(code)) return code;
  return null;
}

// Tokens of a formula's body (the text after its `=`), with offsets relative to `base`.
export function tokenize(text: string, base = 0, allowStored = false): Token[] {
  const out: Token[] = [];
  let i = 0;
  const push = (k: TokenKind, v: string, start: number, end: number) =>
    out.push({ k, v, start: start + base, end: end + base });
  while (i < text.length) {
    const ch = text[i]!;
    const start = i;
    if (/\s/.test(ch)) {
      while (i < text.length && /\s/.test(text[i]!)) i++;
      push('ws', text.slice(start, i), start, i);
      continue;
    }
    if (ch === '"') {
      let v = '';
      i++;
      let closed = false;
      while (i < text.length) {
        if (text[i] === '"') {
          if (text[i + 1] === '"') {
            v += '"';
            i += 2;
            continue;
          }
          i++;
          closed = true;
          break;
        }
        v += text[i];
        i++;
      }
      push(closed ? 'str' : 'bad', closed ? v : 'unterminated_string', start, i);
      continue;
    }
    if (ch === "'") {
      // A quoted sheet name: 'Q3 Costs'!A1 ('' is a quote inside).
      let v = '';
      i++;
      let closed = false;
      while (i < text.length) {
        if (text[i] === "'") {
          if (text[i + 1] === "'") {
            v += "'";
            i += 2;
            continue;
          }
          i++;
          closed = true;
          break;
        }
        v += text[i];
        i++;
      }
      if (closed && text[i] === '!') {
        i++;
        push('sheet', v, start, i);
      } else {
        push('bad', 'unknown_sheet_quote', start, i);
      }
      continue;
    }
    if (ch === '#') {
      const code = readError(text, i);
      if (code) {
        i += code.length;
        push('err', code, start, i);
        continue;
      }
      i++;
      push('hash', '#', start, i);
      continue;
    }
    if (ch === '@' && allowStored && /\d/.test(text[i + 1] ?? '')) {
      i++;
      while (i < text.length && /\d/.test(text[i]!)) i++;
      push('stored', text.slice(start + 1, i), start, i);
      continue;
    }
    if (/\d/.test(ch) || (ch === '.' && /\d/.test(text[i + 1] ?? ''))) {
      while (i < text.length && /\d/.test(text[i]!)) i++;
      if (text[i] === '.') {
        i++;
        while (i < text.length && /\d/.test(text[i]!)) i++;
      }
      if (/[eE]/.test(text[i] ?? '') && /[+-]?\d/.test(text.slice(i + 1, i + 3))) {
        i++;
        if (text[i] === '+' || text[i] === '-') i++;
        while (i < text.length && /\d/.test(text[i]!)) i++;
      }
      push('num', text.slice(start, i), start, i);
      continue;
    }
    if (IDENT_START.test(ch)) {
      while (i < text.length && IDENT_PART.test(text[i]!)) i++;
      const word = text.slice(start, i);
      if (text[i] === '!') {
        i++;
        push('sheet', word, start, i);
      } else {
        push('ident', word, start, i);
      }
      continue;
    }
    const op = OPS.find((o) => text.startsWith(o, i));
    if (op) {
      i += op.length;
      push('op', op, start, i);
      continue;
    }
    const single: Record<string, TokenKind> = {
      '(': 'lparen',
      ')': 'rparen',
      ',': 'comma',
      ';': 'semi',
      '{': 'lbrace',
      '}': 'rbrace',
    };
    const k = single[ch];
    i++;
    push(k ?? 'bad', ch, start, i);
  }
  return out;
}
