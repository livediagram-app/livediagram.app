// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Tab } from '@liveplanner/project';
import { DashboardContext, type DashboardContextValue } from './dashboard-context';
import { DashboardTabPreview } from './DashboardTabPreview';

// docs/specs/006-project/offline-mode.md "Warm open of a cloud project": a Dashboard first tab warm-opened from the
// last seen copy draws its tab tiles from the bodies the copy kept (the tabs themselves are still placeholders), not
// worked on, until each tab's own load answers; a load that fails shows its Retry instead.
afterEach(cleanup);

vi.mock('next/dynamic', () => ({ default: () => () => null }));
vi.mock('@/components/plan/PlanBoardView', () => ({
  PlanBoardView: ({ element }: { element: { planBoard?: { title?: string } } }) => (
    <p>Board {element.planBoard?.title}</p>
  ),
}));
vi.mock('@/components/sheets/PlanSheetView', () => ({ PlanSheetView: () => <p>Sheet cells</p> }));

const placeholder = (id: string, name: string) => ({ id, name, elements: [] }) as unknown as Tab;
const boardTab = (title: string) =>
  ({
    id: 'b',
    name: 'Timeline',
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
        planBoard: { title },
      },
    ],
  }) as unknown as Tab;
const sheetTab = {
  id: 's',
  name: 'Budget',
  kind: 'sheet',
  elements: [{ id: 'g', type: 'shape', shape: 'plan-sheet', x: 0, y: 0, width: 800, height: 600 }],
} as unknown as Tab;

function value(
  tabs: Tab[],
  status: 'loaded' | 'loading' | 'failed',
  standIns?: Tab[],
): DashboardContextValue {
  return {
    tabs,
    elements: new Map(),
    canEdit: false,
    actions: {} as DashboardContextValue['actions'],
    openTab: vi.fn(),
    tabStatus: () => status,
    retryTab: vi.fn(),
    standIns,
  };
}

const tiles = (
  <>
    <DashboardTabPreview slotId="a" tabId="b" of="board" />
    <DashboardTabPreview slotId="c" tabId="s" of="sheet" />
  </>
);

describe('a warm-opened Dashboard of tab tiles', () => {
  it('paints its tiles from the copy: each kept body drawn, not worked on, while its tab is a placeholder', () => {
    const kept = [boardTab('Kept timeline'), sheetTab];
    render(
      <DashboardContext.Provider
        value={value([placeholder('b', 'Timeline'), placeholder('s', 'Budget')], 'loading', kept)}
      >
        {tiles}
      </DashboardContext.Provider>,
    );
    expect(screen.getByText('Board Kept timeline')).toBeTruthy();
    expect(screen.getByText('Sheet cells')).toBeTruthy();
    // Never the empty page or the loading line it showed before.
    expect(screen.queryByText('Loading Timeline…')).toBeNull();
    expect(screen.queryByText('Loading Budget…')).toBeNull();
    expect(screen.getByText('Board Kept timeline').closest('[inert]')).toBeTruthy();
    expect(screen.getByText('Sheet cells').closest('[inert]')).toBeTruthy();
  });

  it('draws the tab as loaded once it arrives, worked on as always', () => {
    const { rerender } = render(
      <DashboardContext.Provider
        value={value([placeholder('b', 'Timeline')], 'loading', [boardTab('Kept timeline')])}
      >
        <DashboardTabPreview slotId="a" tabId="b" of="board" />
      </DashboardContext.Provider>,
    );
    rerender(
      <DashboardContext.Provider
        value={value([boardTab('Fresh timeline')], 'loaded', [boardTab('Kept timeline')])}
      >
        <DashboardTabPreview slotId="a" tabId="b" of="board" />
      </DashboardContext.Provider>,
    );
    expect(screen.getByText('Board Fresh timeline').closest('[inert]')).toBeNull();
    expect(screen.queryByText('Board Kept timeline')).toBeNull();
  });

  it('offers Retry rather than the kept body when its load fails', () => {
    render(
      <DashboardContext.Provider
        value={value([placeholder('b', 'Timeline')], 'failed', [boardTab('Kept timeline')])}
      >
        <DashboardTabPreview slotId="a" tabId="b" of="board" />
      </DashboardContext.Provider>,
    );
    expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy();
    expect(screen.queryByText('Board Kept timeline')).toBeNull();
  });

  it('waits as before with nothing kept', () => {
    render(
      <DashboardContext.Provider value={value([placeholder('b', 'Timeline')], 'loading')}>
        <DashboardTabPreview slotId="a" tabId="b" of="board" />
      </DashboardContext.Provider>,
    );
    expect(screen.getByText('Loading Timeline…')).toBeTruthy();
  });
});
