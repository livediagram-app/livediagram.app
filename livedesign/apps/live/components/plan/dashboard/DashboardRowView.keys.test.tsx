// @vitest-environment jsdom
// docs/specs/026-plan/plan-tabs.md "Dashboard tab": a row's dividers and its height handle are focusable separators,
// moved with the arrow keys, each press one step.
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DashboardLayout, DashboardRow } from '@livedesign/document';
import { DashboardContext, type DashboardContextValue } from './dashboard-context';
import { DashboardRowView, ROW_KEY_STEP_BIG_PX, ROW_KEY_STEP_PX } from './DashboardRowView';

vi.mock('./DashboardSlotView', () => ({ DashboardSlotView: () => <div /> }));
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const row: DashboardRow = {
  id: 'r',
  height: 320,
  slots: [
    { id: 'a', span: 6 },
    { id: 'b', span: 6 },
  ],
};

function show(canEdit = true) {
  // A wide page: the row is not condensed to a phone's stack.
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(1200);
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(320);
  const changeDashboard = vi.fn();
  const value = {
    tabs: [],
    elements: new Map(),
    canEdit,
    actions: { changeDashboard },
    openTab: vi.fn(),
    tabStatus: () => 'loaded',
    retryTab: vi.fn(),
  } as unknown as DashboardContextValue;
  render(
    <DashboardContext.Provider value={value}>
      <DashboardRowView row={row} index={0} rowCount={1} />
    </DashboardContext.Provider>,
  );
  // What each step makes of this row.
  const applied = () =>
    changeDashboard.mock.calls.map(
      ([change]) => (change as (l: DashboardLayout) => DashboardLayout)({ rows: [row] }).rows[0]!,
    );
  return { changeDashboard, applied };
}

describe('a row’s handles from the keyboard', () => {
  it('moves a divider a twelfth per arrow', () => {
    const { applied } = show();
    const divider = screen.getByRole('separator', { name: 'Resize slots 1 and 2' });
    expect(divider.tabIndex).toBe(0);
    expect(divider.getAttribute('aria-valuenow')).toBe('6');
    fireEvent.keyDown(divider, { key: 'ArrowRight' });
    fireEvent.keyDown(divider, { key: 'ArrowLeft' });
    expect(applied().map((r) => r.slots.map((s) => s.span))).toEqual([
      [7, 5],
      [5, 7],
    ]);
  });

  it('changes a row’s height per arrow, further with Shift', () => {
    const { applied } = show();
    const handle = screen.getByRole('separator', { name: 'Resize row 1' });
    expect(handle.tabIndex).toBe(0);
    expect(handle.getAttribute('aria-valuenow')).toBe('320');
    fireEvent.keyDown(handle, { key: 'ArrowDown' });
    fireEvent.keyDown(handle, { key: 'ArrowUp', shiftKey: true });
    expect(applied().map((r) => r.height)).toEqual([
      320 + ROW_KEY_STEP_PX,
      320 - ROW_KEY_STEP_BIG_PX,
    ]);
  });

  it('gives anyone who may not edit no handles', () => {
    show(false);
    expect(screen.queryByRole('separator')).toBeNull();
  });
});
