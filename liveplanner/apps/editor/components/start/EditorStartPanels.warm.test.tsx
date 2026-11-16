// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Tab } from '@liveplanner/project';

// docs/specs/006-project/offline-mode.md "Warm open of a cloud project": a Dashboard first tab warm-opened from the
// last seen copy draws its page before hydration, handed the shown tabs' kept bodies as its tiles' stand-ins; any other
// Dashboard still waits for hydration.
afterEach(cleanup);

const ctx = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));
vi.mock('@/app/project/[id]/EditorContext', () => ({ useEditorContext: () => ctx.current }));
vi.mock('@/app/project/[id]/useSelectTab', () => ({ useSelectTab: () => vi.fn() }));
vi.mock('@/components/start/useTemplatePickMove', () => ({ useTemplatePickMove: () => vi.fn() }));
vi.mock('@/hooks/persistence/useIsOfflineProject', () => ({ useIsOfflineProject: () => false }));
// Only the Dashboard page draws here (a Viewer sees no Start Planning; no Form tab): it names what it was handed.
vi.mock('next/dynamic', () => ({
  default: () =>
    function Page(props: { tab?: Tab; standIns?: readonly Tab[] }) {
      return (
        <p>
          Page {props.tab?.id} with {props.standIns?.map((t) => t.name).join(', ')}
        </p>
      );
    },
}));

import { EditorStartPanels } from './EditorStartPanels';

const dashboard = {
  id: 'd1',
  name: 'Overview',
  kind: 'dashboard',
  elements: [],
  dashboard: {
    rows: [
      {
        id: 'r1',
        height: 300,
        slots: [{ id: 'a', span: 12, content: { type: 'tab', tabId: 'b1' } }],
      },
    ],
  },
} as unknown as Tab;
const kept = [{ id: 'b1', name: 'Timeline', kind: 'board', elements: [] } as unknown as Tab];

function mount(over: Record<string, unknown>) {
  ctx.current = {
    hydrated: false,
    zenMode: false,
    embedMode: false,
    activeTab: dashboard,
    isReadOnly: true,
    tabs: [dashboard],
    loadAllTabs: vi.fn(),
    deleteTab: vi.fn(),
    renameTab: vi.fn(),
    projectId: null,
    activeTabConnected: false,
    can: { level: 'view' },
    activeTabLocked: false,
    loadedTabIds: new Set(),
    warmTabId: null,
    warmRefTabs: [],
    ...over,
  };
  return render(<EditorStartPanels />);
}

describe('EditorStartPanels, a warm-opened Dashboard', () => {
  it('draws the warm-painted Dashboard before hydration, with the tabs its tiles show as kept', () => {
    mount({ warmTabId: 'd1', warmRefTabs: kept });
    expect(screen.getByText('Page d1 with Timeline')).toBeTruthy();
  });

  it('waits for hydration on a Dashboard that is not the warm-painted tab', () => {
    mount({ warmTabId: 'other' });
    expect(screen.queryByText(/^Page/)).toBeNull();
  });

  it('draws it once hydrated, as always', () => {
    mount({ hydrated: true });
    expect(screen.getByText(/^Page d1/)).toBeTruthy();
  });
});
