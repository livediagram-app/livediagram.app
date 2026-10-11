// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Tab } from '@livediagram/document';
import { useSheetHomeTab } from '@/components/sheets/sheet-home-tab';
import { DashboardContext, type DashboardContextValue } from './dashboard-context';
import { DashboardTabPreview } from './DashboardTabPreview';

// docs/specs/026-plan/plan-tabs.md "Filling a slot": a Sheet tab shown in a slot (a new one made for the slot, first
// drawn there) is made and loaded on its own tab, never the Dashboard's.
afterEach(cleanup);

vi.mock('@/components/sheets/PlanSheetView', () => ({
  PlanSheetView: () => <p>home {useSheetHomeTab() ?? 'none'}</p>,
}));
vi.mock('@/components/plan/PlanBoardView', () => ({ PlanBoardView: () => <p>the board</p> }));
vi.mock('next/dynamic', () => ({ default: () => () => null }));

describe('a Sheet tab shown in a slot', () => {
  it('tells its Sheet which tab it lives on', () => {
    const tab = {
      id: 'sheet-tab',
      name: 'Budget',
      kind: 'sheet',
      elements: [{ id: 's', type: 'shape', shape: 'plan-sheet', planSheet: { sheetId: 'x' } }],
    } as unknown as Tab;
    const value = {
      tabs: [tab],
      elements: new Map(),
      canEdit: true,
      actions: {} as DashboardContextValue['actions'],
      openTab: vi.fn(),
      tabStatus: () => 'loaded' as const,
      retryTab: vi.fn(),
    } satisfies DashboardContextValue;
    render(
      <DashboardContext.Provider value={value}>
        <DashboardTabPreview slotId="slot" tabId="sheet-tab" of="sheet" />
      </DashboardContext.Provider>,
    );
    expect(screen.getByText('home sheet-tab')).toBeTruthy();
  });
});

// A Board tab's content arriving after the slot first drew (a dashboard opened afresh: the tab reads as a Diagram
// until its content and kind arrive) still draws the board.
describe('a Board tab whose content arrives after the slot drew', () => {
  it('draws the board once it is there', () => {
    const value = (tab: Tab) =>
      ({
        tabs: [tab],
        elements: new Map(),
        canEdit: true,
        actions: {} as DashboardContextValue['actions'],
        openTab: vi.fn(),
        tabStatus: () => 'loaded' as const,
        retryTab: vi.fn(),
      }) satisfies DashboardContextValue;
    const wrap = (tab: Tab, children: ReactNode) => (
      <DashboardContext.Provider value={value(tab)}>{children}</DashboardContext.Provider>
    );
    const preview = <DashboardTabPreview slotId="slot" tabId="k" of="board" />;
    const placeholder = { id: 'k', name: 'Kanban', elements: [] } as unknown as Tab;
    const { rerender } = render(wrap(placeholder, preview));
    expect(screen.queryByText('the board')).toBeNull();
    const loaded = {
      ...placeholder,
      kind: 'board',
      elements: [{ id: 'b', type: 'shape', shape: 'plan-board', planBoard: { title: 'Kanban' } }],
    } as unknown as Tab;
    rerender(wrap(loaded, preview));
    expect(screen.getByText('the board')).toBeTruthy();
  });
});
