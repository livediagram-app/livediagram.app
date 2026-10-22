import { describe, expect, it } from 'vitest';
import { ITEM_TYPES, type ItemTypeDef } from '@liveplanner/items';
import { resolveDashboardInput } from './dashboard-input';

// A Dashboard named as people name it (docs/specs/026-plan/plan-agents.md "Making a dashboard").

const TABS = [
  { id: 't1', name: 'Board', of: 'board' as const },
  { id: 't2', name: 'Budget', of: 'sheet' as const },
  { id: 't3', name: 'Notes', of: null },
];
const BUG: ItemTypeDef = {
  ...ITEM_TYPES[1],
  id: 'bug',
  label: 'Bug',
  fields: ['title', 'status', 'f-sev'],
  custom: [{ id: 'f-sev', label: 'Severity', kind: 'choice', options: ['S1'] }],
};
const types = [...ITEM_TYPES, BUG];

describe('resolveDashboardInput', () => {
  it('names tabs, card types and groupings, keeping only what is given', () => {
    const r = resolveDashboardInput(
      {
        tabs: ['budget', 'Board'],
        metrics: ['count'],
        charts: [{ view: 'workload', groupBy: 'Severity', types: ['Bug'] }, { view: 'calendar' }],
        notes: [{ title: 'A', text: 'b' }],
      },
      TABS,
      types,
    );
    expect(r).toEqual({
      ok: true,
      spec: {
        tabs: [
          { tabId: 't2', of: 'sheet' },
          { tabId: 't1', of: 'board' },
        ],
        metrics: ['count'],
        charts: [
          {
            view: 'workload',
            settings: { types: ['bug'], swimlaneBy: 'field', swimlaneField: 'f-sev' },
          },
          { view: 'calendar' },
        ],
        notes: [{ title: 'A', text: 'b' }],
      },
    });
    expect(resolveDashboardInput({}, TABS, types)).toEqual({ ok: true, spec: {} });
  });

  it('groups by a built-in grouping with no field', () => {
    const r = resolveDashboardInput(
      { charts: [{ view: 'workload', groupBy: 'priority' }] },
      TABS,
      types,
    );
    expect(r.ok && r.spec.charts?.[0]).toEqual({
      view: 'workload',
      settings: { swimlaneBy: 'priority' },
    });
  });

  it('shows every Board and Sheet tab for "every"', () => {
    const r = resolveDashboardInput({ tabs: 'every' }, TABS, types);
    expect(r.ok && r.spec.tabs?.map((t) => t.tabId)).toEqual(['t1', 't2']);
  });

  it('refuses a tab, card type or grouping the project lacks', () => {
    expect(resolveDashboardInput({ tabs: ['Notes'] }, TABS, types)).toMatchObject({ ok: false });
    expect(resolveDashboardInput({ tabs: ['x'] }, [], types)).toMatchObject({
      ok: false,
      message: expect.stringContaining('has none'),
    });
    expect(
      resolveDashboardInput({ charts: [{ view: 'gantt', types: ['Mood'] }] }, TABS, types).ok,
    ).toBe(false);
    expect(
      resolveDashboardInput({ charts: [{ view: 'workload', groupBy: 'Mood' }] }, TABS, types).ok,
    ).toBe(false);
  });
});
