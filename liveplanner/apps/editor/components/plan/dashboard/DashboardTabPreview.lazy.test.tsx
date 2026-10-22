// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Tab } from '@liveplanner/project';
import { DashboardContext, type DashboardContextValue } from './dashboard-context';
import { DashboardTabPreview } from './DashboardTabPreview';

// docs/specs/026-plan/plan-tabs.md "Dashboard tab": a Board tab shown in a slot whose content arrives after the
// Dashboard opens (a reload on the Dashboard: every other tab is a placeholder, with no kind and no elements, until its
// lazy fetch lands, docs/specs/006-project/per-tab-storage.md). The board must draw once it arrives.
afterEach(cleanup);

vi.mock('next/dynamic', () => ({ default: () => () => null }));
vi.mock('@/components/plan/PlanBoardView', () => ({
  PlanBoardView: ({ element }: { element: { planBoard?: { title?: string } } }) => (
    <p>Board {element.planBoard?.title}</p>
  ),
}));
vi.mock('@/components/sheets/PlanSheetView', () => ({ PlanSheetView: () => null }));

const placeholder = { id: 'b', name: 'Backlog', elements: [] } as unknown as Tab;
const loaded = {
  id: 'b',
  name: 'Backlog',
  kind: 'board',
  elements: [
    {
      id: 'e',
      type: 'shape',
      shape: 'plan-board',
      x: 0,
      y: 0,
      width: 1000,
      height: 720,
      planBoard: { title: 'Backlog' },
    },
  ],
} as unknown as Tab;

function value(tab: Tab, status: 'loaded' | 'loading'): DashboardContextValue {
  return {
    tabs: [tab],
    elements: new Map(),
    canEdit: true,
    actions: {} as DashboardContextValue['actions'],
    openTab: vi.fn(),
    tabStatus: () => status,
    retryTab: vi.fn(),
  };
}

const slot = <DashboardTabPreview slotId="s" tabId="b" of="board" />;

describe('a Board tab whose content arrives after the Dashboard opens', () => {
  it('waits as a board, then draws the board once its content lands', () => {
    const { rerender } = render(
      <DashboardContext.Provider value={value(placeholder, 'loading')}>
        {slot}
      </DashboardContext.Provider>,
    );
    expect(screen.getByText('Loading Backlog…')).toBeTruthy();
    // Waiting as the board the slot was given.
    expect(screen.queryByRole('heading', { name: 'Backlog' })).toBeNull();
    rerender(
      <DashboardContext.Provider value={value(loaded, 'loaded')}>{slot}</DashboardContext.Provider>,
    );
    expect(screen.getByText('Board Backlog')).toBeTruthy();
  });

  it('draws the board even when the slot first showed the tab some other way', () => {
    // A slot that names no kind: the placeholder waits as a Board until it loads.
    const old = <DashboardTabPreview slotId="s" tabId="b" />;
    const { rerender } = render(
      <DashboardContext.Provider value={value(placeholder, 'loading')}>
        {old}
      </DashboardContext.Provider>,
    );
    rerender(
      <DashboardContext.Provider value={value(loaded, 'loaded')}>{old}</DashboardContext.Provider>,
    );
    expect(screen.getByText('Board Backlog')).toBeTruthy();
  });
});
