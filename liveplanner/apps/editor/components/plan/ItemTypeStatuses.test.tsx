// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { ITEM_TYPES, ITEM_TYPE_STATUSES_MAX, type Item } from '@liveplanner/items';
import {
  ItemTypeStatuses,
  deselectAllStates,
  orderedStates,
  selectAllStates,
} from './ItemTypeStatuses';
import { movedTo } from './ItemTypeStatusOrder';
import { ItemFieldEditor, type ItemFieldContext } from './ItemFieldEditor';

// docs/specs/026-plan/item-types.md "The statuses a type uses" and "Editing a type": the ordered list a card type
// uses.

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

afterEach(cleanup);

const STATUSES = [
  { status: 'todo', name: 'To Do' },
  { status: 'doing', name: 'Doing' },
  { status: 'done', name: 'Done' },
];
const ALL_USED = ['todo', 'doing', 'done'];

describe('the type editor’s States', () => {
  const box = (name: string) => screen.getByRole('checkbox', { name });

  it('turns a state off and back on, at the end of the order, with a count', () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <ItemTypeStatuses statuses={STATUSES} used={ALL_USED} onChange={onChange} />,
    );
    expect(screen.getByText('3 of 3 states on')).toBeTruthy();
    expect(box('Done').getAttribute('aria-checked')).toBe('true');
    fireEvent.click(box('To Do'));
    expect(onChange).toHaveBeenLastCalledWith(['doing', 'done']);
    rerender(<ItemTypeStatuses statuses={STATUSES} used={['doing', 'done']} onChange={onChange} />);
    expect(screen.getByText('2 of 3 states on')).toBeTruthy();
    fireEvent.click(box('To Do'));
    expect(onChange).toHaveBeenLastCalledWith(['doing', 'done', 'todo']);
  });

  it('selects all at the end, and deselects all, keeping a state nothing lists', () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <ItemTypeStatuses statuses={STATUSES} used={['gone', 'done']} onChange={onChange} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Select All' }));
    expect(onChange).toHaveBeenLastCalledWith(['gone', 'done', 'todo', 'doing']);
    fireEvent.click(screen.getByRole('button', { name: 'Deselect All' }));
    expect(onChange).toHaveBeenLastCalledWith(['gone']);
    rerender(<ItemTypeStatuses statuses={STATUSES} used={ALL_USED} onChange={onChange} />);
    expect(screen.getByRole('button', { name: 'Select All' }).hasAttribute('disabled')).toBe(true);
  });

  it('stops at the cap: a state still off stays off, Select All stops there, and a note says why', () => {
    const stale = Array.from({ length: ITEM_TYPE_STATUSES_MAX - 1 }, (_, i) => `old${i}`);
    expect(selectAllStates(STATUSES, stale)).toEqual([...stale, 'todo']);
    const onChange = vi.fn();
    render(<ItemTypeStatuses statuses={STATUSES} used={[...stale, 'todo']} onChange={onChange} />);
    expect(box('Done').hasAttribute('disabled')).toBe(true);
    fireEvent.click(box('Done'));
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Select All' }).hasAttribute('disabled')).toBe(true);
    expect(screen.getByRole('note').textContent).toContain(
      `at most ${ITEM_TYPE_STATUSES_MAX} states`,
    );
    fireEvent.click(box('To Do'));
    expect(onChange).toHaveBeenLastCalledWith(stale);
  });

  it('lets every state go, and says such a card stays where it is made', () => {
    const onChange = vi.fn();
    render(<ItemTypeStatuses statuses={STATUSES} used={['done']} onChange={onChange} />);
    fireEvent.click(box('Done'));
    expect(onChange).toHaveBeenLastCalledWith([]);
    cleanup();
    render(<ItemTypeStatuses statuses={STATUSES} used={[]} onChange={vi.fn()} />);
    expect(screen.getByRole('note').textContent).toMatch(/can never be moved to another/);
    expect(screen.getByRole('button', { name: 'Deselect All' }).hasAttribute('disabled')).toBe(
      true,
    );
    // With every state off there is no order to show.
    expect(screen.queryByRole('list', { name: 'State order' })).toBeNull();
  });

  it('says so when the boards name no states', () => {
    render(<ItemTypeStatuses statuses={[]} used={[]} onChange={vi.fn()} />);
    expect(screen.getByText('No States Yet')).toBeTruthy();
  });

  it('Deselect All leaves only what nothing lists', () => {
    expect(deselectAllStates(STATUSES, ['x', 'todo'])).toEqual(['x']);
  });
});

// docs/specs/026-plan/item-types.md "Editing a type": Order (Work Tracker #78).
describe('the States tab’s Order', () => {
  const rows = () =>
    within(screen.getByRole('list', { name: 'State order' }))
      .getAllByRole('listitem')
      .map((li) => li.textContent);
  const grip = (name: string) => screen.getByRole('button', { name: `Move ${name}` });

  it('lists the states the type uses in its order, numbered, a kept id nothing names left out', () => {
    expect(orderedStates(STATUSES, ['done', 'gone', 'todo']).map((s) => s.name)).toEqual([
      'Done',
      'To Do',
    ]);
    render(
      <ItemTypeStatuses statuses={STATUSES} used={['done', 'gone', 'todo']} onChange={vi.fn()} />,
    );
    expect(rows()).toEqual(['1Done', '2To Do']);
  });

  it('moves a state with Alt+Up and Alt+Down on its grip, keeping a kept id in place', () => {
    const onChange = vi.fn();
    render(
      <ItemTypeStatuses
        statuses={STATUSES}
        used={['todo', 'gone', 'doing', 'done']}
        onChange={onChange}
      />,
    );
    fireEvent.keyDown(grip('Done'), { key: 'ArrowUp', altKey: true });
    expect(onChange).toHaveBeenLastCalledWith(['todo', 'gone', 'done', 'doing']);
    fireEvent.keyDown(grip('To Do'), { key: 'ArrowDown', altKey: true });
    expect(onChange).toHaveBeenLastCalledWith(['gone', 'doing', 'todo', 'done']);
    // The ends, a plain arrow and another key move nothing.
    onChange.mockClear();
    fireEvent.keyDown(grip('To Do'), { key: 'ArrowUp', altKey: true });
    fireEvent.keyDown(grip('Done'), { key: 'ArrowDown', altKey: true });
    fireEvent.keyDown(grip('Doing'), { key: 'ArrowDown' });
    fireEvent.keyDown(grip('Doing'), { key: 'Enter', altKey: true });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('turns a state off from its row', () => {
    const onChange = vi.fn();
    render(<ItemTypeStatuses statuses={STATUSES} used={ALL_USED} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Turn Off Doing' }));
    expect(onChange).toHaveBeenLastCalledWith(['todo', 'done']);
  });

  it('disables the grip of a lone state', () => {
    render(<ItemTypeStatuses statuses={STATUSES} used={['done']} onChange={vi.fn()} />);
    expect(grip('Done').hasAttribute('disabled')).toBe(true);
  });

  it('marks a state in the colour the first board gives it', () => {
    render(
      <ItemTypeStatuses
        statuses={STATUSES}
        used={ALL_USED}
        onChange={vi.fn()}
        boards={[
          { title: 'A', statuses: ['todo', 'done'], colours: new Map([['done', '#ff0000']]) },
          { title: 'B', statuses: ['done'], colours: new Map([['done', '#00ff00']]) },
          { title: 'C', statuses: ['doing'] },
        ]}
      />,
    );
    const done = screen.getAllByRole('listitem').find((li) => li.textContent === '3Done')!;
    const dot = done.querySelectorAll('span[aria-hidden]')[1] as HTMLElement;
    expect(dot.style.backgroundColor).toBe('rgb(255, 0, 0)');
  });

  it('moves a state dragged by its grip, the row following the pointer', () => {
    const onChange = vi.fn();
    render(<ItemTypeStatuses statuses={STATUSES} used={ALL_USED} onChange={onChange} />);
    // jsdom lays every row at 0: any drag down passes every other row, so it lands last.
    fireEvent.pointerDown(grip('To Do'), { button: 0, clientY: 0 });
    fireEvent.pointerMove(grip('To Do'), { clientY: 40 });
    const row = screen.getAllByRole('listitem')[0]!;
    expect(row.style.transform).toBe('translateY(40px)');
    fireEvent.pointerUp(grip('To Do'));
    expect(onChange).toHaveBeenLastCalledWith(['doing', 'done', 'todo']);
  });

  it('places a state dragged to a slot, before the state now there or at the end', () => {
    expect(movedTo(['a', 'b', 'c'], 'a', 2)).toEqual(['b', 'c', 'a']);
    expect(movedTo(['a', 'b', 'c'], 'c', 0)).toEqual(['c', 'a', 'b']);
    expect(movedTo(['a', 'b'], 'a', 9)).toEqual(['b', 'a']);
  });
});

describe('the States tab’s Default State', () => {
  it('offers None and every state still on, in the type’s order, and picks one', () => {
    const onDefault = vi.fn();
    render(
      <ItemTypeStatuses
        statuses={STATUSES}
        used={['done', 'todo']}
        onChange={vi.fn()}
        defaultStatus="todo"
        onDefaultStatus={onDefault}
      />,
    );
    const menu = screen.getByLabelText('Default State') as HTMLSelectElement;
    expect(menu.value).toBe('todo');
    expect([...menu.options].map((o) => o.textContent)).toEqual(['None', 'Done', 'To Do']);
    fireEvent.change(menu, { target: { value: 'done' } });
    expect(onDefault).toHaveBeenLastCalledWith('done');
  });

  it('shows None for a Default State the type has turned off', () => {
    render(
      <ItemTypeStatuses
        statuses={STATUSES}
        used={['doing', 'done']}
        onChange={vi.fn()}
        defaultStatus="todo"
        onDefaultStatus={vi.fn()}
      />,
    );
    expect(screen.getByLabelText<HTMLSelectElement>('Default State').value).toBe('');
  });
});

describe('a built-in type’s Default State', () => {
  it('lists each state once by its own name, its built-in default picked, until that is turned off', () => {
    const onDefaultStatus = vi.fn();
    const { rerender } = render(
      <ItemTypeStatuses
        statuses={STATUSES}
        used={ALL_USED}
        onChange={vi.fn()}
        onDefaultStatus={onDefaultStatus}
        typeId="task"
      />,
    );
    const menu = () => screen.getByLabelText<HTMLSelectElement>('Default State');
    const labels = [...menu().options].map((o) => o.textContent);
    expect(labels).toContain('To Do');
    expect(labels.some((l) => l?.includes('Built-In'))).toBe(false);
    expect(labels).not.toContain('None');
    expect(new Set(labels).size).toBe(labels.length);
    expect(menu().value).toBe('todo');
    // What is picked is saved as picked.
    fireEvent.change(menu(), { target: { value: 'todo' } });
    expect(onDefaultStatus).toHaveBeenLastCalledWith('todo');
    fireEvent.change(menu(), { target: { value: 'done' } });
    expect(onDefaultStatus).toHaveBeenLastCalledWith('done');
    rerender(
      <ItemTypeStatuses
        statuses={STATUSES}
        used={['doing', 'done']}
        onChange={vi.fn()}
        onDefaultStatus={vi.fn()}
        typeId="task"
      />,
    );
    expect(menu().options[0]!.textContent).toBe('None');
  });
});

describe('the item panel’s Status', () => {
  const task = { ...ITEM_TYPES.find((t) => t.id === 'task')!, statuses: ['todo', 'doing'] };
  const PERSON = { id: 'p1', name: 'Ali', color: '#2563eb' };
  const make = (status: string): Item => ({
    id: 'item0001',
    type: 'task',
    key: 1,
    rank: 'i',
    fields: { title: 'T', status },
    rev: 1,
    createdAt: 0,
    updatedAt: 0,
    createdBy: PERSON,
    updatedBy: PERSON,
  });
  const ctx = (item: Item): ItemFieldContext => ({
    item,
    type: task,
    statuses: STATUSES,
    people: [],
    canEdit: true,
    labels: [],
    onSave: vi.fn(),
    onPatch: vi.fn(),
    onOpenItem: vi.fn(),
  });

  // docs/specs/026-plan/plan-board.md "A state no board names": never its raw id.
  it('shows a state no board names as No status, offering no raw id', () => {
    render(<ItemFieldEditor f="status" ctx={ctx(make('next~ab12'))} />);
    expect(screen.getByRole<HTMLSelectElement>('combobox').value).toBe('');
    const names = screen.getAllByRole('option').map((o) => o.textContent);
    expect(names).toEqual(['No status', 'To Do', 'Doing']);
  });

  it('offers only the statuses the type uses', () => {
    render(<ItemFieldEditor f="status" ctx={ctx(make('todo'))} />);
    const names = screen.getAllByRole('option').map((o) => o.textContent);
    expect(names).toEqual(['No status', 'To Do', 'Doing']);
  });

  // Work Tracker #78: the type's order, the same on every tab.
  it('lists the statuses in the type’s order', () => {
    render(
      <ItemFieldEditor
        f="status"
        ctx={{ ...ctx(make('todo')), type: { ...task, statuses: ['doing', 'gone', 'todo'] } }}
      />,
    );
    const names = screen.getAllByRole('option').map((o) => o.textContent);
    expect(names).toEqual(['No status', 'Doing', 'To Do']);
  });

  it('reads a legacy type as every status less what it left out', () => {
    const legacy = { ...ITEM_TYPES.find((t) => t.id === 'task')!, excludedStatuses: ['doing'] };
    render(<ItemFieldEditor f="status" ctx={{ ...ctx(make('todo')), type: legacy }} />);
    const names = screen.getAllByRole('option').map((o) => o.textContent);
    expect(names).toEqual(['No status', 'To Do', 'Done']);
  });

  it('shows a left-out status a card is already in, marked, and lets it move out', () => {
    const c = ctx(make('done'));
    render(<ItemFieldEditor f="status" ctx={c} />);
    const done = screen.getByRole('option', {
      name: 'Done (not used by Task)',
    }) as HTMLOptionElement;
    expect(done.disabled).toBe(true);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'doing' } });
    expect(c.onSave).toHaveBeenCalledWith('status', 'doing');
  });
});
