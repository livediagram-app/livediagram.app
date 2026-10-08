// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ITEM_TYPES, ITEM_TYPE_EXCLUDED_STATUSES_MAX, type Item } from '@livediagram/items';
import { ItemTypeStatuses, deselectAllStates, selectAllStates } from './ItemTypeStatuses';
import { ItemFieldEditor, type ItemFieldContext } from './ItemFieldEditor';

// docs/specs/026-plan/item-types.md "An item type" and "Editing a type": the statuses a card type leaves out.

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

afterEach(cleanup);

const STATUSES = [
  { status: 'todo', name: 'To Do' },
  { status: 'doing', name: 'Doing' },
  { status: 'done', name: 'Done' },
];

describe('the type editor’s States', () => {
  const box = (name: string) => screen.getByRole('checkbox', { name });

  it('turns a state off and back on, all on to start, with a count', () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <ItemTypeStatuses statuses={STATUSES} excluded={[]} onChange={onChange} />,
    );
    expect(screen.getByText('3 of 3 on')).toBeTruthy();
    expect(box('Done').getAttribute('aria-checked')).toBe('true');
    fireEvent.click(box('Done'));
    expect(onChange).toHaveBeenLastCalledWith(['done']);
    rerender(<ItemTypeStatuses statuses={STATUSES} excluded={['done']} onChange={onChange} />);
    expect(screen.getByText('2 of 3 on')).toBeTruthy();
    fireEvent.click(box('Done'));
    expect(onChange).toHaveBeenLastCalledWith([]);
  });

  it('selects and deselects all, keeping a left-out state no board lists', () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <ItemTypeStatuses statuses={STATUSES} excluded={['gone', 'done']} onChange={onChange} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Select All' }));
    expect(onChange).toHaveBeenLastCalledWith(['gone']);
    fireEvent.click(screen.getByRole('button', { name: 'Deselect All' }));
    expect(onChange).toHaveBeenLastCalledWith(['gone', 'done', 'todo', 'doing']);
    rerender(<ItemTypeStatuses statuses={STATUSES} excluded={[]} onChange={onChange} />);
    expect(screen.getByRole('button', { name: 'Select All' }).hasAttribute('disabled')).toBe(true);
  });

  it('stops at the cap: a state still on stays on, Deselect All stops there, and a note says why', () => {
    const stale = Array.from({ length: ITEM_TYPE_EXCLUDED_STATUSES_MAX - 1 }, (_, i) => `old${i}`);
    expect(deselectAllStates(STATUSES, stale)).toEqual([...stale, 'todo']);
    const onChange = vi.fn();
    render(
      <ItemTypeStatuses statuses={STATUSES} excluded={[...stale, 'todo']} onChange={onChange} />,
    );
    expect(box('Done').hasAttribute('disabled')).toBe(true);
    fireEvent.click(box('Done'));
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Deselect All' }).hasAttribute('disabled')).toBe(
      true,
    );
    expect(screen.getByRole('note').textContent).toContain(
      `at most ${ITEM_TYPE_EXCLUDED_STATUSES_MAX} states`,
    );
    fireEvent.click(box('To Do'));
    expect(onChange).toHaveBeenLastCalledWith(stale);
  });

  it('lets every state go, and says such a card stays where it is made', () => {
    const onChange = vi.fn();
    render(
      <ItemTypeStatuses statuses={STATUSES} excluded={['todo', 'doing']} onChange={onChange} />,
    );
    fireEvent.click(box('Done'));
    expect(onChange).toHaveBeenLastCalledWith(['todo', 'doing', 'done']);
    cleanup();
    render(
      <ItemTypeStatuses
        statuses={STATUSES}
        excluded={['todo', 'doing', 'done']}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByRole('note').textContent).toMatch(/can never be moved to another/);
    expect(screen.getByRole('button', { name: 'Deselect All' }).hasAttribute('disabled')).toBe(
      true,
    );
  });

  it('says so when the boards name no states', () => {
    render(<ItemTypeStatuses statuses={[]} excluded={[]} onChange={vi.fn()} />);
    expect(screen.getByText(/no states to choose from/)).toBeTruthy();
  });

  it('Select All needs nothing listed to be off', () => {
    expect(selectAllStates(STATUSES, [])).toEqual([]);
  });
});

describe('the States tab’s Default State', () => {
  it('offers None and every state still on, and picks one', () => {
    const onDefault = vi.fn();
    render(
      <ItemTypeStatuses
        statuses={STATUSES}
        excluded={['doing']}
        onChange={vi.fn()}
        defaultStatus="todo"
        onDefaultStatus={onDefault}
      />,
    );
    const menu = screen.getByLabelText('Default State') as HTMLSelectElement;
    expect(menu.value).toBe('todo');
    expect([...menu.options].map((o) => o.textContent)).toEqual(['None', 'To Do', 'Done']);
    fireEvent.change(menu, { target: { value: 'done' } });
    expect(onDefault).toHaveBeenLastCalledWith('done');
  });

  it('shows None for a Default State the type has turned off', () => {
    render(
      <ItemTypeStatuses
        statuses={STATUSES}
        excluded={['todo']}
        onChange={vi.fn()}
        defaultStatus="todo"
        onDefaultStatus={vi.fn()}
      />,
    );
    expect((screen.getByLabelText('Default State') as HTMLSelectElement).value).toBe('');
  });
});

describe('a built-in type’s Default State', () => {
  it('shows its named state in place of None, until it is turned off', () => {
    const { rerender } = render(
      <ItemTypeStatuses
        statuses={STATUSES}
        excluded={[]}
        onChange={vi.fn()}
        onDefaultStatus={vi.fn()}
        typeId="task"
      />,
    );
    const first = () => (screen.getByLabelText('Default State') as HTMLSelectElement).options[0]!;
    expect(first().textContent).toBe('To Do (Built-In Default)');
    rerender(
      <ItemTypeStatuses
        statuses={STATUSES}
        excluded={['todo']}
        onChange={vi.fn()}
        onDefaultStatus={vi.fn()}
        typeId="task"
      />,
    );
    expect(first().textContent).toBe('None');
  });
});

describe('the item panel’s Status', () => {
  const task = { ...ITEM_TYPES.find((t) => t.id === 'task')!, excludedStatuses: ['done'] };
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
    projects: [],
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
    expect((screen.getByRole('combobox') as HTMLSelectElement).value).toBe('');
    const names = screen.getAllByRole('option').map((o) => o.textContent);
    expect(names).toEqual(['No status', 'To Do', 'Doing']);
  });

  it('offers only the statuses the type uses', () => {
    render(<ItemFieldEditor f="status" ctx={ctx(make('todo'))} />);
    const names = screen.getAllByRole('option').map((o) => o.textContent);
    expect(names).toEqual(['No status', 'To Do', 'Doing']);
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
