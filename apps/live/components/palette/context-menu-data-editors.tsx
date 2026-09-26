import { useEffect, useState, type ReactNode } from 'react';
import {
  CHECKLIST_MAX_ITEMS,
  CHECKLIST_MAX_TEXT,
  ENTITY_MAX_FIELDS,
  ENTITY_MAX_TEXT,
  type EntityField,
  PIE_PALETTE,
  type ChecklistItem,
  type LegendItem,
  MIND_FLOWS,
  MIND_FLOW_HINT,
  MIND_FLOW_LABEL,
  type MindFlow,
  type LineSeries,
  type PieSlice,
} from '@livediagram/diagram';
import { hexish } from '@/components/palette/palette-controls';
import { MenuTile, MenuTileGrid } from '@/components/primitives/PortalMenu';
import { MenuToggleRow } from '@/components/palette/context-menu-input-rows';

// Pie-chart data editor (spec/53): one row per slice — a colour swatch
// (recolourable), a label, and a value — plus add / remove. Local draft while
// typing; commits the whole array on blur / structural change (one undo step).
export function PieDataEditor({
  slices,
  palette = PIE_PALETTE,
  onChange,
}: {
  slices: PieSlice[];
  // The ramp an uncoloured slice falls back to, so the swatches here match
  // the chart. Defaults to the built-in one, which is what this showed
  // before chart palettes existed.
  palette?: readonly string[];
  onChange: (slices: PieSlice[]) => void;
}) {
  const [rows, setRows] = useState<PieSlice[]>(slices);
  useEffect(() => setRows(slices), [slices]);
  const colorAt = (i: number, s: PieSlice) => s.color ?? palette[i % palette.length]!;
  const patch = (i: number, p: Partial<PieSlice>) =>
    setRows((r) => r.map((s, j) => (j === i ? { ...s, ...p } : s)));
  // Compact bordered field for the slice rows. The line editor lives in its own
  // (roomier) dialog now, so this is no longer shared.
  const cellInput =
    'min-w-0 rounded border border-slate-200 bg-white px-1 py-0.5 text-[11px] text-slate-700 outline-none focus:border-brand-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200';
  return (
    <div className="px-2 py-1.5">
      <div className="flex flex-col gap-1">
        {rows.map((s, i) => (
          <div key={i} className="flex items-center gap-1">
            <label
              className="relative h-4 w-4 shrink-0 cursor-pointer rounded-[3px] border border-slate-300 dark:border-slate-600"
              style={{ backgroundColor: colorAt(i, s) }}
              aria-label="Slice colour"
            >
              <input
                type="color"
                value={hexish(colorAt(i, s))}
                onChange={(e) =>
                  onChange(rows.map((r, j) => (j === i ? { ...r, color: e.target.value } : r)))
                }
                className="absolute h-0 w-0 opacity-0"
              />
            </label>
            <input
              className={`${cellInput} flex-1`}
              value={s.label}
              placeholder="Label"
              onChange={(e) => patch(i, { label: e.target.value })}
              onBlur={() => onChange(rows)}
            />
            <input
              className={`${cellInput} w-12 text-right tabular-nums`}
              type="number"
              min={0}
              value={s.value}
              aria-label="Value"
              onChange={(e) => patch(i, { value: Math.max(0, Number(e.target.value) || 0) })}
              onBlur={() => onChange(rows)}
            />
            <button
              type="button"
              aria-label="Remove slice"
              disabled={rows.length <= 1}
              onClick={() => onChange(rows.filter((_, j) => j !== i))}
              className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-slate-400 transition enabled:cursor-pointer enabled:hover:bg-rose-50 enabled:hover:text-rose-600 disabled:opacity-30 dark:enabled:hover:bg-rose-500/15"
            >
              ×
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={() => onChange([...rows, { label: `Item ${rows.length + 1}`, value: 10 }])}
        className="mt-1.5 inline-flex w-full cursor-pointer items-center justify-center rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 transition hover:border-brand-300 hover:bg-brand-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-brand-500/60 dark:hover:bg-brand-500/15"
      >
        + Add slice
      </button>
    </div>
  );
}

// Legend rows editor (spec/53): a colour dot, a label, remove, and add. The
// same shape as the pie editor minus the value, because a legend is a key: it
// says what a colour means and nothing about how much of it there is.
export function LegendDataEditor({
  items,
  palette = PIE_PALETTE,
  onChange,
}: {
  items: LegendItem[];
  // What a row with no colour of its own shows, so the editor's dots match
  // the card.
  palette?: readonly string[];
  onChange: (items: LegendItem[]) => void;
}) {
  const [rows, setRows] = useState<LegendItem[]>(items);
  useEffect(() => setRows(items), [items]);
  const colorAt = (i: number, item: LegendItem) => item.color ?? palette[i % palette.length]!;
  const cellInput =
    'min-w-0 rounded border border-slate-200 bg-white px-1 py-0.5 text-[11px] text-slate-700 outline-none focus:border-brand-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200';
  return (
    <div className="px-2 py-1.5">
      <div className="flex flex-col gap-1">
        {rows.map((item, i) => (
          <div key={i} className="flex items-center gap-1">
            <label
              // Round, matching the swatch on the card rather than the pie
              // editor's square chip: the editor should look like the thing
              // it edits.
              className="relative h-4 w-4 shrink-0 cursor-pointer rounded-full border border-slate-300 dark:border-slate-600"
              style={{ backgroundColor: colorAt(i, item) }}
              aria-label="Legend colour"
            >
              <input
                type="color"
                value={hexish(colorAt(i, item))}
                onChange={(e) =>
                  onChange(rows.map((r, j) => (j === i ? { ...r, color: e.target.value } : r)))
                }
                className="absolute h-0 w-0 opacity-0"
              />
            </label>
            <input
              className={`${cellInput} flex-1`}
              value={item.label}
              placeholder="Label"
              onChange={(e) =>
                setRows((r) => r.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))
              }
              onBlur={() => onChange(rows)}
            />
            <button
              type="button"
              aria-label="Remove legend row"
              disabled={rows.length <= 1}
              onClick={() => onChange(rows.filter((_, j) => j !== i))}
              className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-slate-400 transition enabled:cursor-pointer enabled:hover:bg-rose-50 enabled:hover:text-rose-600 disabled:opacity-30 dark:enabled:hover:bg-rose-500/15"
            >
              ×
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        // No colour on the new row, so it takes the next one from the ramp.
        onClick={() => onChange([...rows, { label: `Item ${rows.length + 1}` }])}
        className="mt-1.5 inline-flex w-full cursor-pointer items-center justify-center rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 transition hover:border-brand-300 hover:bg-brand-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-brand-500/60 dark:hover:bg-brand-500/15"
      >
        Add row
      </button>
    </div>
  );
}

// Line-chart data summary (spec/53): the 2-D grid is too wide for the narrow
// menu, so the Data category just lists the series (a colour dot + name) and an
// "Edit data" button that opens the full grid + CSV import in a modal.
export function LineDataSummary({
  series,
  palette = PIE_PALETTE,
  onEdit,
}: {
  series: LineSeries[];
  // See PieDataEditor: the fallback ramp, so the dots match the chart.
  palette?: readonly string[];
  onEdit: () => void;
}) {
  return (
    <div className="px-2 py-1.5">
      <div className="flex flex-col gap-1">
        {series.map((s, i) => (
          <div
            key={i}
            className="flex items-center gap-1.5 text-[11px] text-slate-700 dark:text-slate-200"
          >
            <span
              className="inline-block h-2.5 w-2.5 shrink-0 rounded-[2px]"
              style={{ backgroundColor: s.color ?? palette[i % palette.length]! }}
            />
            <span className="truncate">{s.name || `Series ${i + 1}`}</span>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={onEdit}
        className="mt-1.5 inline-flex w-full cursor-pointer items-center justify-center rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 transition hover:border-brand-300 hover:bg-brand-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-brand-500/60 dark:hover:bg-brand-500/15"
      >
        Edit data
      </button>
    </div>
  );
}

// Checklist rows editor (spec/83): one row per item — a done toggle, the row
// text, and remove — plus add. Same draft-while-typing / commit-on-blur
// contract as PieDataEditor (one undo step per blur / structural change).
// A record's fields (spec/120): one row per `name: Type`. Mirrors the
// checklist editor below — same shape of problem (a bounded list of short
// strings edited in a narrow menu), so same shape of control.
export function EntityFieldsEditor({
  fields,
  onChange,
}: {
  fields: EntityField[];
  onChange: (fields: EntityField[]) => void;
}) {
  const [rows, setRows] = useState<EntityField[]>(fields);
  useEffect(() => setRows(fields), [fields]);
  const cellInput =
    'min-w-0 rounded border border-slate-200 bg-white px-1 py-0.5 text-[11px] text-slate-700 outline-none focus:border-brand-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200';
  return (
    <div className="px-2 py-1.5">
      <div className="flex flex-col gap-1">
        {rows.map((f, i) => (
          <div key={i} className="flex items-center gap-1">
            <input
              className={`${cellInput} flex-1`}
              value={f.name}
              placeholder="name"
              aria-label={`Field ${i + 1} name`}
              maxLength={ENTITY_MAX_TEXT}
              onChange={(e) =>
                setRows((r) => r.map((s, j) => (j === i ? { ...s, name: e.target.value } : s)))
              }
              onBlur={() => onChange(rows)}
            />
            <input
              className={`${cellInput} w-[5.5rem]`}
              value={f.type ?? ''}
              placeholder="type"
              aria-label={`Field ${i + 1} type`}
              maxLength={ENTITY_MAX_TEXT}
              onChange={(e) =>
                setRows((r) =>
                  // Empty stores as undefined, so a row without a type
                  // round-trips identically to one that never had one.
                  r.map((s, j) => (j === i ? { ...s, type: e.target.value || undefined } : s)),
                )
              }
              onBlur={() => onChange(rows)}
            />
            <button
              type="button"
              aria-label="Remove field"
              onClick={() => onChange(rows.filter((_, j) => j !== i))}
              className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/15"
            >
              ×
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        disabled={rows.length >= ENTITY_MAX_FIELDS}
        onClick={() => onChange([...rows, { name: '' }])}
        className="mt-1.5 inline-flex w-full items-center justify-center rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 transition enabled:cursor-pointer enabled:hover:border-brand-300 enabled:hover:bg-brand-50 disabled:opacity-40 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:enabled:hover:border-brand-500/60 dark:enabled:hover:bg-brand-500/15"
      >
        Add field
      </button>
    </div>
  );
}

export function ChecklistRowsEditor({
  items,
  onChange,
  onToggle,
}: {
  items: ChecklistItem[];
  onChange: (items: ChecklistItem[]) => void;
  // Tick one row as its own delta (spec/152). Without it, the tick rewrites
  // the rows like every other edit here.
  onToggle?: (index: number) => void;
}) {
  const [rows, setRows] = useState<ChecklistItem[]>(items);
  useEffect(() => setRows(items), [items]);
  const cellInput =
    'min-w-0 rounded border border-slate-200 bg-white px-1 py-0.5 text-[11px] text-slate-700 outline-none focus:border-brand-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200';
  return (
    <div className="px-2 py-1.5">
      <div className="flex flex-col gap-1">
        {rows.map((item, i) => (
          <div key={i} className="flex items-center gap-1">
            <input
              type="checkbox"
              checked={item.done}
              aria-label={`Row ${i + 1} done`}
              onChange={(e) =>
                onToggle
                  ? onToggle(i)
                  : onChange(rows.map((r, j) => (j === i ? { ...r, done: e.target.checked } : r)))
              }
              className="h-3.5 w-3.5 shrink-0 cursor-pointer accent-brand-500"
            />
            <input
              className={`${cellInput} flex-1`}
              value={item.text}
              placeholder="Task"
              maxLength={CHECKLIST_MAX_TEXT}
              onChange={(e) =>
                setRows((r) => r.map((s, j) => (j === i ? { ...s, text: e.target.value } : s)))
              }
              onBlur={() => onChange(rows)}
            />
            <button
              type="button"
              aria-label="Remove row"
              disabled={rows.length <= 1}
              onClick={() => onChange(rows.filter((_, j) => j !== i))}
              className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-slate-400 transition enabled:cursor-pointer enabled:hover:bg-rose-50 enabled:hover:text-rose-600 disabled:opacity-30 dark:enabled:hover:bg-rose-500/15"
            >
              ×
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        disabled={rows.length >= CHECKLIST_MAX_ITEMS}
        onClick={() => onChange([...rows, { text: '', done: false }])}
        className="mt-1.5 inline-flex w-full items-center justify-center rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 transition enabled:cursor-pointer enabled:hover:border-brand-300 enabled:hover:bg-brand-50 disabled:opacity-40 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:enabled:hover:border-brand-500/60 dark:enabled:hover:bg-brand-500/15"
      >
        + Add row
      </button>
    </div>
  );
}

// Code block summary (spec/82): a multi-line editor is too big for the menu,
// so the Code category shows the language + line count and an "Edit code"
// button that opens the modal — the LineDataSummary pattern.
export function CodeSummary({
  code,
  language,
  wrap,
  onSetWrap,
  onEdit,
}: {
  code: string;
  language: string;
  // Long-line wrapping (spec/82). On by default, so this is the switch that
  // turns it OFF for the rare block whose lines mean something at their full
  // length (a table of fixed columns, say).
  wrap: boolean;
  onSetWrap: (wrap: boolean) => void;
  onEdit: () => void;
}) {
  const lineCount = code.trim().length === 0 ? 0 : code.split('\n').length;
  return (
    <div className="px-2 py-1.5">
      <p className="text-[11px] text-slate-700 dark:text-slate-200">
        {lineCount === 0
          ? 'No code yet'
          : `${lineCount} ${lineCount === 1 ? 'line' : 'lines'} · ${language === 'plain' ? 'plain text' : language}`}
      </p>
      <button
        type="button"
        onClick={onEdit}
        className="mt-1.5 inline-flex w-full cursor-pointer items-center justify-center rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 transition hover:border-brand-300 hover:bg-brand-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-brand-500/60 dark:hover:bg-brand-500/15"
      >
        Edit code
      </button>
      <div className="-mx-2 mt-1">
        <MenuToggleRow label="Wrap Long Lines" checked={wrap} onToggle={() => onSetWrap(!wrap)} />
      </div>
    </div>
  );
}

// Mind-map flow tiles (spec/118): the shape the map grows in. Drawn rather
// than named, because "Balanced" and "Bubble" mean nothing until you see the
// arrangement; each glyph is the branch pattern its flow produces.
const MIND_FLOW_ICON: Record<MindFlow, ReactNode> = {
  tree: (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden>
      <rect x="1.5" y="9" width="7" height="6" rx="1.5" fill="currentColor" />
      <rect x="15" y="3" width="7.5" height="5" rx="1.5" fill="currentColor" opacity="0.55" />
      <rect x="15" y="16" width="7.5" height="5" rx="1.5" fill="currentColor" opacity="0.55" />
      <path d="M8.5 12H12V5.5h3M12 12v6h3" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  ),
  balanced: (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden>
      <rect x="8.5" y="9.5" width="7" height="5" rx="1.5" fill="currentColor" />
      <rect x="0.5" y="3" width="6" height="4.5" rx="1.5" fill="currentColor" opacity="0.55" />
      <rect x="0.5" y="16.5" width="6" height="4.5" rx="1.5" fill="currentColor" opacity="0.55" />
      <rect x="17.5" y="3" width="6" height="4.5" rx="1.5" fill="currentColor" opacity="0.55" />
      <rect x="17.5" y="16.5" width="6" height="4.5" rx="1.5" fill="currentColor" opacity="0.55" />
      <path
        d="M8.5 12H6.5V5.25M8.5 12H6.5v6.75M15.5 12h2V5.25M15.5 12h2v6.75"
        stroke="currentColor"
        strokeWidth="1.3"
      />
    </svg>
  ),
  downward: (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden>
      <rect x="8.5" y="1.5" width="7" height="5" rx="1.5" fill="currentColor" />
      <rect x="1.5" y="16" width="7" height="5" rx="1.5" fill="currentColor" opacity="0.55" />
      <rect x="15" y="16" width="7.5" height="5" rx="1.5" fill="currentColor" opacity="0.55" />
      <path d="M12 6.5v5H5v4.5M12 11.5h7v4.5" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  ),
  bubble: (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="4" fill="currentColor" />
      <circle cx="12" cy="3" r="2.4" fill="currentColor" opacity="0.55" />
      <circle cx="20" cy="9" r="2.4" fill="currentColor" opacity="0.55" />
      <circle cx="17" cy="19.5" r="2.4" fill="currentColor" opacity="0.55" />
      <circle cx="4.5" cy="16" r="2.4" fill="currentColor" opacity="0.55" />
      <path
        d="M12 8V5.4M15.7 10.2l2.2-1.6M14.2 15.3l1.9 2.4M8.7 13.6l-2.4 1.2"
        stroke="currentColor"
        strokeWidth="1.3"
      />
    </svg>
  ),
};

export function MindFlowTiles({
  current,
  onSet,
}: {
  current: MindFlow;
  onSet: (flow: MindFlow) => void;
}) {
  return (
    <>
      <p className="px-3 pt-1 text-[10px] font-medium text-slate-500 dark:text-slate-400">
        {MIND_FLOW_HINT[current]}
      </p>
      {/* Two per row: four tiles across a menu column squeezed the labels
          into each other ("BalancedDownward"). */}
      <MenuTileGrid cols={2}>
        {MIND_FLOWS.map((flow) => (
          <MenuTile
            key={flow}
            icon={MIND_FLOW_ICON[flow]}
            label={MIND_FLOW_LABEL[flow]}
            active={current === flow}
            onClick={() => onSet(flow)}
          />
        ))}
      </MenuTileGrid>
    </>
  );
}
