import { describe, expect, it } from 'vitest';
import { isValidTab } from '@liveplanner/project';
import { buildDashboardTab } from './dashboard-builder';

// A Dashboard tab made whole (docs/specs/026-plan/plan-agents.md "Making a dashboard").

describe('buildDashboardTab', () => {
  it('makes a valid Dashboard tab of tabs, metrics, charts and notes, rows in that order', () => {
    const { tab, dropped } = buildDashboardTab('t9', 'Overview', {
      tabs: [{ tabId: 't1', of: 'board' }],
      metrics: ['count', 'progress', 'stale', 'unassigned', 'due'],
      charts: [
        { view: 'workload', settings: { swimlaneBy: 'priority' } },
        { view: 'gantt' },
        { view: 'calendar' },
      ],
      notes: [{ title: 'How we work', text: 'Weekly review' }],
    });
    expect(isValidTab(tab)).toBe(true);
    expect(dropped).toBe(0);
    expect(tab).toMatchObject({ id: 't9', name: 'Overview', kind: 'dashboard' });
    const rows = tab.dashboard!.rows;
    const kinds = rows.map((r) => r.slots.map((s) => s.content?.type).join(','));
    // tabs, metrics (4 then 1), the Gantt alone, the other charts, the note.
    expect(kinds).toEqual([
      'tab',
      'element,element,element,element',
      'element',
      'element',
      'element,element',
      'note',
    ]);
    const workload = tab.elements.find(
      (e) => e.type === 'shape' && e.planView?.view === 'workload',
    );
    expect(workload).toMatchObject({ planView: { view: 'workload', swimlaneBy: 'priority' } });
    expect(new Set(rows.flatMap((r) => [r.id, ...r.slots.map((s) => s.id)])).size).toBe(
      rows.length + rows.reduce((n, r) => n + r.slots.length, 0),
    );
  });

  it('gives a named chart’s slot its name, the Gantt’s included, and leaves the rest unnamed', () => {
    const { tab } = buildDashboardTab('t9', 'Overview', {
      charts: [
        { view: 'workload', name: '  Team load ' },
        { view: 'gantt', name: 'Launch plan' },
        { view: 'calendar', name: '   ' },
      ],
    });
    const slotOf = (view: string) => {
      const el = tab.elements.find((e) => e.type === 'shape' && e.planView?.view === view)!;
      return tab
        .dashboard!.rows.flatMap((r) => r.slots)
        .find((s) => s.content?.type === 'element' && s.content.elementId === el.id)!.content;
    };
    expect(slotOf('workload')).toMatchObject({ name: 'Team load' });
    expect(slotOf('gantt')).toMatchObject({ name: 'Launch plan' });
    expect(slotOf('calendar')).not.toHaveProperty('name');
    // The view itself keeps no title: the name is the slot's.
    expect(tab.elements.every((e) => !(e.type === 'shape' && e.planView?.title))).toBe(true);
  });

  it('leaves off rows past the Dashboard’s twelve, and says how many', () => {
    const notes = Array.from({ length: 40 }, (_, i) => ({ title: `N${i}`, text: '' }));
    const { tab, dropped } = buildDashboardTab('t9', 'Notes', { notes });
    expect(tab.dashboard!.rows).toHaveLength(12);
    expect(dropped).toBe(Math.ceil(40 / 3) - 12);
  });
});
