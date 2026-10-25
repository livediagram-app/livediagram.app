import { Button } from '@liveplanner/ui';
import {
  CHECKLIST_MAX_ITEMS,
  CHECKLIST_MAX_TEXT,
  PIE_PALETTE,
  type ChecklistItem,
  type LegendItem,
  type LineSeries,
  type PieSlice,
} from '@liveplanner/project';
import { ColourSwatchButton } from '@/components/colour/ColourSwatchButton';
import { standardGroup } from '@/components/colour/colour-options';
import { useProjectColours } from '@/hooks/ui/useProjectColours';
import { MenuToggleRow } from '@/components/palette/context-menu-input-rows';
import { useFollowingDraft } from '@liveworkspace/workbench/hooks/ui/useFollowingDraft';
import { MENU_ADD_ROW_BUTTON, MENU_CELL_INPUT } from './menu-editor-classes';

// A data row's colour (a pie slice, a legend row): its chip, shaped like the chart's own, opening
// the one colour picker (docs/specs/004-interface-design/colour-picker.md): the strong standard
// colours by hex, Custom colours and +.
function DataColour({
  label,
  value,
  shown,
  shape,
  onPick,
}: {
  label: string;
  // The row's own colour, if it has one; `shown` falls back to the chart's palette.
  value: string | undefined;
  shown: string;
  shape: string;
  onPick: (color: string) => void;
}) {
  const yours = useProjectColours();
  return (
    <ColourSwatchButton
      label={label}
      value={value ?? null}
      swatch={shown}
      standard={[standardGroup('strong', 'light', 'hex')]}
      yours={yours}
      className="h-5 w-5"
      onPick={onPick}
    >
      <span
        aria-hidden
        className={`h-4 w-4 border border-slate-300 dark:border-slate-600 ${shape}`}
        style={{ backgroundColor: shown }}
      />
    </ColourSwatchButton>
  );
}

// Pie-chart data editor (docs/specs/009-elements/pie-chart.md): one row per slice — a colour swatch
// (recolourable), a label, and a value — plus add / remove. Local draft while
// typing, re-seeded during render when the slices change underneath (every editor here does the
// same); commits the whole array on blur / structural change (one undo step).
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
  const [rows, setRows] = useFollowingDraft<PieSlice[]>(slices);
  const colorAt = (i: number, s: PieSlice) => s.color ?? palette[i % palette.length]!;
  const patch = (i: number, p: Partial<PieSlice>) =>
    setRows((r) => r.map((s, j) => (j === i ? { ...s, ...p } : s)));
  return (
    <div className="px-2 py-1.5">
      <div className="flex flex-col gap-1">
        {rows.map((s, i) => (
          <div key={i} className="flex items-center gap-1">
            <DataColour
              label="Slice colour"
              value={s.color}
              shown={colorAt(i, s)}
              shape="rounded-[3px]"
              onPick={(color) => onChange(rows.map((r, j) => (j === i ? { ...r, color } : r)))}
            />
            <input
              className={`${MENU_CELL_INPUT} flex-1`}
              value={s.label}
              placeholder="Label"
              onChange={(e) => patch(i, { label: e.target.value })}
              onBlur={() => onChange(rows)}
            />
            <input
              className={`${MENU_CELL_INPUT} w-12 text-right tabular-nums`}
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
              className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-slate-400 transition enabled:cursor-pointer enabled:hover:bg-slate-100 enabled:hover:text-slate-700 disabled:opacity-30 dark:enabled:hover:bg-slate-800"
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
        + Add Slice
      </button>
    </div>
  );
}

// Legend rows editor (docs/specs/009-elements/pie-chart.md): a colour dot, a label, remove, and add. The
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
  const [rows, setRows] = useFollowingDraft<LegendItem[]>(items);
  const colorAt = (i: number, item: LegendItem) => item.color ?? palette[i % palette.length]!;
  return (
    <div className="px-2 py-1.5">
      <div className="flex flex-col gap-1">
        {rows.map((item, i) => (
          <div key={i} className="flex items-center gap-1">
            <DataColour
              label="Legend colour"
              value={item.color}
              shown={colorAt(i, item)}
              // Round, matching the swatch on the card rather than the pie
              // editor's square chip: the editor should look like the thing
              // it edits.
              shape="rounded-full"
              onPick={(color) => onChange(rows.map((r, j) => (j === i ? { ...r, color } : r)))}
            />
            <input
              className={`${MENU_CELL_INPUT} flex-1`}
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
              className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-slate-400 transition enabled:cursor-pointer enabled:hover:bg-slate-100 enabled:hover:text-slate-700 disabled:opacity-30 dark:enabled:hover:bg-slate-800"
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
        Add Row
      </button>
    </div>
  );
}

// Line-chart data summary (docs/specs/009-elements/pie-chart.md): the 2-D grid is too wide for the narrow
// menu, so the Data category just lists the series (a colour dot + name) and an
// "Edit Data" button that opens the full grid + CSV import in a modal.
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
            {s.axis === 'right' ? (
              <span className="shrink-0 text-slate-500 dark:text-slate-400">(right)</span>
            ) : null}
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={onEdit}
        className="mt-1.5 inline-flex w-full cursor-pointer items-center justify-center rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 transition hover:border-brand-300 hover:bg-brand-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-brand-500/60 dark:hover:bg-brand-500/15"
      >
        Edit Data
      </button>
    </div>
  );
}

// A chart drawn from a sheet range (docs/specs/029-sheets/sheet.md "Charts"): its data is the sheet's, edited
// there, so the Data category says so and offers Unlink, which keeps the last read as an ordinary chart's data.
export function LinkedChartData({ onUnlink }: { onUnlink: () => void }) {
  return (
    <div className="px-2 py-1.5">
      <p className="text-[11px] leading-snug text-slate-600 dark:text-slate-300">
        Drawn live from a Sheet&apos;s cells. Change the cells to change the chart.
      </p>
      <Button variant="secondary" size="xs" className="mt-1.5 w-full" onClick={onUnlink}>
        Unlink From Sheet
      </Button>
    </div>
  );
}

// Checklist rows editor (docs/specs/009-elements/checklist.md): one row per item — a done toggle, the row
// text, and remove — plus add. Same draft-while-typing / commit-on-blur
// contract as PieDataEditor (one undo step per blur / structural change).
export function ChecklistRowsEditor({
  items,
  onChange,
  onToggle,
}: {
  items: ChecklistItem[];
  onChange: (items: ChecklistItem[]) => void;
  // Tick one row as its own delta (docs/specs/012-collaboration/collab-race-hardening.md). Without it, the tick rewrites
  // the rows like every other edit here.
  onToggle?: (index: number) => void;
}) {
  const [rows, setRows] = useFollowingDraft<ChecklistItem[]>(items);
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
              className={`${MENU_CELL_INPUT} flex-1`}
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
              className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-slate-400 transition enabled:cursor-pointer enabled:hover:bg-slate-100 enabled:hover:text-slate-700 disabled:opacity-30 dark:enabled:hover:bg-slate-800"
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
        className={MENU_ADD_ROW_BUTTON}
      >
        + Add Row
      </button>
    </div>
  );
}

// Code block summary (docs/specs/009-elements/code-block.md): a multi-line editor is too big for the menu,
// so the Code category shows the language + line count and an "Edit Code"
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
  // Long-line wrapping (docs/specs/009-elements/code-block.md). On by default, so this is the switch that
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
        Edit Code
      </button>
      <div className="-mx-2 mt-1">
        <MenuToggleRow label="Wrap Long Lines" checked={wrap} onToggle={() => onSetWrap(!wrap)} />
      </div>
    </div>
  );
}
