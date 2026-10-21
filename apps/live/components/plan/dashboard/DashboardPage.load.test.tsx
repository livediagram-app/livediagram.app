// @vitest-environment jsdom
// docs/specs/026-plan/plan-tabs.md "Figures from a Sheet": the document's tabs fetched for a figure from a Sheet record
// their failures, as a shown tab's do, so the figure and the Sheet picker say so (with Retry) rather than waiting.
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Tab } from '@liveplanner/document';
import { useDashboard } from './dashboard-context';
import { DashboardPage } from './DashboardPage';
import type { PlanTabActions } from '@/hooks/plan/usePlanTabActions';

vi.mock('@/components/plan/MaximisedPlanLayer', () => ({
  CanvasCover: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock('@/hooks/ui/useCanvasLayerInsets', () => ({ useCanvasLayerInsets: () => ({}) }));
vi.mock('./DashboardSettings', () => ({ DashboardSettings: () => null }));
vi.mock('./DashboardMenuName', () => ({ DashboardMenuName: () => null }));
vi.mock('./DashboardRowView', () => ({
  DashboardRowView: () => {
    const { tabStatus, loadAllTabs } = useDashboard();
    return (
      <button type="button" onClick={loadAllTabs}>
        {tabStatus('t2')}
      </button>
    );
  },
}));
afterEach(cleanup);

const dashboard = {
  id: 'd',
  name: 'Overview',
  kind: 'dashboard',
  elements: [],
  dashboard: {
    rows: [
      {
        id: 'r',
        height: 320,
        slots: [
          { id: 's', span: 12, content: { type: 'sheet-metric', metric: 'figure', sheetId: 'x' } },
        ],
      },
    ],
  },
} as unknown as Tab;
const other = { id: 't2', name: 'Budget', elements: [] } as unknown as Tab;

describe('a Dashboard reading Sheets', () => {
  it('marks the tabs whose fetch failed, and fetches them again on Retry', async () => {
    const root = document.createElement('main');
    root.setAttribute('data-canvas-a11y-root', '');
    document.body.append(root);
    const loadTabs = vi.fn(async () => ['t2']);
    render(
      <DashboardPage
        tab={dashboard}
        tabs={[dashboard, other]}
        canEdit
        actions={{} as PlanTabActions}
        openTab={vi.fn()}
        loadTabs={loadTabs}
        loadedTabIds={new Set(['d'])}
      />,
    );
    await waitFor(() => expect(screen.getByRole('button').textContent).toBe('failed'));
    expect(loadTabs).toHaveBeenCalledWith(['d', 't2']);
    loadTabs.mockResolvedValue([]);
    await act(async () => screen.getByRole('button').click());
    expect(loadTabs).toHaveBeenCalledTimes(2);
    await waitFor(() => expect(screen.getByRole('button').textContent).toBe('loading'));
    root.remove();
  });
});
