import { describe, expect, it } from 'vitest';
import type { Element, Tab } from '@livepages/document';
import { convertPlanTab, isConvertiblePlanTab } from './plan-tab-conversion';

// docs/specs/026-plan/plan-tabs.md "Converting old Plan tabs".
const shape = (id: string, kind: string, x: number, y: number, extra: object = {}) =>
  ({
    id,
    type: 'shape',
    shape: kind,
    x,
    y,
    width: 100,
    height: 100,
    ...extra,
  }) as unknown as Element;
const tab = (elements: Element[], over: Partial<Tab> = {}): Tab => ({
  id: 'p',
  name: 'Plan',
  opensIn: 'plan',
  kind: 'diagram',
  elements,
  ...over,
});
let n = 0;
const createTab = (name: string) => ({ id: `new${++n}`, name, elements: [] }) as unknown as Tab;
const newId = () => `x${++n}`;

describe('converting an old Plan tab', () => {
  it('converts only a Plan tab of the general kind holding Plan elements alone', () => {
    const board = shape('b', 'plan-board', 0, 0);
    expect(isConvertiblePlanTab(tab([board]))).toBe(true);
    expect(isConvertiblePlanTab(tab([board], { opensIn: 'diagram' }))).toBe(false);
    expect(isConvertiblePlanTab(tab([board], { kind: 'board' }))).toBe(false);
    expect(isConvertiblePlanTab(tab([]))).toBe(false);
    expect(isConvertiblePlanTab(tab([board, shape('s', 'square', 0, 0)]))).toBe(false);
  });

  it('makes a tab of one board a Board tab, and of one Sheet a Sheet tab', () => {
    expect(convertPlanTab(tab([shape('b', 'plan-board', 0, 0)]), createTab, newId)).toEqual([
      expect.objectContaining({ id: 'p', kind: 'board', opensIn: 'plan' }),
    ]);
    expect(convertPlanTab(tab([shape('s', 'plan-sheet', 0, 0)]), createTab, newId)![0]!.kind).toBe(
      'sheet',
    );
  });

  it('moves each board and Sheet to a tab of its own and makes this tab their Dashboard', () => {
    const out = convertPlanTab(
      tab([
        shape('v', 'plan-view', 0, 500, { planView: { view: 'metric:count' } }),
        shape('b2', 'plan-board', 400, 0, { planBoard: { title: 'Later' } }),
        shape('b1', 'plan-board', 0, 0, { planBoard: { title: 'First' } }),
        shape('g', 'plan-view', 0, 900, { planView: { view: 'gantt' } }),
      ]),
      createTab,
      newId,
    )!;
    const [dash, ...made] = out;
    expect(made.map((t) => [t.name, t.kind, t.elements.map((e) => e.id)])).toEqual([
      ['First', 'board', ['b1']],
      ['Later', 'board', ['b2']],
    ]);
    expect(dash!.kind).toBe('dashboard');
    expect(dash!.elements.map((e) => e.id)).toEqual(['v', 'g']);
    const slots = dash!.dashboard!.rows.map((r) => r.slots.map((s) => s.content));
    expect(slots).toEqual([
      [
        { type: 'tab', tabId: made[0]!.id, of: 'board' },
        { type: 'tab', tabId: made[1]!.id, of: 'board' },
      ],
      [{ type: 'element', elementId: 'v' }],
      [{ type: 'element', elementId: 'g' }],
    ]);
  });
});
