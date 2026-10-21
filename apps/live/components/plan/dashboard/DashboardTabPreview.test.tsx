// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Tab } from '@liveplanner/document';
import { DashboardContext, type DashboardContextValue } from './dashboard-context';
import { DashboardTabPreview } from './DashboardTabPreview';

// docs/specs/026-plan/plan-tabs.md "Slot content": a shown tab with nothing to draw yet.
afterEach(cleanup);

// The drawing itself (the export renderer) is not drawn here.
vi.mock('next/dynamic', () => ({ default: () => () => null }));

function showTab(
  tab: Tab | null,
  of: 'board' | 'sheet' | 'diagram',
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

describe('a Diagram tab in a slot', () => {
  // docs/specs/026-plan/plan-tabs.md "Dashboard tab": its drawing, live; pressing it opens the tab.
  it('shows the tab’s name over its drawing, opening the tab when pressed', () => {
    const v = showTab(
      { id: 'd', name: 'Architecture', elements: [{ id: 'e1' }] } as unknown as Tab,
      'diagram',
    );
    expect(screen.getByRole('heading', { name: 'Architecture' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Open Architecture' }));
    expect(v.openTab).toHaveBeenCalledWith('d');
  });

  it('says it is loading while its content is on its way, and names a deleted one', () => {
    showTab({ id: 'd', name: 'Architecture', elements: [] }, 'diagram', 'loading');
    expect(screen.getByText('Loading Architecture…')).toBeTruthy();
    cleanup();
    showTab(null, 'diagram');
    expect(screen.getByText('This Diagram was deleted.')).toBeTruthy();
  });

  // docs/specs/026-plan/plan-tabs.md "Showing a tab": a Pages tab's pages and a Form tab's form are drawn, though
  // neither holds an element; a Pages tab still on its way says so rather than drawing a blank page.
  it('draws an empty Pages or Form tab, and waits for a Pages tab still loading', () => {
    showTab({ id: 'p', name: 'Deck', opensIn: 'pages', elements: [] }, 'diagram');
    expect(screen.getByRole('button', { name: 'Open Deck' })).toBeTruthy();
    cleanup();
    showTab(
      { id: 'f', name: 'Survey', kind: 'form', form: {}, elements: [] } as unknown as Tab,
      'diagram',
    );
    expect(screen.getByRole('button', { name: 'Open Survey' })).toBeTruthy();
    cleanup();
    showTab({ id: 'p', name: 'Deck', opensIn: 'pages', elements: [] }, 'diagram', 'loading');
    expect(screen.getByText('Loading Deck…')).toBeTruthy();
    cleanup();
    showTab({ id: 'd', name: 'Blank', elements: [] }, 'diagram');
    expect(screen.getByText('Nothing on Blank yet.')).toBeTruthy();
  });
});
