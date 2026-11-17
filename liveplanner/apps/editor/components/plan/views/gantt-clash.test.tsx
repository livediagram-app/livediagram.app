// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, renderHook } from '@testing-library/react';
import { createShape, type ShapeElement } from '@liveplanner/project';
import {
  BUILT_IN_DATES,
  ITEM_TYPES,
  type Item,
  type ItemFields,
  type ItemTypeDef,
} from '@liveplanner/items';
import type { ToastOffer } from '@liveworkspace/workbench/components/toast/toast-queue';
import { PlanProvider, type PlanContextValue } from '../PlanContext';
import { PlanViewView } from './PlanViewView';
import { shiftsAfter, useGanttMoveFollowing } from './gantt-clash';

// docs/specs/026-plan/plan-views.md "Dependency clashes" and "Moving the cards that follow".
const offers: ToastOffer[] = [];
vi.mock('@/hooks/ui/useToast', () => ({
  useToast: () => ({ offer: (o: ToastOffer) => offers.push(o) }),
}));
const tracked: string[] = [];
vi.mock('@/lib/telemetry', () => ({ track: (...a: string[]) => tracked.push(a.join(' ')) }));

afterEach(() => {
  cleanup();
  offers.length = 0;
  tracked.length = 0;
});

const SAM = { id: 'sam', name: 'Sam', color: '#2563eb' };
const blockedBy = {
  id: 'f-bb',
  label: 'Blocked By',
  kind: 'card' as const,
  linkType: 'project',
  multiple: true,
  blocks: true,
};
const TYPES: ItemTypeDef[] = ITEM_TYPES.map((t: ItemTypeDef) =>
  t.id === 'project'
    ? { ...t, fields: [...t.fields, blockedBy.id], custom: [...(t.custom ?? []), blockedBy] }
    : t,
);
const project = (id: string, key: number, fields: ItemFields): Item => ({
  id,
  type: 'project',
  key,
  rank: `r${key}`,
  fields: { status: 'todo', ...fields },
  rev: 1,
  createdBy: SAM,
  updatedBy: SAM,
  createdAt: 0,
  updatedAt: 0,
});
const DESIGN = project('item-design', 1, {
  title: 'Design',
  start: '2026-10-01',
  due: '2026-10-09',
});
// Starts two days before Design is due.
const BUILD = project('item-build', 2, {
  title: 'Build',
  start: '2026-10-07',
  due: '2026-10-12',
  'f-bb': ['item-design'],
});
const SHIP = project('item-ship', 3, {
  title: 'Ship',
  start: '2026-10-20',
  due: '2026-10-21',
  'f-bb': ['item-build'],
});

function planOf(over: Partial<PlanContextValue> = {}, items = [DESIGN, BUILD, SHIP]) {
  return {
    items: new Map(items.map((i) => [i.id, i])),
    types: TYPES,
    status: 'ready',
    canEdit: true,
    canEditCards: true,
    openItem: vi.fn(),
    updateView: vi.fn(),
    announce: vi.fn(),
    patchItem: vi.fn(),
    patchItems: vi.fn(),
    statusNames: new Map([
      ['todo', 'To do'],
      ['done', 'Done'],
    ]),
    statusPhases: new Map([
      ['todo', 'todo'],
      ['done', 'done'],
    ]),
    ...over,
  } as unknown as PlanContextValue;
}

function chart(plan: PlanContextValue) {
  const el = {
    ...createShape('plan-view', 0, 0),
    id: 'chart',
    planView: { view: 'gantt' },
  } as ShapeElement;
  render(
    <PlanProvider value={plan}>
      <PlanViewView element={el} />
    </PlanProvider>,
  );
}

describe('Gantt dependency clashes', () => {
  it('draws a clashing arrow in amber with a named clash mark, to a Viewer too', () => {
    chart(planOf({ canEdit: false, canEditCards: false }));
    const arrows = [...document.querySelectorAll('[data-gantt-arrow]')];
    expect(arrows).toHaveLength(2);
    expect(arrows.filter((a) => a.hasAttribute('data-clash'))).toHaveLength(1);
    const marks = [...document.querySelectorAll('[data-gantt-clash]')];
    expect(marks.map((m) => m.getAttribute('aria-label'))).toEqual([
      'Starts 2 days before #1 Design is due',
    ]);
  });

  it('draws no clash once the blocker is done', () => {
    const done = { ...DESIGN, fields: { ...DESIGN.fields, status: 'done' } };
    chart(planOf({}, [done, BUILD, SHIP]));
    expect(document.querySelector('[data-gantt-clash]')).toBeNull();
    expect(document.querySelector('[data-clash]')).toBeNull();
  });
});

describe('moving the cards that follow', () => {
  const later = { set: { due: '2026-10-20' } };

  it('works the shifts out with the drag applied', () => {
    const found = shiftsAfter(planOf(), 'item-design', later, BUILT_IN_DATES)!;
    expect(found.moved.fields['due']).toBe('2026-10-20');
    expect(found.shifts.map((s) => [s.item.id, s.days])).toEqual([
      ['item-build', 14],
      ['item-ship', 7],
    ]);
    expect(shiftsAfter(planOf(), 'gone', later, BUILT_IN_DATES)).toBeNull();
    const cleared = shiftsAfter(planOf(), 'item-build', { clear: ['start'] }, BUILT_IN_DATES)!;
    expect(cleared.moved.fields['start']).toBeUndefined();
  });

  it('offers to move them, and moves them as one change when pressed', () => {
    const plan = planOf();
    const { result } = renderHook(() => useGanttMoveFollowing(plan, BUILT_IN_DATES));
    result.current('item-design', later);
    expect(offers).toHaveLength(1);
    expect(offers[0]).toMatchObject({
      message: '2 cards that follow #1 Design now start before it is due.',
      confirmLabel: 'Move 2 Cards',
      declineLabel: 'Leave Them',
    });
    // Nothing moves until it is pressed; by then the drag has landed in the plan.
    expect(plan.patchItems).not.toHaveBeenCalled();
    (plan.items as Map<string, Item>).set('item-design', {
      ...DESIGN,
      fields: { ...DESIGN.fields, due: '2026-10-20' },
    });
    offers[0]!.onConfirm();
    expect(plan.patchItems).toHaveBeenCalledTimes(1);
    expect(plan.patchItems).toHaveBeenCalledWith([
      { id: 'item-build', patch: { set: { start: '2026-10-21', due: '2026-10-26' } } },
      { id: 'item-ship', patch: { set: { start: '2026-10-27', due: '2026-10-28' } } },
    ]);
    expect(plan.announce).toHaveBeenCalledWith('Moved 2 cards that follow #1 Design');
    expect(tracked).toEqual(['Plan Changed GanttMoveFollowing']);
    offers[0]!.onDecline();
  });

  it('says one card, and does nothing when the clash has gone by the time it is pressed', () => {
    const plan = planOf({}, [DESIGN, BUILD]);
    const { result } = renderHook(() => useGanttMoveFollowing(plan, BUILT_IN_DATES));
    result.current('item-design', later);
    expect(offers[0]).toMatchObject({
      message: '1 card that follows #1 Design now starts before it is due.',
      confirmLabel: 'Move 1 Card',
    });
    // A collaborator moved Build well after Design before it was pressed.
    (plan.items as Map<string, Item>).set('item-build', {
      ...BUILD,
      fields: { ...BUILD.fields, start: '2026-11-01', due: '2026-11-02' },
    });
    offers[0]!.onConfirm();
    expect(plan.patchItems).not.toHaveBeenCalled();
  });

  it('offers nothing to a Viewer, outside the editor, or when nothing clashes', () => {
    for (const plan of [
      planOf({ canEditCards: false }),
      planOf({ patchItems: undefined }),
      undefined,
    ]) {
      const { result } = renderHook(() => useGanttMoveFollowing(plan, BUILT_IN_DATES));
      result.current('item-design', later);
    }
    const plan = planOf();
    const { result } = renderHook(() => useGanttMoveFollowing(plan, BUILT_IN_DATES));
    result.current('item-ship', { set: { due: '2026-10-30' } });
    result.current('gone', later);
    expect(offers).toHaveLength(0);
  });
});
