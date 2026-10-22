import { describe, expect, it } from 'vitest';
import type { Item } from './item';
import {
  PLAN_VIEW_STATUSES_MAX,
  cardsInStatuses,
  isPlanViewStatuses,
  viewStatusOptions,
  viewTakesStatuses,
} from './plan-view-statuses';
import { isPlanViewSettings } from './plan-views';

// docs/specs/026-plan/plan-views.md "Statuses".
const SAM = { id: 'sam', name: 'Sam', color: '#2563eb' };
let n = 0;
const card = (fields: Item['fields']): Item => {
  n += 1;
  return {
    id: `c${n}`,
    type: 'task',
    key: n,
    rank: `r${n}`,
    fields,
    rev: 1,
    createdBy: SAM,
    updatedBy: SAM,
    createdAt: 0,
    updatedAt: 0,
  };
};

describe('isPlanViewStatuses', () => {
  it('accepts distinct non-empty status ids, up to the cap', () => {
    expect(isPlanViewStatuses(['todo', 'done'])).toBe(true);
    expect(
      isPlanViewStatuses(Array.from({ length: PLAN_VIEW_STATUSES_MAX }, (_, i) => `s${i}`)),
    ).toBe(true);
  });

  it('refuses an empty list, too many, blanks, duplicates, overlong ids and non-strings', () => {
    expect(isPlanViewStatuses([])).toBe(false);
    expect(
      isPlanViewStatuses(Array.from({ length: PLAN_VIEW_STATUSES_MAX + 1 }, (_, i) => `s${i}`)),
    ).toBe(false);
    expect(isPlanViewStatuses([' '])).toBe(false);
    expect(isPlanViewStatuses(['todo', 'todo'])).toBe(false);
    expect(isPlanViewStatuses(['x'.repeat(41)])).toBe(false);
    expect(isPlanViewStatuses([3])).toBe(false);
    expect(isPlanViewStatuses('todo')).toBe(false);
  });

  it('is what a view element validation accepts', () => {
    expect(isPlanViewSettings({ view: 'priority-matrix', statuses: ['todo'] })).toBe(true);
    expect(isPlanViewSettings({ view: 'priority-matrix', statuses: [] })).toBe(false);
    expect(isPlanViewSettings({ view: 'workload', statuses: [''] })).toBe(false);
  });
});

describe('viewTakesStatuses', () => {
  it('is the charts that count by status', () => {
    expect(viewTakesStatuses('priority-matrix')).toBe(true);
    expect(viewTakesStatuses('workload')).toBe(true);
    expect(viewTakesStatuses('gantt')).toBe(false);
    expect(viewTakesStatuses('search')).toBe(false);
  });
});

describe('cardsInStatuses', () => {
  const a = card({ status: 'todo' });
  const b = card({ status: 'done' });
  const c = card({});
  const all = new Map([a, b, c].map((x) => [x.id, x]));

  it('keeps every card when none are named', () => {
    expect(cardsInStatuses(all, undefined)).toBe(all);
    expect(cardsInStatuses(all, [])).toBe(all);
  });

  it('keeps the cards in a named status, leaving out cards with none', () => {
    expect([...cardsInStatuses(all, ['done']).keys()]).toEqual([b.id]);
    expect([...cardsInStatuses(all, ['todo', 'done']).keys()]).toEqual([a.id, b.id]);
  });
});

describe('viewStatusOptions', () => {
  it('lists the statuses live cards hold, in the boards order, then any other', () => {
    const names = new Map([
      ['todo', 'To Do'],
      ['doing', 'Doing'],
      ['done', 'Done'],
    ]);
    const cards = [
      card({ status: 'done' }),
      card({ status: 'in-review' }),
      card({ status: 'todo' }),
      card({}),
      card({ status: 'doing', archived: true }),
    ];
    expect(viewStatusOptions(cards, names)).toEqual([
      { id: 'todo', label: 'To Do' },
      { id: 'done', label: 'Done' },
      { id: 'in-review', label: 'In Review' },
    ]);
  });

  it('names statuses by their ids without names', () => {
    expect(viewStatusOptions([card({ status: 'todo' })])).toEqual([{ id: 'todo', label: 'Todo' }]);
  });
});
