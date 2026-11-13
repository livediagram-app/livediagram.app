// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { nameChipWidth } from './chair-sitters';
import {
  chipNeedsMeasure,
  chipWidthKey,
  chipWidthOf,
  reportChipWidth,
  resetChipWidths,
  useChipWidthOf,
} from './chip-widths';

afterEach(() => resetChipWidths());

// docs/specs/008-canvas/avatar-mode.md "Seated neighbours' chips never cover each other" (Work Tracker 706).
describe('chip widths', () => {
  it('takes the estimate until a chip is measured, then the measure', () => {
    expect(chipWidthOf('Clever Walrus', null)).toBe(nameChipWidth('Clever Walrus', null));
    expect(chipNeedsMeasure(chipWidthKey('Clever Walrus', null))).toBe(true);
    reportChipWidth(chipWidthKey('Clever Walrus', null), 108.04);
    expect(chipWidthOf('Clever Walrus', null)).toBe(108);
    expect(chipNeedsMeasure(chipWidthKey('Clever Walrus', null))).toBe(false);
    // The same name with a status is another chip.
    expect(chipWidthOf('Clever Walrus', 'Busy')).toBe(nameChipWidth('Clever Walrus', 'Busy'));
    expect(chipWidthOf(null, null)).toBe(0);
    expect(chipWidthOf('', 'Focusing')).toBe(nameChipWidth('', 'Focusing'));
  });

  it('ignores a zero or broken measure (a screen with no layout)', () => {
    const key = chipWidthKey('Al', null);
    reportChipWidth(key, 0);
    reportChipWidth(key, Number.NaN);
    expect(chipNeedsMeasure(key)).toBe(true);
  });

  it('tells the spread when a width changes, and only then', () => {
    const { result } = renderHook(() => useChipWidthOf());
    const first = result.current;
    expect(first('Al', null)).toBe(nameChipWidth('Al', null));
    act(() => reportChipWidth(chipWidthKey('Al', null), 30));
    const second = result.current;
    expect(second).not.toBe(first);
    act(() => reportChipWidth(chipWidthKey('Al', null), 30.01));
    expect(result.current).toBe(second);
    expect(second('Al', null)).toBe(30);
  });

  it('keeps a bounded number of widths, the oldest dropped first', () => {
    for (let i = 0; i < 4100; i++) reportChipWidth(chipWidthKey(`p${i}`, null), 50);
    expect(chipNeedsMeasure(chipWidthKey('p0', null))).toBe(true);
    expect(chipNeedsMeasure(chipWidthKey('p4099', null))).toBe(false);
  });
});
