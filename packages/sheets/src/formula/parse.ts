// The formula parser (blueprint sheets-engine.md "Grammar"): precedence climbing over the tokens, as Google
// Sheets reads a formula (negation binds tighter than ^, so -2^2 is 4; ^ is left-associative).
import { columnIndex } from '../address';
import { FORMULA_DEPTH_MAX, FORMULA_MAX } from '../limits';
import type { A1Ref, BinaryOp, Node } from './ast';
import { tokenize, type Token } from './tokens';
import type { ErrorCode } from './values';

export type ParseFailure =
  | 'empty'
  | 'unexpected_token'
  | 'missing_close_bracket'
  | 'missing_open_bracket'
  | 'unterminated_string'
  | 'bad_reference'
  | 'unknown_sheet_quote'
  | 'too_long'
  | 'too_deep'
  | 'array_ragged';

export const PARSE_FAILURE_COPY: Record<ParseFailure, string> = {
  empty: 'There is nothing after the =',
  unexpected_token: "There's something here that can't be read",
  missing_close_bracket: "There's a missing closing bracket",
  missing_open_bracket: "There's a closing bracket with no opening one",
  unterminated_string: "There's a text in quotes that is never closed",
  bad_reference: "There's a reference that can't be read",
  unknown_sheet_quote: "A sheet's name in quotes must be followed by !",
  too_long: 'This formula is too long: a formula holds up to 8,000 characters',
  too_deep: 'This formula nests too deeply: up to 64 levels',
  array_ragged: 'Every row of an array must have the same number of values',
};

export type ParseResult = { ok: true; ast: Node } | { ok: false; reason: ParseFailure; at: number };

const CELL_RE = /^(\$?)([A-Za-z]{1,4})(\$?)([0-9]{1,7})$/;
const COL_RE = /^(\$?)([A-Za-z]{1,4})$/;
const NAME_RE = /^[A-Za-z_][A-Za-z0-9_.]*$/;

class Fail {
  readonly reason: ParseFailure;
  readonly at: number;
  constructor(reason: ParseFailure, at: number) {
    this.reason = reason;
    this.at = at;
  }
}

type Part =
  | { kind: 'cell'; r: number; c: number; absR: boolean; absC: boolean }
  | { kind: 'col'; c: number; abs: boolean }
  | { kind: 'row'; r: number; abs: boolean };

class Parser {
  private i = 0;
  private depth = 0;
  private readonly toks: Token[];
  private readonly end: number;
  constructor(toks: Token[], end: number) {
    this.toks = toks;
    this.end = end;
  }

  private peek(skipWs = true): Token | undefined {
    let j = this.i;
    if (skipWs) while (this.toks[j]?.k === 'ws') j++;
    return this.toks[j];
  }

  private next(): Token | undefined {
    while (this.toks[this.i]?.k === 'ws') this.i++;
    return this.toks[this.i++];
  }

  private at(): number {
    return this.peek()?.start ?? this.end;
  }

  private isOp(v: string): boolean {
    const t = this.peek();
    return t?.k === 'op' && t.v === v;
  }

  parseAll(): Node {
    const node = this.expr();
    const rest = this.peek();
    if (rest) {
      if (rest.k === 'rparen') throw new Fail('missing_open_bracket', rest.start);
      throw new Fail('unexpected_token', rest.start);
    }
    return node;
  }

  private enter(): void {
    if (++this.depth > FORMULA_DEPTH_MAX) throw new Fail('too_deep', this.at());
  }

  private expr(): Node {
    this.enter();
    const n = this.compare();
    this.depth--;
    return n;
  }

  private binary(next: () => Node, ops: readonly string[]): Node {
    let a = next();
    for (;;) {
      const t = this.peek();
      if (t?.k !== 'op' || !ops.includes(t.v)) return a;
      this.next();
      const b = next();
      a = { k: 'bin', op: t.v as BinaryOp, a, b };
    }
  }

  private compare = (): Node => this.binary(this.concat, ['=', '<>', '<', '>', '<=', '>=']);
  private concat = (): Node => this.binary(this.additive, ['&']);
  private additive = (): Node => this.binary(this.term, ['+', '-']);
  private term = (): Node => this.binary(this.power, ['*', '/']);
  private power = (): Node => this.binary(this.unary, ['^']);

  private unary = (): Node => {
    if (this.isOp('-')) {
      this.next();
      this.enter();
      const a = this.unary();
      this.depth--;
      return { k: 'neg', a };
    }
    if (this.isOp('+')) {
      this.next();
      this.enter();
      const a = this.unary();
      this.depth--;
      return { k: 'pos', a };
    }
    let n = this.primary();
    while (this.isOp('%')) {
      this.next();
      n = { k: 'pct', a: n };
    }
    return n;
  };

  private part(t: Token): Part | null {
    if (t.k === 'ident') {
      const cell = CELL_RE.exec(t.v);
      if (cell) {
        const r = Number(cell[4]) - 1;
        if (r < 0) return null;
        return {
          kind: 'cell',
          r,
          c: columnIndex(cell[2]!),
          absC: cell[1] === '$',
          absR: cell[3] === '$',
        };
      }
      const col = COL_RE.exec(t.v);
      if (col) return { kind: 'col', c: columnIndex(col[2]!), abs: col[1] === '$' };
      return null;
    }
    if (t.k === 'num' && /^\d{1,7}$/.test(t.v)) {
      const r = Number(t.v) - 1;
      return r < 0 ? null : { kind: 'row', r, abs: false };
    }
    if (t.k === 'op' && t.v === '$') return null;
    return null;
  }

  // A reference at the cursor: an optional sheet prefix, a cell / column / row, a `:` and its other end, and a
  // spill `#`. Null (cursor unmoved) when the tokens are not a reference.
  private tryRef(): A1Ref | null {
    const save = this.i;
    const first = this.next();
    if (!first) return null;
    let sheet: string | undefined;
    let head: Token | undefined = first;
    if (first.k === 'sheet') {
      sheet = first.v;
      head = this.toks[this.i];
      this.i++;
      if (!head) throw new Fail('bad_reference', first.start);
    }
    const a = this.part(head);
    if (!a) {
      if (sheet !== undefined) throw new Fail('bad_reference', first.start);
      this.i = save;
      return null;
    }
    // A lone column or row is not a reference (it is a name or a number) unless a ':' follows.
    let b: Part | null = null;
    let endTok = head;
    if (this.isOp(':')) {
      const colonAt = this.i;
      this.next();
      const t = this.next();
      b = t ? this.part(t) : null;
      if (!b) {
        if (a.kind !== 'cell') throw new Fail('bad_reference', head.start);
        this.i = colonAt;
      } else {
        endTok = t!;
      }
    }
    if (a.kind !== 'cell' && !b) {
      if (sheet !== undefined) throw new Fail('bad_reference', first.start);
      this.i = save;
      return null;
    }
    const ref = this.shape(a, b, head.start);
    ref.start = first.start;
    ref.end = endTok.end;
    if (sheet !== undefined) ref.sheet = sheet;
    const hash = this.toks[this.i];
    if (hash?.k === 'hash' && hash.start === endTok.end) {
      this.i++;
      ref.spill = true;
      ref.end = hash.end;
    }
    return ref;
  }

  private shape(a: Part, b: Part | null, at: number): A1Ref {
    const ref: A1Ref = { a: 0, start: 0, end: 0 };
    if (a.kind === 'cell') {
      ref.r1 = a.r;
      ref.c1 = a.c;
      ref.a |= (a.absR ? 1 : 0) | (a.absC ? 2 : 0);
      if (!b) return ref;
      if (b.kind === 'cell') {
        ref.r2 = b.r;
        ref.c2 = b.c;
        ref.a |= (b.absR ? 4 : 0) | (b.absC ? 8 : 0);
      } else if (b.kind === 'col') {
        ref.c2 = b.c;
        ref.a |= b.abs ? 8 : 0;
        ref.open = 'r';
      } else {
        ref.r2 = b.r;
        ref.a |= b.abs ? 4 : 0;
        ref.open = 'c';
      }
      return ref;
    }
    if (a.kind === 'col' && b?.kind === 'col') {
      ref.c1 = a.c;
      ref.c2 = b.c;
      ref.a |= (a.abs ? 2 : 0) | (b.abs ? 8 : 0);
      return ref;
    }
    if (a.kind === 'row' && b?.kind === 'row') {
      ref.r1 = a.r;
      ref.r2 = b.r;
      return ref;
    }
    throw new Fail('bad_reference', at);
  }

  private primary(): Node {
    const t = this.peek();
    if (!t) throw new Fail('unexpected_token', this.end);
    if (t.k === 'bad') {
      throw new Fail(
        t.v === 'unterminated_string' || t.v === 'unknown_sheet_quote'
          ? (t.v as ParseFailure)
          : 'unexpected_token',
        t.start,
      );
    }
    if (t.k === 'ident' || t.k === 'sheet' || t.k === 'num') {
      if (t.k === 'ident') {
        const after = this.toks[this.toks.indexOf(t) + 1];
        if (after?.k === 'lparen' && NAME_RE.test(t.v)) return this.call();
      }
      const ref = this.tryRef();
      if (ref) return { k: 'ref', ref };
    }
    this.next();
    switch (t.k) {
      case 'num':
        return { k: 'num', v: Number(t.v) };
      case 'str':
        return { k: 'str', v: t.v };
      case 'err':
        return { k: 'err', v: t.v as ErrorCode };
      case 'stored':
        return { k: 'stored', i: Number(t.v) };
      case 'ident': {
        const upper = t.v.toUpperCase();
        if (upper === 'TRUE' || upper === 'FALSE') return { k: 'bool', v: upper === 'TRUE' };
        if (!NAME_RE.test(t.v)) throw new Fail('bad_reference', t.start);
        return { k: 'name', v: upper };
      }
      case 'lparen': {
        const inner = this.expr();
        const close = this.next();
        if (close?.k !== 'rparen')
          throw new Fail('missing_close_bracket', close?.start ?? this.end);
        return inner;
      }
      case 'lbrace':
        return this.array(t.start);
      case 'rparen':
        throw new Fail('missing_open_bracket', t.start);
      default:
        throw new Fail('unexpected_token', t.start);
    }
  }

  private call(): Node {
    const name = this.next()!;
    this.next(); // (
    this.enter();
    const args: (Node | null)[] = [];
    if (this.peek()?.k === 'rparen') {
      const close = this.next()!;
      this.depth--;
      return { k: 'call', name: name.v.toUpperCase(), args, start: name.start, end: close.end };
    }
    for (;;) {
      const t = this.peek();
      if (t?.k === 'comma' || t?.k === 'rparen') args.push(null);
      else args.push(this.expr());
      const sep = this.next();
      if (sep?.k === 'comma') continue;
      if (sep?.k === 'rparen') {
        this.depth--;
        return { k: 'call', name: name.v.toUpperCase(), args, start: name.start, end: sep.end };
      }
      throw new Fail(sep ? 'unexpected_token' : 'missing_close_bracket', sep?.start ?? this.end);
    }
  }

  private literal(): Node {
    const t = this.next();
    if (!t) throw new Fail('missing_close_bracket', this.end);
    if (t.k === 'op' && t.v === '-') {
      const n = this.next();
      if (n?.k === 'num') return { k: 'num', v: -Number(n.v) };
      throw new Fail('unexpected_token', n?.start ?? this.end);
    }
    if (t.k === 'num') return { k: 'num', v: Number(t.v) };
    if (t.k === 'str') return { k: 'str', v: t.v };
    if (t.k === 'err') return { k: 'err', v: t.v as ErrorCode };
    if (t.k === 'ident' && /^(true|false)$/i.test(t.v))
      return { k: 'bool', v: t.v.toUpperCase() === 'TRUE' };
    throw new Fail('unexpected_token', t.start);
  }

  private array(start: number): Node {
    const rows: Node[][] = [[]];
    for (;;) {
      rows[rows.length - 1]!.push(this.literal());
      const sep = this.next();
      if (sep?.k === 'comma') continue;
      if (sep?.k === 'semi') {
        rows.push([]);
        continue;
      }
      if (sep?.k === 'rbrace') break;
      throw new Fail(sep ? 'unexpected_token' : 'missing_close_bracket', sep?.start ?? this.end);
    }
    const width = rows[0]!.length;
    if (rows.some((r) => r.length !== width)) throw new Fail('array_ragged', start);
    return { k: 'arr', rows };
  }
}

// Parse a formula as typed (starting with `=`), or a stored template (`allowStored`). Offsets in a failure are
// into `text`, so the editor underlines the right place.
export function parseFormula(text: string, allowStored = false): ParseResult {
  if (text.length > FORMULA_MAX) return { ok: false, reason: 'too_long', at: FORMULA_MAX };
  const body = text.startsWith('=') ? text.slice(1) : text;
  const base = text.length - body.length;
  const toks = tokenize(body, base, allowStored);
  if (!toks.some((t) => t.k !== 'ws')) return { ok: false, reason: 'empty', at: base };
  try {
    return { ok: true, ast: new Parser(toks, text.length).parseAll() };
  } catch (e) {
    if (e instanceof Fail) return { ok: false, reason: e.reason, at: e.at };
    throw e;
  }
}
