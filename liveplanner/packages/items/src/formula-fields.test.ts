import { describe, expect, it } from 'vitest';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import type { PlanBoardSetup } from './board';
import { boardCsvImport, boardCsvRows } from './board-csv';
import { boardSortComparator, boardSortFieldsOf } from './board-sort';
import {
  CALCULATION_LABELS,
  calculatedOutcome,
  calculatedText,
  calculatedValue,
  calculatedValuesOf,
  childIndexOf,
} from './calculated-fields';
import { cardSourceOf } from './card-source';
import {
  FORMULA_ERROR_TEXT,
  formulaOutcome,
  formulaProblem,
  formulaResultOf,
  formulaText,
  formulaValue,
  isFormulaField,
} from './formula-fields';
import { FORMULA_MAX, FORMULA_STEPS_MAX } from './formula/limits';
import type { Item } from './item';
import type { CustomFieldDef, ItemTypeDef } from './item-types';
import { ALI, SAM, item } from './test-items';
import { ITEM_TYPE_CATALOGUE_VERSION, validateItemTypeCatalogue } from './type-catalogue';
import { canShowAsPercent, percentShown, showsAsPercent } from './percent-fields';
import { applyCardTypeChanges } from './type-changes';
import { calculatedWritten } from './write-checks';

// Formula fields (docs/specs/026-plan/item-types.md "Formula fields").

const f = (
  id: string,
  label: string,
  formula: string,
  result?: CustomFieldDef['result'],
  extra: Partial<CustomFieldDef> = {},
): CustomFieldDef => ({
  id,
  label,
  kind: 'calculated',
  calculation: 'formula',
  formula,
  ...(result ? { result } : {}),
  ...extra,
});

const deal: ItemTypeDef = {
  id: 'deal',
  label: 'Deal',
  newTitle: 'New deal',
  glyph: 'task',
  color: '#2563eb',
  fields: [
    'title',
    'status',
    'estimate',
    'start',
    'due',
    'priority',
    'assignee',
    'labels',
    'color',
    'checklist',
    'f-budget',
    'f-spent',
    'f-left',
    'f-share',
    'f-score',
    'f-grade',
    'f-days',
    'f-won',
    'f-close',
    'f-reviewers',
    'f-owner',
    'f-tags',
    'f-stage',
    'f-kids',
    'f-plus',
    'f-loop-a',
    'f-loop-b',
    'f-broken',
    'f-gone-ref',
  ],
  custom: [
    { id: 'f-budget', label: 'Budget', kind: 'currency', currency: 'USD' },
    { id: 'f-spent', label: 'Spent', kind: 'currency' },
    f('f-left', 'Left', '{f-budget} - {f-spent}', 'currency', { currency: 'USD' }),
    f('f-share', 'Share', '{f-spent} / {f-budget} * 100', 'percent'),
    { id: 'f-score', label: 'Score', kind: 'rating', scale: 10 },
    f('f-grade', 'Grade', 'if({f-score} >= 8, "Strong", "Weak")', 'text'),
    f('f-days', 'Length', 'days({due} - {start})'),
    { id: 'f-won', label: 'Won', kind: 'checkbox' },
    f('f-close', 'Close', '{due} + 7', 'date'),
    { id: 'f-reviewers', label: 'Reviewers', kind: 'person', multiple: true },
    { id: 'f-owner', label: 'Owner', kind: 'card', linkType: 'deal' },
    { id: 'f-tags', label: 'Tags', kind: 'multichoice', options: ['a', 'b'] },
    { id: 'f-stage', label: 'Stage', kind: 'choice', options: ['Won', 'Lost'] },
    { id: 'f-kids', label: 'Kids', kind: 'calculated', calculation: 'childCount' },
    // Another formula, read by f-plus.
    f('f-plus', 'Plus', '{f-left} + {f-kids}'),
    f('f-loop-a', 'Loop A', '{f-loop-b} + 1'),
    f('f-loop-b', 'Loop B', '{f-loop-a} + 1'),
    f('f-broken', 'Broken', '1 +'),
    f('f-gone-ref', 'Gone Ref', '{f-deleted} * 2'),
    // Not offered by the type.
    f('f-off', 'Off', '1'),
  ],
};
const types = [deal];
const def = (id: string) => deal.custom!.find((c) => c.id === id)!;
const card = (fields: Item['fields'], extra: Partial<Item> = {}) =>
  item({ title: 'Acme', ...fields }, { type: 'deal', ...extra });
const ctx = { today: '2026-10-31' };

describe('formula fields', () => {
  it('works budget, share, grade, length and close dates out', () => {
    const c = card({
      'f-budget': 5000,
      'f-spent': 2000,
      'f-score': 9,
      start: '2026-11-01',
      due: '2026-11-10',
    });
    expect(formulaValue(def('f-left'), c, deal, ctx)).toBe(3000);
    expect(formulaValue(def('f-share'), c, deal, ctx)).toBe(40);
    expect(formulaValue(def('f-grade'), c, deal, ctx)).toBe('Strong');
    expect(formulaValue(def('f-days'), c, deal, ctx)).toBe(9);
    expect(formulaValue(def('f-close'), c, deal, ctx)).toBe('2026-11-17');
  });

  it('reads blank when every field it reads is empty, 0 for the empty ones otherwise', () => {
    expect(formulaValue(def('f-left'), card({}), deal, ctx)).toBe(null);
    expect(formulaValue(def('f-left'), card({ 'f-budget': 100 }), deal, ctx)).toBe(100);
    // A formula reading no field still works out.
    expect(formulaValue(f('x', 'X', '2 * 3'), card({}), deal, ctx)).toBe(6);
  });

  it('reads each kind and built-in field as the spec says', () => {
    const owner = card({ title: 'Parent deal' });
    const items = new Map([[owner.id, owner]]);
    const c = card({
      estimate: 5,
      priority: 'high',
      assignee: SAM,
      labels: ['x', 'y'],
      color: '#ff0000',
      checklist: [{ text: 'one', done: true }, { text: 'two' }],
      'f-reviewers': [SAM, ALI],
      'f-owner': owner.id,
      'f-tags': ['a'],
      'f-stage': 'Won',
      'f-won': true,
    });
    const v = (formula: string, result?: CustomFieldDef['result']) =>
      formulaValue(f('x', 'X', formula, result), c, deal, { ...ctx, items });
    expect(v('{estimate} * 2')).toBe(10);
    expect(v('{priority}', 'text')).toBe('High');
    expect(v('{assignee}', 'text')).toBe('Sam Lee');
    expect(v('len({labels})')).toBe(2);
    expect(v('{color}', 'text')).toBe('#ff0000');
    expect(v('concat({checklist})', 'text')).toBe('one, two');
    expect(v('len({f-reviewers})')).toBe(2);
    expect(v('concat({f-reviewers})', 'text')).toBe('Sam Lee, Ali');
    expect(v('{f-owner}', 'text')).toBe(`#${owner.key} Parent deal`);
    expect(v('len({f-tags})')).toBe(1);
    expect(v('{f-stage} = "won"', 'checkbox')).toBe(true);
    expect(v('if({f-won}, 1, 0)')).toBe(1);
    expect(v('{#key}')).toBe(c.key);
    expect(v('{#type}', 'text')).toBe('Deal');
    expect(v('{title}', 'text')).toBe('Acme');
    // A Card field whose card is gone, or with no cards to look in.
    expect(formulaValue(f('x', 'X', '{f-owner}', 'text'), c, deal, ctx)).toBe('Missing card');
  });

  it('reads a single Person or Card value as one, and a list misused is an error naming the field', () => {
    const one: ItemTypeDef = {
      ...deal,
      custom: [
        { id: 'f-rev', label: 'Rev', kind: 'person' },
        { id: 'f-link', label: 'Link', kind: 'card', linkType: 'deal' },
        { id: 'f-many', label: 'Many', kind: 'person', multiple: true },
        { id: 'f-cards', label: 'Cards', kind: 'card', linkType: 'deal', multiple: true },
        { id: 'f-other', label: 'Other', kind: 'text' },
        { id: 'f-num-text', label: 'NumText', kind: 'text' },
      ],
      fields: ['title', 'status', 'f-rev', 'f-link', 'f-many', 'f-cards', 'f-other', 'f-num-text'],
    };
    const c = item(
      {
        'f-rev': [SAM, ALI],
        'f-many': SAM,
        'f-cards': ['x', 'y'],
        'f-other': ['p', 'q'],
        'f-num-text': 4,
      },
      { type: 'deal' },
    );
    const o = (formula: string, result?: CustomFieldDef['result']) =>
      formulaOutcome(f('x', 'X', formula, result), c, one, ctx);
    expect(o('{f-rev}', 'text')).toEqual({ ok: true, value: 'Sam Lee' });
    expect(o('{f-link}', 'text')).toEqual({ ok: true, value: null });
    expect(o('len({f-many})')).toEqual({ ok: true, value: 1 });
    expect(o('len({f-cards})')).toEqual({ ok: true, value: 2 });
    expect(o('len({f-other})')).toEqual({ ok: true, value: 2 });
    expect(o('{f-num-text} + 1')).toEqual({ ok: true, value: 5 });
    expect(o('{f-many} + 1')).toEqual({
      ok: false,
      error: 'Many holds several: count them with len()',
    });
  });

  it('reads another formula, and Child Count through the calculated reader', () => {
    const parent = card({ 'f-budget': 10 });
    const index = childIndexOf([parent], types);
    const plus = calculatedValue(def('f-plus'), parent, index, () => false, { type: deal, ...ctx });
    expect(plus).toBe(10);
    // With no calculated reader, Child Count reads blank.
    expect(formulaValue(def('f-plus'), parent, deal, ctx)).toBe(10);
    expect(formulaValue(f('x', 'X', '{f-kids}'), parent, deal, ctx)).toBe(null);
    expect(
      formulaValue(f('x', 'X', '{f-kids} + 1'), parent, deal, { ...ctx, calculated: () => 4 }),
    ).toBe(5);
  });

  it('turns a problem into an outcome, never a throw', () => {
    const c = card({ 'f-budget': 1 });
    expect(formulaOutcome(def('f-loop-a'), c, deal, ctx)).toEqual({
      ok: false,
      error: 'Circular: Loop A reads itself',
    });
    expect(formulaOutcome(def('f-broken'), c, deal, ctx)).toEqual({
      ok: false,
      error: "The formula can't be read: Expected a value at 4",
    });
    expect(formulaOutcome(def('f-gone-ref'), c, deal, ctx)).toEqual({
      ok: false,
      error: 'Uses a field that was deleted or taken off the type',
    });
    expect(formulaOutcome(f('x', 'X', '1 / 0'), c, deal, ctx)).toEqual({
      ok: false,
      error: 'Divides by 0',
    });
    expect(formulaOutcome(f('x', 'X', '"a"'), c, deal, ctx)).toEqual({
      ok: false,
      error: 'Gives text, not a number: make the result Text',
    });
    expect(formulaOutcome(f('x', 'X', '1', 'date'), c, deal, ctx)).toEqual({
      ok: false,
      error: 'Gives a number, not a date',
    });
    expect(
      formulaOutcome(f('x', 'X', '{due}', 'number'), card({ due: '2026-01-01' }), deal, ctx),
    ).toEqual({
      ok: false,
      error: 'Gives a date, not a number: make the result Date',
    });
    expect(formulaOutcome(f('x', 'X', 'true'), c, deal, ctx)).toMatchObject({
      error: /make the result Checkbox/,
    });
    expect(
      formulaOutcome(f('x', 'X', '{f-kids}'), c, deal, {
        calculated: () => {
          throw new Error('boom');
        },
      }),
    ).toEqual({ ok: false, error: "This value can't be worked out" });
    expect(formulaValue(f('x', 'X', '1 / 0'), c, deal, ctx)).toBe(null);
    expect(formulaOutcome({ kind: 'calculated', calculation: 'formula' }, c, deal)).toMatchObject({
      ok: false,
    });
  });

  it('reads each result kind', () => {
    const c = card({ 'f-budget': 10.256 });
    const r = (result: CustomFieldDef['result'], formula = '{f-budget}') =>
      formulaValue(f('x', 'X', formula, result), c, deal, ctx);
    expect(r('number')).toBe(10.256);
    expect(r('currency')).toBe(10.26);
    expect(r('percent')).toBe(10);
    expect(r('text')).toBe('10.256');
    expect(r('text', 'concat("")')).toBe(null);
    expect(r('checkbox')).toBe(true);
    expect(r('checkbox', '0')).toBe(false);
    expect(r('number', '0.1 + 0.2')).toBe(0.3);
    expect(formulaResultOf({})).toBe('number');
    expect(formulaResultOf({ result: 'nope' as never })).toBe('number');
  });

  it('uses the reader’s own day without one given', () => {
    const out = formulaValue(f('x', 'X', 'today()', 'date'), card({}), deal);
    expect(typeof out === 'string' && out.length).toBe(10);
    expect(
      formulaValue(f('x', 'X', 'today()', 'date'), card({}), deal, { today: 'not a day' }),
    ).toBe(out);
  });

  it('writes a value as its result reads', () => {
    expect(formulaText({ result: 'currency', currency: 'GBP' }, 2500)).toBe('£2,500');
    expect(formulaText({}, 82000.5)).toBe('82,000.5');
    expect(formulaText({ result: 'percent' }, 40)).toBe('40%');
    expect(formulaText({ result: 'text' }, 'Strong')).toBe('Strong');
    expect(formulaText({ result: 'date' }, '2026-10-30')).toMatch(/2026/);
    expect(formulaText({ result: 'checkbox' }, true)).toBe('Yes');
    expect(formulaText({ result: 'checkbox' }, false)).toBe('No');
    expect(formulaText({}, null)).toBe(null);
    expect(formulaText({}, '')).toBe(null);
    for (const result of ['number', 'currency', 'percent', 'date', 'checkbox'] as const)
      expect(formulaText({ result }, result === 'date' ? 4 : 'x')).toBe(null);
    expect(calculatedText(def('f-left'), 3000)).toBe(
      'US$3,000'.length ? formulaText(def('f-left'), 3000) : '',
    );
    expect(FORMULA_ERROR_TEXT).toBe('Error');
  });

  it('names a field’s problem whatever the card', () => {
    expect(formulaProblem(def('f-left'), deal)).toBe(null);
    expect(formulaProblem(def('f-broken'), deal)).toMatch(/can't be read/);
    expect(formulaProblem(def('f-gone-ref'), deal)).toMatch(/deleted/);
    expect(formulaProblem({ formula: '{f-budget}' }, deal)).toBe(null);
    expect(formulaProblem({}, deal)).toMatch(/empty/);
  });

  it('is a Calculated field: listed, read-only, and in calculatedValuesOf', () => {
    expect(CALCULATION_LABELS.formula).toBe('Formula');
    expect(isFormulaField(def('f-left'))).toBe(true);
    expect(isFormulaField(def('f-kids'))).toBe(false);
    const c = card({ 'f-budget': 50, 'f-spent': 5 });
    const values = calculatedValuesOf(c, deal, childIndexOf([c], types), () => false);
    expect(values?.['f-left']).toBe(45);
    // Score empty, the only field Grade reads: no value.
    expect(values?.['f-grade']).toBe(null);
    expect(values?.['f-loop-a']).toBe(null);
    expect(calculatedValue(def('f-left'), c, new Map(), () => false)).toBe(null);
    expect(calculatedWritten(types, { type: 'deal', fields: { 'f-left': 3 } })).toBe('f-left');
  });

  it('holds to its budget even when formulas read each other many times', () => {
    // Each level reads the one below eight times: worked out once each, so it never explodes.
    const custom: CustomFieldDef[] = [{ id: 'f-l0', label: 'L0', kind: 'number' }];
    for (let i = 1; i <= 10; i += 1)
      custom.push(
        f(`f-l${i}`, `L${i}`, Array.from({ length: 8 }, () => `{f-l${i - 1}}`).join(' + ')),
      );
    const deep: ItemTypeDef = {
      ...deal,
      custom,
      fields: ['title', 'status', ...custom.map((c) => c.id)],
    };
    expect(formulaValue(custom[10]!, card({ 'f-l0': 1 }), deep, ctx)).toBe(8 ** 10);
    expect(FORMULA_STEPS_MAX).toBe(10_000);
    // One formula alone past the budget.
    const big = f('f-big', 'Big', Array.from({ length: 140 }, () => '{f-l0}').join('+'));
    const wide: ItemTypeDef = {
      ...deep,
      custom: [...custom, big],
      fields: [...deep.fields, 'f-big'],
    };
    expect(formulaOutcome(big, card({ 'f-l0': 1 }), wide, ctx)).toEqual({ ok: true, value: 140 });
  });
});

describe('stored formulas', () => {
  const catalogue = (field: Record<string, unknown>) =>
    validateItemTypeCatalogue({
      version: ITEM_TYPE_CATALOGUE_VERSION,
      types: [
        {
          ...deal,
          custom: [{ id: 'f-x', label: 'X', kind: 'calculated', calculation: 'formula', ...field }],
          fields: ['title', 'status', 'f-x'],
        },
      ],
    });

  it('keeps formula, result and a Currency result’s currency', () => {
    const read = catalogue({ formula: '1 +', result: 'currency', currency: 'USD' });
    expect(read.ok && read.catalogue.types[0]!.custom![0]).toMatchObject({
      formula: '1 +',
      result: 'currency',
      currency: 'USD',
    });
    const plain = catalogue({ result: 'number', currency: 'GBP' });
    expect(plain.ok && plain.catalogue.types[0]!.custom![0]).toEqual({
      id: 'f-x',
      label: 'X',
      kind: 'calculated',
      calculation: 'formula',
      formula: '',
    });
    const gbp = catalogue({ formula: '1', result: 'currency', currency: 'GBP' });
    expect(gbp.ok && gbp.catalogue.types[0]!.custom![0]!.currency).toBe(undefined);
  });

  it('refuses a formula that is no text or too long, and an unknown result or currency', () => {
    expect(catalogue({ formula: 3 })).toMatchObject({ ok: false });
    expect(catalogue({ formula: 'x'.repeat(FORMULA_MAX + 1) })).toMatchObject({ ok: false });
    expect(catalogue({ formula: '1', result: 'colour' })).toMatchObject({ ok: false });
    expect(catalogue({ formula: '1', result: 'currency', currency: 'usd' })).toMatchObject({
      ok: false,
    });
  });
});

describe('agents write formulas by name', () => {
  // Within the catalogue's 12 custom fields.
  const small: ItemTypeDef = {
    ...deal,
    fields: [
      'title',
      'status',
      'f-budget',
      'f-spent',
      'f-left',
      'f-share',
      'f-grade',
      'f-score',
      'f-kids',
    ],
    custom: ['f-budget', 'f-spent', 'f-left', 'f-share', 'f-grade', 'f-score', 'f-kids'].map(def),
  };
  const base = { version: ITEM_TYPE_CATALOGUE_VERSION, types: [small] };
  const add = (custom: Record<string, unknown>[]) =>
    applyCardTypeChanges(null, [{ op: 'add', name: 'Budget Line', custom: custom as never }], []);

  it('stores names as ids, a field added after it included', () => {
    const out = add([
      {
        name: 'Left',
        kind: 'calculated',
        calculation: 'formula',
        formula: 'Budget - Spent',
        result: 'Currency',
        currency: 'EUR',
      },
      { name: 'Budget', kind: 'currency' },
      { name: 'Spent', kind: 'currency' },
    ]);
    expect(out.ok && out.catalogue!.types[0]!.custom![0]).toMatchObject({
      formula: '{f-budget} - {f-spent}',
      result: 'currency',
      currency: 'EUR',
    });
  });

  it('refuses a formula that does not work, one missing, and formula settings on another field', () => {
    expect(
      add([{ name: 'Left', kind: 'calculated', calculation: 'formula', formula: 'Budgt * 2' }]),
    ).toMatchObject({
      ok: false,
      message: 'The formula for "Left" doesn\'t work: Unknown field "Budgt" at 1.',
    });
    expect(add([{ name: 'Left', kind: 'calculated', calculation: 'formula' }])).toMatchObject({
      ok: false,
      message: expect.stringContaining('needs a formula'),
    });
    expect(add([{ name: 'Left', kind: 'number', formula: '1' }])).toMatchObject({
      ok: false,
      message: expect.stringContaining('is no formula'),
    });
    expect(
      add([
        {
          name: 'Left',
          kind: 'calculated',
          calculation: 'formula',
          formula: '1',
          result: 'colour',
        },
      ]),
    ).toMatchObject({
      ok: false,
      message: expect.stringContaining('result is one of'),
    });
  });

  it('edits a formula, its result and currency, and drops them when the calculation changes', () => {
    const edited = applyCardTypeChanges(
      base,
      [
        {
          op: 'set',
          type: 'Deal',
          editCustom: [
            { field: 'Left', formula: 'Budget * 2', result: 'number' },
            { field: 'Share', currency: 'EUR', result: 'Currency' },
            { field: 'Grade', calculation: 'Child Count' },
          ],
        },
      ],
      [],
    );
    expect(edited.ok).toBe(true);
    const custom = edited.ok ? edited.catalogue!.types[0]!.custom! : [];
    expect(custom.find((c) => c.id === 'f-left')).toMatchObject({ formula: '{f-budget} * 2' });
    expect(custom.find((c) => c.id === 'f-left')!.result).toBe(undefined);
    expect(custom.find((c) => c.id === 'f-left')!.currency).toBe(undefined);
    expect(custom.find((c) => c.id === 'f-share')).toMatchObject({
      result: 'currency',
      currency: 'EUR',
    });
    expect(custom.find((c) => c.id === 'f-grade')).toEqual({
      id: 'f-grade',
      label: 'Grade',
      kind: 'calculated',
      calculation: 'childCount',
    });
    const switched = applyCardTypeChanges(
      base,
      [{ op: 'set', type: 'Deal', editCustom: [{ field: 'Kids', calculation: 'formula' }] }],
      [],
    );
    expect(switched).toMatchObject({
      ok: false,
      message: expect.stringContaining('needs a formula'),
    });
    // A formula naming a field removed in the same change is refused; one on a removed field is skipped.
    const removed = applyCardTypeChanges(
      base,
      [
        {
          op: 'set',
          type: 'Deal',
          editCustom: [{ field: 'Left', formula: 'Spent' }],
          removeCustom: ['Left'],
        },
      ],
      [],
    );
    expect(removed.ok).toBe(true);
  });
});

// docs/specs/026-plan/item-types.md "Percent" (Shown as a Percent): a Formula with a Percent result is a share.
describe('a Percent result shown as a Percent', () => {
  const small: ItemTypeDef = {
    ...deal,
    fields: ['title', 'status', 'f-budget', 'f-spent', 'f-left', 'f-share'],
    custom: ['f-budget', 'f-spent', 'f-left', 'f-share'].map(def),
  };
  const base = { version: ITEM_TYPE_CATALOGUE_VERSION, types: [small] };
  const edit = (editCustom: Record<string, unknown>[]) =>
    applyCardTypeChanges(base, [{ op: 'set', type: 'Deal', editCustom: editCustom as never }], []);
  const custom = (out: ReturnType<typeof edit>) => (out.ok ? out.catalogue!.types[0]!.custom! : []);

  it('may show as a Percent, and draws its share held to 0..100', () => {
    const share = { ...def('f-share'), showAs: 'percent' as const };
    expect(canShowAsPercent(share)).toBe(true);
    expect(canShowAsPercent(def('f-left'))).toBe(false);
    expect(showsAsPercent(share)).toBe(true);
    expect(percentShown(share, 140)).toBe(100);
  });

  it('takes showAs from agents with a Percent result, refuses it on another, and drops it when the result changes', () => {
    const on = edit([{ field: 'Share', showAs: 'percent' }]);
    expect(custom(on).find((c) => c.id === 'f-share')!.showAs).toBe('percent');
    expect(edit([{ field: 'Left', showAs: 'percent' }])).toMatchObject({
      ok: false,
      message: expect.stringContaining('only a share, like Children Done or a Percent formula'),
    });
    // Made a Percent and shown as one in the same edit.
    const both = edit([{ field: 'Left', result: 'percent', showAs: 'percent' }]);
    expect(custom(both).find((c) => c.id === 'f-left')!.showAs).toBe('percent');
    const later = applyCardTypeChanges(
      on.ok ? on.catalogue : null,
      [{ op: 'set', type: 'Deal', editCustom: [{ field: 'Share', result: 'number' }] }],
      [],
    );
    expect(custom(later).find((c) => c.id === 'f-share')!.showAs).toBe(undefined);
  });

  it('keeps a stored showAs only on a Percent result', () => {
    const read = (result: string) =>
      validateItemTypeCatalogue({
        version: ITEM_TYPE_CATALOGUE_VERSION,
        types: [
          {
            ...small,
            custom: [{ ...def('f-share'), result, showAs: 'percent' }],
            fields: ['title', 'status', 'f-share'],
          },
        ],
      });
    const percent = read('percent');
    expect(percent.ok && percent.catalogue.types[0]!.custom![0]!.showAs).toBe('percent');
    const text = read('text');
    expect(text.ok && text.catalogue.types[0]!.custom![0]!.showAs).toBe(undefined);
  });
});

describe('where a Formula reads', () => {
  const setup: PlanBoardSetup = {
    title: 'Deals',
    columns: [{ id: 'c1', status: 'open', name: 'Open' }],
    swimlaneBy: 'none',
    cardFields: [],
    hideWriting: false,
    addTypes: ['deal'],
  };
  const a = card({ status: 'open', 'f-budget': 100, 'f-spent': 10, due: '2026-11-02' });
  const b = card({ status: 'open', 'f-budget': 50, 'f-spent': 0, due: '2026-11-01' });
  const empty = card({ status: 'open' });
  const items = new Map([a, b, empty].map((i) => [i.id, i]));

  it('sorts by a Number, Currency, Percent or Date result, never Text', () => {
    const fields = boardSortFieldsOf(types).map((s) => `${s.id}:${s.kind}`);
    expect(fields).toContain('f-left:currency');
    expect(fields).toContain('f-share:number');
    expect(fields).toContain('f-close:date');
    expect(fields).toContain('f-days:number');
    expect(fields.some((s) => s.startsWith('f-grade'))).toBe(false);
    const byLeft = [a, b, empty].sort(
      boardSortComparator([{ field: 'f-left', dir: 'asc' }], types, items),
    );
    expect(byLeft.map((i) => i.id)).toEqual([b.id, a.id, empty.id]);
    const byClose = [a, b, empty].sort(
      boardSortComparator([{ field: 'f-close', dir: 'asc' }], types),
    );
    expect(byClose.map((i) => i.id)).toEqual([b.id, a.id, empty.id]);
  });

  it('exports its value in CSV, and Import CSV skips it', () => {
    const rows = boardCsvRows(setup, items, types);
    const at = rows[0]!.indexOf('Left');
    expect(at).toBeGreaterThan(0);
    expect(rows[0]).not.toContain('Kids');
    expect(rows.slice(1).map((r) => r[at])).toContain('90');
    const imported = boardCsvImport(
      [
        ['Title', 'Left'],
        ['New', '12'],
      ],
      { setup, types, people: [], room: 10 },
    );
    expect(imported.creates).toHaveLength(1);
    expect(JSON.stringify(imported.creates)).not.toContain('f-left');
  });

  it('reads in a sheet’s card functions by name', () => {
    const source = cardSourceOf(items.values(), types);
    const [first] = source.cards();
    expect(source.fieldOf(first!, 'Left')).toBe(90);
    expect(source.fieldOf(first!, 'grade')).toBe(null);
    expect(typeof source.fieldOf(first!, 'Close')).toBe('number');
  });

  it('works a 2,000-card board out within budget (parse once, evaluate per card)', () => {
    const many: Item[] = [];
    for (let i = 0; i < 2000; i += 1)
      many.push(
        card({
          'f-budget': i,
          'f-spent': i / 2,
          'f-score': i % 10,
          start: '2026-01-01',
          due: '2026-02-01',
        }),
      );
    const fields = ['f-left', 'f-share', 'f-grade', 'f-days'].map(def);
    let n = 0;
    const spent = cpuMsOf(() => {
      for (const c of many)
        for (const field of fields) if (formulaValue(field, c, deal, ctx) !== null) n += 1;
    });
    expect(n).toBe(8000 - 1);
    expect(spent).toBeLessThan(cpuBudgetMs(1000));
  });
});

describe('calculatedOutcome', () => {
  it('keeps a Formula’s problem, and works any other calculation out', () => {
    const c = card({});
    const index = childIndexOf([c], types);
    expect(calculatedOutcome(def('f-broken'), c, index, () => false, { type: deal })).toMatchObject(
      { ok: false },
    );
    expect(calculatedOutcome(def('f-kids'), c, index, () => false, { type: deal })).toEqual({
      ok: true,
      value: 0,
    });
    expect(
      calculatedOutcome(f('x', 'X', '{f-kids} + 1'), c, index, () => false, { type: deal }),
    ).toEqual({
      ok: true,
      value: 1,
    });
  });
});
