// Plan AI's changes to a sheet (docs/specs/026-plan/plan-ai.md "On a sheet"): change_sheet's changes, each checked
// against its schema and built exactly as an agent's is (buildSheetChange), in order on a copy of the workbook so each
// reads what the ones before it left. The cells go to the sheet store as one change (writeAll, one undo step), and the
// charts the changes add, clear or move go onto the tab as one element change (one more). The first change that
// can't be made stops the rest and says why; the ones before it are made. Pure but for `sink`.
import {
  buildSheetChange,
  chartsCleared,
  chartsFollowing,
  sheetChange,
  sheetChartElements,
  type SheetChartEl,
  type SheetChartOut,
} from '@liveplanner/agent-verbs/assist';
import type { Element } from '@liveplanner/project';
import type { PlanAiChange } from '@liveplanner/items';
import {
  applySheetWrite,
  NOBODY,
  Workbook,
  type GridRange,
  type SheetWrite,
} from '@liveplanner/sheets';
import { forPeople, unreadableChange, type PlanAiApplied, type PlanAiLine } from './plan-ai-lines';

type Frame = { x: number; y: number; width: number; height: number };

export type SheetSink = {
  // The store's writeAll: null when it took them, else why not.
  writeAll: (writes: readonly { sheetId: string; write: SheetWrite }[]) => string | null;
  commitElements: (map: (els: Element[]) => Element[]) => void;
};

/** A set as the AI may write one cell ("Put 250 in C4"): rows as one row's values ([250]) or one value (250, or
 *  `value`), read as the rows of values change_sheet takes ([[250]]). Any other change as written. */
export function asSheetChange(raw: PlanAiChange): PlanAiChange {
  if (raw.op !== 'set') return raw;
  const rows = raw['rows'] === undefined ? raw['value'] : raw['rows'];
  if (rows === undefined) return raw;
  if (!Array.isArray(rows)) return { ...raw, rows: [[rows]] };
  const list: readonly unknown[] = rows;
  if (list.length && list.every((r) => !Array.isArray(r))) return { ...raw, rows: [list] };
  return { ...raw, rows: list.map((r): unknown => (Array.isArray(r) ? (r as unknown[]) : [r])) };
}

/** Builds `changes` against `live` (the tab's workbook as it stands) and makes them through `sink`. */
export function applySheetChanges(input: {
  live: Workbook;
  locale: string;
  sheetId: string;
  changes: readonly PlanAiChange[];
  dark: boolean;
  frame: Frame | null;
  elements: readonly Element[];
  sink: SheetSink;
  rand?: () => number;
}): PlanAiApplied {
  const { live, sheetId, sink } = input;
  const wb = new Workbook({ sheets: live.sheetList(), locale: input.locale });
  const before = wb.sheet(sheetId);
  if (!before) return { lines: [{ text: 'That sheet isn’t open any more.', ok: false }], steps: 0 };
  const writes: { sheetId: string; write: SheetWrite }[] = [];
  const charts: SheetChartOut[] = [];
  const cleared: (GridRange | null)[] = [];
  const lines: PlanAiLine[] = [];
  for (const raw of input.changes) {
    const parsed = sheetChange.safeParse(asSheetChange(raw));
    if (!parsed.success) {
      lines.push({ text: unreadableChange(raw.op), ok: false });
      break;
    }
    const others = wb
      .sheetList()
      .filter((s) => s.id !== sheetId)
      .map((s) => s.title);
    const built = buildSheetChange(wb, sheetId, parsed.data, others, input.rand, {
      dark: input.dark,
    });
    if (!built.ok) {
      lines.push({ text: forPeople(built.message), ok: false });
      break;
    }
    for (const write of built.writes) {
      const sheet = wb.sheet(sheetId)!;
      wb.updateSheet(applySheetWrite(sheet, write, { now: Date.now(), by: NOBODY }).sheet);
      writes.push({ sheetId, write });
    }
    lines.push({ text: sentence(built.line), ok: true });
    charts.push(...(built.charts ?? []));
    if (built.clearCharts !== undefined) cleared.push(built.clearCharts);
  }

  let steps = 0;
  if (writes.length) {
    const refused = sink.writeAll(writes);
    if (refused)
      return { lines: [...lines.filter((l) => !l.ok), { text: refused, ok: false }], steps };
    steps++;
  }
  const after = wb.sheet(sheetId)!.layout;
  const els = input.elements as unknown as SheetChartEl[];
  const removed = new Set(cleared.flatMap((range) => chartsCleared(els, sheetId, after, range)));
  const moved = chartsFollowing(els, sheetId, before.layout, after).filter(
    (m) => !removed.has(m.id),
  );
  const added = input.frame ? sheetChartElements(wb, input.frame, sheetId, charts) : [];
  if (charts.length && !input.frame)
    lines.push({
      text: 'No Sheet on this tab shows the sheet, so its charts weren’t placed.',
      ok: false,
    });
  if (removed.size || moved.length || added.length) {
    const anchors = new Map(moved.map((m) => [m.id, m.sheetAnchor]));
    sink.commitElements((current) => [
      ...current
        .filter((el) => !removed.has(el.id))
        .map((el) => {
          const anchor = anchors.get(el.id);
          return anchor ? ({ ...el, sheetAnchor: anchor } as Element) : el;
        }),
      ...(added as Element[]),
    ]);
    steps++;
  }
  return { lines, steps };
}

// The builder's line ("set A1:B2") as the panel says it ("Set A1:B2").
const sentence = (line: string) => (line ? line[0]!.toUpperCase() + line.slice(1) : line);
