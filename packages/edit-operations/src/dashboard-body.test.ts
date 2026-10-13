import { describe, expect, it } from 'vitest';
import { applyReplace } from './replace';
import { dashboardSpecIssue } from './dashboard-body';

// A replace's `dashboard` source (docs/specs/026-plan/plan-agents.md "Making a dashboard").

describe('dashboard replace', () => {
  it('makes a new Dashboard tab', () => {
    const out = applyReplace(
      null,
      { dashboard: { metrics: ['count', 'progress'], charts: [{ view: 'calendar' }] } },
      { tabId: 't1', name: 'Overview' },
    );
    if ('errors' in out) throw new Error(JSON.stringify(out.errors));
    expect(out.tab).toMatchObject({ kind: 'dashboard', opensIn: 'plan', name: 'Overview' });
    expect(out.tab.elements).toHaveLength(3);
    expect(out.tab.dashboard!.rows).toHaveLength(2);
  });

  it('never replaces an existing tab', () => {
    const made = applyReplace(null, { dashboard: {} }, { tabId: 't1', name: 'Overview' });
    if ('errors' in made) throw new Error('refused');
    const again = applyReplace(
      made.tab,
      { dashboard: { metrics: ['count'] } },
      { tabId: 't1', name: 'Overview' },
    );
    expect('errors' in again && again.errors[0]!.hint).toContain('add_tab');
  });

  it('names what is wrong with a body', () => {
    expect(dashboardSpecIssue([])).toContain('expected an object');
    expect(dashboardSpecIssue({ tabs: 'x' })).toContain('tabs');
    expect(dashboardSpecIssue({ tabs: [{ tabId: 't', of: 'canvas' }] })).toContain('tabs[0]');
    expect(dashboardSpecIssue({ metrics: 'x' })).toContain('metrics');
    expect(dashboardSpecIssue({ metrics: ['mood'] })).toContain('not a metric');
    expect(dashboardSpecIssue({ charts: 'x' })).toContain('charts');
    expect(dashboardSpecIssue({ charts: [{ view: 'status-mix' }] })).toContain('charts[0]');
    expect(dashboardSpecIssue({ charts: [{ view: 'gantt', settings: 1 }] })).toContain('settings');
    expect(dashboardSpecIssue({ notes: 'x' })).toContain('notes');
    expect(dashboardSpecIssue({ notes: [{ title: 1 }] })).toContain('notes[0]');
    expect(
      dashboardSpecIssue({
        tabs: [{ tabId: 't', of: 'board' }],
        notes: [{ title: 'a', text: 'b' }],
      }),
    ).toBeNull();
  });
});
