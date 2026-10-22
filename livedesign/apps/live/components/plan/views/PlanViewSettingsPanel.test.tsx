// @vitest-environment jsdom
// A chart's cog (docs/specs/026-plan/plan-views.md "Settings"): the same settings as its View flyout.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ITEM_TYPES, type Item } from '@livepages/items';
import type { PlanViewRef } from '@livepages/document';

const plan: Record<string, unknown> = {};
vi.mock('../PlanContext', () => ({ usePlan: () => plan }));
const track = vi.hoisted(() => vi.fn());
vi.mock('@/lib/telemetry', () => ({ track }));

const { PlanViewSettingsPanel } = await import('./PlanViewSettingsPanel');

afterEach(cleanup);

const dated = ITEM_TYPES.map((t) =>
  t.id === 'task' ? { ...t, fields: [...t.fields, 'start'] } : t,
);
function show(stored: PlanViewRef, items: Item[] = []) {
  for (const key of Object.keys(plan)) delete plan[key];
  Object.assign(plan, {
    canEdit: true,
    types: dated,
    updateView: vi.fn(),
    items: new Map(items.map((i) => [i.id, i])),
    statusNames: new Map([
      ['todo', 'To Do'],
      ['doing', 'Doing'],
      ['done', 'Done'],
    ]),
    statusPhases: new Map([
      ['todo', 'todo'],
      ['doing', 'doing'],
      ['done', 'done'],
    ]),
  });
  const onClose = vi.fn();
  render(<PlanViewSettingsPanel elementId="chart" stored={stored} onClose={onClose} />);
  return onClose;
}
const SAM = { id: 'sam', name: 'Sam', color: '#2563eb' };
const card = (id: string, type: string, status?: string): Item => ({
  id,
  type,
  key: 1,
  rank: id,
  fields: status ? { status } : {},
  rev: 1,
  createdBy: SAM,
  updatedBy: SAM,
  createdAt: 0,
  updatedAt: 0,
});
const CARDS = [card('a', 'task', 'todo'), card('b', 'task', 'done'), card('c', 'note', 'doing')];

const section = (name: string) => screen.queryByRole('button', { name: new RegExp(name, 'i') });

describe('a chart’s settings cog', () => {
  it('offers a Gantt chart its card types, swimlanes and row order, and changes them', () => {
    show({ view: 'gantt' });
    expect(section('Card Types')).toBeTruthy();
    expect(section('Swimlanes')).toBeTruthy();
    expect(section('Row Order')).toBeTruthy();
    expect(section('Group By')).toBeNull();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Task' }));
    expect(plan['updateView']).toHaveBeenCalledWith('chart', { view: 'gantt', types: ['project'] });
    expect(track).toHaveBeenCalledWith('Plan', 'Changed', 'GanttTypes');
  });

  it('opens Cards by Field on its field', () => {
    show({ view: 'workload' });
    expect(section('Group By')!.getAttribute('aria-expanded')).toBe('true');
    expect(section('Swimlanes')).toBeNull();
  });

  it('sorts a reordered Gantt chart by date and closes', () => {
    const onClose = show({ view: 'gantt', rowOrder: ['a', 'b'] });
    fireEvent.click(section('Row Order')!);
    fireEvent.click(screen.getByRole('button', { name: 'Sort by Date' }));
    expect(plan['updateView']).toHaveBeenCalledWith('chart', { view: 'gantt' });
    expect(onClose).toHaveBeenCalled();
  });

  // docs/specs/026-plan/plan-views.md "Statuses".
  describe('Statuses', () => {
    it('lists the statuses the shown types hold, all on by default, for the charts that count by status', () => {
      show({ view: 'priority-matrix', types: ['task'] }, CARDS);
      fireEvent.click(section('Statuses')!);
      const rows = screen
        .getAllByRole('checkbox')
        .filter((r) => r.closest('[aria-label="Statuses"]'));
      expect(rows.map((r) => r.textContent)).toEqual(['To Do', 'Done']);
      expect(rows.every((r) => r.getAttribute('aria-checked') === 'true')).toBe(true);
    });

    it('stores what is picked, tracked, and drops the setting when every status is on again', () => {
      show({ view: 'workload' }, CARDS);
      fireEvent.click(section('Statuses')!);
      fireEvent.click(screen.getByRole('checkbox', { name: 'Done' }));
      expect(plan['updateView']).toHaveBeenCalledWith('chart', {
        view: 'workload',
        statuses: ['todo', 'doing'],
      });
      expect(track).toHaveBeenCalledWith('Plan', 'Changed', 'ViewStatuses');
      cleanup();
      show({ view: 'workload', statuses: ['todo', 'doing'] }, CARDS);
      fireEvent.click(section('Statuses')!);
      fireEvent.click(screen.getByRole('checkbox', { name: 'Done' }));
      expect(plan['updateView']).toHaveBeenCalledWith('chart', { view: 'workload' });
    });

    it('drops a named status no column names any more, and keeps one a column still names', () => {
      // 'doing' is a column's but no card holds it; 'gone' no column names.
      show({ view: 'workload', statuses: ['todo', 'doing', 'gone'] }, [
        card('a', 'task', 'todo'),
        card('b', 'task', 'done'),
      ]);
      fireEvent.click(section('Statuses')!);
      fireEvent.click(screen.getByRole('checkbox', { name: 'To Do' }));
      // 'To Do' cannot be let go as the last ticked: tick Done instead, leaving every listed status on.
      expect(plan['updateView']).not.toHaveBeenCalled();
      fireEvent.click(screen.getByRole('checkbox', { name: 'Done' }));
      // Every listed status ticked: the setting goes, whatever else it named.
      expect(plan['updateView']).toHaveBeenCalledWith('chart', { view: 'workload' });
    });

    it('stores a pick with the column-named statuses it held, never a gone one', () => {
      show({ view: 'workload', statuses: ['todo', 'done', 'doing', 'gone'] }, [
        card('a', 'task', 'todo'),
        card('b', 'task', 'done'),
      ]);
      fireEvent.click(section('Statuses')!);
      fireEvent.click(screen.getByRole('checkbox', { name: 'Done' }));
      expect(plan['updateView']).toHaveBeenCalledWith('chart', {
        view: 'workload',
        statuses: ['todo', 'doing'],
      });
    });

    it('keeps the last status on', () => {
      show({ view: 'workload', statuses: ['done'] }, CARDS);
      fireEvent.click(section('Statuses')!);
      fireEvent.click(screen.getByRole('checkbox', { name: 'Done' }));
      expect(plan['updateView']).not.toHaveBeenCalled();
    });

    it('is not offered where a view does not count by status', () => {
      show({ view: 'gantt' }, CARDS);
      expect(section('Statuses')).toBeNull();
    });

    it('says so when no card has a status', () => {
      show({ view: 'priority-matrix' }, [card('x', 'task')]);
      fireEvent.click(section('Statuses')!);
      expect(screen.getByText('No statuses yet').closest('[data-empty-state]')).toBeTruthy();
    });
  });
});
