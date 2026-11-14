import { describe, expect, it } from 'vitest';
import {
  boardFilterFrom,
  boardFilterKey,
  isBoardFilter,
  readBoardFilter,
  resolveBoardFilter,
} from './board-filter';
import { normaliseBoardSetup } from './board';
import { boardWithoutFieldFilters } from './field-filter-removal';
import { ITEM_TYPES } from './item-types';

// The board's filter (docs/specs/026-plan/board-widgets.md "The board's filter"; Work Tracker 842).
const chip = { by: 'type' as const, key: 'bug' };
const opts = { mine: 'p1', today: 20_000, soonDays: 7, finished: ['done'] };

describe('isBoardFilter', () => {
  it('accepts what a saved filter narrows by, and nothing past its limits', () => {
    expect(isBoardFilter({ text: 'login', mine: true, filters: [chip], due: 'soon' })).toBe(true);
    expect(isBoardFilter({})).toBe(true);
    expect(isBoardFilter({ text: 'x'.repeat(200) })).toBe(true);
    expect(isBoardFilter({ text: 'x'.repeat(201) })).toBe(false);
    expect(isBoardFilter({ filters: Array.from({ length: 8 }, () => chip) })).toBe(true);
    expect(isBoardFilter({ filters: Array.from({ length: 9 }, () => chip) })).toBe(false);
    expect(isBoardFilter({ mine: 'p1' })).toBe(false);
    expect(isBoardFilter({ id: 'f1' })).toBe(false);
    expect(isBoardFilter('login')).toBe(false);
  });
});

describe('readBoardFilter', () => {
  it('keeps a valid filter that narrows, and drops an empty or broken one', () => {
    expect(readBoardFilter({ text: 'login' })).toEqual({ text: 'login' });
    expect(readBoardFilter({ text: '   ' })).toBeUndefined();
    expect(readBoardFilter({})).toBeUndefined();
    expect(readBoardFilter({ text: 1 })).toBeUndefined();
  });

  it('is kept by normaliseBoardSetup', () => {
    const base = { columns: [{ id: 'c1', status: 'todo', name: 'To Do' }] };
    expect(normaliseBoardSetup({ ...base, filter: { mine: true } })?.filter).toEqual({
      mine: true,
    });
    expect(normaliseBoardSetup({ ...base, filter: { mine: 'p1' } })?.filter).toBeUndefined();
  });
});

describe('boardFilterFrom and resolveBoardFilter', () => {
  it('keeps Only Mine as a flag and resolves it for each viewer', () => {
    const f = boardFilterFrom({ text: 'login ', mine: 'p9', filters: [chip] });
    expect(f).toEqual({ text: 'login ', mine: true, filters: [chip] });
    expect(resolveBoardFilter(f, opts)).toEqual({ text: 'login ', mine: 'p1', filters: [chip] });
    expect(resolveBoardFilter(f, { ...opts, mine: null })).toEqual({
      text: 'login ',
      filters: [chip],
    });
  });

  it('keeps the widget narrowings, a due window as what it means', () => {
    expect(
      boardFilterFrom({
        person: 'p2',
        type: 'bug',
        priority: 'high',
        due: { from: '2026-11-14', to: '2026-11-21' },
      }),
    ).toEqual({ person: 'p2', type: 'bug', priority: 'high', due: 'soon' });
    expect(boardFilterFrom({ due: { to: '2026-11-13' } })).toEqual({ due: 'overdue' });
    expect(resolveBoardFilter({ due: 'overdue' }, opts).due?.finished).toEqual(['done']);
  });

  it('is undefined when nothing narrows, and cuts long words', () => {
    expect(boardFilterFrom({})).toBeUndefined();
    expect(boardFilterFrom({ text: '  ', filters: [] })).toBeUndefined();
    expect(boardFilterFrom({ text: 'y'.repeat(300) })?.text).toHaveLength(200);
    expect(resolveBoardFilter(undefined, opts)).toEqual({});
  });
});

describe('boardFilterKey', () => {
  it('compares filters whatever their key order', () => {
    expect(boardFilterKey({ text: 'a', mine: true })).toBe(
      boardFilterKey({ mine: true, text: 'a' }),
    );
    expect(boardFilterKey({ text: 'a' })).not.toBe(boardFilterKey({ text: 'b' }));
    expect(boardFilterKey(undefined)).toBe('');
  });
});

describe("a field's type change and the board's filter", () => {
  const setup = normaliseBoardSetup({
    columns: [{ id: 'c1', status: 'todo', name: 'To Do' }],
  })!;
  const target = { field: 'sev', builtIn: false, typesAfter: ITEM_TYPES };
  const sevChip = { by: 'field' as const, field: 'sev', key: 'high' };

  it("takes the field's chips off the board's filter, keeping the rest", () => {
    const out = boardWithoutFieldFilters(
      { ...setup, filter: { text: 'x', filters: [sevChip] } },
      target,
    );
    expect(out.removed).toBe(1);
    expect(out.setup.filter).toEqual({ text: 'x' });
  });

  it('removes a filter left with nothing to narrow by', () => {
    const out = boardWithoutFieldFilters({ ...setup, filter: { filters: [sevChip] } }, target);
    expect(out.removed).toBe(1);
    expect(out.setup.filter).toBeUndefined();
  });

  it('leaves a filter that does not name the field', () => {
    const out = boardWithoutFieldFilters({ ...setup, filter: { text: 'x' } }, target);
    expect(out.removed).toBe(0);
  });
});
