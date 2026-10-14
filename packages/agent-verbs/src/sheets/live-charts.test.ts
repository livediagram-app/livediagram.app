// Charts read live for a picture (docs/specs/029-sheets/sheet.md "Charts"): a linked chart draws what its cells hold now.
import { describe, expect, it } from 'vitest';
import { createShape, type Element } from '@livediagram/document';
import { sheetFromJson } from '@livediagram/sheets';
import { sheetJson } from '../testing/sheets';
import { chartsReadLive } from './live-charts';

const sheet = sheetJson({ id: 'sheet_live01', tabId: 't', title: 'S' }, [
  ['Region', 'Amount'],
  ['North', 10],
  ['South', 30],
]);
const { layout } = sheetFromJson(sheet);
const range = {
  r1: layout.rows[0]!,
  c1: layout.cols[0]!,
  r2: layout.rows[2]!,
  c2: layout.cols[1]!,
};

describe('chartsReadLive', () => {
  it('gives a linked chart its range’s values now, and leaves the rest as they are', () => {
    const stale = {
      ...createShape('pie-chart', 0, 0),
      chartSource: { sheetId: 'sheet_live01', range },
      pieSlices: [{ label: 'Old', value: 1 }],
    } as Element;
    const other = {
      ...createShape('pie-chart', 0, 0),
      chartSource: { sheetId: 'gone', range },
    } as Element;
    const box = createShape('square', 0, 0) as Element;
    const [live, untouched, plain] = chartsReadLive([stale, other, box], [sheet]);
    expect((live as { pieSlices: unknown }).pieSlices).toMatchObject([
      { label: 'North', value: 10 },
      { label: 'South', value: 30 },
    ]);
    expect(untouched).toBe(other);
    expect(plain).toBe(box);
  });

  it('is the elements as they are with no linked chart or no sheets', () => {
    const box = createShape('square', 0, 0) as Element;
    expect(chartsReadLive([box], [sheet])).toEqual([box]);
    const chart = {
      ...createShape('pie-chart', 0, 0),
      chartSource: { sheetId: 'sheet_live01', range },
    } as Element;
    expect(chartsReadLive([chart], [])).toEqual([chart]);
    // A range whose rows are gone keeps what it was saved with.
    const lost = {
      ...chart,
      chartSource: { sheetId: 'sheet_live01', range: { ...range, r1: 'gone' } },
    } as Element;
    expect(chartsReadLive([lost], [sheet])).toEqual([lost]);
  });
});
