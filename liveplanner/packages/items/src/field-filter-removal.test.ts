import { describe, expect, it } from 'vitest';
import type { PlanBoardSetup } from './board';
import {
  boardWithoutFieldFilters,
  clauseNamesField,
  fieldRetypeTargets,
  viewWithoutFieldFilters,
  type FieldRetypeTarget,
} from './field-filter-removal';
import { ITEM_TYPES, type ItemTypeDef } from './item-types';

// docs/specs/026-plan/item-types.md "Edit Field": Filters on the field.
const TASK: ItemTypeDef = {
  ...ITEM_TYPES.find((t) => t.id === 'task')!,
  fields: ['title', 'status', 'assignee', 'priority', 'due', 'f-size'],
  custom: [{ id: 'f-size', label: 'Size', kind: 'choice', options: ['S', 'M'] }],
};
const NOTE: ItemTypeDef = { ...TASK, id: 'note', label: 'Note', fields: ['title', 'status'] };
const without = (t: ItemTypeDef, f: string): ItemTypeDef => ({
  ...t,
  fields: t.fields.filter((x) => x !== f),
});

const board = (extra: Partial<PlanBoardSetup>): PlanBoardSetup => ({
  title: 'Sprint',
  columns: [{ id: 'c', status: 'todo', name: 'To Do' }],
  swimlaneBy: 'none',
  cardFields: [],
  hideWriting: false,
  ...extra,
});

const custom: FieldRetypeTarget = { field: 'f-size', builtIn: false, typesAfter: [TASK] };

describe('which clauses name the field', () => {
  it('reads a field clause by id and a built-in by its grouping', () => {
    expect(clauseNamesField({ by: 'field', field: 'f-size', key: 'S' }, 'f-size')).toBe(true);
    expect(clauseNamesField({ by: 'field', field: 'f-other', key: 'S' }, 'f-size')).toBe(false);
    expect(clauseNamesField({ by: 'assignee', key: 'p' }, 'assignee')).toBe(true);
    expect(clauseNamesField({ by: 'priority', key: 'high' }, 'priority')).toBe(true);
    expect(clauseNamesField({ by: 'type', key: 'task' }, 'f-size')).toBe(false);
  });
});

describe('a board’s saved filters', () => {
  it('takes a custom field’s chips off, removing a saved filter left empty', () => {
    const setup = board({
      savedFilters: [
        { id: 'a', name: 'Small', filters: [{ by: 'field', field: 'f-size', key: 'S' }] },
        {
          id: 'b',
          name: 'Mine small',
          mine: true,
          filters: [
            { by: 'field', field: 'f-size', key: 'S' },
            { by: 'type', key: 'task' },
          ],
        },
        { id: 'c', name: 'Text', text: 'login' },
      ],
    });
    const out = boardWithoutFieldFilters(setup, custom);
    expect(out.removed).toBe(2);
    expect(out.setup.savedFilters).toEqual([
      { id: 'b', name: 'Mine small', mine: true, filters: [{ by: 'type', key: 'task' }] },
      { id: 'c', name: 'Text', text: 'login' },
    ]);
  });

  it('leaves a board with nothing on the field as it is', () => {
    const setup = board({ savedFilters: [{ id: 'c', name: 'Text', text: 'login' }] });
    expect(boardWithoutFieldFilters(setup, custom).setup).toBe(setup);
    const bare = board({});
    expect(boardWithoutFieldFilters(bare, custom).setup).toBe(bare);
  });

  it('drops the saved filters whole when the last is emptied', () => {
    const setup = board({
      savedFilters: [
        { id: 'a', name: 'Small', filters: [{ by: 'field', field: 'f-size', key: 'S' }] },
      ],
    });
    expect(boardWithoutFieldFilters(setup, custom).setup.savedFilters).toBeUndefined();
  });

  it('takes a built-in’s person, priority and window off only where no type holds it any more', () => {
    const setup = board({
      addTypes: ['task'],
      savedFilters: [
        { id: 'a', name: 'Sam', person: 'p-sam', text: 'x' },
        { id: 'b', name: 'High', priority: 'high' },
        { id: 'c', name: 'Late', due: 'overdue' },
      ],
    });
    const assignee = boardWithoutFieldFilters(setup, {
      field: 'assignee',
      builtIn: true,
      typesAfter: [without(TASK, 'assignee')],
    });
    expect(assignee.removed).toBe(1);
    expect(assignee.setup.savedFilters?.[0]).toEqual({ id: 'a', name: 'Sam', text: 'x' });
    const priority = boardWithoutFieldFilters(setup, {
      field: 'priority',
      builtIn: true,
      typesAfter: [without(TASK, 'priority')],
    });
    expect(priority.setup.savedFilters?.map((f) => f.id)).toEqual(['a', 'c']);
    const due = boardWithoutFieldFilters(setup, {
      field: 'due',
      builtIn: true,
      typesAfter: [without(TASK, 'due')],
    });
    expect(due.removed).toBe(1);
    // Another type on the board still holds Priority: its filter still matches, so it stays.
    const mixed = boardWithoutFieldFilters(board({ savedFilters: setup.savedFilters }), {
      field: 'priority',
      builtIn: true,
      typesAfter: [without(TASK, 'priority'), { ...TASK, id: 'bug' }],
    });
    expect(mixed.removed).toBe(0);
    expect(NOTE.fields).not.toContain('priority');
  });
});

describe('a view’s filters', () => {
  it('takes the field’s filters off, leaving no list when none is left', () => {
    const settings = {
      view: 'search' as const,
      filters: [{ by: 'field' as const, field: 'f-size', key: 'S' }],
    };
    const out = viewWithoutFieldFilters(settings, custom);
    expect(out.removed).toBe(1);
    expect(out.settings).toEqual({ view: 'search' });
    const two = {
      view: 'search' as const,
      filters: [
        { by: 'field' as const, field: 'f-size', key: 'S' },
        { by: 'type' as const, key: 'task' },
      ],
    };
    expect(viewWithoutFieldFilters(two, custom).settings.filters).toEqual([
      { by: 'type', key: 'task' },
    ]);
  });

  it('leaves a view without such a filter, or a built-in another type it draws still holds', () => {
    const none = { view: 'search' as const, filters: [{ by: 'type' as const, key: 'task' }] };
    expect(viewWithoutFieldFilters(none, custom).settings).toBe(none);
    const held = {
      view: 'search' as const,
      types: ['task', 'bug'],
      filters: [{ by: 'priority' as const, key: 'high' }],
    };
    const target: FieldRetypeTarget = {
      field: 'priority',
      builtIn: true,
      typesAfter: [without(TASK, 'priority'), { ...TASK, id: 'bug' }],
    };
    expect(viewWithoutFieldFilters(held, target).removed).toBe(0);
    expect(viewWithoutFieldFilters({ ...held, types: ['task'] }, target).removed).toBe(1);
  });
});

describe('the fields a save changes the type of', () => {
  it('names each custom field whose kind changed and each built-in made a custom field', () => {
    const after: ItemTypeDef = {
      ...TASK,
      custom: [{ id: 'f-size', label: 'Size', kind: 'number' }],
    };
    expect(fieldRetypeTargets(TASK, after, { 'f-urgency': 'priority' }, [after])).toEqual([
      { field: 'f-size', builtIn: false, typesAfter: [after] },
      { field: 'priority', builtIn: true, typesAfter: [after] },
    ]);
    expect(fieldRetypeTargets(TASK, TASK, {}, [TASK])).toEqual([]);
    expect(fieldRetypeTargets({ ...TASK, custom: undefined }, after, {}, [after])).toEqual([]);
  });
});
