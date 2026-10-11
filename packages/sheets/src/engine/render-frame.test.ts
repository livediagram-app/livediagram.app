import { describe, expect, it } from 'vitest';
import { book } from '../testing/book';
import { renderFrameWindow, renderWindow } from './render';

// One Sheet element's window from a workbook the caller already holds (docs/specs/026-plan/plan-tabs.md "Export"):
// the grid area inside the static render's header (62 px) and row heads (46 px).
describe('renderFrameWindow', () => {
  it('is the window of the frame’s grid area', () => {
    const b = book({ A1: 'Title', B2: '7' });
    const s = b.sheets[0]!;
    const framed = renderFrameWindow(b.wb, { sheetId: s.id, width: 46 + 300, height: 62 + 120 });
    expect(framed).toEqual(renderWindow(b.wb, s.id, { width: 300, height: 120 }, 'en-GB'));
    expect(framed!.cells.map((c) => c.text)).toEqual(['Title', '7']);
  });

  it('is undefined for a sheet the workbook does not hold', () => {
    const b = book({ A1: 'x' });
    expect(renderFrameWindow(b.wb, { sheetId: 'gone', width: 400, height: 300 })).toBeUndefined();
  });
});
