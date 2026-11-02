// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ITEM_TYPES, type Item, type ItemTypeDef, type PlanBoardSetup } from '@liveplanner/items';
import { planPalette } from './plan-palette';
import { BoardSelectionBar } from './BoardSelectionBar';
import type { PlanContextValue } from './PlanContext';

// docs/specs/026-plan/plan-board.md "Several cards at once": the selection bar, one write per action.
const track = vi.fn<typeof import('@/lib/telemetry').track>();
vi.mock('@/lib/telemetry', () => ({ track: (...a: Parameters<typeof track>) => track(...a) }));

globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

afterEach(() => {
  cleanup();
  track.mockReset();
});

const by = { id: 'p', name: 'Sam', color: '#2563eb' };
const card = (id: string, fields: Item['fields'] = {}, type = 'task'): Item => ({
  id,
  type,
  key: 1,
  rank: id,
  fields: { title: id, status: 'todo', ...fields },
  rev: 1,
  createdAt: 0,
  updatedAt: 0,
  createdBy: by,
  updatedBy: by,
});
const types: ItemTypeDef[] = ITEM_TYPES.map((t) =>
  t.id === 'task'
    ? {
        ...t,
        fields: [...t.fields, 'f-size', 'f-pts'],
        custom: [
          ...(t.custom ?? []),
          { id: 'f-size', label: 'Size', kind: 'choice' as const, options: ['S', 'M'] },
          { id: 'f-pts', label: 'Points', kind: 'number' as const },
        ],
      }
    : t,
);
const a = card('a', { labels: ['ui'] });
const b = card('b', { flagged: true });
const setup = {
  columns: [
    { id: 'todo', status: 'todo', name: 'To Do' },
    { id: 'done', status: 'done', name: 'Done' },
  ],
} as unknown as PlanBoardSetup;
const ann = { id: 'ann', name: 'Ann', color: '#ff0000' };

function planOf(canEdit: boolean) {
  return {
    items: new Map([a, b].map((i) => [i.id, i])),
    types,
    people: [ann],
    canEdit,
    canEditCards: true,
    statusNames: new Map(),
    patchItems: vi.fn(),
    moveItems: vi.fn(),
    trashItems: vi.fn((ids: readonly string[]) => ids.length),
    announce: vi.fn(),
  } as unknown as PlanContextValue & {
    patchItems: ReturnType<typeof vi.fn>;
    moveItems: ReturnType<typeof vi.fn>;
    trashItems: ReturnType<typeof vi.fn>;
    announce: ReturnType<typeof vi.fn>;
  };
}

const bar = (plan: ReturnType<typeof planOf>, onClear = vi.fn()) =>
  render(
    <BoardSelectionBar
      plan={plan}
      setup={setup}
      ordered={['a', 'b']}
      palette={planPalette('light')}
      onClear={onClear}
    />,
  );
const pick = (name: string) => fireEvent.click(screen.getByRole('button', { name }));
const dialog = () => screen.getByRole('dialog');

describe('BoardSelectionBar', () => {
  it('gives an Editor every action, with the count', () => {
    bar(planOf(true));
    const toolbar = screen.getByRole('toolbar', { name: 'Selected cards' });
    expect(toolbar.textContent).toContain('2 cards selected');
    for (const name of ['Move To', 'Assign', 'Priority', 'Labels', 'Set Field', 'Flag'])
      expect(within(toolbar).getByRole('button', { name })).toBeTruthy();
    expect(within(toolbar).getByRole('button', { name: 'Archive' })).toBeTruthy();
    expect(within(toolbar).getByRole('button', { name: 'Move to Trash' })).toBeTruthy();
  });

  it('gives a Participant no Archive nor Move to Trash', () => {
    bar(planOf(false));
    expect(screen.getByRole('button', { name: 'Move To' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Archive' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Move to Trash' })).toBeNull();
  });

  it('moves every card to a column as one write, in order', () => {
    const plan = planOf(false);
    bar(plan);
    pick('Move To');
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Done' }));
    expect(plan.moveItems).toHaveBeenCalledOnce();
    expect(plan.moveItems.mock.calls[0]![0]).toEqual([
      { id: 'a', move: { status: 'done', before: null } },
      { id: 'b', move: { status: 'done', after: 'a' } },
    ]);
    expect(track).toHaveBeenCalledWith('Plan', 'Moved', 'Cards');
    expect(plan.announce).toHaveBeenCalledWith('2 cards moved to Done');
  });

  it('says so when the cards are already in that column', () => {
    const plan = planOf(false);
    bar(plan);
    pick('Move To');
    fireEvent.click(within(dialog()).getByRole('button', { name: 'To Do' }));
    expect(plan.moveItems).not.toHaveBeenCalled();
    expect(plan.announce).toHaveBeenCalledWith('No selected card changed');
  });

  it('assigns, unassigns and sets a priority, each one write', () => {
    const plan = planOf(false);
    bar(plan);
    pick('Assign');
    fireEvent.click(within(dialog()).getByRole('button', { name: /Ann/ }));
    expect(plan.patchItems).toHaveBeenLastCalledWith([
      { id: 'a', patch: { set: { assignee: ann } } },
      { id: 'b', patch: { set: { assignee: ann } } },
    ]);
    pick('Assign');
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Unassign' }));
    expect(plan.announce).toHaveBeenLastCalledWith('No selected card changed');
    pick('Priority');
    fireEvent.click(within(dialog()).getByRole('button', { name: 'High' }));
    expect(plan.patchItems).toHaveBeenCalledTimes(2);
    expect(track).toHaveBeenCalledWith('Plan', 'Changed', 'Cards');
  });

  it('adds, creates and takes off labels', () => {
    const plan = planOf(false);
    bar(plan);
    pick('Labels');
    const add = within(dialog()).getByRole('group', { name: 'Add a label to the selected cards' });
    fireEvent.click(within(add).getByRole('button', { name: 'ui' }));
    expect(plan.patchItems).toHaveBeenLastCalledWith([
      { id: 'b', patch: { set: { labels: ['ui'] } } },
    ]);
    pick('Labels');
    fireEvent.change(screen.getByRole('textbox', { name: 'Find or create a label' }), {
      target: { value: 'api' },
    });
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Create “api”' }));
    expect(plan.patchItems).toHaveBeenCalledTimes(2);
    pick('Labels');
    const remove = within(dialog()).getByRole('group', {
      name: 'Take a label off the selected cards',
    });
    fireEvent.click(within(remove).getByRole('button', { name: 'ui' }));
    expect(plan.patchItems).toHaveBeenLastCalledWith([{ id: 'a', patch: { clear: ['labels'] } }]);
  });

  it('creates a label with Enter', () => {
    const plan = planOf(false);
    bar(plan);
    pick('Labels');
    const box = screen.getByRole('textbox', { name: 'Find or create a label' });
    fireEvent.change(box, { target: { value: 'u' } });
    fireEvent.keyDown(box, { key: 'Enter' });
    expect(plan.patchItems).toHaveBeenLastCalledWith(
      [
        { id: 'b', patch: { set: { labels: ['u'] } } },
        { id: 'a', patch: { set: { labels: ['ui', 'u'] } } },
      ].sort((x, y) => x.id.localeCompare(y.id)),
    );
  });

  it('sets a choice field and a number field, and clears one', () => {
    const plan = planOf(false);
    bar(plan);
    pick('Set Field');
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Size' }));
    fireEvent.click(within(dialog()).getByRole('button', { name: 'M' }));
    expect(plan.patchItems).toHaveBeenLastCalledWith([
      { id: 'a', patch: { set: { 'f-size': 'M' } } },
      { id: 'b', patch: { set: { 'f-size': 'M' } } },
    ]);
    pick('Set Field');
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Points' }));
    const set = within(dialog()).getByRole('button', { name: 'Set' }) as HTMLButtonElement;
    expect(set.disabled).toBe(true);
    fireEvent.change(within(dialog()).getByRole('spinbutton', { name: 'Points' }), {
      target: { value: '5' },
    });
    fireEvent.click(set);
    expect(plan.patchItems).toHaveBeenLastCalledWith([
      { id: 'a', patch: { set: { 'f-pts': 5 } } },
      { id: 'b', patch: { set: { 'f-pts': 5 } } },
    ]);
    pick('Set Field');
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Points' }));
    fireEvent.click(within(dialog()).getByRole('button', { name: /^Set Field/ }));
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Size' }));
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Clear' }));
    expect(plan.announce).toHaveBeenLastCalledWith('No selected card changed');
  });

  it('flags, archives and trashes; Clear Selection lets go', () => {
    const plan = planOf(true);
    const onClear = vi.fn();
    bar(plan, onClear);
    pick('Flag');
    expect(plan.patchItems).toHaveBeenLastCalledWith([
      { id: 'a', patch: { set: { flagged: true } } },
    ]);
    pick('Archive');
    expect(plan.patchItems).toHaveBeenCalledTimes(2);
    pick('Move to Trash');
    expect(plan.trashItems).toHaveBeenCalledWith(['a', 'b']);
    expect(plan.announce).toHaveBeenLastCalledWith('2 cards moved to the Trash');
    expect(onClear).toHaveBeenCalledOnce();
    pick('Clear Selection');
    expect(onClear).toHaveBeenCalledTimes(2);
  });

  it('closes a menu pressed again', () => {
    bar(planOf(true));
    pick('Move To');
    expect(screen.getByRole('dialog')).toBeTruthy();
    pick('Move To');
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
