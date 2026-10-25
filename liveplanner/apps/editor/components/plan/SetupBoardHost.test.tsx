// @vitest-environment jsdom
// docs/specs/026-plan/plan-board.md "Setup Board": a board not set up yet shows a placeholder on the canvas, and Setup
// Board is a dialog over the editor, for this person only: open at once for whoever placed the board, closed to the
// placeholder by Escape, opened again from it, and closed with a toast when someone else sets the board up.
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ITEM_TYPES, type PlanBoardSetup } from '@liveplanner/items';
import { markPlacedHere, resetSetupDialogs } from '@/lib/setup-dialog-store';
import { Dialog } from '@liveworkspace/workbench/components/dialogs/Dialog';
import { planPalette } from './plan-palette';
import { BOARD_SET_UP_ELSEWHERE, SetupBoardHost } from './SetupBoardHost';

vi.mock('./track-board-setup', () => ({ trackSetup: vi.fn() }));
const plan = {
  canEdit: true,
  types: ITEM_TYPES,
  updateBoard: vi.fn(),
  notify: vi.fn(),
  announce: vi.fn(),
  editType: vi.fn(),
};
vi.mock('./PlanContext', () => ({ usePlan: () => plan }));

const UNSET: PlanBoardSetup = { title: 'Roadmap', columns: [] } as unknown as PlanBoardSetup;
const SET: PlanBoardSetup = {
  title: 'Roadmap',
  columns: [{ id: 'c1', status: 'todo', name: 'To Do' }],
} as unknown as PlanBoardSetup;
const NAMES = new Map([['todo', 'To Do']]);

const draw = (setup: PlanBoardSetup, canEdit = true) => (
  <SetupBoardHost
    elementId="board1"
    setup={setup}
    palette={planPalette('light', {})}
    canEdit={canEdit}
    pickable={NAMES}
  />
);

beforeEach(() => {
  vi.clearAllMocks();
  resetSetupDialogs();
});
afterEach(cleanup);

describe('Setup Board as a dialog', () => {
  it('opens at once for whoever placed the board, with focus inside', async () => {
    markPlacedHere('board1');
    render(draw(UNSET));
    const dialog = await screen.findByRole('dialog', { name: 'Set up your board' });
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));
    // The placeholder stays under it, on the canvas.
    expect(screen.getByText('Not set up yet')).toBeTruthy();
  });

  it('shows only the placeholder on a board someone else placed', () => {
    render(draw(UNSET));
    expect(screen.getByText('Roadmap')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Set up board' })).toBeTruthy();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('closes to the placeholder on Escape, and the placeholder opens it again', async () => {
    markPlacedHere('board1');
    render(draw(UNSET));
    const dialog = await screen.findByRole('dialog');
    fireEvent.keyDown(dialog, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(plan.updateBoard).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Set up board' }));
    expect(await screen.findByRole('dialog', { name: 'Set up your board' })).toBeTruthy();
  });

  it('applies the setup on Create Board and closes', async () => {
    markPlacedHere('board1');
    render(draw(UNSET));
    await screen.findByRole('dialog');
    fireEvent.click(screen.getByRole('checkbox', { name: /Task/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Next: Columns' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add To Do' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next: Layout' }));
    fireEvent.click(screen.getByRole('button', { name: /Create Board/ }));
    expect(plan.updateBoard).toHaveBeenCalledWith(
      'board1',
      expect.objectContaining({
        columns: [expect.objectContaining({ status: 'todo', name: 'To Do' })],
      }),
    );
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('closes with a toast when someone else sets the board up while it is open', async () => {
    markPlacedHere('board1');
    const { rerender } = render(draw(UNSET));
    await screen.findByRole('dialog');
    act(() => rerender(draw(SET)));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(plan.notify).toHaveBeenCalledWith(BOARD_SET_UP_ELSEWHERE);
    expect(screen.queryByText('Not set up yet')).toBeNull();
  });

  it('tells someone who may only view that it is not set up yet, with no button or dialog', () => {
    markPlacedHere('board1');
    render(draw(UNSET, false));
    expect(screen.getByText('Someone who can edit it will set it up.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Set up board' })).toBeNull();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('stays open when Escape closes a dialog opened over it (Add New Card Type)', async () => {
    markPlacedHere('board1');
    const Over = ({ open, onClose }: { open: boolean; onClose: () => void }) => (
      <Dialog open={open} onClose={onClose} ariaLabel="Over">
        <button type="button">Inside</button>
      </Dialog>
    );
    const onClose = vi.fn();
    const { rerender } = render(
      <>
        {draw(UNSET)}
        <Over open={false} onClose={onClose} />
      </>,
    );
    await screen.findByRole('dialog', { name: 'Set up your board' });
    rerender(
      <>
        {draw(UNSET)}
        <Over open onClose={onClose} />
      </>,
    );
    fireEvent.keyDown(screen.getByRole('dialog', { name: 'Over' }), { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
    expect(screen.getByRole('dialog', { name: 'Set up your board' })).toBeTruthy();
  });
});
