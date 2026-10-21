import { describe, expect, it } from 'vitest';
import { isValidTab } from '@liveplanner/document';
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
    expect(tab).toMatchObject({ id: 't9', name: 'Overview', kind: 'dashboard', opensIn: 'plan' });
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

  it('leaves off rows past the Dashboard’s twelve, and says how many', () => {
    const notes = Array.from({ length: 40 }, (_, i) => ({ title: `N${i}`, text: '' }));
    const { tab, dropped } = buildDashboardTab('t9', 'Notes', { notes });
    expect(tab.dashboard!.rows).toHaveLength(12);
    expect(dropped).toBe(Math.ceil(40 / 3) - 12);
  });
});
