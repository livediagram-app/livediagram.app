import { describe, expect, it, vi } from 'vitest';
import { listenForSheetSelect, requestSheetSelect } from './sheet-select-request';

// Selecting a Sheet's cell from outside it (docs/specs/026-plan/plan-tour.md "Spreadsheets").

describe('requestSheetSelect', () => {
  it('reaches the drawn Sheet of that sheet, and nothing once it has gone', () => {
    const select = vi.fn();
    const stop = listenForSheetSelect('s1', select);
    expect(requestSheetSelect('s1', { r: 5, c: 2 })).toBe(true);
    expect(select).toHaveBeenCalledWith({ r: 5, c: 2 });
    expect(requestSheetSelect('s2', { r: 0, c: 0 })).toBe(false);
    stop();
    expect(requestSheetSelect('s1', { r: 0, c: 0 })).toBe(false);
    expect(select).toHaveBeenCalledTimes(1);
  });

  it("leaves a newer Sheet's listener alone when an older one stops", () => {
    const older = listenForSheetSelect('s1', vi.fn());
    const newer = vi.fn();
    const stopNewer = listenForSheetSelect('s1', newer);
    older();
    expect(requestSheetSelect('s1', { r: 1, c: 1 })).toBe(true);
    expect(newer).toHaveBeenCalled();
    stopNewer();
  });
});
