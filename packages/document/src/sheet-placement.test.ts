import { describe, expect, it } from 'vitest';
import {
  isSheetElement,
  sheetsAddedOutsidePlan,
  tabTakesSheets,
  withoutSheets,
} from './sheet-placement';
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

describe('isSheetElement', () => {
  it('is a Sheet element and nothing else', () => {
    expect(isSheetElement(sheet('s'))).toBe(true);
    expect(isSheetElement(box('b'))).toBe(false);
  });
});

describe('tabTakesSheets', () => {
  it('takes them in Plan, and on a Plan kind whatever its stored mode', () => {
    expect(tabTakesSheets({ opensIn: 'plan' })).toBe(true);
    expect(tabTakesSheets({ kind: 'sheet', opensIn: 'diagram' })).toBe(true);
    expect(tabTakesSheets({ kind: 'dashboard' })).toBe(true);
  });

  it('refuses every other mode, and a tab with no mode (Diagram)', () => {
    for (const opensIn of ['diagram', 'draw', 'facilitate', 'pages'])
      expect(tabTakesSheets({ opensIn })).toBe(false);
    expect(tabTakesSheets({})).toBe(false);
  });
});

describe('sheetsAddedOutsidePlan', () => {
  it('names the new Sheets on a tab not in Plan', () => {
    const before = [box('b'), sheet('old')];
    const next = { elements: [...before, sheet('s1'), box('c'), sheet('s2')] };
    expect(sheetsAddedOutsidePlan(before, next)).toEqual(['s1', 's2']);
  });

  it('names none on a tab in Plan', () => {
    expect(sheetsAddedOutsidePlan([], { opensIn: 'plan', elements: [sheet('s1')] })).toEqual([]);
  });
});

describe('withoutSheets', () => {
  it('leaves out each Sheet and the charts it draws, and counts the Sheets', () => {
    const { kept, sheets } = withoutSheets([
      box('b'),
      sheet('s1', 'A'),
      chart('c1', 'A'),
      chart('c2', 'elsewhere'),
      sheet('s2', 'B'),
    ]);
    expect(kept.map((el) => el.id)).toEqual(['b', 'c2']);
    expect(sheets).toBe(2);
  });

  it('keeps everything when there is no Sheet', () => {
    const els = [box('a'), box('b')];
    expect(withoutSheets(els)).toEqual({ kept: els, sheets: 0 });
  });
});
