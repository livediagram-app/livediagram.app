// Format rules (docs/specs/029-sheets/conditional-formatting.md): conditions, custom formulas, colour scales, list
// order, the layout changes and their undo, validation, the static render, and the drawing budget.
import { describe, expect, it } from 'vitest';
import { cpuMsOf } from '@livepages/vitest-config/cpu-time';
import { applySheetWrite, inverseSheetWrite, type SheetWrite } from '../store';
import { validateWrite, validateSheetCreate } from '../validate';
import { compileFormula } from '../formula/stored';
import { book, makeSheets } from '../testing/book';
import { renderWindow } from '../engine/render';
import { resetSheetWrite } from '../sheet-starters';
import type { FormatRule, Sheet } from '../sheet';
import type { Value } from '../formula/values';
import {
  conditionValues,
  formatRuleLine,
  formatRuleStyle,
  formatRulesAt,
  mixColour,
  percentileOf,
  scaleColour,
} from './format-rules';

// A scalar as the shown text the rules read; an error or an array shows nothing here.
const shownOf = (v: Value): string =>
  typeof v === 'number' || typeof v === 'string' || typeof v === 'boolean' ? String(v) : '';

const by = { id: 'p', name: 'P', color: '#000000' };
const R = (i: number) => `s0r${i}`;
const C = (i: number) => `s0c${i}`;
const apply = (s: Sheet, w: SheetWrite) => applySheetWrite(s, w, { now: 1, by }).sheet;
const fr = (x: Partial<FormatRule>, r1 = 0, c1 = 0, r2 = 9, c2 = 0): FormatRule => ({
  id: 'frule1',
  r1: R(r1),
  c1: C(c1),
  r2: R(r2),
  c2: C(c2),
  is: 'when',
  ...x,
});
const set = (rule: FormatRule, at?: number): SheetWrite => ({
  kind: 'layout',
  changes: [{ k: 'frule', id: rule.id, rule, ...(at === undefined ? {} : { at }) }],
});
const RED = { bg: '#f4c7c3' };
const GREEN = { bg: '#b7e1cd', fc: '#137333' };

// A book whose first sheet carries `rules`.
function ruled(cells: Record<string, string>, rules: FormatRule[]) {
  const b = book(cells, { rows: 10, cols: 4 });
  let sheet = b.sheets[0]!;
  for (const r of rules) sheet = apply(sheet, set(r));
  b.sheets[0] = sheet;
  b.wb.updateSheet(sheet);
  const style = (r: number, c = 0) => {
    const v = b.wb.value(sheet.id, r, c);
    return formatRuleStyle(b.wb, sheet.id, r, c, v, shownOf(v));
  };
  return { b, sheet, style };
}

describe('single colour', () => {
  it('draws the cells that meet the condition', () => {
    const { style } = ruled({ A1: '50', A2: '150', A3: 'text' }, [
      fr({ op: 'gt', a: '100', style: RED }),
    ]);
    expect(style(0)).toBeNull();
    expect(style(1)).toEqual(RED);
    expect(style(2)).toBeNull();
    expect(style(0, 3)).toBeNull();
  });
  it('the first met rule in list order wins', () => {
    const { style } = ruled({ A1: '150', A2: '5' }, [
      fr({ id: 'first1', op: 'gt', a: '100', style: RED }),
      fr({ id: 'second', op: 'notEmpty', style: GREEN }),
    ]);
    expect(style(0)).toEqual(RED);
    expect(style(1)).toEqual(GREEN);
  });
  it('a custom formula is moved for each cell, and an error or text meets nothing', () => {
    const b0 = book({}, { rows: 10, cols: 4 });
    const fx = compileFormula('=$B1>10', b0.wb.ctxFor(b0.sheets[0]!.id));
    if (!fx.ok) throw new Error('compile');
    const { style } = ruled({ A1: 'a', A2: 'b', A3: 'c', B1: '5', B2: '20', B3: '=1/0' }, [
      fr({ op: 'formula', fx: fx.formula, style: GREEN }),
    ]);
    expect(style(0)).toBeNull();
    expect(style(1)).toEqual(GREEN);
    expect(style(2)).toBeNull();
  });
  it('skips an error value and a rule with no style', () => {
    const { style } = ruled({ A1: '=1/0' }, [
      fr({ op: 'notEmpty' }),
      fr({ id: 'two222', op: 'notEmpty', style: RED }),
    ]);
    expect(style(0)).toBeNull();
  });
});

describe('colour scales', () => {
  const scale = (x: Partial<FormatRule>) =>
    fr({ is: 'scale', min: { c: '#ffffff', at: 'min' }, max: { c: '#57bb8a', at: 'max' }, ...x });
  it('shades numbers between the ends, and leaves text and empties', () => {
    const { style } = ruled({ A1: '0', A2: '50', A3: '100', A4: 'x' }, [scale({})]);
    expect(style(0)).toEqual({ bg: '#ffffff' });
    expect(style(2)).toEqual({ bg: '#57bb8a' });
    expect(style(1)).toEqual({ bg: mixColour('#ffffff', '#57bb8a', 0.5) });
    expect(style(3)).toBeNull();
    expect(style(5)).toBeNull();
  });
  it('places points by number, percent and percentile, with a midpoint', () => {
    const sorted = [0, 10, 20, 30, 40];
    const r = scale({
      min: { c: '#000000', at: 'num', v: 10 },
      mid: { c: '#808080', at: 'pct', v: 50 },
      max: { c: '#ffffff', at: 'pctile', v: 75 },
    });
    expect(scaleColour(r, 5, sorted)).toBe('#000000');
    expect(scaleColour(r, 20, sorted)).toBe('#808080');
    expect(scaleColour(r, 30, sorted)).toBe('#ffffff');
    expect(scaleColour(r, 15, sorted)).toBe(mixColour('#000000', '#808080', 0.5));
    expect(scaleColour(r, 25, sorted)).toBe(mixColour('#808080', '#ffffff', 0.5));
    expect(scaleColour({ ...r, min: undefined }, 5, sorted)).toBeNull();
    expect(percentileOf([], 50)).toBe(0);
    expect(percentileOf([1, 2, 3, 4], 50)).toBe(2.5);
  });
  it('one number takes the Minpoint colour', () => {
    const r = scale({});
    expect(scaleColour(r, 7, [7])).toBe('#ffffff');
  });
  it('works its numbers out again after a change', () => {
    const { b, sheet, style } = ruled({ A1: '0', A2: '100' }, [scale({})]);
    expect(style(1)).toEqual({ bg: '#57bb8a' });
    b.set('A3', '200');
    void sheet;
    expect(style(1)).toEqual({ bg: mixColour('#ffffff', '#57bb8a', 0.5) });
  });
});

describe('the list', () => {
  it('inserts at a place, replaces in place, reorders and removes, each undone', () => {
    const base = makeSheets({ 'Sheet 1': {} }, { rows: 10, cols: 4 })[0]!;
    const a = fr({ id: 'aaaaaa', op: 'empty', style: RED });
    const b = fr({ id: 'bbbbbb', op: 'empty', style: RED });
    const c = fr({ id: 'cccccc', op: 'empty', style: RED });
    let s = apply(apply(base, set(a)), set(b));
    s = apply(s, set(c, 0));
    expect(s.layout.formatRules!.map((x) => x.id)).toEqual(['cccccc', 'aaaaaa', 'bbbbbb']);
    const order = applySheetWrite(
      s,
      { kind: 'layout', changes: [{ k: 'fruleOrder', ids: ['bbbbbb', 'cccccc'] }] },
      { now: 1, by },
    );
    expect(order.sheet.layout.formatRules!.map((x) => x.id)).toEqual([
      'bbbbbb',
      'aaaaaa',
      'cccccc',
    ]);
    expect(apply(order.sheet, inverseSheetWrite(s, order)).layout.formatRules).toEqual(
      s.layout.formatRules,
    );
    const gone = applySheetWrite(
      s,
      { kind: 'layout', changes: [{ k: 'frule', id: 'aaaaaa', rule: null }] },
      { now: 1, by },
    );
    expect(gone.sheet.layout.formatRules!.map((x) => x.id)).toEqual(['cccccc', 'bbbbbb']);
    expect(
      apply(gone.sheet, inverseSheetWrite(s, gone)).layout.formatRules!.map((x) => x.id),
    ).toEqual(['cccccc', 'aaaaaa', 'bbbbbb']);
    const edit = applySheetWrite(s, set({ ...a, style: GREEN }), { now: 1, by });
    expect(edit.sheet.layout.formatRules![1]!.style).toEqual(GREEN);
    expect(apply(edit.sheet, inverseSheetWrite(s, edit)).layout.formatRules![1]!.style).toEqual(
      RED,
    );
    expect(
      apply(base, { kind: 'layout', changes: [{ k: 'fruleOrder', ids: [] }] }).layout.formatRules,
    ).toBeUndefined();
    expect(formatRulesAt(base.layout, 0, 0)).toEqual([]);
  });
  it('shrinks with deleted rows and comes back with the undo; Clear Sheet removes them', () => {
    const base = makeSheets({ 'Sheet 1': {} }, { rows: 10, cols: 4 })[0]!;
    const a = fr({ id: 'aaaaaa', op: 'empty', style: RED }, 0, 0, 0, 0);
    const b = fr({ id: 'bbbbbb', op: 'empty', style: RED }, 0, 0, 5, 0);
    const s = apply(apply(base, set(a)), set(b));
    const del = applySheetWrite(
      s,
      { kind: 'layout', changes: [{ k: 'deleteRows', ids: [R(0)] }] },
      { now: 1, by },
    );
    expect(del.sheet.layout.formatRules!.map((x) => [x.id, x.r1])).toEqual([['bbbbbb', R(1)]]);
    expect(apply(del.sheet, inverseSheetWrite(s, del)).layout.formatRules).toEqual(
      s.layout.formatRules,
    );
    expect(apply(s, resetSheetWrite(s)).layout.formatRules).toBeUndefined();
  });
});

describe('what a format rule may be', () => {
  const base = makeSheets({ 'Sheet 1': {} }, { rows: 10, cols: 4 })[0]!;
  const ok = (x: unknown, at?: number) =>
    validateWrite(base, {
      kind: 'layout',
      changes: [
        { k: 'frule', id: 'frule1', rule: x as FormatRule, ...(at === undefined ? {} : { at }) },
      ],
    }).ok;
  const scaleOf = (x: object) =>
    fr({ is: 'scale', min: { c: '#ffffff', at: 'min' }, max: { c: '#000000', at: 'max' }, ...x });
  it('checks conditions, styles, formulas and scale points', () => {
    expect(ok(fr({ op: 'gt', a: '1', style: RED }))).toBe(true);
    expect(ok(fr({ op: 'gt', a: '1', style: RED }), -1)).toBe(false);
    expect(ok(fr({ op: 'gt', a: '1', style: {} }))).toBe(false);
    expect(ok(fr({ op: 'gt', a: '1', style: { bg: 'red' } }))).toBe(false);
    expect(ok(fr({ op: 'gt', a: '1', style: { nf: 'date' } as never }))).toBe(false);
    expect(ok(fr({ op: 'nope' as never, style: RED }))).toBe(false);
    expect(ok(fr({ op: 'gt', a: 'x'.repeat(256), style: RED }))).toBe(false);
    expect(ok(fr({ op: 'gt', a: '1', style: RED, min: { c: '#ffffff', at: 'min' } }))).toBe(false);
    expect(ok(fr({ op: 'formula', fx: { t: '1>0', r: [] }, style: RED }))).toBe(true);
    expect(ok(fr({ op: 'formula', fx: { t: '1>(', r: [] }, style: RED }))).toBe(false);
    expect(ok(fr({ op: 'formula', fx: { t: '@0>1', r: [] }, style: RED }))).toBe(false);
    expect(ok(fr({ op: 'formula', fx: { t: '@0>1', r: [{ r1: 'bad id!' }] }, style: RED }))).toBe(
      false,
    );
    expect(ok(fr({ op: 'formula', fx: { t: 'x'.repeat(1001), r: [] }, style: RED }))).toBe(false);
    expect(ok(fr({ op: 'formula', a: '1', fx: { t: '1', r: [] }, style: RED }))).toBe(false);
    expect(ok(fr({ op: 'gt', a: '1', style: RED, fx: { t: '1', r: [] } }))).toBe(false);
    expect(ok(scaleOf({}))).toBe(true);
    expect(ok(scaleOf({ mid: { c: '#808080', at: 'pctile', v: 50 } }))).toBe(true);
    expect(ok(scaleOf({ mid: { c: '#808080', at: 'min' } }))).toBe(false);
    expect(ok(scaleOf({ mid: { c: '#808080', at: 'pct', v: 101 } }))).toBe(false);
    expect(ok(scaleOf({ min: { c: '#ffffff', at: 'num' } }))).toBe(false);
    expect(ok(scaleOf({ min: { c: '#ffffff', at: 'min', v: 1 } }))).toBe(false);
    expect(ok(scaleOf({ min: { c: '#ffffff', at: 'min', x: 1 } }))).toBe(false);
    expect(ok(scaleOf({ min: { c: '#ffffff', at: 'nope' } }))).toBe(false);
    expect(ok(scaleOf({ style: RED }))).toBe(false);
    expect(ok(fr({ is: 'other' as never }))).toBe(false);
    expect(ok({ ...fr({ op: 'empty', style: RED }), extra: 1 })).toBe(false);
    expect(ok(null)).toBe(true);
    expect(
      validateWrite(base, { kind: 'layout', changes: [{ k: 'fruleOrder', ids: ['bad id'] }] }).ok,
    ).toBe(false);
  });
  it('holds at most the limit, and a copy carries them checked', () => {
    const many: Sheet = {
      ...base,
      layout: {
        ...base.layout,
        formatRules: Array.from({ length: 100 }, (_, i) =>
          fr({ id: `f${String(i).padStart(5, '0')}`, op: 'empty', style: RED }),
        ),
      },
    };
    expect(validateWrite(many, set(fr({ id: 'zzzzzz', op: 'empty', style: RED })))).toMatchObject({
      ok: false,
      error: 'rules_full',
    });
    expect(validateSheetCreate(many).ok).toBe(true);
    expect(
      validateSheetCreate({
        ...base,
        layout: { ...base.layout, formatRules: [fr({ op: 'gt' })] },
      }).ok,
    ).toBe(false);
  });
});

describe('lines', () => {
  it('names each condition', () => {
    expect(formatRuleLine(fr({ op: 'gt', a: '100' }))).toBe('Greater Than 100');
    expect(formatRuleLine(fr({ op: 'between', a: '1', b: '5' }))).toBe('Is Between 1 and 5');
    expect(formatRuleLine(fr({ op: 'empty' }))).toBe('Is Empty');
    expect(formatRuleLine(fr({ op: 'formula' }), '=$C2>100')).toBe('Custom Formula Is =$C2>100');
    expect(formatRuleLine(fr({ is: 'scale' }))).toBe('Colour Scale');
    expect(formatRuleLine(fr({}))).toBe('Is Not Empty');
    expect(conditionValues('notEmpty')).toBe(0);
    expect(conditionValues('formula')).toBe(1);
  });
});

describe('the static render', () => {
  it('draws met styles, checkboxes and chips', () => {
    const b = book(
      { A1: '150', B1: 'TRUE', B2: 'FALSE', C1: 'Done', C2: 'Other' },
      { rows: 4, cols: 4 },
    );
    let sheet = b.sheets[0]!;
    sheet = apply(
      sheet,
      set(fr({ op: 'gt', a: '100', style: { b: true, bg: '#ff0000' } }, 0, 0, 3, 0)),
    );
    sheet = apply(sheet, {
      kind: 'layout',
      changes: [
        {
          k: 'vrule',
          id: 'chk001',
          rule: { id: 'chk001', r1: R(0), c1: C(1), r2: R(3), c2: C(1), is: 'check' },
        },
        {
          k: 'vrule',
          id: 'lst001',
          rule: {
            id: 'lst001',
            r1: R(0),
            c1: C(2),
            r2: R(3),
            c2: C(2),
            is: 'list',
            opts: [{ v: 'Done', c: '#00ff00' }],
          },
        },
        {
          k: 'vrule',
          id: 'arr001',
          rule: {
            id: 'arr001',
            r1: R(0),
            c1: C(3),
            r2: R(0),
            c2: C(3),
            is: 'list',
            opts: [{ v: 'Done' }],
            show: 'arrow',
          },
        },
      ],
    });
    b.wb.updateSheet(sheet);
    const model = renderWindow(b.wb, sheet.id, { width: 500, height: 200 }, 'en-GB')!;
    const at = (r: number, c: number) => model.cells.find((x) => x.r === r && x.c === c);
    expect(at(0, 0)).toMatchObject({ bold: true, fill: '#ff0000' });
    expect(at(0, 1)?.text).toBe('☑');
    expect(at(1, 1)?.text).toBe('☐');
    expect(at(2, 1)?.text).toBe('☐');
    // A chip is a pill in its option's colour, never the cell's fill; a value with no option's colour a plain pill.
    expect(at(0, 2)).toMatchObject({ text: 'Done', chip: { color: '#00ff00' } });
    expect(at(0, 2)?.fill).toBeUndefined();
    expect(at(1, 2)).toMatchObject({ text: 'Other', chip: {} });
    // An arrow dropdown draws its arrow, even empty.
    expect(at(0, 3)).toMatchObject({ text: '', arrow: true });
    expect(at(0, 3)?.chip).toBeUndefined();
  });
});

describe('the drawing budget', () => {
  // Every cell of a 60 × 26 window checks every rule (none met): the worst case. Timed as growth, not as a ceiling
  // (as the other packages' speed tests are): an absolute time depends on the machine and on coverage
  // instrumentation, which once measured 166 ms against about 15 ms locally, while a ratio does not. In CPU time
  // (cpuMsOf), so a busy CI runner waiting for a core does not count. Four times the rules should cost about four
  // times as much; a quadratic step would cost sixteen.
  const GROWTH = 4;
  const RATIO_CEILING = 8;
  const RUNS = 3;
  // The window drawn this many times a pass, so even the small pass measures several ms, well clear of the CPU timer's
  // microseconds. Kept low: under coverage on a busy CI runner 5 runs of 10 overran the test's 5 s timeout (6.8 s).
  const REPEATS = 3;
  // Room for a slow, instrumented runner: the ratio, not the clock, is what fails a slow path.
  const TIMEOUT_MS = 30_000;

  function windowPass(ruleCount: number): number {
    const cells: Record<string, string> = {};
    for (let r = 1; r <= 60; r++) cells[`A${r}`] = String(r);
    const b = book(cells, { rows: 100, cols: 26 });
    let sheet = b.sheets[0]!;
    const rules: FormatRule[] = Array.from({ length: ruleCount }, (_, i) =>
      fr(
        { id: `f${String(i).padStart(5, '0')}`, op: 'gt', a: String(1000 + i), style: RED },
        0,
        0,
        99,
        25,
      ),
    );
    sheet = { ...sheet, layout: { ...sheet.layout, formatRules: rules } };
    b.sheets[0] = sheet;
    b.wb.updateSheet(sheet);
    const pass = () =>
      cpuMsOf(() => {
        for (let n = 0; n < REPEATS; n++)
          for (let r = 0; r < 60; r++)
            for (let c = 0; c < 26; c++) {
              const v = b.wb.value(sheet.id, r, c);
              formatRuleStyle(b.wb, sheet.id, r, c, v, shownOf(v));
            }
      });
    // The fastest of several passes, so a cold first pass never fails a fast path; a slow one fails every pass.
    return Math.min(...Array.from({ length: RUNS }, pass));
  }

  it(
    'a 60 × 26 window under 100 rules on every column costs in step with the rules, not faster',
    () => {
      const small = windowPass(100 / GROWTH);
      const large = windowPass(100);
      // A floor on the small pass, so a timer that rounds a tiny pass to 0 cannot make the ratio infinite.
      expect(large / Math.max(small, 1)).toBeLessThan(RATIO_CEILING);
    },
    TIMEOUT_MS,
  );
});
