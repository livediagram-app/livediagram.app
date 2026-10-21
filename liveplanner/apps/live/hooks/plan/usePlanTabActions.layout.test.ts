// @vitest-environment jsdom
// docs/specs/026-plan/plan-tabs.md "Filling a slot": a Layout tile placed with no zone (Enter on an armed tile) puts a
// row at the foot, and a slot in the last row with room (a new row when every row is full).
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { newDashboard, type DashboardLayout, type Tab } from '@liveplanner/document';
import { usePlanTabActions } from './usePlanTabActions';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

const ids = () => {
  let n = 0;
  return () => `id${++n}`;
};

function run(dashboard: DashboardLayout, place: (a: ReturnType<typeof usePlanTabActions>) => void) {
  let tabs: Tab[] = [{ id: 'd', name: 'D', kind: 'dashboard', elements: [], dashboard }];
  const write = (map: (ts: Tab[]) => Tab[]) => {
    tabs = map(tabs);
  };
  const { result } = renderHook(() =>
    usePlanTabActions({ activeId: 'd', commitTabs: write, tickTabs: write }),
  );
  place(result.current);
  return tabs[0]!.dashboard!;
}

describe('a Layout tile placed with no zone', () => {
  it('adds a row at the foot', () => {
    const out = run(newDashboard(ids()), (a) =>
      a.placeItem({ kind: 'row', height: 200, slots: 3 }, null),
    );
    expect(out.rows).toHaveLength(3);
    expect(out.rows[2]!.slots).toHaveLength(3);
  });

  it('adds a slot to the last row with room', () => {
    const out = run(newDashboard(ids()), (a) => a.placeItem({ kind: 'slot' }, null));
    expect(out.rows.map((r) => r.slots.length)).toEqual([2, 3]);
  });
});
