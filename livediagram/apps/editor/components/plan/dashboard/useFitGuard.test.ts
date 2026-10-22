// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { addDashboardRow, DASHBOARD_ROWS_MAX, newDashboard } from '@livediagram/document';
import { useFitGuard } from './useFitGuard';

// docs/specs/026-plan/plan-tabs.md "Moving a slot": no bar between rows when a new row would pass the row limit.
const ids = () => {
  let n = 0;
  return () => `id${++n}`;
};

describe('useFitGuard allowMove', () => {
  it('refuses a gap between rows at the row limit unless the slot takes its own row with it', () => {
    const id = ids();
    let layout = newDashboard(id);
    while (layout.rows.length < DASHBOARD_ROWS_MAX) layout = addDashboardRow(layout, id);
    const pageRef = { current: null };
    const { result } = renderHook(() => useFitGuard(pageRef, layout, new Map()));
    const slot = layout.rows[0]!.slots[0]!.id;
    expect(result.current.allowMove(slot)({ kind: 'row-gap', index: 5 })).toBe(false);
    expect(
      result.current.allowMove(slot)({ kind: 'slot', slotId: layout.rows[1]!.slots[0]!.id }),
    ).toBe(true);
  });

  it('allows a gap between rows below the limit', () => {
    const layout = newDashboard(ids());
    const { result } = renderHook(() => useFitGuard({ current: null }, layout, new Map()));
    expect(
      result.current.allowMove(layout.rows[0]!.slots[0]!.id)({ kind: 'row-gap', index: 2 }),
    ).toBe(true);
  });
});
