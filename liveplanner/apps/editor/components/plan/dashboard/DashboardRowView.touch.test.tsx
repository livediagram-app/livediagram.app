// @vitest-environment jsdom
// docs/specs/026-plan/plan-tabs.md "Editing" (on a touch screen): a row's dividers and height handle wait for no
// hover there. Each is a quiet marker, always shown, with a finger's reach round its bar, and a finger on it resizes
// rather than scrolling the page.
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DashboardRow } from '@liveplanner/project';
import { DashboardContext, type DashboardContextValue } from './dashboard-context';
import { DashboardRowView } from './DashboardRowView';

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

function show() {
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(1200);
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(320);
  const value = {
    tabs: [],
    elements: new Map(),
    canEdit: true,
    actions: { changeDashboard: vi.fn() },
    openTab: vi.fn(),
    tabStatus: () => 'loaded',
    retryTab: vi.fn(),
  } as unknown as DashboardContextValue;
  render(
    <DashboardContext.Provider value={value}>
      <DashboardRowView row={row} index={0} rowCount={1} />
    </DashboardContext.Provider>,
  );
}

describe('a row’s handles on a touch screen', () => {
  it('take the finger, never the page’s scroll', () => {
    show();
    for (const handle of screen.getAllByRole('separator'))
      expect(handle.className).toMatch(/\btouch-none\b/);
  });

  it('show without a hover, quietly, with a finger’s reach round the bar', () => {
    show();
    const divider = screen.getByRole('separator', { name: 'Resize slots 1 and 2' });
    expect(divider.className).toContain('[@media(hover:none)]:opacity-50');
    expect(divider.className).toContain('[@media(hover:none)]:w-6');
    expect(divider.firstElementChild!.getAttribute('class')).toContain(
      '[@media(hover:none)]:scale-y-100',
    );
    const height = screen.getByRole('separator', { name: 'Resize row 1' });
    expect(height.className).toContain('[@media(hover:none)]:opacity-50');
    expect(height.className).toContain('[@media(hover:none)]:h-6');
    expect(height.firstElementChild!.getAttribute('class')).toContain(
      '[@media(hover:none)]:scale-x-100',
    );
  });
});
