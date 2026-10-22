// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Tab } from '@liveplanner/project';
import { DashboardContext, type DashboardContextValue } from './dashboard-context';
import { DashboardTabPreview } from './DashboardTabPreview';

// docs/specs/026-plan/plan-tabs.md "Slot content": a shown tab with nothing to draw yet.
afterEach(cleanup);

// Nothing lazily loaded is drawn here.
vi.mock('next/dynamic', () => ({ default: () => () => null }));

function showTab(
  tab: Tab | null,
  of: 'board' | 'sheet',
  status: 'loaded' | 'failed' | 'loading' = 'loaded',
) {
  const value = {
    tabs: tab ? [tab] : [],
    elements: new Map(),
    canEdit: true,
    actions: {} as DashboardContextValue['actions'],
    openTab: vi.fn(),
    tabStatus: () => status,
    retryTab: vi.fn(),
  } satisfies DashboardContextValue;
  render(
    <DashboardContext.Provider value={value}>
      <DashboardTabPreview slotId="s" tabId={tab?.id ?? 'gone'} of={of} />
    </DashboardContext.Provider>,
  );
  return value;
}

function show(status: 'loaded' | 'failed' | 'loading') {
  const value = {
    tabs: [{ id: 't', name: 'Launch', kind: 'board', elements: [] } as unknown as Tab],
    elements: new Map(),
    canEdit: true,
    actions: {} as DashboardContextValue['actions'],
    openTab: vi.fn(),
    tabStatus: () => status,
    retryTab: vi.fn(),
  } satisfies DashboardContextValue;
  render(
    <DashboardContext.Provider value={value}>
      <DashboardTabPreview slotId="s" tabId="t" of="board" />
    </DashboardContext.Provider>,
  );
  return value;
}

describe('a slot’s tab before it draws', () => {
  it('says it is loading while its content is on its way', () => {
    show('loading');
    expect(screen.getByText('Loading Launch…')).toBeTruthy();
  });

  it('offers Retry when its fetch failed', () => {
    const v = show('failed');
    expect(screen.getByRole('alert').textContent).toContain('Couldn’t load Launch.');
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(v.retryTab).toHaveBeenCalledWith('t');
  });

  it('says it is empty once loaded with nothing on it', () => {
    show('loaded');
    expect(screen.getByText('Nothing on Launch yet.')).toBeTruthy();
  });

  it('names a deleted tab by what the slot was given', () => {
    render(
      <DashboardContext.Provider
        value={{
          tabs: [],
          elements: new Map(),
          canEdit: true,
          actions: {} as DashboardContextValue['actions'],
          openTab: vi.fn(),
          tabStatus: () => 'loaded',
          retryTab: vi.fn(),
        }}
      >
        <DashboardTabPreview slotId="s" tabId="gone" of="sheet" />
      </DashboardContext.Provider>,
    );
    expect(screen.getByText('This Sheet was deleted.')).toBeTruthy();
  });
});

describe('a slot naming a tab that is not a Board or Sheet', () => {
  // docs/specs/026-plan/plan-tabs.md "Showing a tab": only a Board or Sheet tab goes in a slot.
  it('says so, and offers to clear the slot', () => {
    showTab(
      { id: 'f', name: 'Survey', kind: 'form', form: {}, elements: [] } as unknown as Tab,
      'board',
    );
    expect(screen.getByText('This tab is not a Board or Sheet.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Clear Slot' })).toBeTruthy();
  });

  it('waits as the Board it was given while a tab’s content is on its way', () => {
    showTab({ id: 'b', name: 'Backlog', elements: [] }, 'board', 'loading');
    expect(screen.getByText('Loading Backlog…')).toBeTruthy();
  });
});
