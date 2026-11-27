// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ITEM_TYPES, type Item, type ItemTypeDef, type StatusPhase } from '@liveplanner/items';
import { ItemStatusPill } from './ItemStatusPill';

// docs/specs/026-plan/plan-board.md "status pill": on a phone the card panel's header shows the card's column as a
// pill; pressed, its columns in a sheet (done ones apart), a pick moving the card with a toast to undo it. A Viewer sees
// the pill without the chevron, and it does not open.
const toast = vi.hoisted(() => ({ action: vi.fn(), dismissAction: vi.fn() }));
vi.mock('@/hooks/ui/useToast', () => ({ useToast: () => toast }));
const track = vi.hoisted(() => vi.fn());
vi.mock('@/lib/telemetry', () => ({ track }));
const haptic = vi.hoisted(() => vi.fn());
vi.mock('@liveworkspace/workbench/lib/haptics', () => ({ haptic }));
const plan = vi.hoisted(() => ({
  value: undefined as
    | undefined
    | {
        statusPhases: ReadonlyMap<string, StatusPhase>;
        statusBoards: { title: string; statuses: string[]; colours?: Map<string, string> }[];
      },
}));
vi.mock('./PlanContext', () => ({ usePlan: () => plan.value }));

const TASK: ItemTypeDef = {
  ...ITEM_TYPES.find((t) => t.id === 'task')!,
  statuses: undefined,
  excludedStatuses: undefined,
};
const STATUSES = [
  { status: 'todo', name: 'To Do' },
  { status: 'doing', name: 'In Progress' },
  { status: 'done', name: 'Done' },
  { status: 'cancelled', name: 'Cancelled' },
];
const PERSON = { id: 'p', name: 'Sam', color: '#2563eb' };
const card = (status?: string): Item => ({
  id: 'c1',
  type: 'task',
  key: 7,
  rank: 'i',
  fields: { title: 'Fix the login', ...(status ? { status } : {}) },
  rev: 1,
  createdAt: 0,
  updatedAt: 0,
  createdBy: PERSON,
  updatedBy: PERSON,
});

beforeEach(() => {
  plan.value = {
    statusPhases: new Map<string, StatusPhase>([
      ['todo', 'todo'],
      ['doing', 'doing'],
      ['done', 'done'],
      ['cancelled', 'done'],
    ]),
    statusBoards: [
      { title: 'Board', statuses: ['todo', 'doing'], colours: new Map([['doing', '#ff0000']]) },
    ],
  };
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function pill(status: string | undefined, canEdit = true, onSave = vi.fn()) {
  render(
    <ItemStatusPill
      item={card(status)}
      type={TASK}
      statuses={STATUSES}
      canEdit={canEdit}
      onSave={onSave}
    />,
  );
  return onSave;
}

describe('the status pill', () => {
  it('shows the column’s colour and name, and a chevron', () => {
    pill('doing');
    const button = screen.getByRole('button', { name: 'Status: In Progress' });
    expect(button.textContent).toContain('In Progress');
    expect(button.getAttribute('aria-expanded')).toBe('false');
    const dot = button.querySelector<HTMLElement>('span[style]');
    expect(dot?.style.backgroundColor).toBe('rgb(255, 0, 0)');
    expect(button.querySelector('svg')).not.toBeNull();
  });

  it('reads No status, its dot hollow, for a card in no column or in one no board names', () => {
    pill(undefined);
    expect(screen.getByRole('button', { name: 'Status: No status' })).toBeTruthy();
    cleanup();
    pill('gone');
    expect(screen.getByRole('button', { name: 'Status: No status' })).toBeTruthy();
  });

  it('opens a sheet of the columns in order, the current one ticked, done ones in their own group', async () => {
    pill('doing');
    fireEvent.click(screen.getByRole('button', { name: 'Status: In Progress' }));
    const sheet = await screen.findByRole('dialog', { name: 'Move Card' });
    expect(within(sheet).getByText('Fix the login')).toBeTruthy();
    const open = within(sheet).getByRole('radiogroup', { name: 'Columns' });
    const done = within(sheet).getByRole('radiogroup', { name: 'Done Columns' });
    expect(
      within(open)
        .getAllByRole('radio')
        .map((r) => r.textContent),
    ).toEqual(['To Do', 'In Progress']);
    expect(
      within(done)
        .getAllByRole('radio')
        .map((r) => r.textContent),
    ).toEqual(['Done', 'Cancelled']);
    const current = within(open).getByRole('radio', { name: 'In Progress' });
    expect(current.getAttribute('aria-checked')).toBe('true');
    expect(document.activeElement).toBe(current);
    expect(sheet.querySelector('hr')).not.toBeNull();
    // A press inside it is not an outside one.
    fireEvent.pointerDown(sheet);
    expect(screen.getByRole('dialog', { name: 'Move Card' })).toBe(sheet);
  });

  it('moves the card at once, ticks, tracks, and offers Undo back to where it was', async () => {
    const onSave = pill('todo');
    fireEvent.click(screen.getByRole('button', { name: 'Status: To Do' }));
    fireEvent.click(await screen.findByRole('radio', { name: 'Done' }));
    expect(onSave).toHaveBeenCalledWith('status', 'done');
    expect(haptic).toHaveBeenCalledWith('snap');
    expect(track).toHaveBeenCalledWith('Plan', 'Changed', 'StatusFromHeader');
    const spec = toast.action.mock.calls[0]![0] as {
      key: string;
      message: string;
      actions: { label: string; onSelect: () => void }[];
    };
    expect(spec.message).toBe('Moved to Done');
    act(() => spec.actions[0]!.onSelect());
    expect(onSave).toHaveBeenLastCalledWith('status', 'todo');
    expect(toast.dismissAction).toHaveBeenCalledWith(spec.key);
    // The sheet slides away after the pick.
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Move Card' })).toBeNull());
  });

  it('puts a card that had no column back in none on Undo', async () => {
    const onSave = pill(undefined);
    fireEvent.click(screen.getByRole('button', { name: 'Status: No status' }));
    fireEvent.click(await screen.findByRole('radio', { name: 'To Do' }));
    const spec = toast.action.mock.calls[0]![0] as { actions: { onSelect: () => void }[] };
    act(() => spec.actions[0]!.onSelect());
    expect(onSave).toHaveBeenLastCalledWith('status', undefined);
  });

  it('only closes on the current column, on Escape, and on a press outside', async () => {
    const onSave = pill('doing');
    const button = screen.getByRole('button', { name: 'Status: In Progress' });
    fireEvent.click(button);
    fireEvent.click(await screen.findByRole('radio', { name: 'In Progress' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    fireEvent.click(button);
    await screen.findByRole('dialog');
    fireEvent.keyDown(document.body, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    fireEvent.click(button);
    await screen.findByRole('dialog');
    fireEvent.pointerDown(document.body);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(onSave).not.toHaveBeenCalled();
    expect(toast.action).not.toHaveBeenCalled();
  });

  it('toggles from the pill itself', async () => {
    pill('doing');
    const button = screen.getByRole('button', { name: 'Status: In Progress' });
    fireEvent.click(button);
    await screen.findByRole('dialog');
    expect(button.getAttribute('aria-expanded')).toBe('true');
    fireEvent.pointerDown(button);
    fireEvent.click(button);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('shows a column the type leaves out only while the card is in it, ticked and not pickable again', async () => {
    render(
      <ItemStatusPill
        item={card('cancelled')}
        type={{ ...TASK, label: 'Task', statuses: ['todo', 'doing', 'done'] }}
        statuses={STATUSES}
        canEdit
        onSave={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Status: Cancelled' }));
    const left = await screen.findByRole('radio', { name: 'Cancelled (not used by Task)' });
    expect(left.getAttribute('aria-checked')).toBe('true');
    expect((left as HTMLButtonElement).disabled).toBe(false);
  });

  it('works without a plan: the stage colours, and every column open', async () => {
    plan.value = undefined;
    pill('doing');
    fireEvent.click(screen.getByRole('button', { name: 'Status: In Progress' }));
    await screen.findByRole('dialog');
    expect(screen.queryByRole('radiogroup', { name: 'Done Columns' })).toBeNull();
    expect(screen.getAllByRole('radio')).toHaveLength(4);
  });
});

describe('the status pill for a Viewer', () => {
  it('shows the column without a chevron, and does not open', () => {
    pill('doing', false);
    expect(screen.queryByRole('button', { name: /Status/ })).toBeNull();
    const shown = screen.getByRole('img', { name: 'Status: In Progress' });
    expect(shown.querySelector('svg')).toBeNull();
    fireEvent.click(shown);
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
