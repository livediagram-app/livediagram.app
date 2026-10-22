// @vitest-environment jsdom
// docs/specs/026-plan/plan-tabs.md "Dashboard tab": a locked tab's Dashboard refuses every change, as every edit there
// is (commitTabs itself does not check the lock).
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { newDashboard, type Tab } from '@livepages/document';
import { usePlanTabActions } from './usePlanTabActions';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

const ids = () => {
  let n = 0;
  return () => `id${++n}`;
};

function run(locked: boolean) {
  let tabs: Tab[] = [
    {
      id: 'd',
      name: 'Overview',
      kind: 'dashboard',
      elements: [],
      dashboard: newDashboard(ids()),
      ...(locked ? { locked: true } : {}),
    },
  ];
  const write = (map: (ts: Tab[]) => Tab[]) => {
    tabs = map(tabs);
  };
  const { result } = renderHook(() =>
    usePlanTabActions({ activeId: 'd', commitTabs: write, tickTabs: write }),
  );
  const slot = tabs[0]!.dashboard!.rows[0]!.slots[0]!.id;
  const before = tabs;
  result.current.setSlotContent(slot, { type: 'note', title: 'Hi', text: '' });
  result.current.changeDashboard((l) => ({ ...l, rows: l.rows.slice(1) }), 'DashboardRow');
  result.current.startElementTab('board', () => {});
  return { before, after: tabs };
}

describe('a locked Dashboard tab', () => {
  it('takes no slot content, layout change or new kind', () => {
    const { before, after } = run(true);
    expect(after).toEqual(before);
  });

  it('takes them when unlocked', () => {
    const { before, after } = run(false);
    expect(after).not.toBe(before);
    expect(after[0]!.kind).toBe('board');
  });
});
