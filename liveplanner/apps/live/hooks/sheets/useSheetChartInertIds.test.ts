// @vitest-environment jsdom
// docs/specs/029-sheets/sheet.md "Charts": the canvas never picks a chart that sits in a Sheet on the tab.
import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { createShape, type Element } from '@liveplanner/document';
import { useSheetChartInertIds } from './useSheetChartInertIds';

const range = { r1: 'aaaa', c1: 'bbbb', r2: 'cccc', c2: 'dddd' };
const sheet = { ...createShape('plan-sheet', 0, 0), planSheet: { sheetId: 'sheet0001' } };
const chart = {
  ...createShape('bar-chart', 0, 0),
  chartSource: { sheetId: 'sheet0001', range },
  sheetAnchor: { x: 0, y: 0 },
};

describe('useSheetChartInertIds', () => {
  it('adds the charts a Sheet on the tab draws to the inert ids', () => {
    const base = new Set(['locked']);
    const { result } = renderHook(() => useSheetChartInertIds([sheet, chart] as Element[], base));
    expect([...result.current.inertIds].sort()).toEqual([chart.id, 'locked'].sort());
    expect([...result.current.chartIds]).toEqual([chart.id]);
  });

  it('hands back the base itself while the tab has none', () => {
    const base = new Set(['locked']);
    const { result } = renderHook(() => useSheetChartInertIds([chart] as Element[], base));
    expect(result.current.inertIds).toBe(base);
    expect(result.current.chartIds.size).toBe(0);
  });
});
