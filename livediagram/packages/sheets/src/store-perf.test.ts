// Row operations stay linear in the sheet (blueprint sheets-engine.md "Performance and limits"): a sort, a delete
// and its undo over 10,000 rows once each scanned the layout per id. Timed as growth in CPU time (cpuMsOf), not as a
// ceiling: four times the rows should cost about four times as much; a scan per id would cost sixteen.
import { describe, expect, it } from 'vitest';
import { cpuMsOf } from '@livediagram/vitest-config/cpu-time';
import { makeSheets } from './testing/book';
import { applySheetWrite, inverseSheetWrite, type SheetWrite } from './store';

const ctx = { now: 1, by: { id: '', name: '', color: '#000000' } };
const RATIO_CEILING = 8;

function costOf(rows: number): number {
  const sheet = makeSheets({ S: { A1: '1' } }, { rows, cols: 3 })[0]!;
  const ids = sheet.layout.rows;
  const writes: SheetWrite[] = [
    { kind: 'layout', changes: [{ k: 'orderRows', ids: [...ids].reverse() }] },
    { kind: 'layout', changes: [{ k: 'deleteRows', ids: ids.slice(1) }] },
  ];
  let fastest = Infinity;
  for (let run = 0; run < 3; run++) {
    fastest = Math.min(
      fastest,
      cpuMsOf(() => {
        for (const w of writes) inverseSheetWrite(sheet, applySheetWrite(sheet, w, ctx));
      }),
    );
  }
  return fastest;
}

describe('row operations as a sheet grows', () => {
  it('cost about linearly more, never quadratically', { timeout: 30_000 }, () => {
    costOf(2_500);
    expect(costOf(10_000) / costOf(2_500)).toBeLessThan(RATIO_CEILING);
  });
});
