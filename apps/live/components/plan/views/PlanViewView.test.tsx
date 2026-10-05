// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { createShape, type ShapeElement } from '@livediagram/document';
import { ITEM_TYPES, type Item, type PlanViewId } from '@livediagram/items';
import { PlanProvider, type PlanContextValue } from '../PlanContext';
import { PlanViewView } from './PlanViewView';

// docs/specs/025-plan/plan-views.md.
const SAM = { id: 'sam', name: 'Sam', color: '#2563eb' };
let n = 0;
const item = (fields: Item['fields'], type = 'task'): Item => {
  n += 1;
  return {
    id: `i${n}`,
    type,
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
    types: ITEM_TYPES,
    status: 'ready',
    planInput: true,
    canEdit: true,
    openItem: vi.fn(),
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

function draw(view: PlanViewId, plan: PlanContextValue | undefined) {
  const el = { ...createShape('plan-view', 0, 0), planView: { view } } as ShapeElement;
  return render(
    <PlanProvider value={plan}>
      <PlanViewView element={el} />
    </PlanProvider>,
  );
}

afterEach(cleanup);

describe('plan views', () => {
  it('say so while the cards load, and show their empty state without any', () => {
    draw('gantt', planWith([], { status: 'loading' }));
    expect(screen.getByText('Loading cards…')).toBeTruthy();
    cleanup();
    draw('gantt', planWith([]));
    expect(
      screen.getByText('No projects yet. Add a Project card to a board to see it here.'),
    ).toBeTruthy();
    cleanup();
    draw('workload', undefined);
    expect(
      screen.getByText('No cards yet. Add cards to a board to see who has what.'),
    ).toBeTruthy();
  });

  it('draws a Gantt row per project, opening it in Plan mode, and offers a missing start', () => {
    const p = item({ title: 'Launch', due: '2026-10-20' }, 'project');
    const kid = item({ title: 'Kid', parent: p.id, status: 'done' });
    const plan = planWith([p, kid]);
    draw('gantt', plan);
    fireEvent.click(screen.getByRole('button', { name: `#${p.key} Launch, 1 of 1 done` }));
    expect(plan.openItem).toHaveBeenCalledWith(p.id);
    fireEvent.click(screen.getByRole('button', { name: `Add a start date to #${p.key} Launch` }));
    expect(plan.openItem).toHaveBeenCalledTimes(2);
    expect(screen.getByText('Today')).toBeTruthy();
  });

  it('opens a card on a double-click only, outside Plan mode', () => {
    const p = item({ title: 'Quiet' }, 'project');
    const plan = planWith([p], { planInput: false, canEdit: false });
    draw('gantt', plan);
    expect(screen.getByText('No dates')).toBeTruthy();
    expect(screen.queryByText('Add a start date')).toBeNull();
    const row = screen.getByRole('button', { name: `#${p.key} Quiet` });
    fireEvent.click(row);
    expect(plan.openItem).not.toHaveBeenCalled();
    fireEvent.doubleClick(row);
    expect(plan.openItem).toHaveBeenCalledWith(p.id);
  });

  it('lists due cards on the calendar and steps months', () => {
    const now = new Date();
    const p = (x: number) => String(x).padStart(2, '0');
    const due = `${now.getFullYear()}-${p(now.getMonth() + 1)}-15`;
    draw('calendar', planWith([item({ title: 'Ship it', due })]));
    expect(screen.getByRole('button', { name: /Ship it/ })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Next Month' }));
    expect(screen.queryByRole('button', { name: /Ship it/ })).toBeNull();
    expect(screen.getByText('Nothing due this month.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Today' }));
    expect(screen.getByRole('button', { name: /Ship it/ })).toBeTruthy();
  });

  it('charts workload, status and priority', () => {
    const cards = [
      item({ title: 'a', assignee: SAM, status: 'done', priority: 'urgent' }),
      item({ title: 'b', status: 'todo' }),
    ];
    draw('workload', planWith(cards));
    expect(screen.getByText('Sam')).toBeTruthy();
    expect(screen.getByText('Unassigned')).toBeTruthy();
    cleanup();
    draw('status-mix', planWith(cards));
    expect(screen.getByRole('img', { name: 'To do 1, Done 1' })).toBeTruthy();
    cleanup();
    draw('priority-matrix', planWith(cards));
    expect(screen.getByRole('cell', { name: 'Urgent, Done: 1' })).toBeTruthy();
    expect(screen.getByRole('cell', { name: 'No Priority, Not Started: 1' })).toBeTruthy();
  });

  it('draws a metric over every card, with no set-up', () => {
    const cards = [item({ title: 'a', status: 'done' }), item({ title: 'b', status: 'todo' })];
    draw('metric:progress', planWith(cards));
    expect(screen.getByRole('group', { name: 'Completion, every card' })).toBeTruthy();
    expect(screen.getByRole('img', { name: '50% done, 1 of 2' })).toBeTruthy();
    cleanup();
    draw('metric:progress', planWith(cards, { statusPhases: new Map() }));
    expect(screen.getByText('No done column')).toBeTruthy();
  });
});
