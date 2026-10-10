// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { presetSetup } from '@livediagram/items';
import { PlanFillTabSetting } from './PlanFillTabSetting';

// docs/specs/026-plan/plan-board.md "Fill Tab": the Board Setup section's two tiles.
const plan: Record<string, unknown> = {};
vi.mock('@/components/plan/PlanContext', () => ({ usePlan: () => plan }));
const confirm = vi.fn(async (_opts: unknown) => true);
vi.mock('@/hooks/ui/useConfirm', () => ({ useConfirm: () => confirm }));
const track = vi.fn();
vi.mock('@/lib/telemetry', () => ({ track: (...a: unknown[]) => track(...a) }));

afterEach(() => {
  cleanup();
  onClose.mockClear();
  confirm.mockClear();
  track.mockClear();
});

const kanban = presetSetup('kanban');

function show(others: { count: number; locked: number }, fillTab = false, canEdit = true) {
  for (const key of Object.keys(plan)) delete plan[key];
  Object.assign(plan, {
    canEdit,
    updateBoard: vi.fn(),
    fillTab: vi.fn(),
    tabOthers: vi.fn(() => others),
  });
  render(
    <PlanFillTabSetting
      boardId="b"
      setup={fillTab ? { ...kanban, fillTab } : kanban}
      onClose={onClose}
    />,
  );
  return plan as {
    updateBoard: ReturnType<typeof vi.fn>;
    fillTab: ReturnType<typeof vi.fn>;
  };
}

const onClose = vi.fn();
const tile = (name: string) => screen.getByRole('radio', { name });

describe('PlanFillTabSetting', () => {
  it('shows On Canvas pressed while off, with what Fill Tab does', () => {
    show({ count: 0, locked: 0 });
    expect(screen.getByText('Fill Tab', { selector: 'h3' })).toBeTruthy();
    expect(screen.getByText(/always fills this tab/)).toBeTruthy();
    expect(tile('On Canvas').getAttribute('aria-checked')).toBe('true');
    expect(tile('Fill Tab').getAttribute('aria-checked')).toBe('false');
  });

  it('fills at once on an otherwise empty tab', async () => {
    const p = show({ count: 0, locked: 0 });
    fireEvent.click(tile('Fill Tab'));
    await waitFor(() => expect(p.fillTab).toHaveBeenCalled());
    expect(confirm).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    // It updates the board as it is at the commit: here, a title changed meanwhile.
    const update = p.fillTab.mock.calls[0]![1] as (s: typeof kanban) => typeof kanban;
    expect(update({ ...kanban, title: 'Renamed' })).toMatchObject({
      fillTab: true,
      title: 'Renamed',
    });
    expect(track).toHaveBeenCalledWith('Plan', 'Toggled', 'FillTabOn');
  });

  it('confirms the deletion first, and does nothing when cancelled', async () => {
    const p = show({ count: 5, locked: 2 });
    confirm.mockResolvedValueOnce(false);
    fireEvent.click(tile('Fill Tab'));
    await waitFor(() => expect(confirm).toHaveBeenCalled());
    // The menu (a phone's sheet) closes first, so the confirm is never under it.
    expect(onClose).toHaveBeenCalled();
    expect(confirm.mock.calls[0]![0]).toMatchObject({
      confirmLabel: 'Delete and Fill Tab',
      message: expect.stringContaining('5 other elements will be deleted (2 of them locked)'),
    });
    expect(p.fillTab).not.toHaveBeenCalled();
    expect(track).not.toHaveBeenCalled();
    fireEvent.click(tile('Fill Tab'));
    await waitFor(() => expect(p.fillTab).toHaveBeenCalled());
  });

  it('turns off as a board edit, back on the canvas', () => {
    const p = show({ count: 0, locked: 0 }, true);
    expect(tile('Fill Tab').getAttribute('aria-checked')).toBe('true');
    fireEvent.click(tile('Fill Tab'));
    expect(p.fillTab).not.toHaveBeenCalled();
    fireEvent.click(tile('On Canvas'));
    expect(p.updateBoard).toHaveBeenCalledWith('b', expect.not.objectContaining({ fillTab: true }));
    expect(track).toHaveBeenCalledWith('Plan', 'Toggled', 'FillTabOff');
  });

  it('is not offered to someone who may only view', () => {
    show({ count: 0, locked: 0 }, false, false);
    expect(screen.queryByRole('radio', { name: 'Fill Tab' })).toBeNull();
  });
});
