import { describe, expect, it } from 'vitest';
import { presetSetup } from '@livediagram/items';
import type { Tab } from '@livediagram/document';
import { suggestedDashboards } from './suggested-dashboards';

// docs/specs/026-plan/plan-mode.md "Starting a board": Dashboards built from the document's own work.
const boardTab = (id: string, name: string, preset: Parameters<typeof presetSetup>[0]) =>
  ({
    id,
    name,
    kind: 'board',
    elements: [
      { id: `${id}-b`, type: 'shape', shape: 'plan-board', planBoard: presetSetup(preset) },
    ],
  }) as unknown as Tab;
const sheetTab = (id: string, name: string) =>
  ({ id, name, kind: 'sheet', elements: [] }) as unknown as Tab;

describe('suggested Dashboards', () => {
  it('offers a timeline for a board whose cards have start and due dates', () => {
    const s = suggestedDashboards([boardTab('r', 'Roadmap', 'roadmap')]);
    const timeline = s.find((d) => d.id === 'timeline:r')!;
    expect(timeline.name).toBe('Roadmap Timeline');
    const views = timeline.rows.flatMap((r) =>
      r.slots.flatMap((x) => ('view' in x ? [x.view] : [])),
    );
    expect(views).toContain('gantt');
    expect(timeline.rows.some((r) => r.slots.some((x) => 'tab' in x && x.tab.tabId === 'r'))).toBe(
      true,
    );
  });

  it('offers a sprint’s health, a triage view and a retro’s summary by what each board is for', () => {
    const ids = suggestedDashboards([
      boardTab('s', 'Sprint', 'sprint'),
      boardTab('b', 'Bugs', 'bug-triage'),
      boardTab('t', 'Retro', 'retro'),
    ]).map((d) => d.id);
    expect(ids).toEqual(expect.arrayContaining(['sprint:s', 'triage:b', 'retro:t', 'team']));
  });

  it('offers a board beside a sheet, and nothing for a document with no boards', () => {
    const ids = suggestedDashboards([
      boardTab('k', 'Kanban', 'kanban'),
      sheetTab('x', 'Budget'),
    ]).map((d) => d.id);
    expect(ids).toContain('work-numbers:k:x');
    expect(suggestedDashboards([sheetTab('x', 'Budget')])).toEqual([]);
  });

  it('lays every row out in whole twelfths', () => {
    for (const d of suggestedDashboards([
      boardTab('r', 'Roadmap', 'roadmap'),
      boardTab('s', 'Sprint', 'sprint'),
      boardTab('b', 'Bugs', 'bug-triage'),
    ]))
      for (const row of d.rows) {
        expect(
          row.slots.reduce((n, x) => n + x.span, 0),
          d.id,
        ).toBe(12);
        expect(
          row.slots.every((x) => Number.isInteger(x.span)),
          d.id,
        ).toBe(true);
      }
  });
});
