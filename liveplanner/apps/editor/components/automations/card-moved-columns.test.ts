// docs/specs/026-plan/automations.md "The rule builder": Card Moved's From and To list only the columns its picked
// card types use, and changing the types drops a pick no picked type uses.
import { describe, expect, it } from 'vitest';
import type { ItemTypeDef } from '@liveplanner/items';
import {
  cardMovedColumns,
  unusedPicks,
  unusedPicksNote,
  withCardMovedTypes,
} from './card-moved-columns';

const type = (id: string, over: Partial<ItemTypeDef> = {}): ItemTypeDef => ({
  id,
  label: id,
  newTitle: id,
  glyph: 'item',
  color: '#000',
  fields: ['title'],
  ...over,
});
const BUG = type('bug', { statuses: ['triage', 'fixing', 'done'] });
const TASK = type('task', { statuses: ['todo', 'done'] });
// A legacy type: every column but the ones it leaves out.
const NOTE = type('note', { excludedStatuses: ['triage', 'fixing'] });
const TYPES = [BUG, TASK, NOTE];
const COLUMNS = ['todo', 'triage', 'fixing', 'done'].map((status) => ({ status, name: status }));
const statuses = (picked?: string[]) =>
  cardMovedColumns(TYPES, picked, COLUMNS).map((c) => c.status);

describe('cardMovedColumns', () => {
  it('lists every column when no type is picked', () => {
    expect(statuses()).toEqual(['todo', 'triage', 'fixing', 'done']);
    expect(statuses([])).toEqual(['todo', 'triage', 'fixing', 'done']);
  });

  it('lists only the columns the picked types use, in the plan’s order', () => {
    expect(statuses(['bug'])).toEqual(['triage', 'fixing', 'done']);
    expect(statuses(['task'])).toEqual(['todo', 'done']);
    expect(statuses(['task', 'bug'])).toEqual(['todo', 'triage', 'fixing', 'done']);
    expect(statuses(['note'])).toEqual(['todo', 'done']);
  });

  it('lists every column when every picked type is gone, and skips a gone one beside a live one', () => {
    expect(statuses(['epic'])).toEqual(['todo', 'triage', 'fixing', 'done']);
    expect(statuses(['epic', 'task'])).toEqual(['todo', 'done']);
  });
});

describe('withCardMovedTypes', () => {
  const plan = { types: TYPES, columns: COLUMNS };

  it('drops a From or To pick no picked type uses, keeping a column the plan deleted', () => {
    expect(
      withCardMovedTypes(
        { kind: 'card_moved', from: ['todo', 'triage', 'gone'], to: ['done', 'fixing'] },
        ['task'],
        plan,
      ),
    ).toEqual({ kind: 'card_moved', types: ['task'], from: ['todo', 'gone'], to: ['done'] });
  });

  it('leaves the key out when no type is picked, keeping every pick', () => {
    expect(
      withCardMovedTypes({ kind: 'card_moved', types: ['task'], from: ['todo'] }, [], plan),
    ).toEqual({ kind: 'card_moved', from: ['todo'] });
    expect(withCardMovedTypes({ kind: 'card_moved' }, ['bug'], plan)).toEqual({
      kind: 'card_moved',
      types: ['bug'],
    });
  });
});

// Work Tracker 855: a picked column the plan still has that no picked type uses any more.
describe('unusedPicks', () => {
  it('answers the chosen columns the plan has that no picked type uses, in the order chosen', () => {
    const names = (chosen?: string[], picked?: string[]) =>
      unusedPicks(TYPES, picked, COLUMNS, chosen).map((c) => c.status);
    expect(names(['done', 'todo', 'fixing'], ['bug'])).toEqual(['todo']);
    expect(names(['todo', 'gone'], ['bug'])).toEqual(['todo']);
    expect(names(['todo'], [])).toEqual([]);
    expect(names(undefined, ['bug'])).toEqual([]);
    expect(names(['todo', 'triage'], ['task'])).toEqual(['triage']);
  });

  it('says them in one note', () => {
    expect(unusedPicksNote([])).toBeNull();
    expect(unusedPicksNote(['Review'])).toBe("The picked card types don't use Review.");
    expect(unusedPicksNote(['Review', 'QA'])).toBe("The picked card types don't use Review or QA.");
    expect(unusedPicksNote(['Review', 'QA', 'Blocked'])).toBe(
      "The picked card types don't use Review, QA or Blocked.",
    );
  });
});
