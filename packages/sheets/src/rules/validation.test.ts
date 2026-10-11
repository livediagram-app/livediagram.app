// Validation rules (docs/specs/029-sheets/data-validation.md): what each rule allows, its line, and how a write is
// checked against the rules, by the editor and the api.
import { describe, expect, it } from 'vitest';
import { applySheetWrite, inverseSheetWrite, type SheetWrite } from '../store';
import { validateWrite, validateSheetCreate } from '../validate';
import { book, makeSheets } from '../testing/book';
import type { CellInput, Sheet, ValidationRule } from '../sheet';
import {
  checkboxValue,
  inputAllowed,
  inputForRule,
  isEmail,
  isUrl,
  optionFor,
  rangeOptions,
  ruleLine,
  ruleMessage,
  scalarAllowed,
  validationRuleAt,
  valueInvalid,
  writeForRules,
} from './validation';
import { resetSheetWrite } from '../sheet-starters';

const by = { id: 'p', name: 'P', color: '#000000' };
const R = (i: number) => `s0r${i}`;
const C = (i: number) => `s0c${i}`;
const base = (): Sheet => makeSheets({ 'Sheet 1': {} }, { rows: 10, cols: 4 })[0]!;
const rule = (x: Partial<ValidationRule>, r1 = 1, c1 = 1, r2 = 5, c2 = c1): ValidationRule =>
  ({
    id: 'rule01',
    r1: R(r1),
    c1: C(c1),
    r2: R(r2),
    c2: C(c2),
    is: 'check',
    ...x,
  }) as ValidationRule;
const setRule = (r: ValidationRule): SheetWrite => ({
  kind: 'layout',
  changes: [{ k: 'vrule', id: r.id, rule: r }],
});
const apply = (s: Sheet, w: SheetWrite) => applySheetWrite(s, w, { now: 1, by }).sheet;
const ctx = (s: Sheet) => ({ locale: 'en-GB', layout: s.layout });
const cell = (r: number, c: number, i: CellInput): SheetWrite => ({
  kind: 'cells',
  cells: [{ r: R(r), c: C(c), i }],
});

const LIST = rule({
  is: 'list',
  opts: [{ v: 'To Do' }, { v: 'Doing', c: '#fde68a' }, { v: 'Done' }],
});

describe('what each rule allows', () => {
  const s = apply(base(), setRule(LIST));
  const x = ctx(s);
  it('a dropdown allows its options, case aside, and offers each in its own spelling', () => {
    expect(scalarAllowed(LIST, 'done', x)).toBe(true);
    expect(scalarAllowed(LIST, 'Blocked', x)).toBe(false);
    expect(optionFor(LIST, 'DOING')?.c).toBe('#fde68a');
    expect(inputForRule(LIST, { s: 'done' })).toEqual({ s: 'Done' });
    expect(inputForRule(LIST, { s: 'nope' })).toEqual({ s: 'nope' });
    const nums = rule({ is: 'list', opts: [{ v: '1' }, { v: '2' }, { v: 'TRUE' }] });
    expect(scalarAllowed(nums, 2, x)).toBe(true);
    expect(scalarAllowed(nums, 3, x)).toBe(false);
    expect(scalarAllowed(nums, true, x)).toBe(true);
  });
  it('a checkbox allows TRUE and FALSE, and reads 1, 0, "true" and "false" as them', () => {
    const r = rule({ is: 'check' });
    expect(scalarAllowed(r, true, x)).toBe(true);
    expect(scalarAllowed(r, 'yes', x)).toBe(false);
    expect(inputForRule(r, { n: 1 })).toEqual({ b: true });
    expect(inputForRule(r, { n: 0 })).toEqual({ b: false });
    expect(inputForRule(r, { s: ' False ' })).toEqual({ b: false });
    expect(inputForRule(r, { n: 2 })).toEqual({ n: 2 });
    expect(checkboxValue(null)).toBeNull();
    expect(checkboxValue('')).toBeNull();
    expect(checkboxValue(true)).toBe(true);
    expect(checkboxValue(3)).toBeUndefined();
  });
  it('number rules meet their condition', () => {
    const cases: [ValidationRule['op'], number, number | undefined, number, boolean][] = [
      ['between', 1, 10, 5, true],
      ['between', 10, 1, 11, false],
      ['notBetween', 1, 10, 11, true],
      ['gt', 5, undefined, 5, false],
      ['gte', 5, undefined, 5, true],
      ['lt', 5, undefined, 4, true],
      ['lte', 5, undefined, 6, false],
      ['eq', 5, undefined, 5, true],
      ['neq', 5, undefined, 5, false],
    ];
    for (const [op, a, b, n, ok] of cases)
      expect(scalarAllowed(rule({ is: 'num', op, a, b }), n, x), `${op} ${n}`).toBe(ok);
    expect(scalarAllowed(rule({ is: 'num', op: 'gt', a: 1 }), 'ten', x)).toBe(false);
  });
  it('date rules compare days and keep to real dates', () => {
    const d = 46300; // a day
    expect(scalarAllowed(rule({ is: 'date', op: 'valid' }), d + 0.5, x)).toBe(true);
    expect(scalarAllowed(rule({ is: 'date', op: 'valid' }), 0, x)).toBe(false);
    expect(scalarAllowed(rule({ is: 'date', op: 'valid' }), 9e6, x)).toBe(false);
    expect(scalarAllowed(rule({ is: 'date', op: 'on', a: d }), d + 0.9, x)).toBe(true);
    expect(scalarAllowed(rule({ is: 'date', op: 'before', a: d }), d, x)).toBe(false);
    expect(scalarAllowed(rule({ is: 'date', op: 'onOrBefore', a: d }), d + 0.2, x)).toBe(true);
    expect(scalarAllowed(rule({ is: 'date', op: 'after', a: d }), d + 1, x)).toBe(true);
    expect(scalarAllowed(rule({ is: 'date', op: 'onOrAfter', a: d }), d - 1, x)).toBe(false);
    expect(scalarAllowed(rule({ is: 'date', op: 'between', a: d, b: d + 2 }), d + 1, x)).toBe(true);
    expect(scalarAllowed(rule({ is: 'date', op: 'notBetween', a: d, b: d + 2 }), d + 1, x)).toBe(
      false,
    );
  });
  it('text rules read text, numbers as shown, and never true/false', () => {
    expect(scalarAllowed(rule({ is: 'text', op: 'contains', a: 'REF' }), 'my ref 1', x)).toBe(true);
    expect(scalarAllowed(rule({ is: 'text', op: 'notContains', a: 'x' }), 'box', x)).toBe(false);
    expect(scalarAllowed(rule({ is: 'text', op: 'exactly', a: 'Yes' }), 'yes', x)).toBe(true);
    expect(scalarAllowed(rule({ is: 'text', op: 'contains', a: '12' }), 1234, x)).toBe(true);
    expect(scalarAllowed(rule({ is: 'text', op: 'contains', a: 'T' }), true, x)).toBe(false);
    expect(scalarAllowed(rule({ is: 'text', op: 'email' }), 'a@b.co', x)).toBe(true);
    expect(isEmail('a b@c.d')).toBe(false);
    expect(isUrl('https://livediagram.app/help')).toBe(true);
    expect(isUrl('livediagram.app')).toBe(true);
    expect(isUrl('not a url')).toBe(false);
    expect(scalarAllowed(rule({ is: 'text', op: 'url' }), 'nope', x)).toBe(false);
  });
  it('reads an email by its one @ and a dot inside the domain, in linear time', () => {
    expect(['a@b.c', ' a@b.co.uk ', 'a@.b.c', 'a@b..c'].map(isEmail)).toEqual([
      true,
      true,
      true,
      true,
    ]);
    expect(['@b.c', 'a@b.', 'a@.b', 'a@bc', 'a@b@c.d', 'a@b.c d', 'a@', ''].map(isEmail)).toEqual([
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      false,
    ]);
    // A dotted run the old pattern backtracked over quadratically (seconds at this length).
    const text = `!@!.${'!.'.repeat(20_000)}@`;
    const t0 = performance.now();
    expect(isEmail(text)).toBe(false);
    expect(performance.now() - t0).toBeLessThan(50);
  });
  it('a formula, an empty value and an error are never refused as typed', () => {
    expect(inputAllowed(LIST, { f: { t: '1', r: [] } }, x)).toBe(true);
    expect(inputAllowed(LIST, { s: '' }, x)).toBe(true);
    expect(scalarAllowed(LIST, { e: '#N/A' }, x)).toBe(true);
    expect(valueInvalid(LIST, null, '', x)).toBe(false);
    expect(valueInvalid(LIST, 'Nope', 'Nope', x)).toBe(true);
  });
});

describe('a dropdown from a range', () => {
  const b = book(
    { A1: 'Red', A2: 'Green', A3: 'red', A4: '', A5: '12', B1: '=A1' },
    { rows: 10, cols: 4 },
  );
  const src = { r1: R(0), c1: C(0), r2: R(4), c2: C(0) };
  const r = rule({ is: 'range', src }, 0, 2, 9, 2);
  it('offers the range values, distinct and empty aside', () => {
    const opts = rangeOptions(b.wb, b.sheets[0]!.id, r);
    expect(opts.map((o) => o.shown)).toEqual(['Red', 'Green', '12']);
  });
  it('is checked by the editor and let through by the api, which cannot work it out', () => {
    const layout = b.sheets[0]!.layout;
    const rangeValues = () => rangeOptions(b.wb, b.sheets[0]!.id, r);
    expect(scalarAllowed(r, 'green', { locale: 'en-GB', layout, rangeValues })).toBe(true);
    expect(scalarAllowed(r, 12, { locale: 'en-GB', layout, rangeValues })).toBe(true);
    expect(scalarAllowed(r, 'Blue', { locale: 'en-GB', layout, rangeValues })).toBe(false);
    expect(scalarAllowed(r, 'Blue', { locale: 'en-GB', layout })).toBe(true);
    expect(ruleLine(r, { locale: 'en-GB', layout })).toBe('Choose one of the values in A1:A5');
  });
  it('offers nothing when its range is gone', () => {
    expect(rangeOptions(b.wb, b.sheets[0]!.id, { ...r, src: undefined })).toEqual([]);
    expect(rangeOptions(b.wb, 'nope', r)).toEqual([]);
  });
});

describe('the lines', () => {
  const layout = base().layout;
  const x = { locale: 'en-GB', layout };
  it('names what is allowed', () => {
    const many = rule({ is: 'list', opts: 'ABCDEFGH'.split('').map((v) => ({ v })) });
    expect(ruleLine(many, x)).toBe(
      "Choose one of the dropdown's options: A, B, C, D, E, and 3 more",
    );
    expect(ruleLine(LIST, x)).toBe("Choose one of the dropdown's options: To Do, Doing, Done");
    expect(ruleLine(rule({ is: 'check' }), x)).toBe('This cell is a checkbox: type TRUE or FALSE');
    expect(ruleLine(rule({ is: 'num', op: 'between', a: 1, b: 10 }), x)).toBe(
      'Enter a number between 1 and 10',
    );
    expect(ruleLine(rule({ is: 'num', op: 'notBetween', a: 1, b: 2 }), x)).toMatch(/not between/);
    expect(ruleLine(rule({ is: 'num', op: 'gte', a: 5 }), x)).toBe(
      'Enter a number greater than or equal to 5',
    );
    expect(ruleLine(rule({ is: 'date', op: 'valid' }), x)).toBe('Enter a date');
    expect(ruleLine(rule({ is: 'date', op: 'after', a: 46296 }), x)).toBe(
      'Enter a date after 01/10/2026',
    );
    expect(ruleLine(rule({ is: 'date', op: 'between', a: 46296, b: 46297 }), x)).toMatch(/between/);
    expect(ruleLine(rule({ is: 'date', op: 'notBetween', a: 46296, b: 46297 }), x)).toMatch(
      /not between/,
    );
    expect(ruleLine(rule({ is: 'text', op: 'contains', a: 'ref' }), x)).toBe(
      'Enter text that contains “ref”',
    );
    expect(ruleLine(rule({ is: 'text', op: 'notContains', a: 'x' }), x)).toMatch(
      /does not contain/,
    );
    expect(ruleLine(rule({ is: 'text', op: 'exactly', a: 'x' }), x)).toBe('Enter exactly “x”');
    expect(ruleLine(rule({ is: 'text', op: 'email' }), x)).toBe('Enter an email address');
    expect(ruleLine(rule({ is: 'text', op: 'url' }), x)).toBe('Enter a web address');
    expect(ruleLine(rule({ is: 'range' }), x)).toBe('Choose one of the listed values');
  });
  it('says the Help Text instead, when there is one', () => {
    expect(ruleMessage({ ...LIST, help: 'Pick a status' }, x)).toBe('Pick a status');
    expect(ruleMessage({ ...LIST, help: '  ' }, x)).toMatch(/options/);
  });
});

describe('checking writes', () => {
  const ruled = apply(base(), setRule(LIST));
  it('finds the rule covering a cell', () => {
    expect(validationRuleAt(ruled.layout, 3, 1)?.id).toBe('rule01');
    expect(validationRuleAt(ruled.layout, 3, 2)).toBeNull();
    expect(validationRuleAt(base().layout, 3, 1)).toBeNull();
  });
  it('refuses a value a Reject rule does not allow, naming the cell and the line', () => {
    const v = validateWrite(ruled, cell(2, 1, { s: 'Blocked' }));
    expect(v).toMatchObject({ ok: false, error: 'value_invalid', at: `${R(2)}:${C(1)}` });
    expect(v.ok ? '' : v.line).toMatch(/To Do, Doing, Done/);
    expect(validateWrite(ruled, cell(2, 1, { s: 'Done' })).ok).toBe(true);
    expect(validateWrite(ruled, cell(2, 1, { s: 'done' })).ok).toBe(true);
    expect(validateWrite(ruled, cell(2, 2, { s: 'anything' })).ok).toBe(true);
    expect(validateWrite(ruled, { kind: 'cells', cells: [{ r: R(2), c: C(1), i: null }] }).ok).toBe(
      true,
    );
  });
  it('stores an undo, an import or a sync as it is, and a Warn rule never refuses', () => {
    expect(validateWrite(ruled, cell(2, 1, { s: 'Blocked' }), { checkRules: false }).ok).toBe(true);
    const warn = apply(base(), setRule({ ...LIST, warn: true }));
    expect(validateWrite(warn, cell(2, 1, { s: 'Blocked' })).ok).toBe(true);
  });
  it('checks cells a layout write carries, against the layout it leaves', () => {
    const w: SheetWrite = {
      kind: 'layout',
      changes: [{ k: 'vrule', id: LIST.id, rule: LIST }],
      cells: [{ r: R(2), c: C(1), i: { s: 'Nope' } }],
    };
    expect(validateWrite(base(), w)).toMatchObject({ ok: false, error: 'value_invalid' });
  });
  it('checks a range dropdown only when the editor gives its values', () => {
    const r = rule({ is: 'range', src: { r1: R(0), c1: C(0), r2: R(0), c2: C(0) } });
    const s = apply(base(), setRule(r));
    expect(validateWrite(s, cell(2, 1, { s: 'x' })).ok).toBe(true);
    const rangeValues = () => [{ value: 'y', shown: 'y' }];
    expect(validateWrite(s, cell(2, 1, { s: 'x' }), { rangeValues }).ok).toBe(false);
  });
});

describe('rules in the layout', () => {
  it('are set, replaced in place, removed and undone', () => {
    const s = apply(base(), setRule(LIST));
    expect(s.layout.rules).toEqual([LIST]);
    const other = rule({ id: 'rule02', is: 'check' }, 6, 0, 8, 0);
    const two = apply(s, setRule(other));
    const edited = { ...LIST, opts: [{ v: 'A' }] };
    const r = applySheetWrite(two, setRule(edited), { now: 1, by });
    expect(r.sheet.layout.rules!.map((x) => x.id)).toEqual(['rule01', 'rule02']);
    expect(r.sheet.layout.rules![0]!.opts).toEqual([{ v: 'A' }]);
    const back = apply(r.sheet, inverseSheetWrite(two, r));
    expect(back.layout.rules).toEqual(two.layout.rules);
    const gone = applySheetWrite(
      two,
      { kind: 'layout', changes: [{ k: 'vrule', id: 'rule01', rule: null }] },
      { now: 1, by },
    );
    expect(gone.sheet.layout.rules!.map((x) => x.id)).toEqual(['rule02']);
    expect(
      apply(gone.sheet, inverseSheetWrite(two, gone)).layout.rules!.map((x) => x.id),
    ).toContain('rule01');
    const none = apply(gone.sheet, {
      kind: 'layout',
      changes: [{ k: 'vrule', id: 'rule02', rule: null }],
    });
    expect(none.layout.rules).toBeUndefined();
  });
  it('shrink with deleted rows, go with all their cells, and come back with the undo', () => {
    const r = rule({ is: 'range', src: { r1: R(8), c1: C(0), r2: R(9), c2: C(0) } }, 1, 1, 3, 1);
    const s = apply(base(), setRule(r));
    const del = applySheetWrite(
      s,
      { kind: 'layout', changes: [{ k: 'deleteRows', ids: [R(1)] }] },
      { now: 1, by },
    );
    expect(del.sheet.layout.rules![0]).toMatchObject({ r1: R(2), r2: R(3) });
    expect(apply(del.sheet, inverseSheetWrite(s, del)).layout.rules![0]).toEqual(r);
    const all = applySheetWrite(
      s,
      { kind: 'layout', changes: [{ k: 'deleteRows', ids: [R(1), R(2), R(3)] }] },
      { now: 1, by },
    );
    expect(all.sheet.layout.rules).toBeUndefined();
    expect(apply(all.sheet, inverseSheetWrite(s, all)).layout.rules).toEqual([r]);
    // The source going takes the rule with it.
    const src = applySheetWrite(
      s,
      { kind: 'layout', changes: [{ k: 'deleteRows', ids: [R(8), R(9)] }] },
      { now: 1, by },
    );
    expect(src.sheet.layout.rules).toBeUndefined();
  });
  it('are refused when malformed, past the limit, or off the sheet', () => {
    const s = base();
    const bad = (x: unknown) =>
      validateWrite(s, {
        kind: 'layout',
        changes: [{ k: 'vrule', id: 'rule01', rule: x as ValidationRule }],
      }).ok;
    expect(bad(LIST)).toBe(true);
    expect(bad({ ...LIST, opts: [] })).toBe(false);
    expect(bad({ ...LIST, opts: [{ v: 'a' }, { v: 'A' }] })).toBe(false);
    expect(bad({ ...LIST, opts: [{ v: 'a', c: 'red' }] })).toBe(false);
    expect(bad({ ...LIST, opts: [{ v: 'x'.repeat(256) }] })).toBe(false);
    expect(bad({ ...LIST, id: 'other1' })).toBe(false);
    expect(bad({ ...LIST, r1: 'gone01' })).toBe(false);
    expect(bad({ ...LIST, show: 'arrow' })).toBe(true);
    expect(bad({ ...LIST, show: 'big' })).toBe(false);
    expect(bad({ ...LIST, extra: 1 })).toBe(false);
    expect(bad({ ...LIST, help: 'x'.repeat(256) })).toBe(false);
    expect(bad({ ...LIST, warn: false })).toBe(false);
    expect(bad(rule({ is: 'check', show: 'arrow' }))).toBe(false);
    expect(bad(rule({ is: 'check', a: 1 }))).toBe(false);
    expect(bad(rule({ is: 'num', op: 'gt', a: 1 }))).toBe(true);
    expect(bad(rule({ is: 'num', op: 'gt', a: 1, b: 2 }))).toBe(false);
    expect(bad(rule({ is: 'num', op: 'between', a: 1 }))).toBe(false);
    expect(bad(rule({ is: 'num', op: 'valid' }))).toBe(false);
    expect(bad(rule({ is: 'date', op: 'valid' }))).toBe(true);
    expect(bad(rule({ is: 'date', op: 'valid', a: 1 }))).toBe(false);
    expect(bad(rule({ is: 'text', op: 'contains', a: 'x' }))).toBe(true);
    expect(bad(rule({ is: 'text', op: 'contains' }))).toBe(false);
    expect(bad(rule({ is: 'text', op: 'email' }))).toBe(true);
    expect(bad(rule({ is: 'text', op: 'email', a: 'x' }))).toBe(false);
    expect(bad(rule({ is: 'range' }))).toBe(false);
    expect(bad(rule({ is: 'range', src: { r1: R(0), c1: C(0), r2: R(0), c2: C(0) } }))).toBe(true);
    expect(
      bad(
        rule({
          is: 'list' as never,
          opts: [{ v: 'a' }],
          src: { r1: R(0), c1: C(0), r2: R(0), c2: C(0) },
        }),
      ),
    ).toBe(false);
    expect(bad({ ...rule({ is: 'nope' as never }) })).toBe(false);
    expect(bad(null)).toBe(true);
    const ids = Array.from({ length: 200 }, (_, i) => `r${String(i).padStart(5, '0')}`);
    const s100: Sheet = {
      ...s,
      layout: { ...s.layout, rules: ids.map((id) => rule({ id }, 0, 0, 0, 0)) },
    };
    expect(s100.layout.rules).toHaveLength(200);
    const more = validateWrite(s100, setRule(rule({ id: 'zzzzzz' })));
    expect(more).toMatchObject({ ok: false, error: 'rules_full' });
  });
  it('travel with a copied sheet and go with Clear Sheet', () => {
    const s = apply(base(), setRule(LIST));
    expect(validateSheetCreate(s).ok).toBe(true);
    expect(
      validateSheetCreate({ ...s, layout: { ...s.layout, rules: [{ ...LIST, opts: [] }] } }).ok,
    ).toBe(false);
    expect(apply(s, resetSheetWrite(s)).layout.rules).toBeUndefined();
  });
});

describe('a write as its rules take it', () => {
  it('saves options in their own spelling and checkbox numbers as TRUE or FALSE, leaving the rest', () => {
    const s = apply(
      apply(base(), setRule(LIST)),
      setRule(rule({ id: 'rule02', is: 'check' }, 1, 2, 5, 2)),
    );
    const w: SheetWrite = {
      kind: 'cells',
      cells: [
        { r: R(1), c: C(1), i: { s: 'doing' } },
        { r: R(1), c: C(2), i: { n: 1 } },
        { r: R(2), c: C(2), i: { s: 'FALSE ' } },
        { r: R(1), c: C(3), i: { s: 'free' } },
        { r: R(2), c: C(1), i: null },
        { r: 'gone01', c: C(1), i: { s: 'x' } },
      ],
    };
    const out = writeForRules(s.layout, w);
    expect(out.kind === 'cells' && out.cells.map((ch) => ch.i)).toEqual([
      { s: 'Doing' },
      { b: true },
      { b: false },
      { s: 'free' },
      null,
      { s: 'x' },
    ]);
    // Nothing to change: the same write.
    const same: SheetWrite = { kind: 'cells', cells: [{ r: R(1), c: C(1), i: { s: 'Done' } }] };
    expect(writeForRules(s.layout, same)).toBe(same);
    expect(writeForRules(base().layout, w)).toBe(w);
    expect(writeForRules(s.layout, { kind: 'title', title: 'x' })).toEqual({
      kind: 'title',
      title: 'x',
    });
  });
});
