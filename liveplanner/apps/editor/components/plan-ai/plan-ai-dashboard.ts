// Plan AI's changes to a Dashboard (docs/specs/026-plan/plan-ai.md "On a dashboard"): each named by row and slot
// number as the dashboard stood before the turn's first change, resolved to ids first, then made in order through the
// layout's own edits (dashboard-edit.ts), so every limit holds as it does for a hand on a handle. The first change that
// can't be made stops the rest and says why; the ones before it are kept. Pure: the caller commits the layout as one
// change (changeDashboard), one undo step.
import {
  DASHBOARD_NOTE_MAX,
  DASHBOARD_NOTE_TITLE_MAX,
  DASHBOARD_ROW_H_DEFAULT,
  DASHBOARD_ROWS_MAX,
  DASHBOARD_SLOTS_MAX,
  insertDashboardRow,
  insertDashboardSlot,
  moveDashboardDivider,
  moveDashboardSlot,
  removeDashboardSlot,
  setDashboardContent,
  setDashboardRowHeight,
  type DashboardLayout,
} from '@liveplanner/project';
import { statusKey, type PlanAiChange } from '@liveplanner/items';
import type { PlanAiLine } from './plan-ai-lines';

type IdMaker = () => string;
type Tabs = readonly { id: string; name: string; kind?: string }[];

class Stop extends Error {}

const num = (v: unknown): number | null =>
  typeof v === 'number' && Number.isInteger(v) && v >= 1 ? v : null;
const text = (v: unknown, max: number): string =>
  typeof v === 'string' ? v.trim().slice(0, max) : '';

// A slot and a width as people say them: "the first slot in row 1", "two thirds of the row" (never twelfths, which
// only the layout counts in). A row holds at most four slots.
const ORDINALS = ['first', 'second', 'third', 'fourth'];
const slotWords = (c: PlanAiChange): string =>
  `the ${ORDINALS[Number(c['slot']) - 1] ?? String(c['slot'])} slot in row ${String(c['row'])}`;
const PARTS: Readonly<Record<number, string>> = {
  2: 'a sixth',
  3: 'a quarter',
  4: 'a third',
  6: 'half',
  8: 'two thirds',
  9: 'three quarters',
  10: 'five sixths',
  12: 'all',
};
/** "two thirds of the row wide"; a span with no plain fraction in twelfths. */
export const widthWords = (span: number): string =>
  `${PARTS[span] ?? `${span} twelfths`} of the row wide`;

/** Makes `changes` on `layout`: the layout after them, and a line for each (the last one refused when one was). */
export function applyDashboardChanges(
  layout: DashboardLayout,
  changes: readonly PlanAiChange[],
  tabs: Tabs,
  id: IdMaker,
): { layout: DashboardLayout; lines: PlanAiLine[] } {
  const before = layout;
  // Row and slot numbers as the dashboard stood before the first change: its ids.
  const rowId = (c: PlanAiChange, key = 'row'): string => {
    const n = num(c[key]);
    const row = n ? before.rows[n - 1] : undefined;
    if (!row)
      throw new Stop(`There is no row ${String(c[key])}: the dashboard has ${before.rows.length}.`);
    return row.id;
  };
  const slotIds = (c: PlanAiChange, rowKey = 'row', slotKey = 'slot'): [string, string] => {
    const r = rowId(c, rowKey);
    const row = before.rows.find((x) => x.id === r)!;
    const n = num(c[slotKey]);
    const slot = n ? row.slots[n - 1] : undefined;
    if (!slot)
      throw new Stop(
        `Row ${String(c[rowKey])} has no slot ${String(c[slotKey])}: it has ${row.slots.length}.`,
      );
    return [r, slot.id];
  };
  const rowNow = (l: DashboardLayout, r: string) => {
    const at = l.rows.findIndex((x) => x.id === r);
    if (at < 0) throw new Stop('That row was removed by an earlier change.');
    return { at, row: l.rows[at]! };
  };
  const slotNow = (l: DashboardLayout, r: string, s: string) => {
    const { row } = rowNow(l, r);
    const at = row.slots.findIndex((x) => x.id === s);
    if (at < 0) throw new Stop('That slot was removed by an earlier change.');
    return at;
  };
  const changed = (next: DashboardLayout, now: DashboardLayout, why: string) => {
    if (next === now) throw new Stop(why);
    return next;
  };

  const one = (l: DashboardLayout, c: PlanAiChange): { layout: DashboardLayout; line: string } => {
    switch (c.op) {
      case 'add_row': {
        const slots = Math.min(DASHBOARD_SLOTS_MAX, num(c['slots']) ?? 2);
        const height = typeof c['height'] === 'number' ? c['height'] : DASHBOARD_ROW_H_DEFAULT;
        const at = num(c['at']);
        const index =
          at && at <= before.rows.length ? rowNow(l, before.rows[at - 1]!.id).at : l.rows.length;
        const next = changed(
          insertDashboardRow(l, index, height, slots, id),
          l,
          `A dashboard holds at most ${DASHBOARD_ROWS_MAX} rows.`,
        );
        return {
          layout: next,
          line: `Added a row of ${slots} ${slots === 1 ? 'slot' : 'slots'}`,
        };
      }
      case 'remove_row': {
        const r = rowId(c);
        rowNow(l, r);
        return {
          layout: { ...l, rows: l.rows.filter((x) => x.id !== r) },
          line: `Removed row ${String(c['row'])}`,
        };
      }
      case 'add_slot': {
        const r = rowId(c);
        const { row } = rowNow(l, r);
        const at = num(c['at']);
        const index = at ? Math.min(at - 1, row.slots.length) : row.slots.length;
        const next = changed(
          insertDashboardSlot(l, r, index, id),
          l,
          `Row ${String(c['row'])} has no room for another slot (at most ${DASHBOARD_SLOTS_MAX}, each at least 2 twelfths).`,
        );
        return { layout: next, line: `Added a slot to row ${String(c['row'])}` };
      }
      case 'remove_slot': {
        const [r, s] = slotIds(c);
        slotNow(l, r, s);
        return {
          layout: removeDashboardSlot(l, r, s),
          line: `Removed ${slotWords(c)}`,
        };
      }
      case 'resize_slot': {
        const [r, s] = slotIds(c);
        const at = slotNow(l, r, s);
        const { row } = rowNow(l, r);
        const span = num(c['span']);
        if (!span) throw new Stop('Give the slot a span of 2 to 12 twelfths.');
        if (row.slots.length === 1) throw new Stop('A row’s only slot always fills it.');
        const delta = span - row.slots[at]!.span;
        // The slot's right edge moves, or its left one for the last slot.
        const next =
          at < row.slots.length - 1
            ? moveDashboardDivider(l, r, at, delta)
            : moveDashboardDivider(l, r, at - 1, -delta);
        const made = changed(
          next,
          l,
          'That slot can’t be that wide: each slot keeps at least 2 twelfths.',
        );
        // The divider stops where a neighbour keeps its least, so the line says the width it took.
        const now = rowNow(made, r).row.slots.find((x) => x.id === s)!.span;
        return {
          layout: made,
          line: `Made ${slotWords(c)} ${widthWords(now)}`,
        };
      }
      case 'row_height': {
        const r = rowId(c);
        rowNow(l, r);
        const height = typeof c['height'] === 'number' ? c['height'] : NaN;
        if (!Number.isFinite(height)) throw new Stop('Give the row a height in pixels.');
        return {
          layout: setDashboardRowHeight(l, r, height),
          line: `Made row ${String(c['row'])} ${Math.round(height)} px tall`,
        };
      }
      case 'move_slot': {
        const [r, s] = slotIds(c);
        const from = slotNow(l, r, s);
        const to = c['toRow'] === undefined ? r : rowId(c, 'toRow');
        const { row: target } = rowNow(l, to);
        // The place it takes in its row (1 the left end), as a gap: within its own row, moving right, the gap after.
        const place = Math.min(
          (num(c['toSlot']) ?? target.slots.length + 1) - 1,
          target.slots.length,
        );
        const index = to === r && place > from ? place + 1 : place;
        const next = changed(
          moveDashboardSlot(l, s, { kind: 'slot-gap', rowId: to, index }, id),
          l,
          'That slot can’t go there: the row is full.',
        );
        return { layout: next, line: `Moved ${slotWords(c)}` };
      }
      case 'note': {
        const [r, s] = slotIds(c);
        slotNow(l, r, s);
        const title = text(c['title'], DASHBOARD_NOTE_TITLE_MAX);
        return {
          layout: setDashboardContent(l, s, {
            type: 'note',
            title,
            text: text(c['text'], DASHBOARD_NOTE_MAX),
          }),
          line: `Put a note${title ? ` “${title}”` : ''} in row ${String(c['row'])}`,
        };
      }
      case 'show_tab': {
        const [r, s] = slotIds(c);
        slotNow(l, r, s);
        const wanted = text(c['tab'], 200);
        const tab = tabs.find(
          (t) =>
            (t.kind === 'board' || t.kind === 'sheet') && statusKey(t.name) === statusKey(wanted),
        );
        if (!tab)
          throw new Stop(
            `No Board or Sheet tab “${wanted}”. Tabs: ${
              tabs
                .filter((t) => t.kind === 'board' || t.kind === 'sheet')
                .map((t) => t.name)
                .join(', ') || 'none'
            }.`,
          );
        return {
          layout: setDashboardContent(l, s, {
            type: 'tab',
            tabId: tab.id,
            of: tab.kind as 'board' | 'sheet',
          }),
          line: `Showed “${tab.name}” in row ${String(c['row'])}`,
        };
      }
      case 'clear_slot': {
        const [r, s] = slotIds(c);
        slotNow(l, r, s);
        return {
          layout: setDashboardContent(l, s, undefined),
          line: `Emptied ${slotWords(c)}`,
        };
      }
      default:
        throw new Stop(`A dashboard can’t take “${c.op}”.`);
    }
  };

  let now = layout;
  const lines: PlanAiLine[] = [];
  for (const change of changes) {
    try {
      const made = one(now, change);
      now = made.layout;
      lines.push({ text: made.line, ok: true });
    } catch (e) {
      if (!(e instanceof Stop)) throw e;
      lines.push({ text: e.message, ok: false });
      break;
    }
  }
  return { layout: now, lines };
}
