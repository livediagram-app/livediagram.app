// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FONTS, createShape, type ShapeElement } from '@liveplanner/project';
import { ITEM_TYPES, planViewSize, type Item } from '@liveplanner/items';
import { PLAN_UI_FONT } from '@/lib/plan-font';
import { PlanProvider, type PlanContextValue } from '../PlanContext';
import { planPalette } from '../plan-palette';
import { PlanViewView } from '../views/PlanViewView';
import { ViewFrame, ViewTitle } from '../views/view-frame';
import { CardHeading } from './card-parts';
import { DashboardContext, type DashboardContextValue } from './dashboard-context';
import { DashboardNote } from './DashboardNote';
import { DashboardTitle } from './DashboardTitle';

// docs/specs/004-interface-design/fonts.md "On Dashboards and views": a Dashboard and a plan view letter their headings
// in the tab's face and every figure, label and line in the UI face, as a board does.
afterEach(cleanup);

const ABRIL = FONTS.find((f) => f.id === 'abril-fatface')!.stack;
const SAM = { id: 'sam', name: 'Sam', color: '#2563eb' };
const ITEM: Item = {
  id: 'i1',
  type: 'task',
  key: 1,
  rank: 'r',
  fields: { title: 'Ship it', status: 'todo' },
  rev: 1,
  createdBy: SAM,
  updatedBy: SAM,
  createdAt: 0,
  updatedAt: 0,
};
const PLAN = {
  items: new Map([['i1', ITEM]]),
  types: ITEM_TYPES,
  status: 'ready',
  canEdit: true,
  openItem: vi.fn(),
  statusNames: new Map([['todo', 'To do']]),
  statusPhases: new Map([['todo', 'todo']]),
} as unknown as PlanContextValue;

const styleOf = (el: Element | null) => el?.getAttribute('style') ?? '';
const isHeading = (el: Element | null) => styleOf(el).includes('var(--plan-heading-font)');

function metric(width?: number, height?: number): ShapeElement {
  const el: ShapeElement = {
    ...createShape('plan-view', 0, 0),
    ...planViewSize('metric:count'),
    ...(width && height ? { width, height } : {}),
    planView: { view: 'metric:count' },
  };
  return el;
}

describe('a plan view', () => {
  it('draws its frame in the UI face, hands the tab face down, and letters only its title in it', () => {
    const { container } = render(
      <ViewFrame
        title="Workload"
        palette={planPalette('light', {})}
        fontFamily={ABRIL}
        state="empty"
        empty="No cards yet."
      />,
    );
    const root = container.firstElementChild as HTMLElement;
    expect(root.style.fontFamily).toBe(PLAN_UI_FONT);
    expect(root.style.getPropertyValue('--plan-heading-font')).toBe(ABRIL);
    expect(isHeading(screen.getByText('Workload'))).toBe(true);
    expect(isHeading(screen.getByText('No cards yet.'))).toBe(false);
  });

  it('keeps the heading face on its title while it is renamed', () => {
    render(
      <ViewTitle.Provider value={{ title: 'Launch', rename: vi.fn() }}>
        <ViewFrame title="Workload" palette={planPalette('light', {})} state="ready" empty="" />
      </ViewTitle.Provider>,
    );
    fireEvent.doubleClick(screen.getByText('Launch'));
    expect(isHeading(screen.getByLabelText('Chart name'))).toBe(true);
  });

  it.each([
    ['a tile', 320, 200],
    ['a pill', undefined, undefined],
  ] as const)('draws a metric as %s in the UI face, its figure included', (_, w, h) => {
    const { container } = render(
      <PlanProvider value={PLAN}>
        <PlanViewView element={metric(w, h)} fontFamily={ABRIL} />
      </PlanProvider>,
    );
    const root = container.querySelector('[role="group"]') as HTMLElement;
    expect(root.style.fontFamily).toBe(PLAN_UI_FONT);
    expect(root.style.getPropertyValue('--plan-heading-font')).toBe(ABRIL);
    // Nothing in a metric is a heading: its label is small capitals and its figure a number.
    expect(container.querySelector('[style*="var(--plan-heading-font)"]')).toBeNull();
  });
});

function dashboard(canEdit: boolean, children: React.ReactNode) {
  const value = {
    tabs: [],
    elements: new Map(),
    canEdit,
    actions: { setSlotContent: vi.fn() },
    openTab: vi.fn(),
    tabStatus: () => 'loaded',
    retryTab: vi.fn(),
  } as unknown as DashboardContextValue;
  return render(<DashboardContext.Provider value={value}>{children}</DashboardContext.Provider>);
}

describe('a Dashboard card', () => {
  it.each([true, false])(
    'letters a written card’s heading in the tab face (can edit: %s)',
    (edit) => {
      render(<CardHeading value="Links" canEdit={edit} label="Card heading" onSave={vi.fn()} />);
      expect(
        isHeading(edit ? screen.getByLabelText('Card heading') : screen.getByText('Links')),
      ).toBe(true);
    },
  );

  it.each([true, false])(
    'letters a Note’s heading, not its text, in the tab face (can edit: %s)',
    (edit) => {
      dashboard(edit, <DashboardNote slotId="s" note={{ title: 'Plan', text: '12 open' }} />);
      expect(
        isHeading(edit ? screen.getByLabelText('Note heading') : screen.getByText('Plan')),
      ).toBe(true);
      expect(
        isHeading(edit ? screen.getByLabelText('Note text') : screen.getByText('12 open')),
      ).toBe(false);
    },
  );

  it.each([true, false])(
    'letters a Title’s heading, not its description, in the tab face (can edit: %s)',
    (edit) => {
      dashboard(edit, <DashboardTitle slotId="s" title={{ title: 'Q4', text: '3 goals' }} />);
      expect(
        isHeading(edit ? screen.getByLabelText('Title heading') : screen.getByText('Q4')),
      ).toBe(true);
      expect(
        isHeading(edit ? screen.getByLabelText('Title description') : screen.getByText('3 goals')),
      ).toBe(false);
    },
  );
});
