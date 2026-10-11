// An agent's validation and format rules (docs/specs/029-sheets/data-validation.md, conditional-formatting.md
// "Agents"): built by the engine's commands, refused in words, and read back.
import { describe, expect, it } from 'vitest';
import {
  NOBODY,
  Workbook,
  applySheetWrite,
  emptyLayout,
  type Sheet,
  type SheetWrite,
} from '@livediagram/sheets';
import { buildSheetChange, type SheetChange } from './sheet-change-build';
import { AGENT_CONDITIONS, rulesRead } from './sheet-rule-change';

let n = 1;
const rand = () => ((n = (n * 16807) % 2147483647), n / 2147483647);

function book() {
  n = 7;
  const sheet: Sheet = {
    id: 'sheet_rules1',
    tabId: 'tab',
    title: 'Rules',
    layout: emptyLayout(rand, 20, 6),
    cells: new Map(),
    rev: 0,
    createdAt: 0,
    updatedAt: 0,
    updatedBy: NOBODY,
  };
  const wb = new Workbook({ sheets: [sheet], locale: 'en-GB' });
  // Build and apply, as the api would.
  const run = (change: SheetChange) => {
    const built = buildSheetChange(wb, sheet.id, change, [], rand);
    if (!built.ok) return built;
    for (const w of built.writes) {
      const next = applySheetWrite(wb.sheet(sheet.id)!, w as SheetWrite, {
        now: 1,
        by: NOBODY,
      }).sheet;
      wb.updateSheet(next);
    }
    return built;
  };
  return { wb, id: sheet.id, run };
}

describe('validation rules for agents', () => {
  it('makes a dropdown, refuses a value it does not allow, and saves an option in its own spelling', () => {
    const { wb, id, run } = book();
    expect(
      run({
        op: 'validate',
        range: 'B2:B10',
        rule: {
          type: 'dropdown',
          options: ['To Do', 'Done'],
          colors: ['#ff0000', null],
          display: 'arrow',
        },
      }),
    ).toMatchObject({ ok: true, line: 'made B2:B10 a dropdown rule' });
    const refused = run({ op: 'set', at: 'B3', rows: [['Blocked']] });
    expect(refused).toMatchObject({ ok: false, code: 'value_invalid' });
    expect(!refused.ok && refused.message).toMatch(/^B3 cannot take that value: Choose one of/);
    expect(run({ op: 'set', at: 'B3', rows: [['done']] }).ok).toBe(true);
    expect(wb.value(id, 2, 1)).toBe('Done');
    const read = rulesRead(wb, id);
    expect(read.validation).toEqual([
      expect.objectContaining({
        range: 'B2:B10',
        type: 'dropdown',
        options: ['To Do', 'Done'],
        reject: true,
      }),
    ]);
  });
  it('makes checkbox, number, date, text and range rules, and clears them', () => {
    const { wb, id, run } = book();
    expect(run({ op: 'validate', range: 'A1:A5', rule: { type: 'checkbox' } }).ok).toBe(true);
    expect(
      run({
        op: 'validate',
        range: 'C1:C5',
        rule: { type: 'number', condition: 'between', value: 1, value2: 5 },
        reject: false,
        help: 'One to five',
      }).ok,
    ).toBe(true);
    expect(
      run({
        op: 'validate',
        range: 'D1',
        rule: { type: 'date', condition: 'after', value: '2026-10-01' },
      }).ok,
    ).toBe(true);
    expect(
      run({ op: 'validate', range: 'D2', rule: { type: 'date', condition: 'valid' } }).ok,
    ).toBe(true);
    expect(
      run({ op: 'validate', range: 'E1', rule: { type: 'text', condition: 'email' } }).ok,
    ).toBe(true);
    expect(
      run({
        op: 'validate',
        range: 'E2',
        rule: { type: 'text', condition: 'contains', value: 'ref' },
      }).ok,
    ).toBe(true);
    expect(
      run({ op: 'validate', range: 'F1', rule: { type: 'dropdown_range', source: 'A10:A12' } }).ok,
    ).toBe(true);
    const read = rulesRead(wb, id).validation;
    expect(read.map((r) => r.type)).toEqual([
      'checkbox',
      'number',
      'date',
      'date',
      'text',
      'text',
      'dropdown_range',
    ]);
    expect(read[1]).toMatchObject({ condition: 'between', reject: false, help: 'One to five' });
    expect(read[6]).toMatchObject({ source: 'A10:A12' });
    expect(run({ op: 'clear_validation', range: 'A1:E5' }).ok).toBe(true);
    expect(rulesRead(wb, id).validation.map((r) => r.range)).toEqual(['F1']);
  });
  it('refuses what cannot be a rule', () => {
    const { run } = book();
    const code = (c: SheetChange) => {
      const r = run(c);
      return r.ok ? null : r.code;
    };
    expect(code({ op: 'validate', range: 'Z99', rule: { type: 'checkbox' } })).toBe(
      'range_invalid',
    );
    expect(code({ op: 'validate', range: 'A1', rule: { type: 'dropdown', options: [''] } })).toBe(
      'rule_invalid',
    );
    expect(
      code({ op: 'validate', range: 'A1', rule: { type: 'dropdown_range', source: 'nope' } }),
    ).toBe('range_invalid');
    expect(
      code({ op: 'validate', range: 'A1', rule: { type: 'number', condition: 'nearly' } }),
    ).toBe('rule_invalid');
    expect(
      code({
        op: 'validate',
        range: 'A1',
        rule: { type: 'number', condition: 'between', value: 1 },
      }),
    ).toBe('rule_invalid');
    expect(
      code({
        op: 'validate',
        range: 'A1',
        rule: { type: 'date', condition: 'on', value: '1/2/3' },
      }),
    ).toBe('rule_invalid');
    expect(
      code({ op: 'validate', range: 'A1', rule: { type: 'text', condition: 'contains' } }),
    ).toBe('rule_invalid');
    expect(code({ op: 'validate', range: 'A1', rule: { type: 'nope' } as never })).toBe(
      'rule_invalid',
    );
    expect(code({ op: 'clear_validation', range: 'nope' })).toBe('range_invalid');
  });
});

describe('format rules for agents', () => {
  it('adds conditions, formulas and scales in order, reads them back, and clears them', () => {
    const { wb, id, run } = book();
    expect(
      run({
        op: 'conditional_format',
        range: 'B2:B10',
        when: { condition: 'greater_than', value: 100 },
        style: { background: '#F4C7C3', bold: true },
      }).ok,
    ).toBe(true);
    expect(
      run({
        op: 'conditional_format',
        range: 'A2:F10',
        when: { condition: 'formula', formula: '=$C2>100' },
        style: { color: '#137333', italic: true, underline: true, strikethrough: true },
      }).ok,
    ).toBe(true);
    expect(
      run({
        op: 'conditional_format',
        range: 'D2:D10',
        scale: {
          min: { color: '#ffffff', type: 'min' },
          mid: { color: '#ffd666', type: 'percentile', value: 50 },
          max: { color: '#57bb8a', type: 'max' },
        },
      }).ok,
    ).toBe(true);
    const read = rulesRead(wb, id).conditionalFormats;
    expect(read.map((r) => r.rule)).toEqual([
      'Greater Than 100',
      'Custom Formula Is =$C2>100',
      'Colour Scale',
    ]);
    expect(read[0]).toMatchObject({ range: 'B2:B10', style: { bg: '#f4c7c3', b: true } });
    expect(run({ op: 'clear_conditional_formats', range: 'B5' })).toMatchObject({
      ok: true,
      line: 'cleared 2 format rules',
    });
    expect(run({ op: 'clear_conditional_formats' })).toMatchObject({
      ok: true,
      line: 'cleared 1 format rule',
    });
    expect(run({ op: 'clear_conditional_formats' })).toMatchObject({ ok: true, writes: [] });
    expect(AGENT_CONDITIONS).toContain('greater_than_or_equal');
    expect(AGENT_CONDITIONS).toContain('starts_with');
  });
  it('refuses what cannot be a format rule', () => {
    const { run } = book();
    const code = (c: SheetChange) => {
      const r = run(c);
      return r.ok ? null : r.code;
    };
    expect(code({ op: 'conditional_format', range: 'Q99' })).toBe('range_invalid');
    expect(code({ op: 'conditional_format', range: 'A1' })).toBe('rule_invalid');
    expect(code({ op: 'conditional_format', range: 'A1', when: { condition: 'empty' } })).toBe(
      'format_invalid',
    );
    expect(
      code({
        op: 'conditional_format',
        range: 'A1',
        when: { condition: 'empty' },
        style: { color: 'red' },
      }),
    ).toBe('format_invalid');
    expect(
      code({
        op: 'conditional_format',
        range: 'A1',
        when: { condition: 'nope' },
        style: { bold: true },
      }),
    ).toBe('rule_invalid');
    expect(
      code({
        op: 'conditional_format',
        range: 'A1',
        when: { condition: 'formula', formula: '=(' },
        style: { bold: true },
      }),
    ).toBe('formula_invalid');
    expect(
      code({
        op: 'conditional_format',
        range: 'A1',
        scale: { min: { color: '#fff', type: 'min' }, max: { color: '#000000', type: 'max' } },
      }),
    ).toBe('rule_invalid');
    expect(
      code({
        op: 'conditional_format',
        range: 'A1',
        scale: {
          min: { color: '#ffffff', type: 'number' },
          max: { color: '#000000', type: 'max' },
        },
      }),
    ).toBe('rule_invalid');
    expect(
      code({
        op: 'conditional_format',
        range: 'A1',
        scale: {
          min: { color: '#ffffff', type: 'nope' as never },
          max: { color: '#000000', type: 'max' },
        },
      }),
    ).toBe('rule_invalid');
    expect(
      code({
        op: 'conditional_format',
        range: 'A1',
        scale: { min: undefined as never, max: { color: '#000000', type: 'max' } },
      }),
    ).toBe('rule_invalid');
    expect(code({ op: 'clear_conditional_formats', range: 'nope' })).toBe('range_invalid');
  });
});
