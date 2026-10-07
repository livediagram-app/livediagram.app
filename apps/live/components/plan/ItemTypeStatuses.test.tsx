// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ITEM_TYPES, ITEM_TYPE_EXCLUDED_STATUSES_MAX, type Item } from '@livediagram/items';
import { ItemTypeStatuses } from './ItemTypeStatuses';
import { ItemFieldEditor, type ItemFieldContext } from './ItemFieldEditor';

// docs/specs/026-plan/item-types.md "An item type" and "Editing a type": the statuses a card type leaves out.

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

afterEach(cleanup);

const STATUSES = [
  { status: 'todo', name: 'To Do' },
  { status: 'doing', name: 'Doing' },
  { status: 'done', name: 'Done' },
];

describe('the type editor’s Statuses', () => {
  it('turns a status off and back on, all on to start', () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <ItemTypeStatuses statuses={STATUSES} excluded={[]} onChange={onChange} />,
    );
    const done = screen.getByRole('button', { name: 'Done' });
    expect(done.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(done);
    expect(onChange).toHaveBeenLastCalledWith(['done']);
    rerender(<ItemTypeStatuses statuses={STATUSES} excluded={['done']} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(onChange).toHaveBeenLastCalledWith([]);
  });

  it('stops at the cap: a status still on stays on, with a note, and one off can come back', () => {
    const onChange = vi.fn();
    const stale = Array.from({ length: ITEM_TYPE_EXCLUDED_STATUSES_MAX - 1 }, (_, i) => `old${i}`);
    render(
      <ItemTypeStatuses statuses={STATUSES} excluded={[...stale, 'todo']} onChange={onChange} />,
    );
    const done = screen.getByRole('button', { name: 'Done' });
    expect(done.hasAttribute('disabled')).toBe(true);
    fireEvent.click(done);
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole('note').textContent).toContain(
      `at most ${ITEM_TYPE_EXCLUDED_STATUSES_MAX} statuses`,
    );
    fireEvent.click(screen.getByRole('button', { name: 'To Do' }));
    expect(onChange).toHaveBeenLastCalledWith(stale);
  });

  it('lets every status go, and says such a card stays where it is made', () => {
    const onChange = vi.fn();
    render(
      <ItemTypeStatuses statuses={STATUSES} excluded={['todo', 'doing']} onChange={onChange} />,
    );
    const done = screen.getByRole('button', { name: 'Done' });
    expect(done.hasAttribute('disabled')).toBe(false);
    fireEvent.click(done);
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
  });

  it('says so when the boards name no statuses', () => {
    render(<ItemTypeStatuses statuses={[]} excluded={[]} onChange={vi.fn()} />);
    expect(screen.getByText(/no statuses to choose from/)).toBeTruthy();
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
