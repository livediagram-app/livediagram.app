import type { Box } from './boxes';

// Which row of the wall each sticky is in, and where along it (docs/specs/021-event-storming/event-storming.md).
//
// A wall sags: a row photographed from an angle drifts ten or twenty pixels
// from one end to the other, so a row is a CLUSTER of centre-y values, not a
// shared coordinate. Sorting by y and starting a new row whenever the gap
// exceeds half a note is enough, and it degrades gracefully — a genuinely
// ambiguous note joins the nearer row, which is what a human would do.

const ROW_GAP_FRACTION = 0.5;

export type RowedBox = Box & { row: number; order: number };

export function clusterRows(boxes: Box[], noteSize: number): RowedBox[] {
  if (boxes.length === 0) return [];
  const gap = Math.max(1, noteSize * ROW_GAP_FRACTION);
  const withCentres = boxes.map((b) => ({ box: b, cy: b.y + b.h / 2 }));
  withCentres.sort((a, b) => a.cy - b.cy);

  const rows: { box: Box; cy: number }[][] = [];
  let current: { box: Box; cy: number }[] = [];
  let lastCy = -Infinity;
  for (const entry of withCentres) {
    if (current.length > 0 && entry.cy - lastCy > gap) {
      rows.push(current);
      current = [];
    }
    current.push(entry);
    lastCy = entry.cy;
  }
  if (current.length > 0) rows.push(current);

  const out: RowedBox[] = [];
  rows.forEach((row, rowIndex) => {
    row
      .slice()
      .sort((a, b) => a.box.x + a.box.w / 2 - (b.box.x + b.box.w / 2))
      .forEach(({ box }, order) => out.push({ ...box, row: rowIndex, order }));
  });
  return out;
}

export const ROW_CALIBRATION = { ROW_GAP_FRACTION } as const;
