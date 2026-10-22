import { describe, expect, it } from 'vitest';
import { applyReplace } from './replace';
import { dashboardSpecIssue } from './dashboard-body';
import type { ReplaceBody } from './types';

// A replace's `dashboard` source (docs/specs/026-plan/plan-agents.md "Making a dashboard").

describe('dashboard replace', () => {
  it('makes a new Dashboard tab', () => {
    const out = applyReplace(
      null,
      { dashboard: { metrics: ['count', 'progress'], charts: [{ view: 'calendar' }] } },
      { tabId: 't1', name: 'Overview' },
    );
    if ('errors' in out) throw new Error(JSON.stringify(out.errors));
    expect(out.tab).toMatchObject({ kind: 'dashboard', name: 'Overview' });
    expect(out.tab.elements).toHaveLength(3);
    expect(out.tab.dashboard!.rows).toHaveLength(2);
  });

  it('rebuilds a Dashboard tab in place, keeping its id, name and theme', () => {
    const made = applyReplace(
      null,
      { dashboard: {} },
      { tabId: 't1', name: 'Overview', themeId: 'ocean' },
    );
    if ('errors' in made) throw new Error('refused');
    const again = applyReplace(
      made.tab,
      { dashboard: { metrics: ['count', 'stale'] } },
      { tabId: 'x', name: 'x' },
    );
    if ('errors' in again) throw new Error(JSON.stringify(again.errors));
    expect(again.tab).toMatchObject({
      id: 't1',
      name: 'Overview',
      theme: made.tab.theme,
      kind: 'dashboard',
    });
    expect(again.tab.elements).toHaveLength(2);
    expect(again.tab.dashboard!.rows).toHaveLength(1);
  });

  it('never turns another tab into a Dashboard', () => {
    const diagram = applyReplace(null, { elements: [] }, { tabId: 't2', name: 'Flow' });
    if ('errors' in diagram) throw new Error('refused');
    const out = applyReplace(
      diagram.tab,
      { dashboard: { metrics: ['count'] } },
      { tabId: 't2', name: 'Flow' },
    );
    expect('errors' in out && out.errors[0]!.hint).toContain('add_tab');
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

describe('dashboard replace, refused', () => {
  it('refuses a dashboard spec that is not one, naming the problem', () => {
    const out = applyReplace(null, { dashboard: 'charts please' } as unknown as ReplaceBody, {
      tabId: 't1',
      name: 'O',
    });
    expect('errors' in out && JSON.stringify(out.errors)).toMatch(/dashboard: expected an object/);
  });
});
