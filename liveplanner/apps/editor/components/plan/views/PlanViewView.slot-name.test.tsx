// @vitest-environment jsdom
// docs/specs/026-plan/plan-tabs.md "A slot's name": a chart or metric in a named Dashboard slot draws the slot's name
// in place of its generated heading (and before the chart's own title), and never writes it to the chart.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { createShape, type ShapeElement } from '@liveplanner/project';
import { ITEM_TYPES, type Item, type PlanViewId } from '@liveplanner/items';
import { PlanProvider, type PlanContextValue } from '../PlanContext';
import { SlotName } from '../dashboard/slot-name-context';
import { PlanViewView } from './PlanViewView';
import { DashboardContext, type DashboardContextValue } from '../dashboard/dashboard-context';
import { DashboardSlotContent } from '../dashboard/DashboardSlotContent';

afterEach(cleanup);

const SAM = { id: 'sam', name: 'Sam', color: '#2563eb' };
const card = (id: string, status: string): Item => ({
  id,
  type: 'task',
  key: 1,
  rank: id,
  fields: { title: id, status, assignee: SAM },
  rev: 1,
  createdBy: SAM,
  updatedBy: SAM,
  createdAt: 0,
  updatedAt: 0,
});

const updateView = vi.fn();
const plan = {
  items: new Map([card('a', 'done'), card('b', 'todo')].map((i) => [i.id, i])),
  types: ITEM_TYPES,
  status: 'ready',
  canEdit: true,
  openItem: vi.fn(),
  updateView,
  statusNames: new Map([
    ['todo', 'To do'],
    ['done', 'Done'],
  ]),
  statusPhases: new Map([
    ['todo', 'todo'],
    ['done', 'done'],
  ]),
} as unknown as PlanContextValue;

function draw(view: PlanViewId, name: string | undefined, over: Partial<ShapeElement> = {}) {
  const el = {
    ...createShape('plan-view', 0, 0),
    width: 480,
    height: 300,
    planView: { view },
    ...over,
  } as ShapeElement;
  render(
    <PlanProvider value={plan}>
      <SlotName.Provider value={name}>
        <PlanViewView element={el} />
      </SlotName.Provider>
    </PlanProvider>,
  );
}

describe('a named slot’s view', () => {
  it('heads a chart with the slot’s name in place of the generated one', () => {
    draw('workload', undefined);
    expect(screen.getByText('Cards by Assignee')).toBeTruthy();
    cleanup();
    draw('workload', 'Who is on what');
    expect(screen.getByText('Who is on what')).toBeTruthy();
    expect(screen.queryByText('Cards by Assignee')).toBeNull();
    expect(updateView).not.toHaveBeenCalled();
  });

  it('puts the slot’s name before the chart’s own title, which shows when the slot has none', () => {
    const titled = { planView: { view: 'workload' as const, title: 'Team Load' } };
    draw('workload', undefined, titled);
    expect(screen.getByText('Team Load')).toBeTruthy();
    cleanup();
    draw('workload', 'Launch crew', titled);
    expect(screen.getByText('Launch crew')).toBeTruthy();
    expect(screen.queryByText('Team Load')).toBeNull();
  });

  it('labels a metric tile with the slot’s name, in its accessible name too', () => {
    draw('metric:progress', 'Launch readiness');
    expect(screen.getByRole('group', { name: /^Launch readiness: 50 %/ })).toBeTruthy();
    expect(screen.queryByText('Completion')).toBeNull();
    cleanup();
    draw('metric:progress', undefined);
    expect(screen.getByRole('group', { name: /^Completion: 50 %/ })).toBeTruthy();
  });

  it('takes its name from the slot’s content as the slot draws it', () => {
    const el = { ...createShape('plan-view', 0, 0), planView: { view: 'metric:progress' } };
    const value = { elements: new Map([[el.id, el]]) } as unknown as DashboardContextValue;
    render(
      <PlanProvider value={plan}>
        <DashboardContext.Provider value={value}>
          <DashboardSlotContent
            slotId="s1"
            content={{ type: 'element', elementId: el.id, name: 'Launch readiness' }}
          />
        </DashboardContext.Provider>
      </PlanProvider>,
    );
    expect(screen.getByRole('group', { name: /^Launch readiness/ })).toBeTruthy();
  });
});
