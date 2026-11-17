// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { presetSetup, statusColumn } from '@liveplanner/items';
import type { ComponentProps } from 'react';
import type { ToastActionSpec } from '@/hooks/ui/useToast';
import { PlanColumnPopover } from './PlanColumnPopover';

type Props = ComponentProps<typeof PlanColumnPopover>;

// docs/specs/026-plan/plan-board.md "Column settings": Remove Column takes the column off this board and keeps
// the state; Delete Status deletes the state, its columns coming off every board.
const plan = {
  items: new Map(),
  statusNames: new Map(),
  statusBoards: [{ title: 'Kanban', statuses: ['todo', 'done'] }],
};
vi.mock('./PlanContext', () => ({ usePlan: () => plan }));
// Remove Column's notice (column-removed-notice.ts) goes through the shared toast.
const toast = { action: vi.fn<(spec: ToastActionSpec) => void>(), dismissAction: vi.fn() };
vi.mock('@/hooks/ui/useToast', () => ({ useToast: () => toast }));
vi.mock('@liveworkspace/workbench/hooks/ui/useIsMobileViewport', () => ({
  useIsMobileViewport: () => false,
}));
afterEach(cleanup);

const setup = {
  ...presetSetup('kanban'),
  columns: [statusColumn('todo', 'To Do'), statusColumn('done', 'Done')],
};

function open(more: Partial<Props> = {}) {
  const fns = {
    onChange: vi.fn<Props['onChange']>(),
    onDeleteStatus: vi.fn<NonNullable<Props['onDeleteStatus']>>(),
    onClose: vi.fn<Props['onClose']>(),
  };
  render(
    <PlanColumnPopover
      getAnchor={() => document.body}
      setup={setup}
      column={setup.columns[0]!}
      onMoveCards={() => {}}
      onTrashCards={() => {}}
      {...fns}
      {...more}
    />,
  );
  return fns;
}

describe('removing a column', () => {
  it('Remove Column takes it off this board only', () => {
    const fns = open();
    fireEvent.click(screen.getByRole('button', { name: 'Remove Column' }));
    expect(fns.onChange.mock.lastCall![0].columns.map((c: { status: string }) => c.status)).toEqual(
      ['done'],
    );
    expect(fns.onDeleteStatus).not.toHaveBeenCalled();
  });

  it('Remove Column says where its cards went, with an Undo that puts the column back (Work Tracker 1048)', () => {
    toast.action.mockClear();
    const onRestore = vi.fn<NonNullable<Props['onRestore']>>();
    const fns = open({ cardCount: 2, onRestore });
    fireEvent.click(screen.getByRole('button', { name: 'Remove Column' }));
    expect(fns.onClose).toHaveBeenCalledWith(false);
    const spec = toast.action.mock.lastCall![0];
    expect(spec.message).toBe(
      'To Do is off this board. Its 2 cards are on no board now: find them with Search.',
    );
    expect(spec.actions[0]!.label).toBe('Undo');
    spec.actions[0]!.onSelect();
    expect(onRestore).toHaveBeenCalledWith(setup.columns[0], 0);
    expect(toast.dismissAction).toHaveBeenCalledWith(spec.key);
  });

  it('an empty column goes silently, and with no way back there is no Undo', () => {
    toast.action.mockClear();
    open();
    fireEvent.click(screen.getByRole('button', { name: 'Remove Column' }));
    expect(toast.action).not.toHaveBeenCalled();
    cleanup();
    open({ cardCount: 1 });
    fireEvent.click(screen.getByRole('button', { name: 'Remove Column' }));
    expect(toast.action.mock.lastCall![0].actions).toEqual([]);
  });

  it('Delete Status, with no cards in it, deletes the state from every board at once', () => {
    const fns = open();
    fireEvent.click(screen.getByRole('button', { name: 'Delete Status' }));
    expect(fns.onChange).toHaveBeenCalled();
    expect(fns.onDeleteStatus).toHaveBeenCalledWith('todo');
  });
});

// docs/specs/026-plan/plan-board.md "A column's own settings": the toolbar on top.
describe('the column toolbar', () => {
  it('holds Move Left and Move Right at the start and Remove Column at the end', () => {
    open();
    const bar = screen.getByRole('toolbar', { name: 'Column actions' });
    const names = [...bar.querySelectorAll('button')].map((b) => b.getAttribute('aria-label'));
    expect(names).toEqual([
      'Move Left (Alt+Shift+Left)',
      'Move Right (Alt+Shift+Right)',
      'Remove Column',
    ]);
    // Above the name.
    const name = screen.getByRole('textbox', { name: 'Column name' });
    expect(bar.compareDocumentPosition(name) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('turns Move Left off on the first column and moves it right', () => {
    const fns = open();
    expect(screen.getByRole('button', { name: 'Move Left (Alt+Shift+Left)' })).toHaveProperty(
      'disabled',
      true,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Move Right (Alt+Shift+Right)' }));
    expect(fns.onChange.mock.lastCall![0].columns.map((c: { status: string }) => c.status)).toEqual(
      ['done', 'todo'],
    );
    expect(fns.onChange.mock.lastCall![1]).toBe('ColumnReordered');
  });
});

// docs/specs/026-plan/plan-board.md "A column's own settings": the popover goes with its column as it glides.
describe('the popover following its column', () => {
  it('settles under the cog’s new place once the column has moved', async () => {
    const cog = document.createElement('button');
    document.body.append(cog);
    let right = 300;
    cog.getBoundingClientRect = () =>
      ({ left: right - 24, right, top: 40, bottom: 64, width: 24, height: 24 }) as DOMRect;
    const props = {
      getAnchor: () => cog,
      onMoveCards: () => {},
      onTrashCards: () => {},
      onChange: vi.fn(),
      onClose: vi.fn(),
    };
    const { rerender } = render(
      <PlanColumnPopover {...props} setup={setup} column={setup.columns[0]!} />,
    );
    const box = () => screen.getByRole('dialog', { name: 'To Do column' });
    expect(box().style.left).toBe(`${300 - 288}px`);
    // Moved right: the board re-renders with the column second, and the cog has travelled.
    right = 600;
    const moved = { ...setup, columns: [setup.columns[1]!, setup.columns[0]!] };
    rerender(<PlanColumnPopover {...props} setup={moved} column={moved.columns[1]!} />);
    await act(() => new Promise((r) => setTimeout(r, 400)));
    expect(box().style.left).toBe(`${600 - 288}px`);
    cog.remove();
  });
});
