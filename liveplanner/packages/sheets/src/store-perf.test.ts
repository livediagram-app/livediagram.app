// Row operations stay linear in the sheet (blueprint sheets-engine.md "Performance and limits"): a sort, a delete
// and its undo over 10,000 rows once each scanned the layout per id. Timed as growth in CPU time (cpuMsOf), not as a
// ceiling: four times the rows should cost about four times as much; a scan per id would cost sixteen.
import { describe, expect, it } from 'vitest';
import { cpuGrowthRatio, cpuMsOf, cpuRatioCeiling } from '@liveworkspace/vitest-config/cpu-time';
import { makeSheets } from './testing/book';
import { applySheetWrite, inverseSheetWrite, type SheetWrite } from './store';

const ctx = { now: 1, by: { id: '', name: '', color: '#000000' } };
const RATIO_CEILING = cpuRatioCeiling(8);

// One sample: each write applied and undone on a sheet of `rows` rows, built outside the timing.
function costOf(rows: number): () => number {
  const sheet = makeSheets({ S: { A1: '1' } }, { rows, cols: 3 })[0]!;
  const ids = sheet.layout.rows;
  const writes: SheetWrite[] = [
    { kind: 'layout', changes: [{ k: 'orderRows', ids: [...ids].reverse() }] },
    { kind: 'layout', changes: [{ k: 'deleteRows', ids: ids.slice(1) }] },
  ];
  return () =>
    cpuMsOf(() => {
      for (const w of writes) inverseSheetWrite(sheet, applySheetWrite(sheet, w, ctx));
    });
}

describe('row operations as a sheet grows', () => {
  it('cost about linearly more, never quadratically', { timeout: 30_000 }, () => {
    // Both sizes warmed and timed in turns (cpuGrowthRatio), the fastest sample of each kept.
    const ratio = cpuGrowthRatio(costOf(2_500), costOf(10_000), { ceiling: RATIO_CEILING });
    expect(ratio).toBeLessThan(RATIO_CEILING);
  });
});
