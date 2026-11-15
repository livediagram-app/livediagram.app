// The flow charts' read on the wire (docs/specs/026-plan/plan-views.md "Flow charts", blueprint item-store.md "Flow
// read"): GET /api/projects/:id/flow?days=&types=. The shapes come from @liveplanner/items, whose flowCountsOf,
// cycleTimesOf and throughputOf work the three charts out of it.

import type { FlowCard, FlowCountRow } from '@liveplanner/items';

export type { FlowCard, FlowCountRow, FlowStep } from '@liveplanner/items';

// A range's flow: its daily counts, and each card that moved in it with its moves over the history the plan keeps.
export type FlowResponse = {
  /** The range's first day, as a flow day (whole UTC days since 1 January 1970). */
  fromDay: number;
  /** Its last day: today, as a flow day. */
  toDay: number;
  /** The stored daily counts of the range, and of the last stored day before it, which its first days carry. Only
   *  the card types asked for. */
  counts: FlowCountRow[];
  /** Each card of the types asked for that moved in the range: its type, when it was made, its oldest kept history
   *  entry, and its moves over the history the plan keeps (up to 180 days), oldest first, each `[at, from, to]`:
   *  statuses only, never who moved it. */
  cards: FlowCard[];
};
