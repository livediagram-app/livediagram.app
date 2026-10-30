// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ITEM_TYPES, presetSetup, projectBoard } from '@liveplanner/items';
import { planPalette } from './plan-palette';
import { BoardCardTypeChips } from './BoardCardTypeChips';

// docs/specs/026-plan/plan-board.md "Card type chips".
const setup = presetSetup('kanban');
const statusNames = new Map(setup.columns.map((c) => [c.status, c.name]));
const plan = {
  types: ITEM_TYPES,
  statusNames,
  addItem: vi.fn(),
  openNewItem: vi.fn(),
  announce: vi.fn(),
};
vi.mock('./PlanContext', () => ({ usePlan: () => plan }));

afterEach(() => vi.clearAllMocks());

const palette = planPalette('light');
const projection = projectBoard(setup, new Map(), undefined, ITEM_TYPES, statusNames);
const chips = (types = ITEM_TYPES.slice(0, 2)) =>
  render(
    <BoardCardTypeChips setup={setup} projection={projection} types={types} palette={palette} />,
  );

describe('the card type chips', () => {
  it('names each type it takes, as a button in an Add Cards group', () => {
    const two = ITEM_TYPES.slice(0, 2);
    chips(two);
    expect(screen.getByRole('group', { name: 'Add Cards' })).toBeTruthy();
    const buttons = screen.getAllByRole('button');
    expect(buttons.map((b) => b.getAttribute('aria-label'))).toEqual(
      two.map((t) => `Add a ${t.label}`),
    );
    expect(buttons.map((b) => b.textContent)).toEqual(two.map((t) => t.label));
  });

  it('drops the names past three types, keeping the accessible names', () => {
    const four = ITEM_TYPES.slice(0, 4);
    expect(four).toHaveLength(4);
    chips(four);
    const buttons = screen.getAllByRole('button');
    expect(buttons.map((b) => b.textContent)).toEqual(['', '', '', '']);
    expect(buttons[3]!.getAttribute('aria-label')).toBe(`Add a ${four[3]!.label}`);
  });

  it('adds a card and opens it on a click, announcing where it went', () => {
    const task = ITEM_TYPES.find((t) => t.id === 'task')!;
    chips([task]);
    const button = screen.getByRole('button', { name: 'Add a Task' });
    act(() => {
      fireEvent.pointerDown(button, { button: 0, pointerId: 1, clientX: 0, clientY: 0 });
      fireEvent.pointerUp(window, { pointerId: 1, clientX: 0, clientY: 0 });
    });
    expect(plan.addItem).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'task', status: 'todo', after: null }),
    );
    const id = (plan.addItem.mock.calls[0]![0] as { id: string }).id;
    expect(plan.openNewItem).toHaveBeenCalledWith(id);
    expect(plan.announce).toHaveBeenCalledWith('Task added to To Do');
    // The pointer's own click event is the drag hook's: it adds no second card.
    fireEvent.click(button, { detail: 1 });
    expect(plan.addItem).toHaveBeenCalledTimes(1);
  });

  it('adds one from the keyboard', () => {
    chips([ITEM_TYPES.find((t) => t.id === 'task')!]);
    fireEvent.click(screen.getByRole('button', { name: 'Add a Task' }), { detail: 0 });
    expect(plan.addItem).toHaveBeenCalledTimes(1);
  });

  it('keeps a double-click from renaming the board', () => {
    const onDoubleClick = vi.fn();
    render(
      <div onDoubleClick={onDoubleClick}>
        <BoardCardTypeChips
          setup={setup}
          projection={projection}
          types={ITEM_TYPES.slice(0, 1)}
          palette={palette}
        />
      </div>,
    );
    fireEvent.doubleClick(screen.getByRole('button'));
    expect(onDoubleClick).not.toHaveBeenCalled();
  });
});
