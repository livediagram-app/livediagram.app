// A Dashboard layout's edits (dashboard.ts): rows and slots added, resized, moved and emptied. Pure, like the rest:
// every edit returns a new layout, or the same one when nothing changes or the change would pass a limit.

import {
  clamp,
  DASHBOARD_ROW_H_MAX,
  DASHBOARD_ROW_H_MIN,
  DASHBOARD_ROWS_MAX,
  DASHBOARD_SLOTS_MAX,
  DASHBOARD_SPAN_MIN,
  DASHBOARD_SPANS,
  type DashboardContent,
  type DashboardLayout,
  type DashboardRow,
  type DashboardSlot,
  evenSpans,
  type IdMaker,
  newRow,
} from './dashboard-layout';

const mapRow = (
  layout: DashboardLayout,
  rowId: string,
  f: (row: DashboardRow) => DashboardRow | null,
): DashboardLayout => {
  let changed = false;
  const rows: DashboardRow[] = [];
  for (const row of layout.rows) {
    if (row.id !== rowId) {
      rows.push(row);
      continue;
    }
    const next = f(row);
    if (next !== row) changed = true;
    if (next) rows.push(next);
  }
  return changed ? { ...layout, rows } : layout;
};

// A row of two empty slots after `afterRowId` (at the end when absent); the same layout at the row limit.
export function addDashboardRow(
  layout: DashboardLayout,
  id: IdMaker,
  afterRowId?: string,
): DashboardLayout {
  if (layout.rows.length >= DASHBOARD_ROWS_MAX) return layout;
  const at = afterRowId ? layout.rows.findIndex((r) => r.id === afterRowId) : -1;
  const rows = [...layout.rows];
  rows.splice(at < 0 ? rows.length : at + 1, 0, newRow(id));
  return { ...layout, rows };
}

// A row's height, clamped.
export function setDashboardRowHeight(
  layout: DashboardLayout,
  rowId: string,
  height: number,
): DashboardLayout {
  const h = clamp(Math.round(height), DASHBOARD_ROW_H_MIN, DASHBOARD_ROW_H_MAX);
  return mapRow(layout, rowId, (row) => (row.height === h ? row : { ...row, height: h }));
}

// An empty slot added to a row: the widest slot splits (its right half becomes the new one, after it). The same
// layout at the slot limit, or when no slot is wide enough to split.
export function addDashboardSlot(
  layout: DashboardLayout,
  rowId: string,
  id: IdMaker,
): DashboardLayout {
  return mapRow(layout, rowId, (row) => {
    if (row.slots.length >= DASHBOARD_SLOTS_MAX) return row;
    const widest = row.slots.reduce((w, s, i) => (s.span > row.slots[w]!.span ? i : w), 0);
    const span = row.slots[widest]!.span;
    if (span < DASHBOARD_SPAN_MIN * 2) return row;
    const right = Math.floor(span / 2);
    const slots = [...row.slots];
    slots.splice(
      widest,
      1,
      { ...row.slots[widest]!, span: span - right },
      { id: id(), span: right },
    );
    return { ...row, slots };
  });
}

// An empty slot put at `index` in a row (0 is the left end, the slot count the right end): it takes half the span of
// the wider slot beside it there. The same layout at the slot limit, or when that neighbour is too narrow to share.
export function insertDashboardSlot(
  layout: DashboardLayout,
  rowId: string,
  index: number,
  id: IdMaker,
): DashboardLayout {
  return mapRow(layout, rowId, (row) => {
    if (row.slots.length >= DASHBOARD_SLOTS_MAX) return row;
    const at = clamp(Math.round(index), 0, row.slots.length);
    const left = row.slots[at - 1];
    const right = row.slots[at];
    const donor = !left ? at : !right ? at - 1 : left.span >= right.span ? at - 1 : at;
    const span = row.slots[donor]!.span;
    if (span < DASHBOARD_SPAN_MIN * 2) return row;
    const given = Math.floor(span / 2);
    const slots = row.slots.map((s, i) => (i === donor ? { ...s, span: span - given } : s));
    slots.splice(at, 0, { id: id(), span: given });
    return { ...row, slots };
  });
}

// A row of `slots` empty slots and `height` put at `index` among the rows (0 the top). The same layout at the row limit.
export function insertDashboardRow(
  layout: DashboardLayout,
  index: number,
  height: number,
  slots: number,
  id: IdMaker,
): DashboardLayout {
  if (layout.rows.length >= DASHBOARD_ROWS_MAX) return layout;
  const rows = [...layout.rows];
  rows.splice(clamp(Math.round(index), 0, rows.length), 0, {
    id: id(),
    height: clamp(Math.round(height), DASHBOARD_ROW_H_MIN, DASHBOARD_ROW_H_MAX),
    slots: evenSpans(slots).map((span) => ({ id: id(), span })),
  });
  return { ...layout, rows };
}

// A copy of a slot's place for Duplicate (docs/specs/026-plan/plan-tabs.md "Editing"): a new empty slot just right of
// `slotId` in its row while the row has room (the space split as Add Slot to the Right does), else a new row of one
// slot below its row; with the new slot's id. Null when neither fits (a full row on a full dashboard, or a slot too
// narrow to split with no room for a row).
export function placeDashboardDuplicate(
  layout: DashboardLayout,
  rowId: string,
  slotId: string,
  id: IdMaker,
): { layout: DashboardLayout; slotId: string } | null {
  const rowAt = layout.rows.findIndex((r) => r.id === rowId);
  const row = layout.rows[rowAt];
  const at = row?.slots.findIndex((s) => s.id === slotId) ?? -1;
  if (!row || at < 0) return null;
  const beside = insertDashboardSlot(layout, rowId, at + 1, id);
  if (beside !== layout) {
    const made = beside.rows[rowAt]!.slots[at + 1];
    if (made) return { layout: beside, slotId: made.id };
  }
  const below = insertDashboardRow(layout, rowAt + 1, row.height, 1, id);
  if (below === layout) return null;
  return { layout: below, slotId: below.rows[rowAt + 1]!.slots[0]!.id };
}

// A slot removed: its span goes to its left neighbour (its right one when first); the last slot removes its row.
export function removeDashboardSlot(
  layout: DashboardLayout,
  rowId: string,
  slotId: string,
): DashboardLayout {
  return mapRow(layout, rowId, (row) => {
    const i = row.slots.findIndex((s) => s.id === slotId);
    if (i < 0) return row;
    if (row.slots.length === 1) return null;
    const gone = row.slots[i]!;
    const n = i > 0 ? i - 1 : 1;
    const slots = row.slots.map((s, j) => (j === n ? { ...s, span: s.span + gone.span } : s));
    slots.splice(i, 1);
    return { ...row, slots };
  });
}

// The divider after slot `index` moved by `delta` spans: the slot on its left grows by it and the one on its right
// shrinks, each kept at least the minimum. The same layout when nothing moves.
export function moveDashboardDivider(
  layout: DashboardLayout,
  rowId: string,
  index: number,
  delta: number,
): DashboardLayout {
  return mapRow(layout, rowId, (row) => {
    const left = row.slots[index];
    const right = row.slots[index + 1];
    if (!left || !right) return row;
    const d = clamp(
      Math.round(delta),
      DASHBOARD_SPAN_MIN - left.span,
      right.span - DASHBOARD_SPAN_MIN,
    );
    if (d === 0) return row;
    const slots = [...row.slots];
    slots[index] = { ...left, span: left.span + d };
    slots[index + 1] = { ...right, span: right.span - d };
    return { ...row, slots };
  });
}

// A slot's content set, or cleared (undefined).
export function setDashboardContent(
  layout: DashboardLayout,
  slotId: string,
  content: DashboardContent | undefined,
): DashboardLayout {
  const row = layout.rows.find((r) => r.slots.some((s) => s.id === slotId));
  if (!row) return layout;
  return mapRow(layout, row.id, (r) => ({
    ...r,
    slots: r.slots.map((s) => {
      if (s.id !== slotId) return s;
      const { content: _drop, ...rest } = s;
      return content ? { ...rest, content } : rest;
    }),
  }));
}

// The slot beside `slotId` in direction `dir`, for moving it from the keyboard: left and right its neighbours in its
// row; up and down the slot in the row above or below whose middle (by span) is nearest its own. Null at an edge.
export function dashboardNeighbour(
  layout: DashboardLayout,
  slotId: string,
  dir: 'left' | 'right' | 'up' | 'down',
): string | null {
  const r = layout.rows.findIndex((row) => row.slots.some((s) => s.id === slotId));
  if (r < 0) return null;
  const row = layout.rows[r]!;
  const i = row.slots.findIndex((s) => s.id === slotId);
  if (dir === 'left') return row.slots[i - 1]?.id ?? null;
  if (dir === 'right') return row.slots[i + 1]?.id ?? null;
  const other = layout.rows[dir === 'up' ? r - 1 : r + 1];
  if (!other) return null;
  const middles = (slots: readonly DashboardSlot[]) => {
    let at = 0;
    return slots.map((s) => {
      const mid = at + s.span / 2;
      at += s.span;
      return mid;
    });
  };
  const mine = middles(row.slots)[i]!;
  const theirs = middles(other.slots);
  let best = 0;
  for (const [k, m] of theirs.entries())
    if (Math.abs(m - mine) < Math.abs(theirs[best]! - mine)) best = k;
  return other.slots[best]?.id ?? null;
}

// The slot just before or after this one in reading order (row by row, left to right), the order a phone stacks
// the dashboard in (plan-tabs.md "On a phone"): Move Up and Move Down swap with it. null at either end.
export function dashboardReadingNeighbour(
  layout: DashboardLayout,
  slotId: string,
  dir: 'previous' | 'next',
): string | null {
  const order = layout.rows.flatMap((row) => row.slots.map((s) => s.id));
  const i = order.indexOf(slotId);
  if (i < 0) return null;
  return order[dir === 'previous' ? i - 1 : i + 1] ?? null;
}

// Where a moved slot goes (DashboardPage's drag): onto another slot (the two swap what they hold; spans stay), into a
// gap in a row (`index`, 0 its left end), or between rows as a row of its own (`index`, 0 above the first).
type DashboardMoveTarget =
  | { kind: 'slot'; slotId: string }
  | { kind: 'slot-gap'; rowId: string; index: number }
  | { kind: 'row-gap'; index: number };

// The slot `slotId` moved to `target`. Leaving its row gives its span to its neighbour (the row goes with its last
// slot); joining a row takes half the wider neighbour's span there. The same layout when the move changes nothing or
// cannot be made (the target row is full, or too narrow to share, or a new row would pass the row limit).
export function moveDashboardSlot(
  layout: DashboardLayout,
  slotId: string,
  target: DashboardMoveTarget,
  id: IdMaker,
): DashboardLayout {
  const fromRow = layout.rows.find((r) => r.slots.some((s) => s.id === slotId));
  const slot = fromRow?.slots.find((s) => s.id === slotId);
  if (!fromRow || !slot) return layout;
  if (target.kind === 'slot') {
    if (target.slotId === slotId) return layout;
    const other = layout.rows.flatMap((r) => r.slots).find((s) => s.id === target.slotId);
    if (!other) return layout;
    const swapped = setDashboardContent(
      setDashboardContent(layout, slotId, other.content),
      target.slotId,
      slot.content,
    );
    return swapped;
  }
  const fromIndex = fromRow.slots.findIndex((s) => s.id === slotId);
  if (target.kind === 'slot-gap' && target.rowId === fromRow.id) {
    // Within its own row: the slot (span and all) moves to the gap.
    const to = target.index > fromIndex ? target.index - 1 : target.index;
    if (to === fromIndex) return layout;
    return mapRow(layout, fromRow.id, (row) => {
      const slots = row.slots.filter((s) => s.id !== slotId);
      slots.splice(to, 0, slot);
      return { ...row, slots };
    });
  }
  if (target.kind === 'slot-gap') {
    const toRow = layout.rows.find((r) => r.id === target.rowId);
    if (!toRow || toRow.slots.length >= DASHBOARD_SLOTS_MAX) return layout;
    const opened = insertDashboardSlot(layout, toRow.id, target.index, () => slot.id + ':moving');
    if (opened === layout) return layout;
    const left = removeDashboardSlot(opened, fromRow.id, slotId);
    return mapRow(left, toRow.id, (row) => ({
      ...row,
      slots: row.slots.map((s) =>
        s.id === slot.id + ':moving'
          ? { id: slot.id, span: s.span, ...(slot.content ? { content: slot.content } : {}) }
          : s,
      ),
    }));
  }
  // A row of its own: as wide as the page, at its height, where the gap is (counted before the source row may go).
  if (fromRow.slots.length === 1) {
    const at = layout.rows.indexOf(fromRow);
    if (target.index === at || target.index === at + 1) return layout;
  } else if (layout.rows.length >= DASHBOARD_ROWS_MAX) {
    // Its row stays, so the new one would be a row past the limit (which a read drops, orphaning its content).
    return layout;
  }
  const rows = [...layout.rows];
  rows.splice(clamp(Math.round(target.index), 0, rows.length), 0, {
    id: id(),
    height: fromRow.height,
    slots: [{ id: slot.id + ':moving', span: DASHBOARD_SPANS }],
  });
  const left = removeDashboardSlot({ ...layout, rows }, fromRow.id, slotId);
  return {
    ...layout,
    rows: left.rows.map((r) => ({
      ...r,
      slots: r.slots.map((s) =>
        s.id === slot.id + ':moving'
          ? { id: slot.id, span: s.span, ...(slot.content ? { content: slot.content } : {}) }
          : s,
      ),
    })),
  };
}
