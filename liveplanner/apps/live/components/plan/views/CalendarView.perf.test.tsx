// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { createShape, type ShapeElement } from '@liveplanner/document';
import { ITEM_TYPES, type Item } from '@liveplanner/items';
import { PlanProvider, type PlanContextValue } from '../PlanContext';

// docs/specs/026-plan/plan-views.md "Moving a card on a calendar": a drag's pointer moves re-render the lifted copy
// alone; the days re-render only when the day under the pointer changes (two days: the one left and the one entered).
const faces = vi.hoisted(() => ({ count: 0 }));
vi.mock('../PlanCardFace', async (importOriginal) => {
  const real = await importOriginal<typeof import('../PlanCardFace')>();
  return {
    ...real,
    PlanCardFace: (props: Parameters<typeof real.PlanCardFace>[0]) => {
      faces.count += 1;
      return real.PlanCardFace(props);
    },
  };
});
vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));
const { PlanViewView } = await import('./PlanViewView');

const SAM = { id: 'sam', name: 'Sam', color: '#2563eb' };
// About 150 cards over October 2026's 42-day grid (six weeks: the view is drawn tall enough for minimal cards).
const CARDS: Item[] = Array.from({ length: 150 }, (_, i) => ({
  id: `c${i}`,
  type: 'task',
  key: i + 1,
  rank: `r${i}`,
  fields: { title: `Card ${i}`, due: `2026-10-${String((i % 31) + 1).padStart(2, '0')}` },
  rev: 1,
  createdBy: SAM,
  updatedBy: SAM,
  createdAt: 0,
  updatedAt: 0,
}));
const plan = {
  items: new Map(CARDS.map((c) => [c.id, c])),
  types: ITEM_TYPES,
  status: 'ready',
  canEdit: true,
  canEditCards: true,
  openItem: vi.fn(),
  patchItem: vi.fn(async () => true),
  announce: vi.fn(),
  statusNames: new Map(),
  statusPhases: new Map(),
} as unknown as PlanContextValue;

const GRID = { left: 0, top: 0, width: 700, height: 1200, right: 700, bottom: 1200, x: 0, y: 0 };
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-05T12:00:00Z'));
  const real = HTMLElement.prototype.getBoundingClientRect;
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
    this: HTMLElement,
  ) {
    if (this.hasAttribute('data-calendar-grid')) return { ...GRID, toJSON: () => GRID };
    return real.call(this);
  });
});
afterEach(() => {
  fireEvent.click(document.body);
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('dragging on a full calendar', () => {
  it('re-renders only the lifted copy while the pointer stays over one day', () => {
    const el = {
      ...createShape('plan-view', 0, 0),
      width: 1400,
      height: 1600,
      planView: { view: 'calendar' },
    } as ShapeElement;
    const { container } = render(
      <PlanProvider value={plan}>
        <PlanViewView element={el} />
      </PlanProvider>,
    );
    const entry = container.querySelector<HTMLElement>('[data-calendar-item]')!;
    fireEvent.pointerDown(entry, { button: 0, clientX: 5, clientY: 5 });
    // Into a day, then 60 moves inside it.
    fireEvent.pointerMove(window, { clientX: 250, clientY: 450 });
    faces.count = 0;
    const MOVES = 60;
    for (let i = 0; i < MOVES; i += 1)
      fireEvent.pointerMove(window, { clientX: 220 + (i % 40), clientY: 430 + (i % 30) });
    const rendered = faces.count;
    fireEvent.keyDown(window, { key: 'Escape' });
    // The lifted copy's face, once a move; never a day's cards.
    expect(rendered).toBeLessThanOrEqual(MOVES);
  });
});
