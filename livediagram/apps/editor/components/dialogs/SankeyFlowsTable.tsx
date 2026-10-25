'use client';

// The Flows dialog's Table tab (docs/specs/009-elements/sankey.md "The Flows dialog"): the flows grouped as the
// diagram reads, left to right. A level per step of the diagram; in it, a group per node that sends something,
// listing where it sends (→ To and the Amount), with Send To… to add another. A row whose To sends nothing on
// yet has a + to carry on from it. The Add a Flow area under the levels always holds a blank line to fill in.
//
// The groups hold still while the cursor is in the table, so a row never jumps away mid-edit: they regroup when
// a row is added or removed, rows are pasted, or the cursor leaves the table. Built for the keyboard: Enter moves
// through a row's cells, then to the next row, and on the last row adds one; From and To suggest the names
// already in the diagram; pasting several lines into any cell fills in a row per line.

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ClipboardEvent,
  type FocusEvent,
  type KeyboardEvent,
} from 'react';
import {
  cleanSankeyName,
  formatSankeyValue,
  parseSankeyText,
  SANKEY_BALANCE_EPSILON,
  sankeyGraph,
  sankeyNodeLeftover,
  SANKEY_MAX_FLOWS,
  type ChartPaletteId,
  type SankeyNodeStyle,
} from '@livediagram/document';
import {
  draftFlows,
  draftNodeNames,
  filledRowCount,
  isBlank,
  pasteRows,
  rowFrom,
  rowReasons,
  type SankeyDraftRow,
} from '@/lib/sankey-flow-rows';
import { flowLevels, flowNodeColors, flowTotals } from '@/lib/sankey-flow-levels';
import { SankeyFlowRow, type FlowField } from '@/components/dialogs/SankeyFlowRow';
import { lucideGlyph, Switch } from '@livediagram/ui';
import { lucidePlus } from '@liveworkspace/icons/lucide';

const LOOSE_FIELDS: FlowField[] = ['from', 'to', 'value'];
const GROUPED_FIELDS: FlowField[] = ['to', 'value'];

// A node's Add a Flow row: full width, dashed, so it reads as the place the next flow goes.
const ADD_ROW =
  'mt-1.5 flex w-full items-center gap-1.5 rounded-md border border-dashed border-slate-300 bg-white/60 px-2.5 py-1.5 text-left text-xs font-medium text-slate-600 transition enabled:cursor-pointer enabled:hover:border-brand-400 enabled:hover:bg-brand-50 enabled:hover:text-brand-700 disabled:opacity-40 dark:border-slate-600 dark:bg-slate-900/40 dark:text-slate-300 dark:enabled:hover:border-brand-500/60 dark:enabled:hover:bg-brand-500/15 dark:enabled:hover:text-brand-200';
const PlusIcon = lucideGlyph(lucidePlus, 14);

const keySet = (rows: readonly SankeyDraftRow[]) => rows.map((r) => r.key).join(',');

export function SankeyFlowsTable({
  rows,
  unit,
  nodes,
  leftoverName,
  palette,
  chartPalette,
  onSetLeftover,
  onRows,
  onCommit,
}: {
  rows: SankeyDraftRow[];
  unit?: string;
  nodes?: readonly SankeyNodeStyle[];
  // The node leftovers run to while they show (docs/specs/009-elements/sankey.md "Leftovers"); absent when hidden.
  leftoverName?: string;
  palette?: readonly string[];
  chartPalette?: ChartPaletteId;
  // Switches one node's own leftover on or off (stored at once, one undo step).
  onSetLeftover: (name: string, on: boolean) => void;
  // A change while typing (redraws the preview); nothing is stored until onCommit.
  onRows: (rows: SankeyDraftRow[]) => void;
  // Store these rows: on a cell's blur, and at once for a structural change (add, remove, paste).
  onCommit: (rows: SankeyDraftRow[]) => void;
}) {
  const listId = useId();
  const inputs = useRef(new Map<string, HTMLInputElement>());
  // Where the cursor goes once the rows it is waiting for have rendered.
  const pendingFocus = useRef<string | null>(null);

  // The rows the groups were last drawn from. A different set of rows (added, removed, pasted, renamed from the
  // node strip, or the Add a Flow area's blank line filled in) regroups at once; an edit inside a row waits until
  // the cursor leaves the table. Rows being written in the Add a Flow area stay there until then too (`writing`).
  const [grouped, setGrouped] = useState(rows);
  const [writing, setWriting] = useState<ReadonlySet<number>>(() => new Set());
  const layout = useMemo(() => flowLevels(grouped, writing), [grouped, writing]);
  if (keySet(grouped) !== keySet(rows)) {
    setWriting(new Set(layout.loose.map(({ row }) => row.key)));
    setGrouped(rows);
  }

  const graph = useMemo(() => sankeyGraph(draftFlows(rows)), [rows]);
  const totals = useMemo(() => flowTotals(graph), [graph]);
  const colors = useMemo(
    () => flowNodeColors(graph, nodes, palette, chartPalette),
    [graph, nodes, palette, chartPalette],
  );
  const reasons = useMemo(() => rowReasons(rows), [rows]);
  const names = useMemo(() => draftNodeNames(rows), [rows]);
  const indexOf = useMemo(() => new Map(rows.map((r, i) => [r.key, i])), [rows]);

  // Every row in the order it is shown, with the source it sits under (null for a loose row).
  const shown = useMemo(
    () => [
      ...layout.levels.flatMap((l) =>
        l.sources.flatMap((s) => s.rows.map(({ row }) => ({ key: row.key, source: s.name }))),
      ),
      ...layout.loose.map(({ row }) => ({ key: row.key, source: null as string | null })),
    ],
    [layout],
  );

  useEffect(() => {
    const id = pendingFocus.current;
    if (!id) return;
    pendingFocus.current = null;
    const el = inputs.current.get(id);
    el?.focus();
    el?.select();
  }, [rows, grouped]);

  const focus = (key: number, field: FlowField) => {
    pendingFocus.current = `${key}:${field}`;
    const el = inputs.current.get(pendingFocus.current);
    if (el) {
      pendingFocus.current = null;
      el.focus();
      el.select();
    }
  };

  const set = (i: number, field: FlowField, value: string) =>
    onRows(rows.map((r, j) => (j === i ? { ...r, [field]: value } : r)));

  // A row sending from `name`, with the cursor in its To.
  const sendFrom = (name: string) => {
    if (rows.length >= SANKEY_MAX_FLOWS) return;
    const added = rowFrom(rows, name);
    onCommit(added.rows);
    pendingFocus.current = `${added.row.key}:to`;
  };

  const remove = (i: number) => {
    const key = rows[i]!.key;
    const at = shown.findIndex((s) => s.key === key);
    const neighbour = shown[at + 1] ?? shown[at - 1];
    onCommit(rows.filter((_, j) => j !== i));
    if (neighbour) pendingFocus.current = `${neighbour.key}:${neighbour.source ? 'to' : 'from'}`;
  };

  const onKey = (e: KeyboardEvent<HTMLInputElement>, i: number, field: FlowField) => {
    if (e.key !== 'Enter' || e.nativeEvent.isComposing) return;
    e.preventDefault();
    const key = rows[i]!.key;
    const at = shown.findIndex((s) => s.key === key);
    const here = shown[at];
    const fields = here?.source ? GROUPED_FIELDS : LOOSE_FIELDS;
    const f = fields.indexOf(field);
    if (f < fields.length - 1) return focus(key, fields[f + 1]!);
    // The next row shown; the last is always the Add a Flow area's blank line, while there is room for it.
    const next = shown[at + 1];
    if (next) return focus(next.key, next.source ? 'to' : 'from');
  };

  // Several lines (or a tab-separated row) pasted into a cell become rows; a plain word pastes as usual.
  const onPaste = (e: ClipboardEvent<HTMLInputElement>, i: number) => {
    const text = e.clipboardData.getData('text/plain');
    if (!/[\n\t]/.test(text.trim())) return;
    const { flows } = parseSankeyText(text);
    if (flows.length === 0) return;
    e.preventDefault();
    onCommit(pasteRows(rows, i, flows));
  };

  const cell = (i: number) => (field: FlowField) => {
    const key = rows[i]!.key;
    return {
      ref: (el: HTMLInputElement | null) => {
        const id = `${key}:${field}`;
        if (el) inputs.current.set(id, el);
        else inputs.current.delete(id);
      },
      onChange: (e: { target: { value: string } }) => set(i, field, e.target.value),
      onBlur: () => onCommit(rows),
      onKeyDown: (e: KeyboardEvent<HTMLInputElement>) => onKey(e, i, field),
      onPaste: (e: ClipboardEvent<HTMLInputElement>) => onPaste(e, i),
    };
  };

  // The cursor leaving the table lets the groups catch up with what was typed.
  const onTableBlur = (e: FocusEvent<HTMLDivElement>) => {
    if (e.currentTarget.contains(e.relatedTarget)) return;
    setWriting(new Set());
    setGrouped(rows);
  };

  // A row's To that sends nothing on yet (and is drawn) can be carried on from: one more step to the right.
  const sending = useMemo(
    () => new Set(graph.nodes.filter((n) => n.outflow > 0).map((n) => n.name)),
    [graph],
  );
  const carryOn = (r: SankeyDraftRow) => {
    const to = cleanSankeyName(r.to);
    if (!to || sending.has(to) || !totals.has(to) || full) return undefined;
    return () => sendFrom(to);
  };

  const filled = filledRowCount(rows);
  const full = filled >= SANKEY_MAX_FLOWS;
  const row = (key: number, withFrom: boolean) => {
    const i = indexOf.get(key);
    if (i === undefined) return null;
    const r = rows[i]!;
    return (
      <SankeyFlowRow
        key={key}
        n={i + 1}
        from={r.from}
        to={r.to}
        value={r.value}
        withFrom={withFrom}
        reason={reasons.get(i)}
        reasonId={`${listId}-why-${key}`}
        listId={listId}
        cell={cell(i)}
        onRemove={isBlank(r) ? undefined : () => remove(i)}
        onCarryOn={carryOn(r)}
      />
    );
  };

  return (
    <div onBlur={onTableBlur}>
      <datalist id={listId}>
        {names.map((n) => (
          <option key={n} value={n} />
        ))}
      </datalist>
      {unit ? (
        <p className="mb-1 text-right text-[11px] text-slate-500 dark:text-slate-400">
          Amounts in {unit}
        </p>
      ) : null}
      {layout.levels.length > 0 ? (
        <div className="flex flex-col gap-4">
          {layout.levels.map((level, li) => (
            <section key={level.step} aria-labelledby={`${listId}-step-${level.step}`}>
              <h3
                id={`${listId}-step-${level.step}`}
                className="mb-1.5 text-[11px] font-semibold text-slate-500 dark:text-slate-400"
              >
                Step {li + 1}
              </h3>
              <div className="flex flex-col gap-2">
                {level.sources.map((source, si) => {
                  const t = totals.get(source.name);
                  const diff = t && t.inflow > 0 ? t.inflow - t.outflow : 0;
                  // What this node keeps: drawn as its leftover unless switched off for it, a choice either
                  // way, so not flagged. Anything else unbalanced is worth a look.
                  const kept =
                    leftoverName !== undefined && diff > SANKEY_BALANCE_EPSILON ? diff : 0;
                  const keptOn = kept > 0 && sankeyNodeLeftover(nodes, source.name);
                  const differs = Math.abs(diff) > SANKEY_BALANCE_EPSILON && kept === 0;
                  return (
                    <div
                      key={source.name}
                      role="group"
                      aria-label={`Flows from ${source.name}`}
                      // The tour rings the first node's group alone: a ring round whole steps would cover the dialog.
                      data-tour-id={li === 0 && si === 0 ? 'sankey-rows' : undefined}
                      className="rounded-lg border border-slate-200 bg-slate-50/60 px-2.5 pb-1.5 pt-2 dark:border-slate-700 dark:bg-slate-800/40"
                    >
                      <div className="mb-1.5 flex items-center gap-2">
                        <span
                          aria-hidden
                          className="h-2.5 w-2.5 shrink-0 rounded-[3px] bg-slate-300 dark:bg-slate-600"
                          style={{ backgroundColor: colors.get(source.name) }}
                        />
                        <span className="text-optical-line min-w-0 flex-1 truncate text-sm font-medium text-slate-800 dark:text-slate-100">
                          {source.name}
                        </span>
                        {t ? (
                          <span
                            className={`shrink-0 text-[11px] tabular-nums ${
                              differs
                                ? 'text-amber-700 dark:text-amber-400'
                                : 'text-slate-500 dark:text-slate-400'
                            }`}
                          >
                            {t.inflow > 0 ? `In ${formatSankeyValue(t.inflow, unit)} · ` : ''}
                            Out {formatSankeyValue(t.outflow, unit)}
                          </span>
                        ) : null}
                      </div>
                      <ul className="flex flex-col gap-1.5">
                        {source.rows.map(({ row: r }) => row(r.key, false))}
                        {kept > 0 ? (
                          <li
                            className={`grid grid-cols-[auto_minmax(0,1fr)_5rem_4.375rem] items-center sm:grid-cols-[auto_minmax(0,1fr)_6.5rem_4.375rem] gap-x-1.5 text-sm transition ${
                              keptOn
                                ? 'text-slate-600 dark:text-slate-300'
                                : 'text-slate-400 dark:text-slate-400'
                            }`}
                          >
                            <span
                              aria-hidden
                              className="w-[15px] border-t border-dashed border-current"
                            />
                            <span
                              className={`truncate px-2 italic ${keptOn ? '' : 'line-through'}`}
                            >
                              {leftoverName}
                            </span>
                            <span className="px-2 text-right tabular-nums">
                              {formatSankeyValue(kept)}
                            </span>
                            <span className="flex justify-end">
                              <Switch
                                size="sm"
                                checked={keptOn}
                                label={`Draw ${formatSankeyValue(kept, unit)} not sent on from ${source.name} as ${leftoverName}`}
                                onChange={() => onSetLeftover(source.name, !keptOn)}
                              />
                            </span>
                          </li>
                        ) : null}
                      </ul>
                      {/* On the rows' grid, so it lines up under their To and Amount boxes. */}
                      <div className="grid grid-cols-[auto_minmax(0,1fr)_5rem_2rem_2rem] gap-x-1.5 sm:grid-cols-[auto_minmax(0,1fr)_6.5rem_2rem_2rem]">
                        <span aria-hidden className="w-[15px]" />
                        <button
                          type="button"
                          className={`${ADD_ROW} col-span-2`}
                          disabled={full}
                          onClick={() => sendFrom(source.name)}
                        >
                          <PlusIcon />
                          <span className="text-optical-line min-w-0 truncate">
                            Add a Flow From {source.name}
                          </span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      ) : null}
      <section
        aria-labelledby={`${listId}-new`}
        data-tour-id="sankey-add-flow"
        className={`rounded-lg border-2 border-dashed border-brand-200 bg-brand-50/40 px-3 pb-2.5 pt-2 dark:border-brand-500/30 dark:bg-brand-500/5 ${
          layout.levels.length > 0 ? 'mt-4' : ''
        }`}
      >
        <div className="mb-1.5 flex items-baseline justify-between gap-2">
          <h3
            id={`${listId}-new`}
            className="text-sm font-semibold text-brand-700 dark:text-brand-300"
          >
            Add a Flow
          </h3>
          <span className="text-[11px] text-slate-500 tabular-nums dark:text-slate-400">
            {filled} of {SANKEY_MAX_FLOWS}
          </span>
        </div>
        <p className="mb-2 text-xs text-slate-500 dark:text-slate-400">
          {full
            ? 'The diagram holds as many flows as it can.'
            : layout.levels.length > 0
              ? 'From a new starting node, or any node above. It moves to its step when you are done.'
              : 'Write the first flow: where it starts, where it goes, and how much. Or paste rows from a spreadsheet.'}
        </p>
        <ul className="flex flex-col gap-1.5">
          {layout.loose.map(({ row: r }) => row(r.key, true))}
        </ul>
      </section>
    </div>
  );
}
