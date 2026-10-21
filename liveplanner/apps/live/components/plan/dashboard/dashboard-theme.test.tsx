// @vitest-environment jsdom
// docs/specs/026-plan/plan-tabs.md "Dashboard tab": the Dashboard tab's theme draws its slots' borders, and the boards
// and Sheets its tab slots show, there only.
import { cleanup, render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DashboardSlot, Tab } from '@liveplanner/document';
import { EditorContext } from '@/app/document/[id]/EditorContext';
import { DashboardContext, type DashboardContextValue } from './dashboard-context';
import { DashboardSlotView } from './DashboardSlotView';
import { DashboardTabPreview } from './DashboardTabPreview';

const seen = vi.hoisted(() => ({ stroke: [] as (string | undefined)[] }));
vi.mock('./DashboardSlotContent', () => ({
  DashboardSlotContent: () => <div />,
  Missing: () => null,
  useBoxSize: () => ({ width: 300, height: 200 }),
}));
vi.mock('@/components/plan/PlanBoardView', () => ({
  PlanBoardView: ({ element }: { element: { strokeColor?: string } }) => {
    seen.stroke.push(element.strokeColor);
    return null;
  },
}));
vi.mock('@/components/sheets/PlanSheetView', () => ({ PlanSheetView: () => null }));

afterEach(() => {
  cleanup();
  seen.stroke = [];
});

const PINK = '#db2777';

function wrap(children: ReactNode, tabs: Tab[] = []) {
  const value = {
    tabs,
    elements: new Map(),
    canEdit: false,
    actions: {},
    openTab: vi.fn(),
    tabStatus: () => 'loaded',
    retryTab: vi.fn(),
  } as unknown as DashboardContextValue;
  return render(
    <EditorContext.Provider value={{ activeTab: { theme: 'slate' } } as never}>
      <DashboardContext.Provider value={value}>{children}</DashboardContext.Provider>
    </EditorContext.Provider>,
  );
}

describe('a Dashboard tab’s theme', () => {
  it('draws a slot card’s border in its stroke colour', () => {
    const slot: DashboardSlot = {
      id: 's',
      span: 6,
      content: { type: 'note', title: 'N', text: '' },
    };
    const { container } = wrap(
      <DashboardSlotView rowId="r" slot={slot} at={{ slot: 0, row: 0, slots: 1 }} />,
    );
    const card = container.querySelector<HTMLElement>('[data-dashboard-slot] > div:last-child')!;
    expect(card.style.borderColor).toBe('rgb(219, 39, 119)');
  });

  it('draws a tab slot’s board in it, leaving the board’s own colours on its tab', () => {
    const board = { id: 'b', type: 'shape', shape: 'plan-board', x: 0, y: 0, width: 1, height: 1 };
    const tab = { id: 't', name: 'Roadmap', kind: 'board', elements: [board] } as unknown as Tab;
    wrap(<DashboardTabPreview slotId="s" tabId="t" />, [tab]);
    expect(seen.stroke.at(-1)).toBe(PINK);
    expect((board as { strokeColor?: string }).strokeColor).toBeUndefined();
  });
});
