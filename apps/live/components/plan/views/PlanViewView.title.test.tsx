// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { createShape, type PlanViewRef, type ShapeElement } from '@liveplanner/document';
import { ITEM_TYPES, type Item, type PlanViewId } from '@liveplanner/items';
import { PlanProvider, type PlanContextValue } from '../PlanContext';
import { setPlanCover } from '@/hooks/plan/plan-cover-store';
import { PlanViewView } from './PlanViewView';

const track = vi.fn<typeof import('@/lib/telemetry').track>();
vi.mock('@/lib/telemetry', () => ({ track: (...a: Parameters<typeof track>) => track(...a) }));

// docs/specs/026-plan/plan-tabs.md "Names": a chart filling its Visualisation tab renames with the tab from its
// title, for an Editor only; and docs/specs/026-plan/plan-views.md "Cards by Field": an overflowing list scrolls
// from its first row.
const ID = 'chart-1';
let n = 0;
const person = (i: number) => ({ id: `p${i}`, name: `Person ${i}`, color: '#2563eb' });
const card = (fields: Item['fields']): Item => {
  n += 1;
  return {
    id: `i${n}`,
    type: 'task',
    key: n,
    rank: `r${n}`,
    fields,
    rev: 1,
    createdBy: person(0),
    updatedBy: person(0),
    createdAt: 0,
    updatedAt: 0,
  };
};

function planWith(over: Partial<PlanContextValue> = {}, items: Item[] = []): PlanContextValue {
  return {
    items: new Map(items.map((i) => [i.id, i])),
    types: ITEM_TYPES,
    status: 'ready',
    planInput: true,
    canEdit: true,
    openItem: vi.fn(),
    updateView: vi.fn(),
    statusNames: new Map([['todo', 'To do']]),
    statusPhases: new Map([['todo', 'todo']]),
    ...over,
  } as unknown as PlanContextValue;
}

function draw(
  view: PlanViewId,
  plan: PlanContextValue,
  settings: Omit<PlanViewRef, 'view'> = {},
  size: { width?: number; height?: number } = {},
) {
  const el = {
    ...createShape('plan-view', 0, 0),
    ...size,
    id: ID,
    planView: { view, ...settings },
  } as ShapeElement;
  return render(
    <PlanProvider value={plan}>
      <PlanViewView element={el} />
    </PlanProvider>,
  );
}

const fillTab = () =>
  setPlanCover({
    fillTabId: ID,
    fillTabKind: 'View',
    planKind: 'dashboard',
  });

afterEach(() => {
  cleanup();
  setPlanCover({ fillTabId: null, fillTabKind: null, planKind: null });
});

describe('a chart filling its Visualisation tab', () => {
  it('renames from its title for an Editor', () => {
    fillTab();
    const plan = planWith({}, [card({ title: 'a', status: 'todo' })]);
    draw('workload', plan);
    fireEvent.doubleClick(screen.getByText('Cards by Assignee'));
    const field = screen.getByLabelText('Chart name') as HTMLInputElement;
    fireEvent.change(field, { target: { value: 'Load' } });
    fireEvent.keyDown(field, { key: 'Enter' });
    expect(plan.updateView).toHaveBeenCalledWith(ID, { view: 'workload', title: 'Load' });
    expect(track).toHaveBeenCalledWith('Tab', 'Renamed');
  });

  it.each([
    ['a Participant', { canEdit: false }],
    ['a Viewer', { canEdit: false, canEditCards: false }],
  ])('offers no rename to %s', (_who, over) => {
    fillTab();
    const plan = planWith(over, [card({ title: 'a', status: 'todo' })]);
    draw('workload', plan);
    fireEvent.doubleClick(screen.getByText('Cards by Assignee'));
    expect(screen.queryByLabelText('Chart name')).toBeNull();
    expect(plan.updateView).not.toHaveBeenCalled();
  });

  it('starts a rename from the bare name, never the month it shows', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-05T12:00:00Z'));
    try {
      fillTab();
      const plan = planWith({}, [card({ title: 'a', status: 'todo', due: '2026-10-07' })]);
      draw('calendar', plan);
      const title = screen.getByText(/^Due Calendar · /);
      fireEvent.doubleClick(title);
      const field = screen.getByLabelText('Chart name') as HTMLInputElement;
      expect(field.value).toBe('Due Calendar');
      fireEvent.blur(field);
      // Left as it was: nothing saved.
      expect(plan.updateView).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('Cards by Field', () => {
  it('scrolls an overflowing list from its first row, centring only a list that fits', () => {
    const many = Array.from({ length: 40 }, (_, i) =>
      card({ title: `c${i}`, status: 'todo', assignee: person(i) }),
    );
    const { container } = draw('workload', planWith({}, many), {}, { width: 400, height: 200 });
    const list = container.querySelector('ul') as HTMLElement;
    expect(list.className).toContain('overflow-y-auto');
    expect(list.className).not.toContain('justify-center');
    cleanup();
    const { container: fits } = draw(
      'workload',
      planWith({}, [card({ title: 'a', status: 'todo' })]),
      {},
      { width: 400, height: 400 },
    );
    expect((fits.querySelector('ul') as HTMLElement).className).toContain('justify-center');
  });
});
