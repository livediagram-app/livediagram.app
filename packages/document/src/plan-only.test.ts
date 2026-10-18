import { describe, expect, it } from 'vitest';
import {
  isPlanOnlyElement,
  planOnlyAddedOutsidePlan,
  tabTakesPlanOnly,
  withoutPlanOnly,
} from './plan-only';
import type { Element } from './index';

const box = (id: string): Element => ({
  id,
  type: 'shape',
  shape: 'square',
  x: 0,
  y: 0,
  width: 100,
  height: 60,
});
const sheet = (id: string, sheetId = `sh-${id}`): Element => ({
  id,
  type: 'shape',
  shape: 'plan-sheet',
  x: 0,
  y: 0,
  width: 960,
  height: 560,
  planSheet: { sheetId },
});
const board = (id: string): Element => ({
  id,
  type: 'shape',
  shape: 'plan-board',
  x: 0,
  y: 0,
  width: 640,
  height: 420,
});
const chart = (id: string, sheetId: string): Element =>
  ({
    id,
    type: 'shape',
    shape: 'bar-chart',
    x: 0,
    y: 0,
    width: 200,
    height: 120,
    chartSource: { sheetId, range: { r1: 'a', c1: 'a', r2: 'b', c2: 'b' } },
    sheetAnchor: { col: 'a', row: 'a', dx: 0, dy: 0 },
  }) as unknown as Element;

describe('isPlanOnlyElement', () => {
  it('is a board or a Sheet, and nothing else', () => {
    expect(isPlanOnlyElement(sheet('s'))).toBe(true);
    expect(isPlanOnlyElement(board('p'))).toBe(true);
    expect(isPlanOnlyElement(box('b'))).toBe(false);
  });
});

describe('tabTakesPlanOnly', () => {
  it('takes them in Plan, and on a Plan kind whatever its stored mode', () => {
    expect(tabTakesPlanOnly({ opensIn: 'plan' })).toBe(true);
    expect(tabTakesPlanOnly({ kind: 'sheet', opensIn: 'diagram' })).toBe(true);
    expect(tabTakesPlanOnly({ kind: 'dashboard' })).toBe(true);
  });

  it('refuses every other mode, and a tab with no mode (Diagram)', () => {
    for (const opensIn of ['diagram', 'draw', 'facilitate', 'pages'])
      expect(tabTakesPlanOnly({ opensIn })).toBe(false);
    expect(tabTakesPlanOnly({})).toBe(false);
  });
});

describe('planOnlyAddedOutsidePlan', () => {
  it('names the new boards and Sheets on a tab not in Plan', () => {
    const before = [box('b'), sheet('old'), board('oldBoard')];
    const next = { elements: [...before, sheet('s1'), box('c'), board('p1')] };
    expect(planOnlyAddedOutsidePlan(before, next)).toEqual(['s1', 'p1']);
  });

  it('names none on a tab in Plan', () => {
    expect(planOnlyAddedOutsidePlan([], { opensIn: 'plan', elements: [sheet('s1')] })).toEqual([]);
  });
});

describe('withoutPlanOnly', () => {
  it('leaves out each board, each Sheet and the charts it draws, and counts them', () => {
    const { kept, boards, sheets } = withoutPlanOnly([
      box('b'),
      sheet('s1', 'A'),
      board('p1'),
      chart('c1', 'A'),
      chart('c2', 'elsewhere'),
      sheet('s2', 'B'),
    ]);
    expect(kept.map((el) => el.id)).toEqual(['b', 'c2']);
    expect({ boards, sheets }).toEqual({ boards: 1, sheets: 2 });
  });

  it('keeps everything when there is no board or Sheet', () => {
    const els = [box('a'), box('b')];
    expect(withoutPlanOnly(els)).toEqual({ kept: els, boards: 0, sheets: 0 });
  });
});
