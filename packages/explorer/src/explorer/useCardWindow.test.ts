// The card grid's window maths (useCardWindow): which item cards draw for a place in the viewport, and that the rows
// it draws and the rows its spacers stand in for always add up to the whole run.
import { describe, expect, it } from 'vitest';
import { CARD_OVERSCAN_ROWS, cardWindowOf } from './useCardWindow';

const metrics = { cols: 3, pitch: 300, gap: 16 };

describe('cardWindowOf', () => {
  it('draws every card while nothing is measured (no layout, or before the first measure)', () => {
    expect(
      cardWindowOf({ folders: 4, count: 500, metrics: null, runTop: 0, viewport: 800 }),
    ).toEqual({
      shared: 0,
      start: 0,
      end: 500,
      rowsBefore: 0,
      rowsAfter: 0,
      pitch: 0,
      cols: 0,
      gap: 0,
    });
  });

  it('draws the first screen and its overscan at the top', () => {
    const w = cardWindowOf({ folders: 0, count: 2000, metrics, runTop: 100, viewport: 800 });
    // Rows 0..2 are on screen (100 + 3 * 300 > 800), and three more below.
    expect(w.start).toBe(0);
    expect(w.rowsBefore).toBe(0);
    expect(w.end).toBe((3 + CARD_OVERSCAN_ROWS) * 3);
  });

  it('keeps the items on the last folder row drawn, and windows the run after them', () => {
    // 13 folders over 3 columns: the fifth row holds one folder and two items.
    const w = cardWindowOf({ folders: 13, count: 2000, metrics, runTop: -30_000, viewport: 800 });
    expect(w.shared).toBe(2);
    expect(w.rowsBefore).toBe(100 - CARD_OVERSCAN_ROWS);
    expect(w.start).toBe(2 + w.rowsBefore * 3);
    expect((w.end - w.start) % 3).toBe(0);
  });

  it('accounts for every row of the run, wherever the viewport is', () => {
    for (const folders of [0, 1, 2, 3, 13]) {
      for (const count of [0, 1, 5, 59, 60, 2000]) {
        for (const runTop of [800, 0, -1, -299, -300, -12_345, -1e9]) {
          const w = cardWindowOf({ folders, count, metrics, runTop, viewport: 800 });
          const runRows = Math.ceil((count - w.shared) / 3);
          const drawnRows = Math.ceil((w.end - w.start) / 3);
          expect(w.rowsBefore + drawnRows + w.rowsAfter, `${folders}/${count}/${runTop}`).toBe(
            runRows,
          );
          expect(w.start).toBe(w.shared + w.rowsBefore * 3);
          expect(w.end).toBeLessThanOrEqual(count);
          expect(w.shared).toBeLessThanOrEqual(Math.min(count, 2));
        }
      }
    }
  });

  it('draws a screenful whatever the length, one column on a phone', () => {
    const phone = { cols: 1, pitch: 296, gap: 16 };
    const w = cardWindowOf({
      folders: 0,
      count: 2000,
      metrics: phone,
      runTop: -100_000,
      viewport: 844,
    });
    expect(w.end - w.start).toBeLessThanOrEqual(Math.ceil(844 / 296) + 1 + 2 * CARD_OVERSCAN_ROWS);
  });
});
