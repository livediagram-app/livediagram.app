import { describe, expect, it } from 'vitest';
import type { ShapeElement } from '@liveplanner/project';
import { ITEM_TYPES } from '@liveplanner/items';
import { planViewArt } from './plan-view-art';
import { NOW, artData, card, shape } from './test-fixtures';

// docs/specs/026-plan/plan-tabs.md "Export": a plan view draws as a picture of its chart, not a labelled box.
const view = (v: string, extra: Record<string, unknown> = {}) =>
  shape('v', 'plan-view', { planView: { view: v, ...extra } }) as ShapeElement;

const cards = [
  card({ title: 'Ship it', status: 'todo', priority: 'urgent', due: '2026-10-14' }),
  card({ title: 'Write docs', status: 'doing', due: '2026-10-20' }),
  card({ title: 'Done thing', status: 'done' }),
  card({ title: 'Launch', status: 'doing', start: '2026-10-05', due: '2026-10-25' }, 'project'),
];
const data = artData(cards);

describe('a plan view’s picture', () => {
  it('draws Cards by Field as bars with their totals and the phase key', () => {
    const svg = planViewArt(view('workload'), data, 'light');
    expect(svg).toContain('Cards by Assignee');
    expect(svg).toContain('No assignee');
    expect(svg).toContain('In Progress');
  });

  it('sums Cards by Field’s Count By field (plan-views.md "Count By")', () => {
    const sized = artData([
      card({ title: 'a', status: 'todo', estimate: 2.5 }),
      card({ title: 'b', status: 'done', estimate: 3 }),
    ]);
    const svg = planViewArt(view('workload', { measure: 'estimate' }), sized, 'light');
    expect(svg).toContain('5.5');
    expect(planViewArt(view('workload'), sized, 'light')).not.toContain('5.5');
  });

  it('draws Priority by Status as a grid of counts', () => {
    const svg = planViewArt(view('priority-matrix'), data, 'light');
    expect(svg).toContain('Priority by Status');
    expect(svg).toContain('Urgent');
    expect(svg).toContain('No Priority');
    expect(svg).toContain('Not Started');
  });

  it('counts only the chosen statuses', () => {
    const svg = planViewArt(view('priority-matrix', { statuses: ['zzz'] }), data, 'light');
    expect(svg).toContain('No cards yet.');
  });

  it('draws a Gantt’s projects over its weeks, with today’s line', () => {
    const svg = planViewArt(view('gantt'), data, 'light');
    expect(svg).toContain('Gantt Chart');
    expect(svg).toContain('Launch');
    expect(svg).not.toContain('Ship it');
    expect(svg).toContain('#dc2626');
  });

  // docs/specs/026-plan/plan-views.md "Dependency arrows".
  it('draws an arrow from each blocker to the row it blocks, a done one fainter', () => {
    const blockedBy = {
      id: 'f-bb',
      label: 'Blocked By',
      kind: 'card' as const,
      linkType: 'project',
      multiple: true,
      blocks: true,
    };
    const types = ITEM_TYPES.map((t) =>
      t.id === 'project'
        ? { ...t, fields: [...t.fields, blockedBy.id], custom: [...(t.custom ?? []), blockedBy] }
        : t,
    );
    const site = card(
      { title: 'Site', status: 'doing', start: '2026-10-01', due: '2026-10-08' },
      'project',
    );
    const done = card(
      { title: 'Copy', status: 'done', start: '2026-10-01', due: '2026-10-04' },
      'project',
    );
    const launch = card(
      {
        title: 'Go',
        status: 'todo',
        start: '2026-10-12',
        due: '2026-10-20',
        [blockedBy.id]: [site.id, done.id],
      },
      'project',
    );
    const linked = { ...artData([site, done, launch]), types };
    const svg = planViewArt(view('gantt'), linked, 'light');
    expect(svg.match(/<g opacity="1" color=/g)).toHaveLength(1);
    expect(svg.match(/<g opacity="0.4" color=/g)).toHaveLength(1);
    // Without the field, no arrows.
    expect(planViewArt(view('gantt'), artData([site, done, launch]), 'light')).not.toContain(
      '<g opacity=',
    );
  });

  it('draws a Due Calendar’s month with the cards on their days', () => {
    const svg = planViewArt(view('calendar'), data, 'light');
    expect(svg).toContain(`Due Calendar · October ${NOW.getFullYear()}`);
    expect(svg).toContain('Ship it');
    expect(svg).toContain('Mon');
  });

  it('draws a Start Calendar from the start dates', () => {
    const svg = planViewArt(view('start-calendar'), data, 'light');
    expect(svg).toContain('Start Calendar');
    expect(svg).toContain('Launch');
    expect(svg).not.toContain('Ship it');
  });

  it('draws Card Search’s matching cards as rows', () => {
    const svg = planViewArt(view('search'), data, 'light');
    expect(svg).toContain('Card Search');
    expect(svg).toContain('Write docs');
    expect(svg).toContain('#2');
  });

  it('draws Status Breakdown’s statuses by name', () => {
    const svg = planViewArt(view('status-mix'), data, 'light');
    expect(svg).toContain('Status Breakdown');
    expect(svg).toContain('Doing');
  });

  it('draws a metric as its name and figure', () => {
    const svg = planViewArt({ ...view('metric:count'), width: 300, height: 200 }, data, 'light');
    expect(svg).toContain('Item Count');
    expect(svg).toContain('>4<');
    // A Dashboard slot's name, given as its title, in place of its label.
    const named = planViewArt(
      { ...view('metric:count', { title: 'Open work' }), width: 300, height: 200 },
      data,
      'light',
    );
    expect(named).toContain('Open work');
    expect(named).not.toContain('Item Count');
  });

  it('uses the view’s own title, and an empty state with no cards', () => {
    const svg = planViewArt(view('workload', { title: 'Team Load' }), artData([]), 'dark');
    expect(svg).toContain('Team Load');
    expect(svg).toContain('No cards yet.');
  });
});
