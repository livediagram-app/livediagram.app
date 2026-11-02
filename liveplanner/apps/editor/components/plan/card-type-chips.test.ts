import { describe, expect, it } from 'vitest';
import {
  ITEM_TYPES,
  presetSetup,
  projectBoard,
  type Item,
  type PlanBoardSetup,
} from '@liveplanner/items';
import { resolveEditorCapabilities } from '@/lib/editor-capabilities';
import { chipClickCell, chipsShown } from './card-type-chips';

// docs/specs/026-plan/plan-board.md "Card type chips".
const kanban = presetSetup('kanban');
const statusNames = new Map(kanban.columns.map((c) => [c.status, c.name]));
const shown = (over: Partial<Parameters<typeof chipsShown>[0]> = {}) =>
  chipsShown({
    interactive: true,
    canEditCards: true,
    phone: false,
    simplified: false,
    setup: kanban,
    types: ITEM_TYPES,
    ...over,
  });

describe('who sees the card type chips', () => {
  it('shows them to an Editor and a Participant, never a Viewer (share roles: a card is a Participant’s to add)', () => {
    const can = (level: 'edit' | 'participate' | 'view') =>
      resolveEditorCapabilities({ level, adderKey: 'k' }).planCards;
    expect(shown({ canEditCards: can('edit') })).toBe(true);
    expect(shown({ canEditCards: can('participate') })).toBe(true);
    expect(shown({ canEditCards: can('view') })).toBe(false);
  });

  it('hides them outside Plan mode, on a phone and in a Dashboard slot', () => {
    expect(shown({ interactive: false })).toBe(false);
    expect(shown({ phone: true })).toBe(false);
    expect(shown({ simplified: true })).toBe(false);
  });

  it('hides them on an Archive board, a board not set up and a board taking no types', () => {
    expect(shown({ setup: { ...kanban, archive: true } })).toBe(false);
    expect(shown({ setup: { ...kanban, columns: [] } })).toBe(false);
    expect(shown({ types: [] })).toBe(false);
  });
});

describe('where a chip’s click adds its card', () => {
  const card = (id: string, status: string, rank: string): Item =>
    ({ id, key: 1, type: 'task', rank, fields: { title: id, status } }) as unknown as Item;

  it('adds to the column of the type’s starting status, after its last card', () => {
    const items = new Map([
      ['a', card('a', 'todo', 'a0')],
      ['b', card('b', 'todo', 'a1')],
    ]);
    const projection = projectBoard(kanban, items, undefined, ITEM_TYPES, statusNames);
    const at = chipClickCell(kanban, projection, ITEM_TYPES, 'task', statusNames);
    expect(at).toMatchObject({ type: 'task', status: 'todo', after: 'b', columnName: 'To Do' });
    expect(at?.fields.title).toBe('New task');
  });

  it('falls back to the board’s first column when it has no column for the starting status', () => {
    const setup: PlanBoardSetup = {
      ...kanban,
      columns: kanban.columns.filter((c) => c.status !== 'todo' && c.status !== 'backlog'),
    };
    const names = new Map(setup.columns.map((c) => [c.status, c.name]));
    const projection = projectBoard(setup, new Map(), undefined, ITEM_TYPES, names);
    const at = chipClickCell(setup, projection, ITEM_TYPES, 'task', names);
    expect(at).toMatchObject({ status: setup.columns[0]!.status, after: null });
  });

  it('takes the first row’s field on a board with swimlanes', () => {
    const setup: PlanBoardSetup = { ...kanban, swimlaneBy: 'priority' };
    const projection = projectBoard(setup, new Map(), undefined, ITEM_TYPES, statusNames);
    expect(projection.swimlanes).toBe(true);
    const at = chipClickCell(setup, projection, ITEM_TYPES, 'task', statusNames);
    const lane = projection.lanes[0]!;
    expect(at?.fields).toMatchObject({ title: 'New task' });
    if (lane.value !== null && lane.value !== undefined)
      expect(at?.fields.priority).toBe(lane.value);
  });

  it('adds nothing on a board with no columns', () => {
    const setup: PlanBoardSetup = { ...kanban, columns: [] };
    const projection = projectBoard(setup, new Map(), undefined, ITEM_TYPES, statusNames);
    expect(chipClickCell(setup, projection, ITEM_TYPES, 'task', statusNames)).toBeNull();
  });
});
