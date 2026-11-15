// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ITEM_TYPES, presetSetup, projectBoard, type ItemTypeDef } from '@liveplanner/items';
import { AddCardPopover } from './AddCardPopover';
import { BoardCardTypeChips } from './BoardCardTypeChips';
import { LinkedCardGroup } from './LinkedCards';
import { chipsShown } from './card-type-chips';
import { planPalette } from './plan-palette';

// docs/specs/026-plan/item-types.md "Where a card is added, its templates are offered": the Add a Card menu lists each
// type's templates under it, a chip or New {Type} of a type with templates opens it with that type alone, and only
// whoever may add cards is offered any of them.
const { track } = vi.hoisted(() => ({ track: vi.fn() }));
vi.mock('@/lib/telemetry', () => ({ track }));
vi.mock('@liveworkspace/workbench/hooks/ui/useIsMobileViewport', () => ({
  useIsMobileViewport: () => false,
}));
const setup = presetSetup('kanban');
const statusNames = new Map(setup.columns.map((c) => [c.status, c.name]));
const plan = {
  types: [] as ItemTypeDef[],
  statusNames,
  items: new Map(),
  addItem: vi.fn(),
  openNewItem: vi.fn(),
  announce: vi.fn(),
};
vi.mock('./PlanContext', () => ({ usePlan: () => plan }));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const task = ITEM_TYPES.find((t) => t.id === 'task')!;
const note = ITEM_TYPES.find((t) => t.id === 'note')!;
const BUG_REPORT = {
  id: 'tp-bug-report',
  name: 'Bug Report',
  fields: { title: 'Bug: ', description: 'Steps to reproduce', labels: ['bug'] },
};
const templated: ItemTypeDef = { ...task, templates: [BUG_REPORT] };
plan.types = [templated, note];

function menu(types: readonly ItemTypeDef[] = [templated, note]) {
  const onAdd = vi.fn();
  const onClose = vi.fn();
  const anchor = document.createElement('button');
  document.body.appendChild(anchor);
  render(<AddCardPopover anchor={anchor} types={types} onAdd={onAdd} onClose={onClose} />);
  return { onAdd, onClose };
}

describe('Add a Card with card templates', () => {
  it('lists each template under its type, spoken as the card it makes', () => {
    menu();
    const rows = screen.getAllByRole('menuitem');
    expect(rows.map((r) => r.getAttribute('aria-label'))).toEqual([
      'Task',
      'Task from Bug Report',
      'Note',
    ]);
    // Indented under its type, its name and what it fills.
    expect(rows[1]!.className).toContain('pl-7');
    expect(rows[1]!.textContent).toContain('Bug Report');
    expect(rows[1]!.textContent).toContain('Title, Description, Labels');
    expect(rows[0]!.className).not.toContain('pl-7');
  });

  it('adds a card filled in from the template, and counts it', () => {
    const { onAdd, onClose } = menu();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Task from Bug Report' }));
    expect(onClose).toHaveBeenCalled();
    expect(onAdd).toHaveBeenCalledWith({
      type: 'task',
      fields: { title: 'Bug: ', description: 'Steps to reproduce', labels: ['bug'] },
      template: 'tp-bug-report',
    });
    expect(track).toHaveBeenCalledWith('Plan', 'Used', 'CardTemplate');
  });

  it('keeps the type’s own row a blank card, uncounted as a template', () => {
    const { onAdd } = menu();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Task' }));
    expect(onAdd).toHaveBeenCalledWith({ type: 'task', fields: { title: 'New task' } });
    expect(track).not.toHaveBeenCalled();
  });

  it('walks the type and template rows in one list from the keyboard', () => {
    menu();
    const rows = screen.getAllByRole('menuitem');
    act(() => rows[0]!.focus());
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(rows[1]);
    fireEvent.keyDown(document.activeElement!, { key: 'End' });
    expect(document.activeElement).toBe(rows[2]);
  });

  it('shows a plan without templates exactly as before', () => {
    menu([task, note]);
    expect(screen.getAllByRole('menuitem').map((r) => r.getAttribute('aria-label'))).toEqual([
      'Task',
      'Note',
    ]);
  });
});

describe('a card type chip of a type with templates', () => {
  const palette = planPalette('light');
  const projection = projectBoard(setup, new Map(), undefined, plan.types, statusNames);
  const chips = (types: readonly ItemTypeDef[]) =>
    render(
      <BoardCardTypeChips setup={setup} projection={projection} types={types} palette={palette} />,
    );

  it('opens Add a Card with that type alone, blank first, and adds the pick where a chip adds', () => {
    chips([templated]);
    const chip = screen.getByRole('button', { name: 'Add a Task' });
    expect(chip.getAttribute('aria-haspopup')).toBe('menu');
    fireEvent.click(chip, { detail: 0 });
    expect(plan.addItem).not.toHaveBeenCalled();
    expect(chip.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getAllByRole('menuitem').map((r) => r.getAttribute('aria-label'))).toEqual([
      'Task',
      'Task from Bug Report',
    ]);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Task from Bug Report' }));
    expect(plan.addItem).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'task',
        status: 'todo',
        fields: expect.objectContaining({ title: 'Bug: ', labels: ['bug'] }),
      }),
    );
    expect(plan.openNewItem).toHaveBeenCalled();
    expect(plan.announce).toHaveBeenCalledWith('Task added to To Do');
    expect(screen.queryByRole('menuitem')).toBeNull();
  });

  it('opens it from a pointer press too, and still adds at once for a type without templates', () => {
    chips([templated, note]);
    const chip = screen.getByRole('button', { name: 'Add a Task' });
    act(() => {
      fireEvent.pointerDown(chip, { button: 0, pointerId: 1, clientX: 0, clientY: 0 });
      fireEvent.pointerUp(window, { pointerId: 1, clientX: 0, clientY: 0 });
    });
    expect(screen.getAllByRole('menuitem')).toHaveLength(2);
    expect(plan.addItem).not.toHaveBeenCalled();
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
    fireEvent.click(screen.getByRole('button', { name: 'Add a Note' }), { detail: 0 });
    expect(plan.addItem).toHaveBeenCalledWith(expect.objectContaining({ type: 'note' }));
  });

  it('is never offered to a Viewer: no chips without the right to add cards', () => {
    const base = { interactive: true, phone: false, simplified: false, setup, types: [templated] };
    expect(chipsShown({ ...base, canEditCards: true })).toBe(true);
    expect(chipsShown({ ...base, canEditCards: false })).toBe(false);
  });
});

describe('New {Type} of a type with templates', () => {
  const group = { fieldId: 'parent', label: 'Parent', fromTypes: ['task', 'note'], cards: [] };
  const section = (canAdd: boolean) => {
    const onAdd = vi.fn();
    render(
      <LinkedCardGroup
        group={group}
        types={[templated, note]}
        statusNames={statusNames}
        canAdd={canAdd}
        onOpen={vi.fn()}
        onAdd={onAdd}
      />,
    );
    return onAdd;
  };

  it('offers the templates, then makes the card from the pick', () => {
    const onAdd = section(true);
    const button = screen.getByRole('button', { name: 'New Task' });
    expect(button.getAttribute('aria-haspopup')).toBe('menu');
    fireEvent.click(button);
    expect(onAdd).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Task from Bug Report' }));
    expect(onAdd).toHaveBeenCalledWith('task', {
      title: 'Bug: ',
      description: 'Steps to reproduce',
      labels: ['bug'],
    });
  });

  it('makes a card at once for a type without templates', () => {
    const onAdd = section(true);
    const button = screen.getByRole('button', { name: 'New Note' });
    expect(button.getAttribute('aria-haspopup')).toBeNull();
    fireEvent.click(button);
    expect(onAdd).toHaveBeenCalledWith('note');
  });

  it('is never offered to a Viewer', () => {
    section(false);
    expect(screen.queryByRole('button', { name: 'New Task' })).toBeNull();
  });
});
