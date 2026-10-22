// docs/specs/029-sheets/sheet.md "Zoom": a covering Sheet's zoom, 50% to 200% in whole percents.
import { afterEach, describe, expect, it } from 'vitest';
import {
  getSheetZoom,
  setSheetZoom,
  SHEET_ZOOM_MAX,
  SHEET_ZOOM_MIN,
  stepSheetZoom,
} from './sheet-zoom';

afterEach(() => setSheetZoom(1));

describe('sheet zoom', () => {
  it('steps by 10% without drifting, and clamps to its range', () => {
    stepSheetZoom(1);
    stepSheetZoom(1);
    stepSheetZoom(1);
    expect(getSheetZoom()).toBe(1.3);
    for (let i = 0; i < 20; i++) stepSheetZoom(1);
    expect(getSheetZoom()).toBe(SHEET_ZOOM_MAX);
    for (let i = 0; i < 40; i++) stepSheetZoom(-1);
    expect(getSheetZoom()).toBe(SHEET_ZOOM_MIN);
    setSheetZoom(3);
    expect(getSheetZoom()).toBe(SHEET_ZOOM_MAX);
    setSheetZoom(Number.NaN);
    expect(getSheetZoom()).toBe(SHEET_ZOOM_MAX);
  });
});
