import { describe, expect, it } from 'vitest';
import type { CustomFieldDef, ItemTypeDef } from './item-types';
import {
  hiddenCopyPatch,
  hiddenCopyTargets,
  hiddenRemovePatch,
  hiddenValueCount,
  hiddenValuesOf,
  hiddenValueText,
} from './hidden-values';
import { applyPatch, inversePatch } from './apply';
import type { Item } from './item';

// docs/specs/026-plan/item-types.md "The Hidden tab" (Work Tracker 857): the values a card keeps that its type doesn't
// show, grouped by the type they came from, removed fields last; system keys never; Copy To Field by the type-change
// rules; Remove one value; each one undoable write.
const typeOf = (id: string, label: string, custom: CustomFieldDef[], extra: string[] = []) =>
  ({
    id,
    label,
    newTitle: `New ${id}`,
    glyph: 'item',
    color: '#2563eb',
    fields: ['title', 'status', 'description', ...extra, ...custom.map((f) => f.id)],
    custom,
  }) as ItemTypeDef;

const IDEA = typeOf('idea', 'Idea', [
  { id: 'f-solution', label: 'Solution', kind: 'longtext' },
  { id: 'f-apps', label: 'App', kind: 'multichoice', options: ['Editor', 'API'] },
  { id: 'f-score', label: 'Score', kind: 'calculated' },
  { id: 'f-talk', label: 'Talk', kind: 'comments' },
  { id: 'f-vote', label: 'Vote', kind: 'votes' },
  { id: 'f-time', label: 'Time', kind: 'duration', timeSpent: true },
]);
const BUG = typeOf('bug', 'Bug', [{ id: 'f-steps', label: 'Steps', kind: 'text' }]);
const WORK = typeOf('work', 'Work Item', [
  { id: 'f-criteria', label: 'Acceptance Criteria', kind: 'longtext' },
  { id: 'f-app', label: 'App', kind: 'choice', options: ['API'] },
  { id: 'f-count', label: 'Count', kind: 'number' },
]);
const TYPES = [IDEA, BUG, WORK];

const card = (fields: Item['fields']): Item => ({
  id: 'c1',
  type: 'work',
  key: 1,
  rank: 'a',
  fields,
  rev: 1,
  createdAt: 0,
  updatedAt: 0,
  createdBy: { id: 'p', name: 'P', color: '#000' },
  updatedBy: { id: 'p', name: 'P', color: '#000' },
});

describe('hiddenValuesOf', () => {
  it('groups values by the type they came from, in catalogue and field order, removed fields last', () => {
    const groups = hiddenValuesOf(
      card({
        title: 'T',
        'f-criteria': 'shown',
        'f-steps': 'Click',
        'f-apps': ['API'],
        'f-solution': 'Do it',
        'f-zed': 'old',
        'f-abc': 3,
      }),
      WORK,
      TYPES,
    );
    expect(groups.map((g) => [g.type?.label ?? null, g.values.map((v) => v.field)])).toEqual([
      ['Idea', ['f-solution', 'f-apps']],
      ['Bug', ['f-steps']],
      [null, ['f-abc', 'f-zed']],
    ]);
    expect(groups[0]!.values[0]!.def?.label).toBe('Solution');
    expect(hiddenValueCount(groups)).toBe(5);
  });

  it('reads custom field ids only, never system keys, empty values or kept-elsewhere kinds', () => {
    const groups = hiddenValuesOf(
      card({
        status: 'todo',
        statusSince: 5,
        repeat: { every: 'week' },
        votes: { p: 1 },
        flagged: true,
        archived: true,
        assignee: { id: 'p', name: 'P', color: '#000' },
        'f-solution': '',
        'f-apps': [],
        'f-steps': null,
        'f-solutionRich': [{ text: 'x' }],
        'f-score': 4,
        'f-talk': 'x',
        'f-vote': { p: 2 },
        'f-time': { people: {}, entries: [], running: [] },
      }),
      WORK,
      TYPES,
    );
    expect(groups).toEqual([]);
  });

  it('shows nothing once the card is back on the type that shows them', () => {
    const back = { ...card({ 'f-solution': 'Do it' }), type: 'idea' };
    expect(hiddenValuesOf(back, IDEA, TYPES)).toEqual([]);
  });
});

describe('hiddenValueText', () => {
  it('reads a removed value as plain text', () => {
    expect(hiddenValueText('a')).toBe('a');
    expect(hiddenValueText(4)).toBe('4');
    expect(hiddenValueText(true)).toBe('Yes');
    expect(hiddenValueText(false)).toBe('No');
    expect(hiddenValueText(null)).toBe('');
    expect(hiddenValueText(['x', { id: 'p', name: 'Sam', color: '#000' }, { text: 'Row' }])).toBe(
      'x, Sam, Row',
    );
    expect(hiddenValueText({ label: 'L' })).toBe('L');
    expect(hiddenValueText({ other: 1 })).toBe('');
  });
});

describe('Copy To Field and Remove', () => {
  const solution = IDEA.custom![0]!;
  const apps = IDEA.custom![1]!;

  it('offers only the fields that can take the value, Description last', () => {
    expect(hiddenCopyTargets(WORK, solution, 'Do it').map((f) => f.id)).toEqual([
      'f-criteria',
      'description',
    ]);
    // A Multiple Choice into a Choice: only when a pick is one of its options.
    expect(hiddenCopyTargets(WORK, apps, ['API']).map((f) => f.id)).toEqual(['f-app']);
    expect(hiddenCopyTargets(WORK, apps, ['Editor'])).toEqual([]);
    // A type without a Description offers none.
    const bare = { ...WORK, fields: WORK.fields.filter((f) => f !== 'description') };
    expect(hiddenCopyTargets(bare, solution, 'Do it').map((f) => f.id)).toEqual(['f-criteria']);
  });

  it('copies the value and its formatting over the target, one undoable write', () => {
    const before = card({
      statusSince: 0,
      'f-solution': 'Do it',
      'f-solutionRich': [{ text: 'Do it', b: true }],
      'f-criteria': 'Old',
    });
    const patch = hiddenCopyPatch(before, solution, WORK.custom![0]!);
    expect(patch).toEqual({
      set: { 'f-criteria': 'Do it', 'f-criteriaRich': [{ text: 'Do it', b: true }] },
    });
    const ctx = { now: 1, by: before.createdBy };
    const after = applyPatch(before, patch, ctx);
    const undone = applyPatch(after, inversePatch(before, patch), ctx);
    expect(undone.fields).toEqual(before.fields);
  });

  it('drops the target’s own formatting when the copy brings none', () => {
    const before = card({ 'f-steps': 'Click', 'f-criteria': 'Old', 'f-criteriaRich': [] });
    const patch = hiddenCopyPatch(before, BUG.custom![0]!, WORK.custom![0]!);
    expect(patch).toEqual({ set: { 'f-criteria': 'Click' }, clear: ['f-criteriaRich'] });
  });

  it('removes one value and its formatting, undoably', () => {
    const before = card({
      statusSince: 0,
      'f-solution': 'Do it',
      'f-solutionRich': [],
      'f-steps': 'Keep',
    });
    const patch = hiddenRemovePatch(before, 'f-solution');
    expect(patch).toEqual({ clear: ['f-solution', 'f-solutionRich'] });
    expect(hiddenRemovePatch(before, 'f-steps')).toEqual({ clear: ['f-steps'] });
    const ctx = { now: 1, by: before.createdBy };
    const after = applyPatch(before, patch, ctx);
    expect(after.fields).toEqual({ statusSince: 0, 'f-steps': 'Keep' });
    expect(applyPatch(after, inversePatch(before, patch), ctx).fields).toEqual(before.fields);
  });
});
