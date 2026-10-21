import { afterEach, describe, expect, it, vi } from 'vitest';
import { clearPointingTarget, pointingTargetFor, setPointingTarget } from './sheet-pointing';

describe("pointing into another sheet's formula", () => {
  afterEach(() => clearPointingTarget('s1'));

  it('offers the formula being written to the other sheets of its tab only', () => {
    const point = vi.fn(() => true);
    setPointingTarget({ sheetId: 's1', tabId: 't1', point, refocus: () => {} });
    expect(pointingTargetFor('s1', 't1')).toBeNull();
    expect(pointingTargetFor('s2', 't2')).toBeNull();
    expect(pointingTargetFor('s2', 't1')?.point({ r: 0, c: 0 }, { r: 0, c: 0 }, 'Sheet 2')).toBe(
      true,
    );
    expect(point).toHaveBeenCalledWith({ r: 0, c: 0 }, { r: 0, c: 0 }, 'Sheet 2');
  });

  it('is cleared only by the sheet that set it', () => {
    setPointingTarget({ sheetId: 's1', tabId: 't1', point: () => true, refocus: () => {} });
    clearPointingTarget('s3');
    expect(pointingTargetFor('s2', 't1')).not.toBeNull();
    clearPointingTarget('s1');
    expect(pointingTargetFor('s2', 't1')).toBeNull();
  });
});
