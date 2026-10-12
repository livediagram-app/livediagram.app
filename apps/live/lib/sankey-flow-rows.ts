// The Flows dialog's draft (docs/specs/009-elements/sankey.md "The Flows dialog"): the rows as typed, what
// they store as, why a row is not drawn, and which middle nodes do not balance. Pure, so the dialog only
// renders it.

import {
  cleanSankeyName,
  formatSankeyValue,
  readSankeyNumber,
  SANKEY_BALANCE_EPSILON,
  sankeyGraph,
  SANKEY_MAX_FLOWS,
  type SankeyFlow,
  type SankeySkipReason,
} from '@livediagram/document';

/** A row as typed: the amount stays text while it is written ("3,2" on its way to "3,200"). */
export type SankeyDraftRow = { key: number; from: string; to: string; value: string };

let nextKey = 1;
/** A fresh row key, unique for the page's life: rows are keyed by it, never by their position. */
export const rowKey = () => nextKey++;

export function rowsFromFlows(flows: readonly SankeyFlow[]): SankeyDraftRow[] {
  return flows.map((f) => ({
    key: rowKey(),
    from: f.from,
    to: f.to,
    value: Number.isFinite(f.value) ? String(f.value) : '',
  }));
}

export const isBlank = (r: SankeyDraftRow) => !r.from.trim() && !r.to.trim() && !r.value.trim();

/** Every row as a flow, blank or not, so a row's index is its flow's (the preview and the reasons). */
export function draftFlows(rows: readonly SankeyDraftRow[]): SankeyFlow[] {
  return rows.map((r) => {
    const n = readSankeyNumber(r.value);
    return { from: r.from, to: r.to, value: Number.isFinite(n) ? n : 0 };
  });
}

/** What is stored: the rows, less any left wholly blank (an added row nobody filled in yet). */
export function flowsToStore(rows: readonly SankeyDraftRow[]): SankeyFlow[] {
  return draftFlows(rows.filter((r) => !isBlank(r))).slice(0, SANKEY_MAX_FLOWS);
}

export const SKIP_REASON_COPY: Record<SankeySkipReason, string> = {
  'empty-name': 'Needs a From and a To',
  self: 'Flows into itself',
  value: 'Needs an amount above zero',
  loop: 'Loops back to an earlier node, so it is hidden',
  'too-many': 'Over the limit',
};

/** Why each row is not drawn, by row index; a wholly blank row is still being written, so it has none. */
export function rowReasons(rows: readonly SankeyDraftRow[]): Map<number, string> {
  const out = new Map<number, string>();
  for (const s of sankeyGraph(draftFlows(rows)).skipped) {
    const row = rows[s.flow];
    if (row && !isBlank(row)) out.set(s.flow, SKIP_REASON_COPY[s.reason]);
  }
  return out;
}

/**
 * The middle nodes whose in and out differ: the commonest mistake in a hand-made Sankey. While leftovers show,
 * a node that sends on less than it receives draws the rest as its leftover, so only one sending on more is noted.
 */
export function balanceNotes(
  rows: readonly SankeyDraftRow[],
  unit?: string,
  leftovers = false,
): string[] {
  return sankeyGraph(draftFlows(rows))
    .nodes.filter(
      (n) =>
        n.inflow > 0 &&
        n.outflow > 0 &&
        (leftovers
          ? n.outflow - n.inflow > SANKEY_BALANCE_EPSILON
          : Math.abs(n.inflow - n.outflow) > SANKEY_BALANCE_EPSILON),
    )
    .map(
      (n) =>
        `${n.name} receives ${formatSankeyValue(n.inflow, unit)} and sends ${formatSankeyValue(n.outflow, unit)}`,
    );
}

/** The node names typed so far, for the From / To suggestions. */
export function draftNodeNames(rows: readonly SankeyDraftRow[]): string[] {
  const seen = new Set<string>();
  for (const r of rows)
    for (const n of [r.from, r.to]) {
      const t = n.replace(/\s+/g, ' ').trim();
      if (t) seen.add(t);
    }
  return [...seen];
}

/** A row to add after `rows`: starting where the last one ended, since flows are written as a chain. */
export function nextRow(rows: readonly SankeyDraftRow[]): SankeyDraftRow {
  const last = rows[rows.length - 1];
  return { key: rowKey(), from: last?.to.trim() ?? '', to: '', value: '' };
}

/** Rows pasted over row `at`: replacing it when it is blank, else going in after it. */
export function pasteRows(
  rows: readonly SankeyDraftRow[],
  at: number,
  pasted: readonly SankeyFlow[],
): SankeyDraftRow[] {
  const incoming = rowsFromFlows(pasted);
  const replace = rows[at] && isBlank(rows[at]!) ? 1 : 0;
  const index = Math.min(rows.length, at + 1 - replace);
  return [...rows.slice(0, index), ...incoming, ...rows.slice(index + replace)].slice(
    0,
    SANKEY_MAX_FLOWS,
  );
}

/**
 * A new row sending from `name`, placed after that node's last flow (or after the last filled row), so stored
 * flows stay grouped and the Add a Flow line stays last.
 */
export function rowFrom(
  rows: readonly SankeyDraftRow[],
  name: string,
): { rows: SankeyDraftRow[]; row: SankeyDraftRow } {
  const row: SankeyDraftRow = { key: rowKey(), from: name, to: '', value: '' };
  const clean = cleanSankeyName(name);
  let at = rows.length;
  while (at > 0 && isBlank(rows[at - 1]!)) at--;
  rows.forEach((r, i) => {
    if (cleanSankeyName(r.from) === clean) at = i + 1;
  });
  return { rows: [...rows.slice(0, at), row, ...rows.slice(at)], row };
}

/**
 * The rows with one wholly blank row at the end, the Add a Flow area's empty line, unless the diagram is full.
 * A blank row is never stored (flowsToStore drops it), so it costs nothing to keep one ready.
 */
export function withTrailingBlank(rows: SankeyDraftRow[]): SankeyDraftRow[] {
  const last = rows[rows.length - 1];
  if (last && isBlank(last)) return rows;
  if (rows.filter((r) => !isBlank(r)).length >= SANKEY_MAX_FLOWS) return rows;
  return [...rows, { key: rowKey(), from: '', to: '', value: '' }];
}

/** How many rows hold something: what the counter counts and what is stored. */
export function filledRowCount(rows: readonly SankeyDraftRow[]): number {
  return rows.filter((r) => !isBlank(r)).length;
}
