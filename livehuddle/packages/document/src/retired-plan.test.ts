import { describe, expect, it } from 'vitest';
import { dropRetiredPlan, isRetiredPlanElement } from './retired-plan';
import { migrateIncomingTab, migrateStoredTab } from './stored-tab';
import { opensInOf } from './editor-mode';
import { tabKindOf } from './tab-kind';
import { isValidTab } from './validate';
import type { Tab } from './index';

// Plan mode moved out to liveplanner: a Plan tab opens as an ordinary tab in Diagram with its ordinary elements.
const square = { id: 'sq', type: 'shape', shape: 'square', x: 0, y: 0, width: 120, height: 80 };
const text = { id: 'tx', type: 'text', x: 0, y: 200, width: 200, height: 40, label: 'Title' };
const board = {
  id: 'pb',
  type: 'shape',
  shape: 'plan-board',
  x: 0,
  y: 300,
  width: 900,
  height: 500,
  planBoard: { columns: [] },
};
const card = { ...board, id: 'pc', shape: 'plan-card', planCard: { itemId: 'i1' } };
const view = { ...board, id: 'pv', shape: 'plan-view', planView: { view: 'burndown' } };
const sheet = {
  ...board,
  id: 'ps',
  shape: 'plan-sheet',
  planSheet: { sheetId: 'sheet-abc' },
  cellComments: {},
};
const sheetChart = {
  id: 'ch',
  type: 'shape',
  shape: 'pie-chart',
  x: 0,
  y: 900,
  width: 240,
  height: 240,
  pieSlices: [{ label: 'A', value: 3 }],
  chartSource: { sheetId: 'sheet-abc', range: { r1: 'r1', c1: 'c1', r2: 'r2', c2: 'c2' } },
  sheetAnchor: { x: 10, y: 20 },
};

const planTab = (kind: string) =>
  ({
    id: 't',
    name: 'Roadmap',
    kind,
    opensIn: 'plan',
    dashboard: { rows: [] },
    form: { title: 'Sign-up', questions: [] },
    theme: 'ocean',
    elements: [square, board, card, view, sheet, sheetChart, text],
  }) as unknown as Tab;

describe('dropRetiredPlan', () => {
  it('opens every Plan tab kind as an ordinary tab in Diagram, keeping its ordinary elements', () => {
    for (const kind of ['board', 'sheet', 'dashboard', 'form']) {
      const out = dropRetiredPlan(planTab(kind)) as unknown as Record<string, unknown>;
      expect('kind' in out).toBe(false);
      expect(tabKindOf(out)).toBe('diagram');
      expect('opensIn' in out).toBe(false);
      expect(opensInOf(out)).toBe('diagram');
      expect('dashboard' in out).toBe(false);
      expect('form' in out).toBe(false);
      expect(out.theme).toBe('ocean');
      expect((out.elements as { id: string }[]).map((e) => e.id)).toEqual(['sq', 'ch', 'tx']);
    }
  });

  it('keeps a sheet chart with its last read data, without the range or its place in the Sheet', () => {
    const out = dropRetiredPlan(planTab('sheet'));
    const chart = out.elements.find((e) => e.id === 'ch') as unknown as Record<string, unknown>;
    expect('chartSource' in chart).toBe(false);
    expect('sheetAnchor' in chart).toBe(false);
    expect(chart.pieSlices).toEqual(sheetChart.pieSlices);
    expect(chart.x).toBe(0);
  });

  it('opens a general tab left in Plan in Diagram', () => {
    const out = dropRetiredPlan({ id: 't', name: 'T', opensIn: 'plan', elements: [square] });
    expect('opensIn' in out).toBe(false);
    expect(out.elements).toEqual([square]);
  });

  it('drops Plan elements from a tab in another mode, and keeps that mode and kind', () => {
    const out = dropRetiredPlan({
      id: 't',
      name: 'T',
      kind: 'diagram',
      opensIn: 'workshop',
      elements: [square, card],
    }) as unknown as Record<string, unknown>;
    expect(out.kind).toBe('diagram');
    expect(out.opensIn).toBe('workshop');
    expect(out.elements).toEqual([square]);
  });

  it('keeps an event-storming board as it is', () => {
    const tab = { id: 't', name: 'T', kind: 'event-storming', elements: [square] };
    expect(dropRetiredPlan(tab)).toBe(tab);
  });

  it('keeps a chart that was never drawn from a sheet as the same object', () => {
    const plain = { ...sheetChart } as Record<string, unknown>;
    delete plain.chartSource;
    delete plain.sheetAnchor;
    const tab = { id: 't', name: 'T', elements: [plain, square] };
    expect(dropRetiredPlan(tab)).toBe(tab);
  });

  it('hands back the same tab when there is nothing of Plan on it', () => {
    const tab = { id: 't', name: 'T', opensIn: 'draw', elements: [square, text] };
    expect(dropRetiredPlan(tab)).toBe(tab);
  });

  it('reads a tab with no elements array without throwing', () => {
    const out = dropRetiredPlan({ id: 't', name: 'T', kind: 'board' }) as Record<string, unknown>;
    expect('kind' in out).toBe(false);
    expect('elements' in out).toBe(false);
  });
});

describe('isRetiredPlanElement', () => {
  it('names the four Plan shapes and nothing else', () => {
    for (const el of [board, card, view, sheet]) expect(isRetiredPlanElement(el)).toBe(true);
    for (const el of [
      square,
      text,
      sheetChart,
      null,
      'plan-board',
      { type: 'text', shape: 'plan-board' },
    ]) {
      expect(isRetiredPlanElement(el)).toBe(false);
    }
  });
});

describe('a stored Plan tab on the way in', () => {
  it('is read by the stored-tab migration as a valid Diagram tab', () => {
    const out = migrateStoredTab(planTab('board'));
    expect(tabKindOf(out)).toBe('diagram');
    expect(opensInOf(out)).toBe('diagram');
    expect(out.elements.map((e) => e.id)).toEqual(['sq', 'ch', 'tx']);
    expect(isValidTab(out)).toBe(true);
  });

  it('is accepted from outside once migrated, its Plan-only parts gone', () => {
    const out = migrateIncomingTab(planTab('dashboard')) as Tab;
    expect(isValidTab(out)).toBe(true);
    expect(out.elements).toHaveLength(3);
  });
});
