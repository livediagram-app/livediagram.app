import { describe, expect, it } from 'vitest';
import { parseFormula, PARSE_FAILURE_COPY } from './parse';
import { tokenize } from './tokens';
import { callsOf, refsOf, type Node } from './ast';

function ast(text: string): Node {
  const r = parseFormula(text);
  if (!r.ok) throw new Error(`${text}: ${r.reason}@${r.at}`);
  return r.ast;
}

// A compact printout of a tree, to compare shapes.
function show(n: Node): string {
  switch (n.k) {
    case 'num':
      return String(n.v);
    case 'str':
      return JSON.stringify(n.v);
    case 'bool':
      return n.v ? 'TRUE' : 'FALSE';
    case 'err':
      return n.v;
    case 'name':
      return `name:${n.v}`;
    case 'stored':
      return `@${n.i}`;
    case 'ref': {
      const r = n.ref;
      return `ref(${r.sheet ? `${r.sheet}!` : ''}${[r.r1, r.c1, r.r2, r.c2].map((x) => x ?? '_').join(',')}${r.a ? ` a${r.a}` : ''}${r.open ? ` open${r.open}` : ''}${r.spill ? ' #' : ''})`;
    }
    case 'neg':
      return `-(${show(n.a)})`;
    case 'pos':
      return `+(${show(n.a)})`;
    case 'pct':
      return `(${show(n.a)})%`;
    case 'bin':
      return `(${show(n.a)} ${n.op} ${show(n.b)})`;
    case 'call':
      return `${n.name}(${n.args.map((a) => (a ? show(a) : '∅')).join(', ')})`;
    case 'arr':
      return `{${n.rows.map((r) => r.map(show).join(',')).join(';')}}`;
  }
}

describe('tokenize', () => {
  it('keeps offsets and kinds', () => {
    const toks = tokenize('SUM(A1, "a""b") & #N/A', 1);
    expect(toks.map((t) => t.k)).toEqual([
      'ident',
      'lparen',
      'ident',
      'comma',
      'ws',
      'str',
      'rparen',
      'ws',
      'op',
      'ws',
      'err',
    ]);
    expect(toks[5]).toMatchObject({ v: 'a"b', start: 9, end: 15 });
  });
  it('reads sheets, stored refs, numbers and bad characters', () => {
    expect(tokenize("'Q3 ''x'''!A1").map((t) => [t.k, t.v])).toEqual([
      ['sheet', "Q3 'x'"],
      ['ident', 'A1'],
    ]);
    expect(tokenize('@12', 0, true)[0]).toMatchObject({ k: 'stored', v: '12' });
    expect(tokenize('@12')[0]!.k).toBe('bad');
    expect(tokenize('1.5e-3 .5 2E')[0]!.v).toBe('1.5e-3');
    expect(tokenize('.5')[0]!.v).toBe('.5');
    expect(tokenize('B2#')[1]!.k).toBe('hash');
    expect(tokenize('~')[0]!.k).toBe('bad');
  });
});

describe('parseFormula', () => {
  it.each([
    ['=1+2*3', '(1 + (2 * 3))'],
    ['=(1+2)*3', '((1 + 2) * 3)'],
    ['=-2^2', '(-(2) ^ 2)'],
    ['=2^3^2', '((2 ^ 3) ^ 2)'],
    ['=50%', '(50)%'],
    ['=+A1', '+(ref(0,0,_,_))'],
    ['=1&2=3', '((1 & 2) = 3)'],
    ['=1<>2', '(1 <> 2)'],
    ['=a1<=$B$2', '(ref(0,0,_,_) <= ref(1,1,_,_ a3))'],
    ['=SUM(A1:B$2)', 'SUM(ref(0,0,1,1 a4))'],
    ['=SUM(A:C)', 'SUM(ref(_,0,_,2))'],
    ['=SUM($A:$C)', 'SUM(ref(_,0,_,2 a10))'],
    ['=SUM(2:4)', 'SUM(ref(1,_,3,_))'],
    ['=SUM(A2:A)', 'SUM(ref(1,0,_,0 openr))'],
    ['=SUM(A2:2)', 'SUM(ref(1,0,1,_ openc))'],
    ['=Budget!B4', 'ref(Budget!3,1,_,_)'],
    ["='Q3 Costs'!A1:D20", 'ref(Q3 Costs!0,0,19,3)'],
    ['=B2#', 'ref(1,1,_,_ #)'],
    ['=SUM(B2:C3#)', 'SUM(ref(1,1,2,2 #))'],
    ['=IF(A1,,"x")', 'IF(ref(0,0,_,_), ∅, "x")'],
    ['=NOW()', 'NOW()'],
    ['=log10(100)', 'LOG10(100)'],
    ['=TRUE', 'TRUE'],
    ['=false()', 'FALSE()'],
    ['={1,2;3,-4}', '{1,2;3,-4}'],
    ['={"a",TRUE,#N/A}', '{"a",TRUE,#N/A}'],
    ['=foo', 'name:FOO'],
    ['=A', 'name:A'],
    ['=2', '2'],
    ['= 1 + 2 ', '(1 + 2)'],
    ['=A1 : B2', 'ref(0,0,1,1)'],
  ])('%s', (text, shape) => {
    expect(show(ast(text))).toBe(shape);
  });
  it.each([
    ['=', 'empty', 1],
    ['=   ', 'empty', 1],
    ['=(1+2', 'missing_close_bracket', 5],
    ['=1+2)', 'missing_open_bracket', 4],
    [')', 'missing_open_bracket', 0],
    ['="abc', 'unterminated_string', 1],
    ["='abc", 'unknown_sheet_quote', 1],
    ["='abc'", 'unknown_sheet_quote', 1],
    ['=Budget!', 'bad_reference', 1],
    ['=Budget!foo', 'bad_reference', 1],
    ['=1 2', 'unexpected_token', 3],
    ['=SUM(1 2)', 'unexpected_token', 7],
    ['=SUM(1', 'missing_close_bracket', 6],
    ['={1,2;3}', 'array_ragged', 1],
    ['={1,A1}', 'unexpected_token', 4],
    ['={1', 'missing_close_bracket', 3],
    ['={-x}', 'unexpected_token', 3],
    ['={1 2}', 'unexpected_token', 4],
    ['=A:1', 'bad_reference', 1],
    ['=A1:B2:C3', 'unexpected_token', 6],
    ['=~', 'unexpected_token', 1],
    ['=*', 'unexpected_token', 1],
    ['=A$', 'bad_reference', 1],
    ['=A0', 'name', 0],
  ])('%s fails with %s', (text, reason, at) => {
    const r = parseFormula(text);
    if (reason === 'name') {
      expect(r.ok).toBe(true);
      return;
    }
    expect(r).toEqual({ ok: false, reason, at });
    expect(PARSE_FAILURE_COPY[reason as keyof typeof PARSE_FAILURE_COPY]).toBeTruthy();
  });
  it('bounds length and depth', () => {
    expect(parseFormula(`=${'1+'.repeat(4000)}1`)).toMatchObject({ ok: false, reason: 'too_long' });
    expect(parseFormula(`=${'('.repeat(70)}1${')'.repeat(70)}`)).toMatchObject({
      ok: false,
      reason: 'too_deep',
    });
    expect(parseFormula(`=${'-'.repeat(70)}1`)).toMatchObject({ ok: false, reason: 'too_deep' });
    expect(parseFormula(`=${'+'.repeat(70)}1`)).toMatchObject({ ok: false, reason: 'too_deep' });
    expect(parseFormula(`=${'ABS('.repeat(70)}1${')'.repeat(70)}`)).toMatchObject({
      ok: false,
      reason: 'too_deep',
    });
  });
  it('lists refs in source order and calls', () => {
    const tree = ast('=SUM(B1, A1) + MAX(C1:C2)');
    expect(refsOf(tree).map((r) => r.start)).toEqual([5, 9, 19]);
    expect([...callsOf(tree)]).toEqual(['SUM', 'MAX']);
    expect([...callsOf(ast('=-ABS({1})%'))]).toEqual(['ABS']);
    expect(refsOf(ast('=-A1%+{1}'))).toHaveLength(1);
  });
  it('parses stored templates', () => {
    expect(
      show(
        parseFormula('SUM(@0)+@1', true).ok
          ? (parseFormula('SUM(@0)+@1', true) as { ast: Node }).ast
          : { k: 'num', v: 0 },
      ),
    ).toBe('(SUM(@0) + @1)');
  });
});
