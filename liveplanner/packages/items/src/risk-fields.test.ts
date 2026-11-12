import { describe, expect, it } from 'vitest';
import type { PlanBoardSetup } from './board';
import { boardCsvRows, customValueOfText } from './board-csv';
import { customFieldText } from './card-text';
import { changedValue, optionsFromValues } from './field-kind-change';
import {
  CUSTOM_FIELD_KINDS,
  ITEM_TYPES,
  KINDS_IN_PROGRESS,
  OFFERED_FIELD_KINDS,
  type CustomFieldDef,
  type ItemTypeDef,
} from './item-types';
import { RISKS, RISK_HINT, RISK_LABELS, isRisk, riskLabel, riskOf, riskRank } from './risk-fields';
import { item } from './test-items';
import {
  ITEM_TYPE_CATALOGUE_VERSION,
  defaultCatalogue,
  validateItemTypeCatalogue,
} from './type-catalogue';
import { applyCardTypeChanges } from './type-changes';

// docs/specs/026-plan/item-types.md "Risk": four fixed levels, most pressing first, read the same by every surface.
const RISK: CustomFieldDef = { id: 'f-risk', label: 'Risk', kind: 'risk' };

describe('the Risk levels', () => {
  it('are Critical to Low, most pressing first, each named in Title Case', () => {
    expect(RISKS).toEqual(['critical', 'high', 'medium', 'low']);
    expect(RISKS.map((r) => RISK_LABELS[r])).toEqual(['Critical', 'High', 'Medium', 'Low']);
    expect(RISK_HINT).toBe('Pick Critical, High, Medium or Low');
  });

  it('knows a stored level and nothing else', () => {
    expect(isRisk('high')).toBe(true);
    expect(isRisk('High')).toBe(false);
    expect(isRisk('urgent')).toBe(false);
    expect(isRisk(3)).toBe(false);
  });

  it('reads a level from its id or its name, in any case, and nothing else', () => {
    expect(riskOf('High')).toBe('high');
    expect(riskOf('  CRITICAL ')).toBe('critical');
    expect(riskOf('low')).toBe('low');
    expect(riskOf('Severe')).toBeUndefined();
    expect(riskOf('')).toBeUndefined();
    expect(riskOf(2)).toBeUndefined();
  });

  it('names a stored level, and ranks Critical above Low', () => {
    expect(riskLabel('medium')).toBe('Medium');
    expect(riskLabel('Medium')).toBeNull();
    expect(RISKS.map(riskRank)).toEqual([3, 2, 1, 0]);
    expect(riskRank(undefined)).toBeUndefined();
  });
});

describe('the Risk kind', () => {
  it('is a custom field kind still being built, offered to no one yet', () => {
    expect(CUSTOM_FIELD_KINDS).toContain('risk');
    expect(KINDS_IN_PROGRESS).toEqual(['risk']);
    expect(OFFERED_FIELD_KINDS).not.toContain('risk');
    expect(OFFERED_FIELD_KINDS).toHaveLength(CUSTOM_FIELD_KINDS.length - 1);
  });

  it('is kept by a catalogue read with no settings, options and all dropped', () => {
    const type = {
      id: 'bug',
      label: 'Bug',
      color: '#dc2626',
      glyph: 'bug',
      fields: ['f-risk'],
      custom: [{ ...RISK, options: ['Big'], scale: 4, multiple: true }],
    };
    for (const newerFields of ['keep', 'refuse'] as const) {
      const read = validateItemTypeCatalogue(
        { version: ITEM_TYPE_CATALOGUE_VERSION, types: [...ITEM_TYPES, type] },
        { newerFields },
      );
      if (!read.ok) throw new Error(read.reason);
      expect(read.catalogue.types.find((t) => t.id === 'bug')!.custom).toEqual([RISK]);
    }
  });

  it('is refused to an agent until it is offered, the offered kinds named', () => {
    const made = applyCardTypeChanges(
      defaultCatalogue(),
      [{ op: 'add', name: 'Bug', custom: [{ name: 'Risk', kind: 'risk' }] }],
      [{ status: 'todo', name: 'To Do' }],
    );
    expect(made.ok).toBe(false);
    if (made.ok) return;
    expect(made.message).toMatch(/"risk" is not a custom field kind/);
    expect(made.message).not.toMatch(/\brisk\b,/);
  });
});

describe('a Risk value', () => {
  it('reads as its level’s name, and as nothing when it is no level', () => {
    expect(customFieldText(RISK, 'critical')).toBe('Critical');
    expect(customFieldText(RISK, 'Critical')).toBeNull();
    expect(customFieldText(RISK, 7)).toBeNull();
  });

  it('is written to CSV as its name and read back from a name or an id', () => {
    const bug: ItemTypeDef = {
      id: 'bug',
      label: 'Bug',
      newTitle: 'New bug',
      glyph: 'bug',
      color: '#dc2626',
      fields: ['title', 'status', 'f-risk'],
      custom: [RISK],
    };
    const setup: PlanBoardSetup = {
      title: 'Bugs',
      columns: [{ id: 'c1', status: 'todo', name: 'To Do' }],
      swimlaneBy: 'none',
      cardFields: [],
      hideWriting: false,
      addTypes: ['bug'],
    };
    const cards = [
      item({ title: 'A', status: 'todo', 'f-risk': 'high' }, { type: 'bug', rank: 'a' }),
      item({ title: 'B', status: 'todo', 'f-risk': 'odd' }, { type: 'bug', rank: 'b' }),
    ];
    const rows = boardCsvRows(setup, new Map(cards.map((c) => [c.id, c])), [bug]);
    expect(rows[0]).toContain('Risk');
    const at = rows[0]!.indexOf('Risk');
    expect(rows.slice(1).map((r) => r[at])).toEqual(['High', '']);
    expect(customValueOfText(RISK, 'medium', [])).toBe('medium');
    expect(customValueOfText(RISK, 'Low', [])).toBe('low');
    expect(customValueOfText(RISK, 'Big', [])).toBeUndefined();
  });

  it('keeps its level by name through a kind change, to and from a Choice', () => {
    const choice = { kind: 'choice' as const, options: ['Low', 'High', 'Other'] };
    expect(changedValue(choice, RISK, 'High')).toEqual({
      kind: 'rewritten',
      value: 'high',
      trimmed: false,
    });
    expect(changedValue(choice, RISK, 'Other')).toEqual({ kind: 'cleared' });
    expect(changedValue(RISK, choice, 'low')).toEqual({
      kind: 'rewritten',
      value: 'Low',
      trimmed: false,
    });
    expect(changedValue(RISK, { kind: 'text' }, 'critical')).toEqual({
      kind: 'rewritten',
      value: 'Critical',
      trimmed: false,
    });
    expect(changedValue(RISK, RISK, 'high')).toEqual({ kind: 'kept' });
  });

  it('takes a Multiple Choice’s first level, the rest lost', () => {
    const multi = { kind: 'multichoice' as const, options: ['Web', 'High', 'Low'] };
    expect(changedValue(multi, RISK, ['Web', 'High', 'Low'])).toEqual({
      kind: 'rewritten',
      value: 'high',
      trimmed: true,
    });
    expect(changedValue(multi, RISK, ['Web'])).toEqual({ kind: 'cleared' });
  });

  it('starts a Choice made from it with the four levels, in order', () => {
    expect(optionsFromValues(RISK, ['low', 'odd'])).toEqual(['Critical', 'High', 'Medium', 'Low']);
    expect(optionsFromValues({ kind: 'choice', options: ['A'] }, ['B'])).toEqual(['A', 'B']);
  });
});
