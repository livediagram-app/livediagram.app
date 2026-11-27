import { describe, expect, it } from 'vitest';
import { ITEM_TYPES, type ItemTypeDef, type StatusPhase } from '@liveplanner/items';
import { PHASE_COLOURS } from '@liveplanner/plan-art';
import { statusDotColour, statusOptionsOf, statusPillGroups } from './status-options';

// docs/specs/026-plan/plan-board.md "status pill" and item-types.md "The statuses a type uses": the columns the Details
// picker and the phone's status pill offer, split open from done, and the colour each one's dot takes.
const TASK = ITEM_TYPES.find((t) => t.id === 'task')!;
const STATUSES = [
  { status: 'todo', name: 'To Do' },
  { status: 'doing', name: 'Doing' },
  { status: 'done', name: 'Done' },
  { status: 'cancelled', name: 'Cancelled' },
];
const PHASES = new Map<string, StatusPhase>([
  ['todo', 'todo'],
  ['doing', 'doing'],
  ['done', 'done'],
  ['cancelled', 'done'],
]);

describe('statusOptionsOf', () => {
  it('lists every status the plan names for a type that uses them all, in order', () => {
    const plain: ItemTypeDef = { ...TASK, statuses: undefined, excludedStatuses: undefined };
    expect(statusOptionsOf(plain, STATUSES, 'todo')).toEqual(STATUSES);
  });

  it('keeps to the type’s own statuses and order, skipping one no board names', () => {
    const own: ItemTypeDef = { ...TASK, statuses: ['doing', 'gone', 'todo'] };
    expect(statusOptionsOf(own, STATUSES, 'todo').map((o) => o.status)).toEqual(['doing', 'todo']);
  });

  it('shows a status the type leaves out only while the card is in it, last and marked', () => {
    const own: ItemTypeDef = { ...TASK, label: 'Task', statuses: ['todo', 'doing'] };
    expect(statusOptionsOf(own, STATUSES, 'done').at(-1)).toEqual({
      status: 'done',
      name: 'Done (not used by Task)',
      excluded: true,
    });
    expect(statusOptionsOf(own, STATUSES, 'todo').some((o) => o.excluded)).toBe(false);
  });
});

describe('statusPillGroups', () => {
  it('puts the done columns in a group of their own, each group in board order', () => {
    const groups = statusPillGroups(STATUSES, PHASES);
    expect(groups.open.map((o) => o.status)).toEqual(['todo', 'doing']);
    expect(groups.done.map((o) => o.status)).toEqual(['done', 'cancelled']);
  });

  it('reads a status no board phases as open', () => {
    expect(statusPillGroups([{ status: 'x', name: 'X' }], new Map()).open).toHaveLength(1);
  });
});

describe('statusDotColour', () => {
  it('takes the first board’s column colour for the status', () => {
    const boards = [
      { colours: new Map([['todo', '#111111']]) },
      { colours: new Map([['doing', '#222222']]) },
      { colours: new Map([['doing', '#333333']]) },
    ];
    expect(statusDotColour('doing', boards, PHASES)).toBe('#222222');
  });

  it('falls back to the stage’s colour, and Not Started’s for a status no board phases', () => {
    expect(statusDotColour('cancelled', [{}], PHASES)).toBe(PHASE_COLOURS.done);
    expect(statusDotColour('x', [], PHASES)).toBe(PHASE_COLOURS.todo);
  });
});
