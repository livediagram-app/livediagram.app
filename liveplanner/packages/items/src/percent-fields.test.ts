import { describe, expect, it } from 'vitest';
import { laneFieldsOf, laneGroups, laneDropPatch, type PlanBoardSetup } from './board';
import { boardCsvImport, boardCsvRows } from './board-csv';
import { boardSortFieldsOf, sortCards } from './board-sort';
import { customFieldText } from './card-text';
import type { Item } from './item';
import { ITEM_TYPES, type CustomFieldDef, type ItemTypeDef } from './item-types';
import {
  canShowAsPercent,
  parsePercent,
  percentShown,
  percentText,
  percentValue,
  PERCENT_MAX,
  PERCENT_MIN,
  showsAsPercent,
} from './percent-fields';
import { resolveFields } from './plan-names';
import { canBeRequired, missingRequiredFields } from './required-fields';
import { item } from './test-items';
import {
  defaultCatalogue,
  ITEM_TYPE_CATALOGUE_VERSION,
  validateItemTypeCatalogue,
} from './type-catalogue';
import { applyCardTypeChanges } from './type-changes';
import { viewMeasureOptions } from './view-fields';

// Percent fields (docs/specs/026-plan/item-types.md "Percent").

const PROGRESS: CustomFieldDef = { id: 'f-progress', label: 'Progress', kind: 'percent' };
const DONE: CustomFieldDef = {
  id: 'f-done',
  label: 'Done',
  kind: 'calculated',
  calculation: 'childrenDone',
};
const work: ItemTypeDef = {
  ...ITEM_TYPES[1],
  id: 'work',
  label: 'Work',
  fields: ['title', 'status', 'f-progress', 'f-done'],
  custom: [PROGRESS, DONE],
};
const statuses = [{ status: 'todo', name: 'To Do' }];
const naming = { statuses, items: [] };
const titles = (list: readonly Item[]) => list.map((i) => i.fields['title']);

describe('reading a share', () => {
  it('reads a number or numeric text, rounded and held to 0 to 100', () => {
    expect([PERCENT_MIN, PERCENT_MAX]).toEqual([0, 100]);
    expect(percentValue(40)).toBe(40);
    expect(percentValue(40.6)).toBe(41);
    expect(percentValue(' 40 % ')).toBe(40);
    expect(percentValue(140)).toBe(100);
    expect(percentValue(-5)).toBe(0);
    expect(percentValue(0)).toBe(0);
    for (const none of [undefined, null, '', ' ', 'lots', '%', Number.NaN, true, ['40']])
      expect(percentValue(none as never), String(none)).toBeUndefined();
  });

  it('refuses a write outside 0 to 100 rather than holding it', () => {
    expect(parsePercent('40%')).toBe(40);
    expect(parsePercent(33.4)).toBe(33);
    expect(parsePercent(0)).toBe(0);
    expect(parsePercent(100)).toBe(100);
    expect(parsePercent(100.2)).toBeUndefined();
    expect(parsePercent(-1)).toBeUndefined();
    expect(parsePercent('lots')).toBeUndefined();
  });

  it('writes a share as "40%"', () => {
    expect(percentText(40)).toBe('40%');
    expect(customFieldText(PROGRESS, 40)).toBe('40%');
    expect(customFieldText(PROGRESS, 140)).toBe('100%');
    expect(customFieldText(PROGRESS, 0)).toBe('0%');
    expect(customFieldText(PROGRESS, 'lots')).toBeNull();
  });
});

describe('showing as a Percent', () => {
  it('draws a Percent field, and a Children Done only when it says so', () => {
    expect(showsAsPercent(PROGRESS)).toBe(true);
    expect(showsAsPercent(DONE)).toBe(false);
    expect(showsAsPercent({ ...DONE, showAs: 'percent' })).toBe(true);
    // A Child Count is no share: a stray showAs is ignored.
    expect(showsAsPercent({ ...DONE, calculation: 'childCount', showAs: 'percent' })).toBe(false);
    expect(showsAsPercent({ kind: 'number', showAs: 'percent' })).toBe(false);
    expect(canShowAsPercent(DONE)).toBe(true);
    expect(canShowAsPercent(PROGRESS)).toBe(false);
  });

  it('gives the share a field shows, or nothing', () => {
    expect(percentShown(PROGRESS, 120)).toBe(100);
    expect(percentShown({ ...DONE, showAs: 'percent' }, 40)).toBe(40);
    expect(percentShown(DONE, 40)).toBeUndefined();
    expect(percentShown(PROGRESS, undefined)).toBeUndefined();
  });
});

describe('agents and the card table', () => {
  it('take a number or "40%", rounded, and refuse one outside 0 to 100', () => {
    expect(resolveFields({ Progress: '40%' }, work, naming)).toMatchObject({
      ok: true,
      fields: { 'f-progress': 40 },
    });
    expect(resolveFields({ Progress: 66.6 }, work, naming)).toMatchObject({
      ok: true,
      fields: { 'f-progress': 67 },
    });
    for (const bad of [140, -1, 'lots', true])
      expect(resolveFields({ Progress: bad }, work, naming), String(bad)).toMatchObject({
        ok: false,
        code: 'value_invalid',
        message: 'Progress is a percent: give a number from 0 to 100.',
      });
  });
});

describe('the catalogue', () => {
  it('makes a Percent field, and a Children Done shown as a Percent', () => {
    const r = applyCardTypeChanges(
      defaultCatalogue(),
      [
        {
          op: 'add',
          name: 'Work',
          custom: [
            { name: 'Progress', kind: 'percent', required: true },
            { name: 'Done', kind: 'calculated', calculation: 'childrenDone', showAs: 'Percent' },
            { name: 'Kids', kind: 'calculated', calculation: 'childCount', showAs: 'number' },
          ],
        },
      ],
      statuses,
    );
    if (!r.ok) throw new Error(r.message);
    const made = r.catalogue!.types.find((t) => t.label === 'Work')!;
    expect(made.custom).toEqual([
      { id: 'f-progress', label: 'Progress', kind: 'percent', required: true },
      {
        id: 'f-done',
        label: 'Done',
        kind: 'calculated',
        calculation: 'childrenDone',
        showAs: 'percent',
      },
      { id: 'f-kids', label: 'Kids', kind: 'calculated', calculation: 'childCount' },
    ]);
  });

  it('turns it on and off, and drops it when the calculation stops being a share', () => {
    const base = { version: ITEM_TYPE_CATALOGUE_VERSION, types: [work] } as const;
    const on = applyCardTypeChanges(
      base,
      [{ op: 'set', type: 'Work', editCustom: [{ field: 'Done', showAs: 'percent' }] }],
      statuses,
    );
    if (!on.ok) throw new Error(on.message);
    const shown = on.catalogue!.types[0]!.custom!.find((c) => c.id === 'f-done')!;
    expect(shown.showAs).toBe('percent');
    const after = (catalogue: typeof on.catalogue, edit: Record<string, unknown>) => {
      const r = applyCardTypeChanges(
        catalogue,
        [{ op: 'set', type: 'Work', editCustom: [{ field: 'Done', ...edit }] }],
        statuses,
      );
      if (!r.ok) throw new Error(r.message);
      return r.catalogue!.types[0]!.custom!.find((c) => c.id === 'f-done')!;
    };
    expect(after(on.catalogue, { showAs: 'number' }).showAs).toBeUndefined();
    expect(after(on.catalogue, { showAs: 'text' }).showAs).toBeUndefined();
    expect(after(on.catalogue, { showAs: 'Percent Bar' }).showAs).toBe('percent');
    expect(after(on.catalogue, { calculation: 'childCount' }).showAs).toBeUndefined();
    expect(after(on.catalogue, { calculation: 'childrenDone' }).showAs).toBe('percent');
  });

  it('refuses a Percent asked of a field that gives no share, or an unknown way to show', () => {
    const refused = (custom: Record<string, unknown>) =>
      applyCardTypeChanges(
        defaultCatalogue(),
        [{ op: 'add', name: 'X', custom: [{ name: 'V', ...custom } as never] }],
        statuses,
      );
    expect(
      refused({ kind: 'calculated', calculation: 'childCount', showAs: 'percent' }),
    ).toMatchObject({
      ok: false,
      message: `"V" can't show as a percent: only a share, like Children Done, can.`,
    });
    expect(refused({ kind: 'number', showAs: 'percent' }).ok).toBe(false);
    expect(
      refused({ kind: 'calculated', calculation: 'childrenDone', showAs: 'ring' }),
    ).toMatchObject({
      ok: false,
      message: `"ring" is not a way to show a field: give percent or number.`,
    });
  });

  it('keeps showAs only as percent, on a share', () => {
    const read = (field: Record<string, unknown>) => {
      const r = validateItemTypeCatalogue({
        version: ITEM_TYPE_CATALOGUE_VERSION,
        types: [{ ...work, custom: [PROGRESS, { ...DONE, ...field }] }],
      });
      if (!r.ok) throw new Error(r.reason);
      return r.catalogue.types[0]!.custom![1]!;
    };
    expect(read({ showAs: 'percent' }).showAs).toBe('percent');
    expect(read({ showAs: 'ring' }).showAs).toBeUndefined();
    expect(read({ calculation: 'childCount', showAs: 'percent' }).showAs).toBeUndefined();
  });

  it('may be required, 0 counting as a value', () => {
    expect(canBeRequired('percent')).toBe(true);
    const req = { ...work, custom: [{ ...PROGRESS, required: true }, DONE] };
    expect(missingRequiredFields(req, { 'f-progress': 0 })).toEqual([]);
    expect(missingRequiredFields(req, {}).map((f) => f.id)).toEqual(['f-progress']);
  });
});

describe('boards', () => {
  const cards = [
    item({ title: 'half', 'f-progress': 50 }, { type: 'work' }),
    item({ title: 'none' }, { type: 'work' }),
    item({ title: 'over', 'f-progress': 140 }, { type: 'work' }),
    item({ title: 'start', 'f-progress': 0 }, { type: 'work' }),
  ];

  it('sort it as a number, a stray value where its bar shows', () => {
    expect(boardSortFieldsOf([work]).find((f) => f.id === 'f-progress')).toEqual({
      id: 'f-progress',
      label: 'Progress',
      kind: 'percent',
    });
    expect(titles(sortCards(cards, [{ field: 'f-progress', dir: 'asc' }], [work]))).toEqual([
      'start',
      'half',
      'over',
      'none',
    ]);
  });

  it('lay swimlanes and searches by it, a row per share named "40%"', () => {
    expect(laneFieldsOf([work]).find((f) => f.id === 'f-progress')?.kind).toBe('percent');
    const map = new Map(cards.map((c) => [c.id, c]));
    const groups = laneGroups('field', 'f-progress', cards, map, [work]);
    expect(groups.lanes.map((l) => l.label)).toEqual(['0%', '50%', '100%', 'No Progress']);
    expect(laneDropPatch(groups.lanes[1])).toEqual({ set: { 'f-progress': 50 } });
  });

  it('never adds Percents up in Cards by Field', () => {
    expect(viewMeasureOptions([work])).toEqual([]);
  });
});

describe('CSV', () => {
  const setup: PlanBoardSetup = {
    title: 'Work',
    columns: [{ id: 'c1', status: 'todo', name: 'To Do' }],
    swimlaneBy: 'none',
    cardFields: [],
    hideWriting: false,
    addTypes: ['work'],
  };

  it('writes the number', () => {
    const rows = boardCsvRows(
      setup,
      new Map([
        ['a', item({ title: 'A', status: 'todo', 'f-progress': 40 }, { type: 'work', id: 'a' })],
      ]),
      [work],
    );
    const at = rows[0]!.indexOf('Progress');
    expect(rows[1]![at]).toBe('40');
  });

  it('reads "40" or "40%", rounding, and skips a cell it cannot hold', () => {
    const { creates } = boardCsvImport(
      [
        ['Title', 'Progress'],
        ['A', '40%'],
        ['B', '12.6'],
        ['C', '140'],
        ['D', 'most'],
      ],
      { setup, types: [work], people: [], room: 100 },
    );
    expect(creates.map((c) => c.fields['f-progress'])).toEqual([40, 13, undefined, undefined]);
  });
});
