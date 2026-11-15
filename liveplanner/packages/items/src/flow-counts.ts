// The plan's daily flow counts (docs/specs/026-plan/items.md "Flow counts", blueprint item-store.md "Flow counts"):
// how many cards of each type stood in each status at the end of each UTC day, as the plan keeps them, and the
// counts of every day of a range read from them, a day with no row of its own carrying the last day before it. Pure:
// the plan's triggers write the rows (apps/api plan-room/flow-counts-schema.ts), and the Cumulative Flow chart reads
// what this answers (docs/specs/026-plan/plan-views.md "Flow charts").

import { TRASH_STATUS } from './board-model';
import { DAY_MS } from './plan-view-dates';

// The longest range a flow chart reads, and the days the plan keeps counts for (as long as card history is kept).
export const FLOW_DAYS_MAX = 180;
// A card with no status, as a count names it: the stored key is never null.
export const FLOW_NO_STATUS = '';

// One stored count: on flow day `day`, `cards` cards of type `type` stood in `status`.
export type FlowCountRow = { day: number; type: string; status: string; cards: number };

// The counts of a range: for each status any counted day holds, a count per day of the range, oldest first.
// `countedFrom` is the index of the first day the plan had counts for (days before it read 0 and are not drawn), or
// null when it had none by the range's end.
export type FlowCounts = {
  fromDay: number;
  days: number;
  countedFrom: number | null;
  byStatus: Map<string, number[]>;
};

// The flow day of a moment: whole UTC days since 1 January 1970, as plan-view-dates numbers days.
export function flowDayOf(ms: number): number {
  return Math.floor(ms / DAY_MS);
}

// The counts of each day from `fromDay` to `toDay` (at most FLOW_DAYS_MAX days, the newest kept), of the card types
// in `types` (every type when absent), from the stored rows of those days and the last day before them. Every stored
// day holds the whole plan's counts that day (the triggers carry the day before forward first), so a day reads its
// own rows, else the last stored day before it. The Trash is left out, and a count below zero (a row the triggers
// could not have written, but storage can hold) reads 0. Linear in the rows and the days.
export function flowCountsOf(
  rows: readonly FlowCountRow[],
  fromDay: number,
  toDay: number,
  types?: ReadonlySet<string>,
): FlowCounts {
  const from = Math.max(fromDay, toDay - FLOW_DAYS_MAX + 1);
  const days = Math.max(0, toDay - from + 1);
  const byDay = new Map<number, Map<string, number>>();
  let firstStored: number | null = null;
  for (const row of rows) {
    if (row.day > toDay) continue;
    if (firstStored === null || row.day < firstStored) firstStored = row.day;
    let day = byDay.get(row.day);
    if (!day) byDay.set(row.day, (day = new Map<string, number>()));
    if (row.status === TRASH_STATUS || (types && !types.has(row.type))) continue;
    day.set(row.status, (day.get(row.status) ?? 0) + Math.max(0, row.cards));
  }
  // The last stored day at or before the range's start carries into it.
  let current: Map<string, number> | undefined;
  let carried = -Infinity;
  for (const [day, counts] of byDay) {
    if (day <= from && day > carried) {
      carried = day;
      current = counts;
    }
  }
  const byStatus = new Map<string, number[]>();
  const series = (status: string) => {
    let out = byStatus.get(status);
    if (!out) byStatus.set(status, (out = new Array<number>(days).fill(0)));
    return out;
  };
  for (const counts of byDay.values()) for (const status of counts.keys()) series(status);
  for (let i = 0; i < days; i++) {
    current = byDay.get(from + i) ?? current;
    if (!current) continue;
    for (const [status, cards] of current) series(status)[i] = cards;
  }
  // A status no card stood in on any day of the range (one emptied before it began) draws no band.
  for (const [status, counts] of byStatus)
    if (counts.every((n) => n === 0)) byStatus.delete(status);
  const countedFrom = firstStored === null || days === 0 ? null : Math.max(0, firstStored - from);
  return { fromDay: from, days, countedFrom, byStatus };
}
