import { describe, expect, it } from 'vitest';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import { compileFormula } from './compile';
import { evaluateTree } from './evaluate';
import { FUNCTION_NAMES, arityText, functionNamed } from './functions';
import { FORMULA_CACHE_MAX, FORMULA_DEPTH_MAX, FORMULA_MAX, FORMULA_STEPS_MAX } from './limits';
import { parseFormula, refsOf } from './parse';
import { formulaScopeOf, missingFieldProblem, shownFormula, storedFormula } from './references';
import { tokenize } from './tokens';
import { FormulaFail, dateOf, dayText, toText, truthy, type FormulaValue } from './values';

// The formula language (docs/specs/026-plan/item-types.md "Formula fields"): tokens, syntax, values, functions,
// names and ids, and the safety limits, fuzzed.

const TODAY = dateOf('2026-10-31')!;

// Works a formula out over a bag of values by name; a problem comes back as { error }.
function run(
  src: string,
  vars: Record<string, FormulaValue> = {},
): FormulaValue | { error: string } {
  const tree = parseFormula(src);
  if ('error' in tree) return { error: tree.error };
  try {
    return evaluateTree(tree, {
      read: (id) => {
        if (!(id in vars)) throw new FormulaFail(`no ${id}`);
        return vars[id]!;
      },
      today: () => TODAY,
      budget: { left: FORMULA_STEPS_MAX },
    });
  } catch (e) {
    return { error: (e as FormulaFail).error };
  }
}

describe('tokenize', () => {
  it('reads numbers, text, names, braces, operators and punctuation', () => {
    const toks = tokenize('Story Points * 1.5 + {Done (%)} >= "a ""b""", .5');
    expect(Array.isArray(toks) && toks.map((t) => t.t)).toEqual([
      'name',
      'op',
      'num',
      'op',
      'name',
      'op',
      'str',
      ',',
      'num',
    ]);
    expect(Array.isArray(toks) && toks[0]).toMatchObject({ v: 'Story Points', braced: false });
    expect(Array.isArray(toks) && toks[4]).toMatchObject({ v: 'Done (%)', braced: true });
    expect(Array.isArray(toks) && toks[6]).toMatchObject({ v: 'a "b"' });
  });

  it('ends a name before two spaces or an operator', () => {
    const toks = tokenize('Budget  Spent-Cost');
    expect(Array.isArray(toks) && toks.map((t) => ('v' in t ? t.v : t.t))).toEqual([
      'Budget',
      'Spent',
      '-',
      'Cost',
    ]);
  });

  it('reads the two-character operators and their other spellings', () => {
    const toks = tokenize('<= >= != <> == < > =');
    expect(Array.isArray(toks) && toks.map((t) => ('v' in t ? t.v : t.t))).toEqual([
      '<=',
      '>=',
      '!=',
      '!=',
      '=',
      '<',
      '>',
      '=',
    ]);
  });

  it('names what it cannot read and where', () => {
    expect(tokenize('1 & 2')).toEqual({ error: 'Unexpected "&" at 3', at: 2 });
    expect(tokenize('"open')).toEqual({ error: 'Text has no closing quote', at: 0 });
    expect(tokenize('{Budget')).toEqual({ error: 'No closing } for the { at 1', at: 0 });
    expect(tokenize('1 + { }')).toEqual({ error: 'Empty {} at 5', at: 4 });
  });

  it('reads letters of any script as a name', () => {
    expect(tokenize('Prénom')).toMatchObject([{ t: 'name', v: 'Prénom' }]);
  });
});

describe('parseFormula', () => {
  it('binds * / before + -, and both before a comparison', () => {
    expect(run('1 + 2 * 3')).toBe(7);
    expect(run('(1 + 2) * 3')).toBe(9);
    expect(run('10 - 4 - 3')).toBe(3);
    expect(run('12 / 2 / 3')).toBe(2);
    expect(run('1 + 1 = 2')).toBe(true);
    expect(run('-2 * -3')).toBe(6);
    expect(run('+4')).toBe(4);
  });

  it('reads true, false, and a function call, ignoring case', () => {
    expect(run('TRUE')).toBe(true);
    expect(run('false')).toBe(false);
    expect(run('ROUND(2.4)')).toBe(2);
  });

  it('names a syntax problem and where', () => {
    expect(run('')).toEqual({ error: 'The formula is empty' });
    expect(run('1 +')).toEqual({ error: 'Expected a value at 4' });
    expect(run('(1 + 2')).toEqual({ error: 'Expected ) at 7' });
    expect(run('1 2')).toEqual({ error: 'Unexpected "2" at 3' });
    expect(run('*')).toEqual({ error: 'Expected a value at 1' });
    expect(run('foo(1)')).toEqual({ error: 'Unknown function "foo"' });
    expect(run('round()')).toEqual({ error: 'round takes 1 or 2 values' });
    expect(run('today(1)')).toEqual({ error: 'today takes no values' });
    expect(run('abs(1, 2)')).toEqual({ error: 'abs takes 1 value' });
    expect(run('if(1)')).toEqual({ error: 'if takes 2 or 3 values' });
    expect(run('round(1 2)')).toEqual({ error: 'Expected ) at 9' });
  });

  it('holds nesting to FORMULA_DEPTH_MAX', () => {
    const ok = '('.repeat(FORMULA_DEPTH_MAX) + '1' + ')'.repeat(FORMULA_DEPTH_MAX);
    expect(run(ok)).toBe(1);
    const deep = '('.repeat(FORMULA_DEPTH_MAX + 1) + '1' + ')'.repeat(FORMULA_DEPTH_MAX + 1);
    expect(run(deep)).toEqual({ error: `Nested too deeply (up to ${FORMULA_DEPTH_MAX})` });
    expect(run('-'.repeat(FORMULA_DEPTH_MAX + 1) + '1')).toMatchObject({ error: /Nested/ });
    expect(
      run('abs('.repeat(FORMULA_DEPTH_MAX + 1) + '1' + ')'.repeat(FORMULA_DEPTH_MAX + 1)),
    ).toMatchObject({
      error: /Nested/,
    });
  });

  it('lists the fields a tree names, each once', () => {
    const tree = parseFormula('if(A > B, A, -{C}) + concat(B)');
    expect('error' in tree ? [] : refsOf(tree).map((r) => r.name)).toEqual(['A', 'B', 'C']);
  });
});

describe('evaluate', () => {
  const day = (s: string) => dateOf(s)!;

  it('does sums, treating blank as 0', () => {
    expect(run('Budget - Spent', { Budget: 5000, Spent: null })).toBe(5000);
    expect(run('Estimate * Rate', { Estimate: 3, Rate: 120 })).toBe(360);
    expect(run('1 / 4')).toBe(0.25);
    expect(run('-A', { A: null })).toBe(0);
  });

  it('refuses what a sum cannot take', () => {
    expect(run('1 / 0')).toEqual({ error: 'Divides by 0' });
    expect(run('"a" + 1')).toEqual({ error: 'Join text with concat()' });
    expect(run('"a" - 1')).toEqual({ error: "Text can't be taken away" });
    expect(run('true * 2')).toEqual({ error: 'Expected a number, got true or false' });
    expect(run('A * 2', { A: { list: ['x'], field: 'Reviewers' } })).toEqual({
      error: 'Reviewers holds several: count them with len()',
    });
    expect(run('A * A', { A: 1e200 })).toEqual({ error: 'The number is too large' });
    expect(run('-D', { D: day('2026-01-01') })).toEqual({ error: "A date can't be negative" });
  });

  it('works with dates: days between, days added, compared', () => {
    expect(run('Due - Start', { Due: day('2026-11-10'), Start: day('2026-11-01') })).toBe(9);
    expect(run('days(Due - Start)', { Due: day('2026-11-10'), Start: day('2026-11-01') })).toBe(9);
    expect(toText(run('Start + 7', { Start: day('2026-11-01') }) as FormulaValue)).toBe(
      '2026-11-08',
    );
    expect(toText(run('7 + Start', { Start: day('2026-11-01') }) as FormulaValue)).toBe(
      '2026-11-08',
    );
    expect(toText(run('Start - 1', { Start: day('2026-11-01') }) as FormulaValue)).toBe(
      '2026-10-31',
    );
    expect(run('Due > Start', { Due: day('2026-11-10'), Start: day('2026-11-01') })).toBe(true);
    expect(run('A + B', { A: day('2026-11-10'), B: day('2026-11-01') })).toMatchObject({
      error: /can't be added/,
    });
    expect(run('1 - D', { D: day('2026-11-10') })).toMatchObject({ error: /taken from a number/ });
  });

  it('days() counts from today, today() is the reader’s day', () => {
    expect(run('days(Due)', { Due: day('2026-11-03') })).toBe(3);
    expect(run('days(Due)', { Due: day('2026-10-30') })).toBe(-1);
    expect(run('days(5)')).toBe(5);
    expect(run('days(A)', { A: null })).toBe(null);
    expect(toText(run('today()') as FormulaValue)).toBe('2026-10-31');
  });

  it('compares text ignoring case, blank as the other side’s empty', () => {
    expect(run('Stage = "won"', { Stage: 'Won' })).toBe(true);
    expect(run('"a" < "B"')).toBe(true);
    expect(run('"b" > "A"')).toBe(true);
    expect(run('A = 0', { A: null })).toBe(true);
    expect(run('A = ""', { A: null })).toBe(true);
    expect(run('A = false', { A: null })).toBe(true);
    expect(run('A = B', { A: null, B: null })).toBe(true);
    expect(run('A = D', { A: null, D: day('2026-01-01') })).toBe(false);
    expect(run('true > false')).toBe(true);
    expect(run('1 = "1"')).toBe(false);
    expect(run('1 != "1"')).toBe(true);
    expect(run('1 < "1"')).toEqual({ error: "Can't compare a number with text" });
    expect(run('1 <= 1')).toBe(true);
    expect(run('2 >= 3')).toBe(false);
  });

  it('runs every function', () => {
    expect(run('round(2.5)')).toBe(3);
    expect(run('round(-2.5)')).toBe(-3);
    expect(run('round(1.005, 2)')).toBe(1.01);
    expect(run('round(0.0000001, 2)')).toBe(0);
    expect(run('round(A, 10)', { A: 1e301 })).toBe(1e301);
    expect(run('round(1, 11)')).toEqual({ error: "round's places are 0 to 10" });
    expect(run('round(1, 0.5)')).toMatchObject({ error: /places/ });
    expect(run('min(3, A, 1)', { A: null })).toBe(1);
    expect(run('max(3, 9, 1)')).toBe(9);
    expect(run('max(A)', { A: null })).toBe(null);
    expect(
      toText(run('min(A, B)', { A: day('2026-01-05'), B: day('2026-01-02') }) as FormulaValue),
    ).toBe('2026-01-02');
    expect(run('max(1, D)', { D: day('2026-01-02') })).toMatchObject({ error: /not both/ });
    expect(run('abs(-4)')).toBe(4);
    expect(run('if(Score >= 8, "Strong", "Weak")', { Score: 9 })).toBe('Strong');
    expect(run('if(Score >= 8, "Strong", "Weak")', { Score: 3 })).toBe('Weak');
    expect(run('if(false, 1)')).toBe(null);
    // Only the branch taken is worked out.
    expect(run('if(true, 1, 1 / 0)')).toBe(1);
    expect(run('and(1, "x", true)')).toBe(true);
    expect(run('and(1, 0)')).toBe(false);
    expect(run('or(0, "")')).toBe(false);
    expect(run('or(0, 1 / 1)')).toBe(true);
    expect(run('not(A)', { A: null })).toBe(true);
    expect(run('concat("Q", 3, " ", true, A)', { A: null })).toBe('Q3 Yes');
    expect(run('concat(L)', { L: { list: ['Sam', 'Ana'], field: 'Reviewers' } })).toBe('Sam, Ana');
    expect(run('len(L)', { L: { list: ['Sam', 'Ana'], field: 'Reviewers' } })).toBe(2);
    expect(run('len("héllo")')).toBe(5);
    expect(run('len(A)', { A: null })).toBe(0);
    expect(run('len(4)')).toEqual({ error: 'len counts a list or text, not a number' });
  });

  it('stops at the step budget', () => {
    const tree = parseFormula('1 + 1 + 1');
    expect('error' in tree).toBe(false);
    expect(() =>
      evaluateTree(tree as never, {
        read: () => null,
        today: () => TODAY,
        budget: { left: 3 },
      }),
    ).toThrow(FormulaFail);
  });
});

describe('values', () => {
  it('reads only real days', () => {
    expect(dateOf('2026-02-30')).toBe(null);
    expect(dateOf('2026-1-01')).toBe(null);
    expect(dateOf('20x6-01-01')).toBe(null);
    expect(dateOf('2026')).toBe(null);
    expect(dayText(dateOf('2024-02-29')!)).toBe('2024-02-29');
  });

  it('tests truth and writes text', () => {
    expect([null, 0, '', false, { list: [], field: 'x' }].map(truthy)).toEqual([
      false,
      false,
      false,
      false,
      false,
    ]);
    expect([1, 'a', true, TODAY, { list: [1], field: 'x' }].map(truthy)).toEqual([
      true,
      true,
      true,
      true,
      true,
    ]);
    expect(toText(0.1 + 0.2)).toBe('0.3');
    expect(toText(false)).toBe('No');
    expect(toText(null)).toBe('');
  });
});

describe('functions', () => {
  it('names each function and how many values it takes', () => {
    expect(FUNCTION_NAMES).toEqual([
      'round',
      'min',
      'max',
      'abs',
      'if',
      'and',
      'or',
      'not',
      'days',
      'today',
      'concat',
      'len',
    ]);
    expect(arityText('min')).toBe('1 to 64 values');
    expect(functionNamed('toString')).toBe(undefined);
    expect(functionNamed('constructor')).toBe(undefined);
  });
});

describe('names and ids', () => {
  const type = {
    fields: [
      'title',
      'status',
      'estimate',
      'due',
      'f-budget',
      'f-spent',
      'f-pic',
      'f-if',
      'f-odd',
      'f-points',
    ],
    custom: [
      { id: 'f-budget', label: 'Budget', kind: 'currency' as const },
      { id: 'f-spent', label: 'Money Spent', kind: 'currency' as const },
      { id: 'f-pic', label: 'Photo', kind: 'image' as const },
      { id: 'f-if', label: 'If', kind: 'text' as const },
      { id: 'f-odd', label: 'Done (%)', kind: 'number' as const },
      // A custom field's name wins over a built-in's other name.
      { id: 'f-points', label: 'Points', kind: 'number' as const },
      // Not offered by the type.
      { id: 'f-old', label: 'Old', kind: 'number' as const },
    ],
  };
  const scope = formulaScopeOf(type);

  it('lists what a formula may read, in the type’s order, Number and Type last', () => {
    expect(scope.fields.map((f) => f.name)).toEqual([
      'Title',
      'Estimate',
      'Due Date',
      'Budget',
      'Money Spent',
      'If',
      'Done (%)',
      'Points',
      'Number',
      'Type',
    ]);
    expect(formulaScopeOf(type)).toBe(scope);
    expect(scope.byName.get('points')).toBe('f-points');
    expect(scope.byName.get('due')).toBe('due');
    expect(scope.byName.get('start')).toBe(undefined);
  });

  it('stores names as ids and shows ids as names', () => {
    const stored = storedFormula('Budget - money spent + {Done (%)} + {If} + Due', scope);
    expect(stored).toEqual({
      ok: true,
      formula: '{f-budget} - {f-spent} + {f-odd} + {f-if} + {due}',
    });
    expect(shownFormula('{f-budget} - {f-spent} + {f-odd} + {f-if} + {due}', scope)).toBe(
      'Budget - Money Spent + {Done (%)} + {If} + Due Date',
    );
  });

  it('shows a field gone from the type so saving it names the problem', () => {
    expect(shownFormula('{f-old} * 2', scope)).toBe('{deleted field} * 2');
    expect(storedFormula('{deleted field} * 2', scope)).toMatchObject({
      ok: false,
      error: 'Unknown field "deleted field" at 1',
    });
    expect(shownFormula('1 +', scope)).toBe('1 +');
  });

  it('refuses an unknown field, an unreadable one, itself, bad syntax and length', () => {
    expect(storedFormula('Budget - Spnt', scope)).toEqual({
      ok: false,
      error: 'Unknown field "Spnt" at 10',
      at: 9,
    });
    expect(storedFormula('len(Photo)', scope)).toMatchObject({
      error: "An Image can't be used in a formula",
    });
    expect(storedFormula('Budget * 2', scope, 'f-budget')).toMatchObject({
      error: "A formula can't read its own field",
    });
    expect(storedFormula('Budget *', scope)).toMatchObject({
      ok: false,
      error: 'Expected a value at 9',
    });
    expect(storedFormula('1'.repeat(FORMULA_MAX + 1), scope)).toMatchObject({
      ok: false,
      at: FORMULA_MAX,
    });
    // Short names that grow past the limit as ids.
    const long = Array.from({ length: 200 }, () => 'If').join('+');
    expect(storedFormula(long, scope)).toMatchObject({ ok: false });
  });

  it('names what a stored formula reads that the type lost', () => {
    expect(missingFieldProblem(['f-budget'], scope)).toBe(null);
    expect(missingFieldProblem(['f-old'], scope)).toBe(
      'Uses a field that was deleted or taken off the type',
    );
    expect(missingFieldProblem(['f-pic'], scope)).toBe("An Image can't be used in a formula");
    expect(missingFieldProblem(['f-budget'], scope, 'f-budget')).toBe(
      "A formula can't read its own field",
    );
  });
});

describe('compileFormula', () => {
  it('parses once per stored text, and keeps the cache bounded', () => {
    const a = compileFormula('{f-a} + today()');
    expect(compileFormula('{f-a} + today()')).toBe(a);
    expect(a).toMatchObject({ ok: true, ids: ['f-a'], usesToday: true });
    expect(compileFormula('-days({f-a}) * (1 = 1)')).toMatchObject({ usesToday: true });
    expect(compileFormula('{f-a} + 1')).toMatchObject({ usesToday: false });
    expect(compileFormula('1 +')).toMatchObject({ ok: false, error: 'Expected a value at 4' });
    expect(compileFormula('1'.repeat(FORMULA_MAX + 1))).toMatchObject({ ok: false });
    for (let i = 0; i < FORMULA_CACHE_MAX + 5; i += 1) compileFormula(`${i}`);
    expect(compileFormula('{f-a} + today()')).not.toBe(a);
  });
});

// Fuzz (docs/specs/026-plan/item-types.md "Formula fields", Safety): random token streams, deep nesting and long
// runs never throw and never hang, whatever they hold.
describe('fuzz', () => {
  // A small seeded generator, so a failure repeats.
  function rng(seed: number) {
    let s = seed >>> 0;
    return () => {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 2 ** 32;
    };
  }
  const PIECES = [
    '1',
    '0',
    '2.5',
    '"x"',
    '""',
    'A',
    'B',
    'L',
    'D',
    '{A}',
    '{',
    '}',
    '(',
    ')',
    ',',
    '+',
    '-',
    '*',
    '/',
    '=',
    '!=',
    '<',
    '<=',
    '>',
    '>=',
    '<>',
    'true',
    'false',
    'round(',
    'min(',
    'max(',
    'abs(',
    'if(',
    'and(',
    'or(',
    'not(',
    'days(',
    'today()',
    'concat(',
    'len(',
    ' ',
    '  ',
    '"',
    '&',
    '%',
    'é',
  ];
  const vars: Record<string, FormulaValue> = {
    A: 3,
    B: null,
    L: { list: ['a', 'b'], field: 'L' },
    D: dateOf('2026-01-01'),
  };

  it('never throws on random token streams (CPU budget)', () => {
    const next = rng(143);
    const spent = cpuMsOf(() => {
      for (let i = 0; i < 5000; i += 1) {
        const n = 1 + Math.floor(next() * 40);
        let src = '';
        for (let j = 0; j < n; j += 1) src += PIECES[Math.floor(next() * PIECES.length)];
        const out = run(src, vars);
        expect(out === null || ['number', 'string', 'boolean', 'object'].includes(typeof out)).toBe(
          true,
        );
      }
    });
    expect(spent).toBeLessThan(cpuBudgetMs(4000));
  });

  it('never throws on random characters', () => {
    const next = rng(7);
    for (let i = 0; i < 2000; i += 1) {
      let src = '';
      const n = Math.floor(next() * 60);
      for (let j = 0; j < n; j += 1) src += String.fromCharCode(32 + Math.floor(next() * 95));
      expect(() => run(src, vars)).not.toThrow();
    }
  });

  it('answers the worst cases at the length limit fast', () => {
    const half = Math.floor(FORMULA_MAX / 2);
    const cases = [
      '('.repeat(FORMULA_MAX),
      'abs('.repeat(250),
      '-'.repeat(FORMULA_MAX - 1) + '1',
      '1+'.repeat(half - 1) + '1',
      ' '.repeat(FORMULA_MAX - 1) + '1',
      'a '.repeat(half),
      '{'.repeat(FORMULA_MAX),
      '"'.repeat(FORMULA_MAX - 1),
      'max(' + '1,'.repeat(half - 3) + '1)',
      'concat(' + 'L,'.repeat(63) + 'L)',
    ];
    const spent = cpuMsOf(() => {
      for (const src of cases) {
        expect(src.length).toBeLessThanOrEqual(FORMULA_MAX);
        expect(() => run(src, vars)).not.toThrow();
      }
    });
    expect(spent).toBeLessThan(cpuBudgetMs(500));
  });
});
