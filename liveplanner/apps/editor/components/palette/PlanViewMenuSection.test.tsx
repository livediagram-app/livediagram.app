// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createShape, type PlanViewRef, type ShapeElement } from '@liveplanner/project';
import { ITEM_TYPES, type ItemTypeDef } from '@liveplanner/items';
import { track } from '@/lib/telemetry';
import { PlanViewMenuSection } from './PlanViewMenuSection';

// docs/specs/026-plan/plan-views.md "Swimlanes": a Gantt chart's collapsible Swimlanes row sets its swimlanes, one
// element edit.
const plan: Record<string, unknown> = {};
vi.mock('@/components/plan/PlanContext', () => ({ usePlan: () => plan }));
vi.mock('@liveworkspace/workbench/components/primitives/MenuFlyoutSection', () => ({
  MenuFlyoutSection: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

afterEach(cleanup);

const chart = (planView: PlanViewRef) =>
  ({ ...createShape('plan-view', 0, 0), id: 'chart', planView }) as ShapeElement;

function show(planView: PlanViewRef, overrides: Record<string, unknown> = {}, open = true) {
  for (const key of Object.keys(plan)) delete plan[key];
  Object.assign(plan, { canEdit: true, types: ITEM_TYPES, updateView: vi.fn() }, overrides);
  const onToggle = vi.fn<(id: string) => void>();
  render(
    <PlanViewMenuSection
      element={chart(planView)}
      flyoutProps={{}}
      sectionProps={(id) => ({ open, onToggle: () => onToggle(id) })}
    />,
  );
  return onToggle;
}

describe('PlanViewMenuSection', () => {
  it('has Card Types and Swimlanes rows, collapsed until clicked', () => {
    const onToggle = show({ view: 'gantt' }, {}, false);
    const lanes = screen.getByRole('button', { name: 'Swimlanes' });
    const types = screen.getByRole('button', { name: 'Card Types' });
    expect(lanes.getAttribute('aria-expanded')).toBe('false');
    expect(types.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByRole('radio', { name: 'Assignee' })).toBeNull();
    fireEvent.click(lanes);
    expect(onToggle).toHaveBeenCalledWith('plan-view-swimlanes');
    fireEvent.click(types);
    expect(onToggle).toHaveBeenCalledWith('plan-view-types');
  });

  it('keeps naming a type that lost Start or Due when another is toggled', () => {
    const dated = ITEM_TYPES.map((t) =>
      t.id === 'idea' ? { ...t, fields: [...t.fields, 'start', 'due'] } : t,
    );
    // Task is named but has no Start, so it is not listed; toggling Idea keeps it named.
    show({ view: 'gantt', types: ['project', 'task'] }, { types: dated });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Idea' }));
    expect(plan['updateView']).toHaveBeenLastCalledWith('chart', {
      view: 'gantt',
      types: ['project', 'idea', 'task'],
    });
  });

  it('lists only card types with Start and Due, and says why', () => {
    show({ view: 'gantt' });
    expect(screen.getAllByRole('checkbox', { name: 'Project' }).length).toBeGreaterThan(0);
    // The built-in Task has Due but no Start; Note has neither.
    expect(screen.queryByRole('checkbox', { name: 'Task' })).toBeNull();
    expect(screen.queryByRole('checkbox', { name: 'Note' })).toBeNull();
    expect(screen.getAllByRole('note').map((n) => n.textContent)).toContain(
      'iThe card types this view charts; only those with Start and Due fields are listed.',
    );
  });

  it('draws every type with dates to start with, narrows to fewer, keeping its other settings, and tracks it', () => {
    const dated = ITEM_TYPES.map((t) =>
      t.id === 'task' ? { ...t, fields: [...t.fields, 'start'] } : t,
    );
    show({ view: 'gantt', namesWidth: 300 }, { types: dated });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Task' }));
    expect(plan['updateView']).toHaveBeenLastCalledWith('chart', {
      view: 'gantt',
      namesWidth: 300,
      types: ['project'],
    });
    expect(track).toHaveBeenCalledWith('Plan', 'Changed', 'GanttTypes');
  });

  it('drops the setting once every type with dates is back, and never lets the last type go', () => {
    const dated = ITEM_TYPES.map((t) =>
      t.id === 'task' ? { ...t, fields: [...t.fields, 'start'] } : t,
    );
    show({ view: 'gantt', types: ['project'] }, { types: dated });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Task' }));
    expect(plan['updateView']).toHaveBeenLastCalledWith('chart', { view: 'gantt' });
    cleanup();
    show({ view: 'gantt' });
    const project = screen
      .getAllByRole('checkbox', { name: 'Project' })
      .find((b) => b.getAttribute('aria-checked') === 'true')!;
    // The last type keeps its pressed look (not dimmed as disabled), and pressing it changes nothing.
    expect(project.hasAttribute('disabled')).toBe(false);
    expect(project.getAttribute('aria-checked')).toBe('true');
    vi.mocked(plan['updateView'] as () => void).mockClear();
    fireEvent.click(project);
    expect(plan['updateView']).not.toHaveBeenCalled();
  });

  it('sets the chart’s swimlanes, keeping its other settings, and tracks it', () => {
    show({ view: 'gantt', namesWidth: 300 });
    fireEvent.click(screen.getByRole('radio', { name: 'Assignee' }));
    expect(plan['updateView']).toHaveBeenCalledWith('chart', {
      view: 'gantt',
      namesWidth: 300,
      swimlaneBy: 'assignee',
    });
    expect(track).toHaveBeenCalledWith('Plan', 'Changed', 'GanttSwimlanes');
  });

  it('lanes by a field, and None drops the setting', () => {
    show({ view: 'gantt', swimlaneBy: 'priority' });
    fireEvent.click(screen.getByRole('radio', { name: 'Labels' }));
    expect(plan['updateView']).toHaveBeenLastCalledWith('chart', {
      view: 'gantt',
      swimlaneBy: 'field',
      swimlaneField: 'labels',
    });
    fireEvent.click(screen.getByRole('radio', { name: 'None' }));
    expect(plan['updateView']).toHaveBeenLastCalledWith('chart', { view: 'gantt' });
  });

  // docs/specs/026-plan/plan-views.md "Row order".
  it('offers Sort by Date only while the chart has its own order, and it clears the order', () => {
    show({ view: 'gantt' });
    expect(screen.queryByRole('button', { name: 'Sort by Date' })).toBeNull();
    cleanup();
    show({ view: 'gantt', namesWidth: 300, rowOrder: ['item-alpha', 'item-betaa'] });
    fireEvent.click(screen.getByRole('button', { name: 'Sort by Date' }));
    expect(plan['updateView']).toHaveBeenCalledWith('chart', { view: 'gantt', namesWidth: 300 });
    expect(track).toHaveBeenCalledWith('Plan', 'Changed', 'GanttRowOrder');
  });

  // docs/specs/026-plan/plan-views.md "Dates": a chart reads the Date fields picked for its dates.
  const sprint = ITEM_TYPES.map((t): ItemTypeDef =>
    t.id === 'project'
      ? {
          ...t,
          fields: [...t.fields, 'f-kick', 'f-pts'],
          custom: [
            { id: 'f-kick', label: 'Kickoff', kind: 'date' as const },
            { id: 'f-pts', label: 'Story Points', kind: 'number' as const },
          ],
        }
      : t,
  );

  it('picks a Gantt chart’s Starts On and Due On, the built-in dropped rather than stored', () => {
    show({ view: 'gantt', namesWidth: 300 }, { types: sprint });
    expect(screen.getByRole('heading', { name: 'Starts On' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Due On' })).toBeTruthy();
    const starts = within(screen.getByRole('radiogroup', { name: 'Starts On' }));
    const dues = within(screen.getByRole('radiogroup', { name: 'Due On' }));
    expect(dues.getByRole('radio', { name: 'Kickoff' })).toBeTruthy();
    fireEvent.click(starts.getByRole('radio', { name: 'Kickoff' }));
    expect(plan['updateView']).toHaveBeenLastCalledWith('chart', {
      view: 'gantt',
      namesWidth: 300,
      startField: 'f-kick',
    });
    expect(track).toHaveBeenCalledWith('Plan', 'Changed', 'ViewDates');
    cleanup();
    show({ view: 'gantt', startField: 'f-kick' }, { types: sprint });
    // The Card Types note names the picked field.
    expect(screen.getAllByRole('note').map((n) => n.textContent)).toContain(
      'iThe card types this view charts; only those with Kickoff and Due fields are listed.',
    );
    fireEvent.click(
      within(screen.getByRole('radiogroup', { name: 'Starts On' })).getByRole('radio', {
        name: 'Start Date',
      }),
    );
    expect(plan['updateView']).toHaveBeenLastCalledWith('chart', { view: 'gantt' });
  });

  it('gives a calendar one date list, and says where another comes from', () => {
    show({ view: 'start-calendar' });
    expect(screen.queryByRole('heading', { name: 'Starts On' })).toBeNull();
    const only = within(screen.getByRole('radiogroup', { name: 'Starts On' }));
    expect(only.getByRole('radio', { name: 'Start Date' }).getAttribute('aria-checked')).toBe(
      'true',
    );
    expect(screen.getAllByRole('note').map((n) => n.textContent)).toContain(
      'iThe date field this chart reads. Add a Date field to a card type to chart it here.',
    );
    cleanup();
    show({ view: 'calendar', dueField: 'f-kick' }, { types: sprint });
    fireEvent.click(
      within(screen.getByRole('radiogroup', { name: 'Due On' })).getByRole('radio', {
        name: 'Due Date',
      }),
    );
    expect(plan['updateView']).toHaveBeenLastCalledWith('chart', { view: 'calendar' });
  });

  // docs/specs/026-plan/plan-views.md "Count By".
  it('counts Cards by Field by cards, Estimate or a Number field', () => {
    show({ view: 'workload' }, { types: sprint, items: new Map(), statusNames: new Map() });
    expect(
      within(screen.getByRole('radiogroup', { name: 'Count By' }))
        .getByRole('radio', { name: 'Cards' })
        .getAttribute('aria-checked'),
    ).toBe('true');
    const count = within(screen.getByRole('radiogroup', { name: 'Count By' }));
    fireEvent.click(count.getByRole('radio', { name: 'Story Points' }));
    expect(plan['updateView']).toHaveBeenLastCalledWith('chart', {
      view: 'workload',
      measure: 'f-pts',
    });
    expect(track).toHaveBeenCalledWith('Plan', 'Changed', 'ViewMeasure');
    cleanup();
    show(
      { view: 'workload', measure: 'f-pts' },
      { types: sprint, items: new Map(), statusNames: new Map() },
    );
    fireEvent.click(
      within(screen.getByRole('radiogroup', { name: 'Count By' })).getByRole('radio', {
        name: 'Cards',
      }),
    );
    expect(plan['updateView']).toHaveBeenLastCalledWith('chart', { view: 'workload' });
  });

  it('shows nothing for another view, or to someone who may not edit', () => {
    show({ view: 'calendar' });
    expect(screen.queryByRole('radio', { name: 'Assignee' })).toBeNull();
    cleanup();
    show({ view: 'gantt' }, { canEdit: false });
    expect(screen.queryByRole('radio', { name: 'Assignee' })).toBeNull();
  });
});
