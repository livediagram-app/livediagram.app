// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { createShape, type ShapeElement } from '@liveplanner/document';
import { ITEM_TYPES, type Item, type PlanViewId } from '@liveplanner/items';
import { PlanProvider, type PlanContextValue } from '../PlanContext';
import { PlanViewView } from './PlanViewView';
import { calendarDayAt } from './useCalendarDrag';

const track = vi.fn<typeof import('@/lib/telemetry').track>();
vi.mock('@/lib/telemetry', () => ({ track: (...a: Parameters<typeof track>) => track(...a) }));

// docs/specs/026-plan/plan-views.md "Moving a card on a calendar" and "Start Calendar".
const SAM = { id: 'sam', name: 'Sam', color: '#2563eb' };
let n = 0;
const item = (fields: Item['fields']): Item => {
  n += 1;
  return {
    id: `i${n}`,
    type: 'task',
    key: n,
    rank: `r${n}`,
    fields,
    rev: 1,
    createdBy: SAM,
    updatedBy: SAM,
    createdAt: 0,
    updatedAt: 0,
  };
};

function planWith(items: Item[], over: Partial<PlanContextValue> = {}): PlanContextValue {
  return {
    items: new Map(items.map((i) => [i.id, i])),
    types: ITEM_TYPES.map((t) => (t.id === 'task' ? { ...t, fields: [...t.fields, 'start'] } : t)),
    status: 'ready',
    planInput: true,
    canEdit: true,
    canEditCards: true,
    openItem: vi.fn(),
    patchItem: vi.fn(async () => true),
    announce: vi.fn(),
    statusNames: new Map(),
    statusPhases: new Map(),
    ...over,
  } as unknown as PlanContextValue;
}

function draw(view: PlanViewId, plan: PlanContextValue) {
  const el = { ...createShape('plan-view', 0, 0), planView: { view } } as ShapeElement;
  return render(
    <PlanProvider value={plan}>
      <PlanViewView element={el} />
    </PlanProvider>,
  );
}

// October 2026's grid runs Monday 28 September to Sunday 1 November: five weeks. Laid out 700 by 500, a day is
// 100 px square, so Wednesday 14 October (the 17th day) sits at (250, 250).
const GRID = { left: 0, top: 0, width: 700, height: 500, right: 700, bottom: 500, x: 0, y: 0 };
const AT_14_OCT = { clientX: 250, clientY: 250 };

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-05T12:00:00Z'));
  track.mockClear();
  const real = HTMLElement.prototype.getBoundingClientRect;
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
    this: HTMLElement,
  ) {
    if (this.hasAttribute('data-calendar-grid')) return { ...GRID, toJSON: () => GRID };
    return real.call(this);
  });
});
afterEach(() => {
  // A drag's release waits for its click to swallow; let it have one so it never eats the next test's.
  fireEvent.click(document.body);
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

const entry = (name: RegExp) => screen.getByRole('button', { name });

function dragTo(el: HTMLElement, to: { clientX: number; clientY: number }) {
  fireEvent.pointerDown(el, { button: 0, clientX: 5, clientY: 5 });
  fireEvent.pointerMove(window, to);
  fireEvent.pointerUp(window, to);
}

describe('calendarDayAt', () => {
  it('reads the day under a point, and nothing off the grid', () => {
    expect(calendarDayAt(GRID, 250, 250, 100, 5)).toBe(116);
    expect(calendarDayAt(GRID, 0, 0, 100, 5)).toBe(100);
    expect(calendarDayAt(GRID, 699, 499, 100, 5)).toBe(134);
    expect(calendarDayAt(GRID, 701, 10, 100, 5)).toBeUndefined();
    expect(calendarDayAt(GRID, 10, -1, 100, 5)).toBeUndefined();
    expect(calendarDayAt({ ...GRID, width: 0 }, 10, 10, 100, 5)).toBeUndefined();
  });
});

describe('moving a card on the Due Calendar', () => {
  it('drags a card to another day: its Due moves, announced and counted once', () => {
    const card = item({ title: 'Ship it', due: '2026-10-05' });
    const plan = planWith([card]);
    draw('calendar', plan);
    const el = entry(/Ship it/);
    fireEvent.pointerDown(el, { button: 0, clientX: 5, clientY: 5 });
    fireEvent.pointerMove(window, AT_14_OCT);
    // A lifted copy follows the pointer and the day under it is ringed.
    expect(document.querySelector('[data-calendar-ghost]')).not.toBeNull();
    const target = document.querySelector<HTMLElement>('[data-calendar-day]:nth-child(17)')!;
    expect(target.style.boxShadow).toContain('inset');
    fireEvent.pointerUp(window, AT_14_OCT);
    expect(plan.patchItem).toHaveBeenCalledTimes(1);
    expect(plan.patchItem).toHaveBeenCalledWith(card.id, { set: { due: '2026-10-14' } });
    expect(plan.announce).toHaveBeenCalledWith(`Moved #${card.key} Ship it to 14 October`);
    expect(track).toHaveBeenCalledWith('Plan', 'Changed', 'CalendarDue');
    expect(document.querySelector('[data-calendar-ghost]')).toBeNull();
    // The click the release makes never opens the card.
    fireEvent.click(el);
    expect(plan.openItem).not.toHaveBeenCalled();
  });

  it('shifts the Start with a Due dragged before it, and says so', () => {
    const card = item({ title: 'Ship it', start: '2026-10-20', due: '2026-10-22' });
    const plan = planWith([card]);
    draw('calendar', plan);
    dragTo(entry(/Ship it/), AT_14_OCT);
    expect(plan.patchItem).toHaveBeenCalledWith(card.id, {
      set: { due: '2026-10-14', start: '2026-10-12' },
    });
    expect(plan.announce).toHaveBeenCalledWith(
      `Moved #${card.key} Ship it to 14 October, its Start too`,
    );
  });

  it('still opens the card on a plain press, and a drop on the same day does nothing', () => {
    const card = item({ title: 'Ship it', due: '2026-10-14' });
    const plan = planWith([card]);
    draw('calendar', plan);
    const el = entry(/Ship it/);
    fireEvent.pointerDown(el, { button: 0, clientX: 5, clientY: 5 });
    fireEvent.pointerUp(window, { clientX: 6, clientY: 5 });
    fireEvent.click(el);
    expect(plan.openItem).toHaveBeenCalledWith(card.id);
    dragTo(el, AT_14_OCT);
    expect(plan.patchItem).not.toHaveBeenCalled();
  });

  it('drops the drag on Escape, unwritten', () => {
    const card = item({ title: 'Ship it', due: '2026-10-05' });
    const plan = planWith([card]);
    draw('calendar', plan);
    fireEvent.pointerDown(entry(/Ship it/), { button: 0, clientX: 5, clientY: 5 });
    fireEvent.pointerMove(window, AT_14_OCT);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(document.querySelector('[data-calendar-ghost]')).toBeNull();
    fireEvent.pointerUp(window, AT_14_OCT);
    expect(plan.patchItem).not.toHaveBeenCalled();
  });

  it('never lets a Viewer, or a view not taking input, move a card', () => {
    const card = item({ title: 'Ship it', due: '2026-10-05' });
    for (const over of [{ canEditCards: false }, { planInput: false }]) {
      const plan = planWith([card], over);
      draw('calendar', plan);
      const el = entry(/Ship it/);
      dragTo(el, AT_14_OCT);
      fireEvent.keyDown(el, { key: 'ArrowRight', altKey: true });
      expect(document.querySelector('[data-calendar-ghost]')).toBeNull();
      expect(plan.patchItem).not.toHaveBeenCalled();
      cleanup();
    }
  });

  it('moves a focused card a day with Alt+Left/Right and a week with Alt+Up/Down', () => {
    const card = item({ title: 'Ship it', due: '2026-10-14' });
    const plan = planWith([card]);
    draw('calendar', plan);
    fireEvent.keyDown(entry(/Ship it/), { key: 'ArrowRight', altKey: true });
    expect(plan.patchItem).toHaveBeenLastCalledWith(card.id, { set: { due: '2026-10-15' } });
    fireEvent.keyDown(entry(/Ship it/), { key: 'ArrowUp', altKey: true });
    expect(plan.patchItem).toHaveBeenLastCalledWith(card.id, { set: { due: '2026-10-07' } });
    expect(plan.announce).toHaveBeenLastCalledWith(`Moved #${card.key} Ship it to 7 October`);
    // Without Alt an arrow is left alone.
    fireEvent.keyDown(entry(/Ship it/), { key: 'ArrowLeft' });
    expect(plan.patchItem).toHaveBeenCalledTimes(2);
  });

  it('follows a card moved by keys off the grid into the next month', () => {
    const card = item({ title: 'Ship it', due: '2026-10-30' });
    const plan = planWith([card]);
    draw('calendar', plan);
    fireEvent.keyDown(entry(/Ship it/), { key: 'ArrowDown', altKey: true });
    expect(plan.patchItem).toHaveBeenCalledWith(card.id, { set: { due: '2026-11-06' } });
    expect(screen.getByText(/November 2026/)).toBeTruthy();
  });
});

describe('the Start Calendar', () => {
  it('lists cards by Start, counts them starting, and drags move the Start', () => {
    const a = item({ title: 'Kick off', start: '2026-10-05', due: '2026-10-15' });
    const b = item({ title: 'Only due', due: '2026-10-05' });
    const plan = planWith([a, b]);
    draw('start-calendar', plan);
    expect(screen.getByText(/Start Calendar · October 2026/)).toBeTruthy();
    expect(screen.getByLabelText('1 starting')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Only due/ })).toBeNull();
    dragTo(entry(/Kick off/), AT_14_OCT);
    expect(plan.patchItem).toHaveBeenCalledWith(a.id, { set: { start: '2026-10-14' } });
    expect(track).toHaveBeenCalledWith('Plan', 'Changed', 'CalendarStart');
  });

  it('says so when nothing starts this month', () => {
    draw('start-calendar', planWith([]));
    expect(screen.getByText('Nothing starts this month.')).toBeTruthy();
  });
});

// docs/specs/026-plan/plan-views.md "Moving a card on a calendar": a card moved by keys is focused where it lands, and
// one that lands under a day's "+N more" is let go, never focused later when it shows.
describe('a card moved by keys into a full day', () => {
  it('focuses a card where it lands in sight', () => {
    const c = item({ title: 'Delta', due: '2026-10-14' });
    const plan = planWith([c]);
    const el = {
      ...createShape('plan-view', 0, 0),
      planView: { view: 'calendar' },
    } as ShapeElement;
    const view = (p: PlanContextValue) => (
      <PlanProvider value={p}>
        <PlanViewView element={el} />
      </PlanProvider>
    );
    const { rerender } = render(view(plan));
    act(() => {
      fireEvent.keyDown(entry(/Delta/), { key: 'ArrowRight', altKey: true });
      rerender(view(planWith([{ ...c, fields: { ...c.fields, due: '2026-10-15' } }])));
    });
    expect(document.activeElement).toBe(entry(/Delta/));
    expect(entry(/Delta/).closest('[data-calendar-day]')!.textContent).toContain('15');
  });

  it('stops looking for it, so focus never jumps to it later', () => {
    const a = item({ title: 'Alpha', due: '2026-10-15' });
    const b = item({ title: 'Bravo', due: '2026-10-15' });
    const c = item({ title: 'Charlie', due: '2026-10-14' });
    const plan = planWith([a, b, c]);
    const el = {
      ...createShape('plan-view', 0, 0),
      planView: { view: 'calendar' },
    } as ShapeElement;
    const view = (p: PlanContextValue) => (
      <PlanProvider value={p}>
        <PlanViewView element={el} />
      </PlanProvider>
    );
    const { rerender } = render(view(plan));
    // The move lands with the key press (an optimistic write): Charlie joins a day with room for one card and
    // "+2 more".
    const moved = { ...c, fields: { ...c.fields, due: '2026-10-15' } };
    act(() => {
      fireEvent.keyDown(entry(/Charlie/), { key: 'ArrowRight', altKey: true });
      rerender(view(planWith([a, b, moved])));
    });
    expect(plan.patchItem).toHaveBeenCalledWith(c.id, { set: { due: '2026-10-15' } });
    expect(screen.queryByRole('button', { name: /Charlie/ })).toBeNull();
    expect(screen.getByText('+2 more')).toBeTruthy();
    // Later the day empties out and Charlie shows: focus stays where it was.
    (document.activeElement as HTMLElement | null)?.blur();
    rerender(view(planWith([moved])));
    expect(entry(/Charlie/)).not.toBe(document.activeElement);
  });
});
