// Where the notes of a photographed wall land on the board (docs/specs/021-event-storming/event-storming.md "Always
// on a lane", Photo import).
//
// A photograph is the densest, least regular arrival a board ever sees: its
// rows sag, its notes are lapped over each other, a policy that was a square
// on the wall arrives with its wide silhouette, and a small photo of a big wall
// puts two rows of paper closer together than one lane. Measured on the eight
// labelled walls, rows sit 0.46 to 2.4 lanes apart, and a third of the notes in
// a row overlap a neighbour once every kind takes its own silhouette.
//
// Nothing already on the board moves; only the photo's notes do:
//   ROWS      notes level with each other (centres within half a lane's height
//             of the row's first note) are one row, and a row lands as a unit.
//   COLUMNS   notes of different rows within a quarter note of each other
//             share one left edge — the alignment the wall only approximated.
//   LANES     each row takes its nearest lane. A row with a note landing on a
//             board note, or on a note of a row above it, goes one lane down,
//             and every row below goes down with it (the cascade), so a dense
//             photo keeps its row order.
//   ALONG     notes that overlap on one lane slide right, one gutter clear of
//             the note before them, in the photo's left-to-right order.

import { ES_NOTE_SIZE_PX } from './event-storming';
import { groupRows } from './event-storming-lane-landing';
import { ES_LANES, ES_NOTE_GAP, laneCentre, laneIndexAt } from './event-storming-lanes';
import type { BoardNote } from './event-storming-photo-match';
import type { PhotoAddition } from './event-storming-photo';

// "Roughly above one another": within a quarter of a standard note.
export const PHOTO_COLUMN_RADIUS = ES_NOTE_SIZE_PX.square.width / 4;

type Box = { x: number; y: number; width: number; height: number };

const centreX = (b: Box) => b.x + b.width / 2;
const centreY = (b: Box) => b.y + b.height / 2;
const overlapsX = (a: Box, b: Box) => a.x < b.x + b.width && b.x < a.x + a.width;
const overlaps = (a: Box, b: Box) =>
  overlapsX(a, b) && a.y < b.y + b.height && b.y < a.y + a.height;

// COLUMNS. Visited left to right, each note joins the first column whose anchor
// is within the radius and which holds nothing of its own row; a column of two
// or more takes the left edge of its top-most note.
function alignColumns(notes: readonly PhotoAddition[], rowOf: readonly number[]): number[] {
  const xs = notes.map((n) => n.x);
  const order = notes
    .map((_, i) => i)
    .sort((a, b) => centreX(notes[a]!) - centreX(notes[b]!) || rowOf[a]! - rowOf[b]! || a - b);
  const columns: { anchor: number; members: number[]; rows: Set<number> }[] = [];
  for (const i of order) {
    const column = columns.find(
      (c) =>
        Math.abs(centreX(notes[i]!) - c.anchor) <= PHOTO_COLUMN_RADIUS && !c.rows.has(rowOf[i]!),
    );
    if (column) {
      column.members.push(i);
      column.rows.add(rowOf[i]!);
    } else {
      columns.push({ anchor: centreX(notes[i]!), members: [i], rows: new Set([rowOf[i]!]) });
    }
  }
  for (const column of columns) {
    if (column.members.length < 2) continue;
    const top = [...column.members].sort(
      (a, b) => centreY(notes[a]!) - centreY(notes[b]!) || a - b,
    )[0]!;
    for (const i of column.members) xs[i] = notes[top]!.x;
  }
  return xs;
}

export function placeNewNotes(additions: PhotoAddition[], existing: BoardNote[]): PhotoAddition[] {
  if (additions.length === 0) return [];
  const rows = groupRows(additions);
  const rowOf: number[] = [];
  rows.forEach((row, r) => row.forEach((i) => (rowOf[i] = r)));
  const xs = alignColumns(additions, rowOf);
  const heightOf = (i: number) => additions[i]!.height;
  const footprint = (i: number, lane: number): Box => ({
    x: xs[i]!,
    y: laneCentre(lane, ES_LANES) - heightOf(i) / 2,
    width: additions[i]!.width,
    height: heightOf(i),
  });

  // LANES: rows top to bottom, each as a unit.
  const laneOf: number[] = [];
  let shift = 0;
  const bound = existing.length + additions.length + 2;
  for (const row of rows) {
    const meanCy = row.reduce((sum, i) => sum + centreY(additions[i]!), 0) / row.length;
    let lane = laneIndexAt(meanCy, ES_LANES) + shift;
    for (let passes = 0; ; passes += 1) {
      const clash = row.some((i) => {
        const at = footprint(i, lane);
        const onBoard = existing.some((e) => overlaps(at, e));
        const above = laneOf.some(
          (l, j) => l === lane && rowOf[j] !== rowOf[i] && overlapsX(at, footprint(j, l)),
        );
        return onBoard || above;
      });
      if (!clash) break;
      if (passes >= bound) {
        console.warn('[es-lanes] photo placement bound', { row: rowOf[row[0]!], lane });
        break;
      }
      lane += 1;
      shift += 1;
    }
    for (const i of row) laneOf[i] = lane;
  }

  // ALONG: per lane, the photo's notes left to right, each one gutter clear of
  // the note before it and of any board note on that lane.
  const out = additions.map((a) => ({ ...a }));
  const lanes = [...new Set(laneOf)];
  for (const lane of lanes) {
    const onLane = additions
      .map((_, i) => i)
      .filter((i) => laneOf[i] === lane)
      .sort((a, b) => centreX(additions[a]!) - centreX(additions[b]!) || a - b);
    let previous: Box | null = null;
    for (const i of onLane) {
      let at = footprint(i, lane);
      if (previous && at.x < previous.x + previous.width) {
        at = { ...at, x: previous.x + previous.width + ES_NOTE_GAP };
      }
      for (;;) {
        const hit = existing.find((e) => overlaps(at, e));
        if (!hit) break;
        at = { ...at, x: hit.x + hit.width + ES_NOTE_GAP };
      }
      out[i] = { ...out[i]!, x: at.x, y: at.y };
      previous = at;
    }
  }
  return out;
}
