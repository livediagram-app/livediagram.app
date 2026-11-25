// @vitest-environment jsdom
// liveworkspace/docs/specs/022-interface-design/undo-not-confirm.md: Clear Dashboard and Start Over hand back an Undo
// that puts the layout and the pruned slot elements back on their tab, unless someone has changed them since.
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  clearDashboard,
  dashboardFromPreset,
  setDashboardContent,
  type Element,
  type Tab,
} from '@liveplanner/project';
import { usePlanTabActions } from './usePlanTabActions';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

let n = 0;
const id = () => `id${++n}`;

function setup() {
  const base = dashboardFromPreset('two-by-two', id);
  const slot = base.rows[0]!.slots[0]!.id;
  const held = setDashboardContent(base, slot, { type: 'tab', tabId: 'board' } as never);
  // The slot's element, and one the dashboard never held.
  const el = (eid: string) => ({ id: eid, type: 'shape' }) as unknown as Element;
  const elements = [el('stray'), el('a')];
  let tabs: Tab[] = [
    { id: 'd', name: 'D', kind: 'dashboard', elements, dashboard: held },
    { id: 'other', name: 'O', elements: [] },
  ];
  const write = (map: (ts: Tab[]) => Tab[]) => {
    tabs = map(tabs);
  };
  const hook = renderHook(
    ({ active }) => usePlanTabActions({ activeId: active, commitTabs: write, tickTabs: write }),
    { initialProps: { active: 'd' } },
  );
  return {
    actions: () => hook.result.current,
    moveTo: (active: string) => hook.rerender({ active }),
    tab: () => tabs[0]!,
    write,
    held,
    elements,
  };
}

describe('changeDashboard’s Undo', () => {
  it('puts the layout and every pruned element back, exactly', () => {
    const s = setup();
    const undo = s.actions().changeDashboard(clearDashboard, 'DashboardContent', { prune: true });
    expect(s.tab().dashboard).not.toBe(s.held);
    // Pruned: neither element is a slot's any more.
    expect(s.tab().elements).toEqual([]);
    expect(undo()).toBe(true);
    expect(s.tab().dashboard).toBe(s.held);
    expect(s.tab().elements).toEqual(s.elements);
    // Taken back once.
    expect(undo()).toBe(false);
  });

  it('lands on its own tab after the person moves to another', () => {
    const s = setup();
    const undo = s.actions().changeDashboard(clearDashboard, 'DashboardContent', { prune: true });
    s.moveTo('other');
    undo();
    expect(s.tab().dashboard).toBe(s.held);
  });

  it('keeps a collaborator’s later layout, and still brings the elements back', () => {
    const s = setup();
    const undo = s.actions().changeDashboard(clearDashboard, 'DashboardContent', { prune: true });
    const theirs = dashboardFromPreset('focus', id);
    s.write((ts) => ts.map((t) => (t.id === 'd' ? { ...t, dashboard: theirs } : t)));
    undo();
    expect(s.tab().dashboard).toBe(theirs);
    expect(s.tab().elements).toEqual(s.elements);
  });

  it('has nothing to undo when the change changed nothing', () => {
    const s = setup();
    const undo = s.actions().changeDashboard((l) => l, 'DashboardContent');
    expect(undo()).toBe(false);
  });
});
