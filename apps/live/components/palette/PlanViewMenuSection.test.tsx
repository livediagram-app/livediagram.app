// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createShape, type PlanViewRef, type ShapeElement } from '@livediagram/document';
import { ITEM_TYPES } from '@livediagram/items';
import { track } from '@/lib/telemetry';
import { PlanViewMenuSection } from './PlanViewMenuSection';

// docs/specs/026-plan/plan-views.md "Swimlanes": a Gantt chart's collapsible Swimlanes row sets its swimlanes, one
// element edit.
const plan: Record<string, unknown> = {};
vi.mock('@/components/plan/PlanContext', () => ({ usePlan: () => plan }));
vi.mock('@/components/primitives/MenuFlyoutSection', () => ({
  MenuFlyoutSection: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

afterEach(cleanup);

const chart = (planView: PlanViewRef) =>
  ({ ...createShape('plan-view', 0, 0), id: 'chart', planView }) as ShapeElement;

function show(planView: PlanViewRef, overrides: Record<string, unknown> = {}, open = true) {
  for (const key of Object.keys(plan)) delete plan[key];
  Object.assign(plan, { canEdit: true, types: ITEM_TYPES, updateView: vi.fn() }, overrides);
  const onToggle = vi.fn();
  render(
    <PlanViewMenuSection
      element={chart(planView)}
      flyoutProps={{} as never}
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
    expect(screen.queryByRole('button', { name: 'Assignee' })).toBeNull();
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
    fireEvent.click(screen.getByRole('button', { name: 'Idea' }));
    expect(plan['updateView']).toHaveBeenLastCalledWith('chart', {
      view: 'gantt',
      types: ['project', 'idea', 'task'],
    });
  });

  it('lists only card types with Start and Due, and says why', () => {
    show({ view: 'gantt' });
    expect(screen.getAllByRole('button', { name: 'Project' }).length).toBeGreaterThan(0);
    // The built-in Task has Due but no Start; Note has neither.
    expect(screen.queryByRole('button', { name: 'Task' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Note' })).toBeNull();
    expect(screen.getByRole('note').textContent).toBe(
      'iThe card types this view charts; only those with Start and Due fields are listed.',
    );
  });

  it('accepts more card types, keeping its other settings, and tracks it', () => {
    const dated = ITEM_TYPES.map((t) =>
      t.id === 'task' ? { ...t, fields: [...t.fields, 'start'] } : t,
    );
    show({ view: 'gantt', namesWidth: 300 }, { types: dated });
    fireEvent.click(screen.getByRole('button', { name: 'Task' }));
    expect(plan['updateView']).toHaveBeenLastCalledWith('chart', {
      view: 'gantt',
      namesWidth: 300,
      types: ['project', 'task'],
    });
    expect(track).toHaveBeenCalledWith('Plan', 'Changed', 'GanttTypes');
  });

  it('drops the setting back to Project alone, and never lets the last type go', () => {
    const dated = ITEM_TYPES.map((t) =>
      t.id === 'task' ? { ...t, fields: [...t.fields, 'start'] } : t,
    );
    show({ view: 'gantt', types: ['project', 'task'] }, { types: dated });
    fireEvent.click(screen.getByRole('button', { name: 'Task' }));
    expect(plan['updateView']).toHaveBeenLastCalledWith('chart', { view: 'gantt' });
    cleanup();
    show({ view: 'gantt' });
    const project = screen
      .getAllByRole('button', { name: 'Project' })
      .find((b) => b.getAttribute('aria-pressed') === 'true')!;
    // The last type keeps its pressed look (not dimmed as disabled), and pressing it changes nothing.
    expect(project.hasAttribute('disabled')).toBe(false);
    expect(project.getAttribute('aria-pressed')).toBe('true');
    vi.mocked(plan['updateView'] as () => void).mockClear();
    fireEvent.click(project);
    expect(plan['updateView']).not.toHaveBeenCalled();
  });

  it('sets the chart’s swimlanes, keeping its other settings, and tracks it', () => {
    show({ view: 'gantt', namesWidth: 300 });
    fireEvent.click(screen.getByRole('button', { name: 'Assignee' }));
    expect(plan['updateView']).toHaveBeenCalledWith('chart', {
      view: 'gantt',
      namesWidth: 300,
      swimlaneBy: 'assignee',
    });
    expect(track).toHaveBeenCalledWith('Plan', 'Changed', 'GanttSwimlanes');
  });

  it('lanes by a field, and None drops the setting', () => {
    show({ view: 'gantt', swimlaneBy: 'priority' });
    fireEvent.click(screen.getByRole('button', { name: 'Labels' }));
    expect(plan['updateView']).toHaveBeenLastCalledWith('chart', {
      view: 'gantt',
      swimlaneBy: 'field',
      swimlaneField: 'labels',
    });
    fireEvent.click(screen.getByRole('button', { name: 'None' }));
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

  it('shows nothing for another view, or to someone who may not edit', () => {
    show({ view: 'calendar' });
    expect(screen.queryByRole('button', { name: 'Assignee' })).toBeNull();
    cleanup();
    show({ view: 'gantt' }, { canEdit: false });
    expect(screen.queryByRole('button', { name: 'Assignee' })).toBeNull();
  });
});
