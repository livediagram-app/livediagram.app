// Terraform's HCL read by hand (docs/specs/020-import-export/infrastructure-import.md "Formats", blueprint
// "parseHcl"): one left-to-right pass makes the tokens, with a stack of modes for strings and their `${}`
// interpolations, and an explicit stack of blocks makes the tree. No regular expression runs over the text and nothing
// recurses on its shape, so a long or hostile file costs no more than its length (CodeQL ReDoS) and cannot overflow
// the call stack.

import { HCL_MAX_DEPTH } from './limits';
import { checkInfraText } from './parse';
import type { InfraError } from './types';

export type HclToken = {
  t: 'ident' | 'str' | 'num' | 'punct' | 'nl';
  v: string;
  line: number;
  // Inside an interpolation: read for references, never for the file's structure.
  inner?: true;
};

export type HclBlock = {
  type: string;
  labels: string[];
  line: number;
  attrs: Map<string, HclToken[]>;
  blocks: HclBlock[];
};

type Failure = { ok: false; message: string; line: number };
type Lexed = { ok: true; tokens: HclToken[] } | Failure;

const isIdentStart = (ch: string | undefined) =>
  ch !== undefined && ((ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || ch === '_');
const isIdentPart = (ch: string | undefined) =>
  isIdentStart(ch) || (ch !== undefined && ((ch >= '0' && ch <= '9') || ch === '-'));
const isDigit = (ch: string | undefined) => ch !== undefined && ch >= '0' && ch <= '9';

// The newlines in text[from, to), so a skipped comment or heredoc keeps the line count true.
function newlinesIn(text: string, from: number, to: number): number {
  let n = 0;
  for (let i = from; i < to; i++) if (text[i] === '\n') n++;
  return n;
}

type Frame = { mode: 'string'; line: number; value: string } | { mode: 'interp'; depth: number };

// A heredoc's body read for its interpolations, one level deep: each `${ ... }` (its braces counted) lexed on its own,
// its tokens marked inner. An interpolation left open is read no further.
function heredocInner(body: string, firstLine: number, out: HclToken[]): void {
  let i = body.indexOf('${');
  while (i !== -1) {
    let depth = 0;
    let j = i + 2;
    for (; j < body.length; j++) {
      if (body[j] === '{') depth++;
      else if (body[j] === '}') {
        if (depth === 0) break;
        depth--;
      }
    }
    if (j >= body.length) return;
    const lexed = lex(body.slice(i + 2, j), false);
    if (lexed.ok) {
      const lineAt = firstLine + newlinesIn(body, 0, i);
      for (const tok of lexed.tokens)
        out.push({ ...tok, line: lineAt + tok.line - 1, inner: true });
    }
    i = body.indexOf('${', j + 1);
  }
}

// The tokens of `text`. `heredocs` is false for a heredoc's interpolation, so heredocs never nest in a lex.
function lex(text: string, heredocs = true): Lexed {
  const tokens: HclToken[] = [];
  const stack: Frame[] = [];
  const n = text.length;
  let i = 0;
  let line = 1;
  const push = (t: HclToken['t'], v: string, at = line) =>
    tokens.push(stack.length > 0 ? { t, v, line: at, inner: true } : { t, v, line: at });
  while (i < n) {
    const top = stack[stack.length - 1];
    const ch = text[i]!;
    if (top?.mode === 'string') {
      if (ch === '\\') {
        top.value += text[i + 1] ?? '';
        i += 2;
        continue;
      }
      if (ch === '"') {
        stack.pop();
        push('str', top.value, top.line);
        i++;
        continue;
      }
      if (ch === '\n') return { ok: false, message: 'The string is not closed', line: top.line };
      // `$${` and `%%{` are a literal `${` and `%{`.
      if ((ch === '$' || ch === '%') && text[i + 1] === ch && text[i + 2] === '{') {
        top.value += `${ch}{`;
        i += 3;
        continue;
      }
      if ((ch === '$' || ch === '%') && text[i + 1] === '{') {
        stack.push({ mode: 'interp', depth: 0 });
        i += 2;
        continue;
      }
      top.value += ch;
      i++;
      continue;
    }
    if (ch === ' ' || ch === '\t' || ch === '\r') {
      i++;
      continue;
    }
    if (ch === '\n') {
      push('nl', '\n');
      line++;
      i++;
      continue;
    }
    if (ch === '#' || (ch === '/' && text[i + 1] === '/')) {
      const end = text.indexOf('\n', i);
      i = end === -1 ? n : end;
      continue;
    }
    if (ch === '/' && text[i + 1] === '*') {
      const end = text.indexOf('*/', i + 2);
      if (end === -1) return { ok: false, message: 'The comment is not closed', line };
      line += newlinesIn(text, i, end);
      i = end + 2;
      continue;
    }
    if (ch === '"') {
      stack.push({ mode: 'string', line, value: '' });
      i++;
      continue;
    }
    if (ch === '<' && text[i + 1] === '<' && heredocs) {
      let j = i + 2;
      const indented = text[j] === '-' || text[j] === '~';
      if (indented) j++;
      if (isIdentStart(text[j])) {
        const markStart = j;
        while (isIdentPart(text[j])) j++;
        const marker = text.slice(markStart, j);
        while (text[j] === ' ' || text[j] === '\t' || text[j] === '\r') j++;
        if (text[j] === '\n') {
          const bodyStart = j + 1;
          // Each line after the opener, until one that is the marker (trimmed when the heredoc is indented).
          let lineStart = bodyStart;
          let end = -1;
          while (lineStart <= n) {
            const nl = text.indexOf('\n', lineStart);
            const lineEnd = nl === -1 ? n : nl;
            const raw = text.slice(lineStart, lineEnd);
            const candidate = raw.endsWith('\r') ? raw.slice(0, -1) : raw;
            if ((indented ? candidate.trim() : candidate) === marker) {
              end = lineEnd;
              break;
            }
            if (nl === -1) break;
            lineStart = nl + 1;
          }
          if (end === -1)
            return { ok: false, message: `The heredoc ${marker} is not closed`, line };
          const body = text.slice(bodyStart, lineStart);
          push('str', body);
          heredocInner(body, line + 1, tokens);
          line += newlinesIn(text, i, end);
          i = end;
          continue;
        }
      }
    }
    if (top?.mode === 'interp') {
      if (ch === '{') top.depth++;
      else if (ch === '}') {
        if (top.depth === 0) {
          stack.pop();
          i++;
          continue;
        }
        top.depth--;
      }
    }
    if (isIdentStart(ch)) {
      const start = i;
      while (isIdentPart(text[i])) i++;
      push('ident', text.slice(start, i));
      continue;
    }
    if (isDigit(ch)) {
      const start = i;
      while (isDigit(text[i]) || (text[i] === '.' && isDigit(text[i + 1]))) i++;
      push('num', text.slice(start, i));
      continue;
    }
    push('punct', ch);
    i++;
  }
  const open = stack[stack.length - 1];
  if (open?.mode === 'string')
    return { ok: false, message: 'The string is not closed', line: open.line };
  if (open) return { ok: false, message: 'The interpolation is not closed', line };
  return { ok: true, tokens };
}

const isPunct = (tok: HclToken | undefined, v: string) =>
  tok !== undefined && !tok.inner && tok.t === 'punct' && tok.v === v;
const OPENERS = new Set(['(', '[', '{']);
const CLOSERS = new Set([')', ']', '}']);

const failure = (message: string, line: number): { ok: false; error: InfraError } => ({
  ok: false,
  error: { code: 'parse', message: `Couldn't read the HCL: ${message} (line ${line}).` },
});

/** A Terraform file as its tree of blocks: the root block holds the file's attributes and top-level blocks. */
export function parseHcl(
  text: string,
): { ok: true; body: HclBlock } | { ok: false; error: InfraError } {
  const refused = checkInfraText(text);
  if (refused) return { ok: false, error: refused };
  const lexed = lex(text);
  if (!lexed.ok) return failure(lexed.message, lexed.line);
  const { tokens } = lexed;
  const root: HclBlock = { type: '', labels: [], line: 1, attrs: new Map(), blocks: [] };
  const stack: HclBlock[] = [root];
  let i = 0;
  while (i < tokens.length) {
    const tok = tokens[i]!;
    if (tok.inner || tok.t === 'nl') {
      i++;
      continue;
    }
    const top = stack[stack.length - 1]!;
    if (isPunct(tok, '}')) {
      if (stack.length === 1) return failure('A "}" closes no block', tok.line);
      stack.pop();
      i++;
      continue;
    }
    if (tok.t !== 'ident') return failure(`Unexpected "${tok.v.slice(0, 20)}"`, tok.line);
    // An attribute: `name = expression`, to the newline or the block's `}` at bracket depth 0.
    if (isPunct(tokens[i + 1], '=') && !isPunct(tokens[i + 2], '=')) {
      let k = i + 2;
      let depth = 0;
      const expr: HclToken[] = [];
      for (; k < tokens.length; k++) {
        const t = tokens[k]!;
        if (!t.inner) {
          if (t.t === 'nl' && depth === 0) break;
          if (t.t === 'punct' && OPENERS.has(t.v)) depth++;
          else if (t.t === 'punct' && CLOSERS.has(t.v)) {
            if (depth === 0) break;
            depth--;
          }
        }
        expr.push(t);
      }
      top.attrs.set(tok.v, expr);
      i = k;
      continue;
    }
    // A block: `type label* {`.
    const labels: string[] = [];
    let k = i + 1;
    while (tokens[k] && !tokens[k]!.inner && (tokens[k]!.t === 'str' || tokens[k]!.t === 'ident'))
      labels.push(tokens[k++]!.v);
    if (!isPunct(tokens[k], '{'))
      return failure(`Expected "=" or "{" after "${tok.v.slice(0, 40)}"`, tok.line);
    if (stack.length > HCL_MAX_DEPTH) return failure('Blocks nest too deep', tok.line);
    const block: HclBlock = { type: tok.v, labels, line: tok.line, attrs: new Map(), blocks: [] };
    top.blocks.push(block);
    stack.push(block);
    i = k + 1;
  }
  if (stack.length > 1) {
    const open = stack[stack.length - 1]!;
    return failure(`The block "${open.type}" is not closed`, open.line);
  }
  return { ok: true, body: root };
}

// The words a reference starts with that name no resource.
const NOT_RESOURCES = new Set([
  'var',
  'local',
  'data',
  'each',
  'count',
  'self',
  'path',
  'terraform',
]);

export type HclReference = { kind: 'resource' | 'module'; type: string; name: string };

/** Every `a.b` the block's attributes name, nested blocks and interpolations included, in order, once each. */
export function hclReferences(block: HclBlock): HclReference[] {
  const seen = new Set<string>();
  const out: HclReference[] = [];
  const scan = (tokens: readonly HclToken[]) => {
    for (let i = 0; i + 2 < tokens.length; i++) {
      const a = tokens[i]!;
      const dot = tokens[i + 1]!;
      const b = tokens[i + 2]!;
      if (a.t !== 'ident' || dot.t !== 'punct' || dot.v !== '.' || b.t !== 'ident') continue;
      // The start of a chain only: `x.aws_s3_bucket.b` names no resource.
      const prev = tokens[i - 1];
      if (prev && prev.t === 'punct' && prev.v === '.') continue;
      if (NOT_RESOURCES.has(a.v)) continue;
      const ref: HclReference | null =
        a.v === 'module'
          ? { kind: 'module', type: 'module', name: b.v }
          : a.v.includes('_')
            ? { kind: 'resource', type: a.v, name: b.v }
            : null;
      if (!ref) continue;
      const key = `${ref.type}.${ref.name}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(ref);
    }
  };
  // The parser caps the nesting at HCL_MAX_DEPTH, so this walk is as deep as that at most.
  const walk = (b: HclBlock) => {
    for (const tokens of b.attrs.values()) scan(tokens);
    for (const child of b.blocks) walk(child);
  };
  walk(block);
  return out;
}

/** An attribute's expression as written, for a note (`count = 3`): its tokens joined, cut to `max`. */
export function exprText(tokens: readonly HclToken[] | undefined, max = 40): string | undefined {
  if (!tokens || tokens.length === 0) return undefined;
  let out = '';
  for (const t of tokens) {
    if (t.t === 'nl') continue;
    out += t.t === 'str' ? JSON.stringify(t.v) : t.v;
    if (out.length > max) return `${out.slice(0, max - 1)}…`;
  }
  return out;
}
