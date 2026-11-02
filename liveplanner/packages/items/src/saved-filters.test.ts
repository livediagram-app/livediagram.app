import { describe, expect, it } from 'vitest';
import {
  SAVED_FILTERS_MAX,
  addSavedFilter,
  isSavedBoardFilters,
  quickNarrows,
  readSavedFilters,
  removeSavedFilter,
  renameSavedFilter,
  resolveSavedFilter,
  savedFilterFrom,
  savedFilterNameTaken,
  updateSavedFilter,
  type SavedBoardFilter,
} from './saved-filters';
import { normaliseBoardSetup } from './board';
import { todayNumber } from './plan-view-dates';

const bugs: SavedBoardFilter = {
  id: 'sf-1',
  name: 'My Bugs',
  mine: true,
  filters: [{ by: 'type', key: 't:bug' }],
};

describe('isSavedBoardFilters', () => {
  it('accepts well-formed filters', () => {
    expect(
      isSavedBoardFilters([
        bugs,
        {
          id: 'sf-2',
          name: 'Due',
          due: 'soon',
          text: 'ui',
          priority: 'high',
          person: 'p',
          type: 'bug',
        },
      ]),
    ).toBe(true);
  });

  it.each([
    ['not a list', 'x'],
    [
      'too many',
      Array.from({ length: SAVED_FILTERS_MAX + 1 }, (_, i) => ({ id: `s${i}`, name: 'n' })),
    ],
    ['a repeated id', [bugs, { ...bugs, name: 'Other' }]],
    ['not an object', [3]],
    ['no id', [{ name: 'n' }]],
    ['a long id', [{ id: 'x'.repeat(41), name: 'n' }]],
    ['a blank name', [{ id: 's', name: '  ' }]],
    ['a long name', [{ id: 's', name: 'n'.repeat(41) }]],
    ['long words', [{ id: 's', name: 'n', text: 'w'.repeat(201) }]],
    ['mine not true', [{ id: 's', name: 'n', mine: 'yes' }]],
    ['bad chips', [{ id: 's', name: 'n', filters: [{ by: 'nope', key: '' }] }]],
    ['a blank person', [{ id: 's', name: 'n', person: '' }]],
    ['a bad type', [{ id: 's', name: 'n', type: 'Not A Type!' }]],
    ['a bad priority', [{ id: 's', name: 'n', priority: 'extreme' }]],
    ['a bad due window', [{ id: 's', name: 'n', due: 'tomorrow' }]],
  ])('refuses %s', (_, v) => {
    expect(isSavedBoardFilters(v)).toBe(false);
  });
});

describe('readSavedFilters', () => {
  it('keeps the well-formed ones, each id once, at most the cap', () => {
    const many = Array.from({ length: 10 }, (_, i) => ({ id: `s${i}`, name: `n${i}` }));
    expect(readSavedFilters([{ id: '' }, bugs, bugs, ...many])).toHaveLength(SAVED_FILTERS_MAX);
    expect(readSavedFilters('x')).toBeUndefined();
    expect(readSavedFilters([{ nope: 1 }])).toBeUndefined();
  });

  it('rides normaliseBoardSetup', () => {
    const setup = normaliseBoardSetup({
      columns: [{ id: 'c', status: 'todo' }],
      savedFilters: [bugs, { junk: true }],
    });
    expect(setup?.savedFilters).toEqual([bugs]);
    expect(normaliseBoardSetup({ columns: [] })?.savedFilters).toBeUndefined();
  });
});

describe('from a quick filter and back', () => {
  const now = new Date(2026, 9, 14, 12);
  const today = todayNumber(now);

  it('keeps Only Mine as a flag and a due window as what it means', () => {
    const saved = savedFilterFrom(
      {
        text: '  login ',
        mine: 'p-sam',
        filters: [{ by: 'priority', key: 'p:high' }],
        person: 'p-ali',
        type: 'bug',
        priority: 'high',
        due: { to: '2026-10-13' },
      },
      '  Overdue Bugs ',
      'sf-9',
    );
    expect(saved).toEqual({
      id: 'sf-9',
      name: 'Overdue Bugs',
      text: 'login',
      mine: true,
      filters: [{ by: 'priority', key: 'p:high' }],
      person: 'p-ali',
      type: 'bug',
      priority: 'high',
      due: 'overdue',
    });
    expect(savedFilterFrom({ due: { from: 'a', to: 'b' } }, 'Soon', 's').due).toBe('soon');
    expect(savedFilterFrom({}, 'Nothing', 's')).toEqual({ id: 's', name: 'Nothing' });
  });

  it('resolves Only Mine for whoever applies it, and windows from today', () => {
    const overdue = resolveSavedFilter(
      {
        id: 's',
        name: 'n',
        mine: true,
        due: 'overdue',
        text: 'x',
        person: 'p',
        type: 't',
        priority: 'low',
        filters: [{ by: 'type', key: 't:bug' }],
      },
      { mine: 'p-ali', today, soonDays: 7, finished: ['done'] },
    );
    expect(overdue).toEqual({
      text: 'x',
      mine: 'p-ali',
      filters: [{ by: 'type', key: 't:bug' }],
      person: 'p',
      type: 't',
      priority: 'low',
      due: { to: '2026-10-13', finished: ['done'] },
    });
    const soon = resolveSavedFilter(
      { id: 's', name: 'n', mine: true, due: 'soon' },
      { mine: null, today, soonDays: 7, finished: [] },
    );
    expect(soon).toEqual({ due: { from: '2026-10-14', to: '2026-10-21' } });
  });

  it('says whether a quick filter narrows at all', () => {
    expect(quickNarrows({})).toBe(false);
    expect(quickNarrows({ text: '  ' })).toBe(false);
    expect(quickNarrows({ filters: [] })).toBe(false);
    for (const q of [
      { text: 'a' },
      { mine: 'p' },
      { filters: [{ by: 'type' as const, key: 't' }] },
      { person: 'p' },
      { type: 't' },
      { priority: 'low' as const },
      { due: { to: 'x' } },
    ])
      expect(quickNarrows(q)).toBe(true);
  });
});

describe('list edits', () => {
  it('adds up to the cap, renames, updates, removes and checks names', () => {
    let list = addSavedFilter(undefined, bugs);
    expect(list).toEqual([bugs]);
    const full = Array.from({ length: SAVED_FILTERS_MAX }, (_, i) => ({
      id: `s${i}`,
      name: `n${i}`,
    }));
    expect(addSavedFilter(full, bugs)).toHaveLength(SAVED_FILTERS_MAX);
    list = renameSavedFilter(list, 'sf-1', '  Our Bugs ');
    expect(list[0]!.name).toBe('Our Bugs');
    expect(renameSavedFilter(list, 'other', 'x')).toEqual(list);
    list = updateSavedFilter(list, 'sf-1', { text: 'ui' });
    expect(list[0]).toEqual({ id: 'sf-1', name: 'Our Bugs', text: 'ui' });
    expect(updateSavedFilter(list, 'other', {})).toEqual(list);
    expect(savedFilterNameTaken(list, ' our bugs ')).toBe(true);
    expect(savedFilterNameTaken(list, 'our bugs', 'sf-1')).toBe(false);
    expect(savedFilterNameTaken(undefined, 'x')).toBe(false);
    expect(removeSavedFilter(list, 'sf-1')).toEqual([]);
  });
});
