import { CloseIcon } from '@livediagram/ui';
import { CHECKLIST_MAX_ITEMS, CHECKLIST_MAX_TEXT, PIE_PALETTE, type ChecklistItem, type LegendItem, type LineSeries, type PieSlice } from '@livediagram/document';
import { ColourSwatchButton } from '@/components/colour/ColourSwatchButton';
import { standardGroup } from '@/components/colour/colour-options';
import { useDocumentColours } from '@/hooks/ui/useDocumentColours';
import { NumberDraftInput } from '@/components/primitives/NumberDraftInput';
import { useFollowingDraft } from '@liveworkspace/workbench/hooks/ui/useFollowingDraft';
import { useRowMotion } from '@liveworkspace/workbench/hooks/ui/useRowMotion';

// The rows' controls at a dialog's size (canvas-and-palette.md "A category that opens a dialog"): 36px tall, 14px
// text (16px on a phone, the app's anti-zoom rule), so a finger lands on each.
const CELL =
  'h-9 min-w-0 rounded-md border border-slate-200 bg-white px-2.5 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-brand-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100';
const REMOVE_ROW =
  'flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-lg leading-none text-slate-400 transition enabled:cursor-pointer enabled:hover:bg-slate-100 enabled:hover:text-slate-700 disabled:opacity-30 dark:enabled:hover:bg-slate-800 dark:enabled:hover:text-slate-200';
const ADD_ROW =
  'mt-1 inline-flex h-9 w-full items-center justify-center rounded-md border border-dashed border-slate-300 text-sm font-medium text-slate-600 transition enabled:cursor-pointer enabled:hover:border-brand-400 enabled:hover:bg-brand-50/50 enabled:hover:text-brand-700 disabled:opacity-40 dark:border-slate-700 dark:text-slate-300 dark:enabled:hover:border-brand-500 dark:enabled:hover:bg-brand-500/10 dark:enabled:hover:text-brand-200';

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
  const yours = useDocumentColours();
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
  allowNegative = false,
  onChange,
}: {
  slices: PieSlice[];
  // A column or bar chart draws below zero (pie-chart.md "Below zero on a column or bar chart"); only a pie's
  // values stop at zero.
  allowNegative?: boolean;
  // The ramp an uncoloured slice falls back to, so the swatches here match
  // the chart. Defaults to the built-in one, which is what this showed
  // before chart palettes existed.
  palette?: readonly string[];
  onChange: (slices: PieSlice[]) => void;
}) {
  const [rows, setRows] = useFollowingDraft<PieSlice[]>(slices);
  // Rows slide in and out (docs/specs/004-interface-design/motion.md "Rows that come and go").
  const motion = useRowMotion();
  const colorAt = (i: number, s: PieSlice) => s.color ?? palette[i % palette.length]!;
  const patch = (i: number, p: Partial<PieSlice>) =>
    setRows((r) => r.map((s, j) => (j === i ? { ...s, ...p } : s)));
  return (
    <div>
      <div className="flex flex-col">
        {rows.map((s, i) => (
          // Its own bottom padding, not a gap on the list, so a row sliding out takes its spacing with it.
          <div key={i} {...motion.rowProps(i)}>
            <div className="flex items-center gap-2 pb-2">
              <DataColour
                label={`Slice ${i + 1} colour`}
                value={s.color}
                shown={colorAt(i, s)}
                shape="rounded-[3px]"
                onPick={(color) => onChange(rows.map((r, j) => (j === i ? { ...r, color } : r)))}
              />
              <input
                className={`${CELL} flex-1`}
                value={s.label}
                placeholder="Label"
                aria-label={`Slice ${i + 1} label`}
                onChange={(e) => patch(i, { label: e.target.value })}
                onBlur={() => onChange(rows)}
              />
              <NumberDraftInput
                className={`${CELL} w-20 text-right tabular-nums`}
                value={s.value}
                min={allowNegative ? undefined : 0}
                aria-label={`Slice ${i + 1} value`}
                onValue={(value) => patch(i, { value })}
                onBlur={() => onChange(rows)}
              />
              <button
                type="button"
                aria-label={`Remove slice ${i + 1}`}
                disabled={rows.length <= 1}
                onClick={() => motion.leave(i, () => onChange(rows.filter((_, j) => j !== i)))}
                className={REMOVE_ROW}
              >
                <CloseIcon size={12} />
              </button>
            </div>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={() => {
          motion.enter(rows.length);
          onChange([...rows, { label: `Item ${rows.length + 1}`, value: 10 }]);
        }}
        className={ADD_ROW}
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
  // Rows slide in and out (docs/specs/004-interface-design/motion.md "Rows that come and go").
  const motion = useRowMotion();
  const colorAt = (i: number, item: LegendItem) => item.color ?? palette[i % palette.length]!;
  return (
    <div>
      <div className="flex flex-col">
        {rows.map((item, i) => (
          // Its own bottom padding, not a gap on the list, so a row sliding out takes its spacing with it.
          <div key={i} {...motion.rowProps(i)}>
            <div className="flex items-center gap-2 pb-2">
              <DataColour
                label={`Legend row ${i + 1} colour`}
                value={item.color}
                shown={colorAt(i, item)}
                // Round, matching the swatch on the card rather than the pie
                // editor's square chip: the editor should look like the thing
                // it edits.
                shape="rounded-full"
                onPick={(color) => onChange(rows.map((r, j) => (j === i ? { ...r, color } : r)))}
              />
              <input
                className={`${CELL} flex-1`}
                value={item.label}
                placeholder="Label"
                aria-label={`Legend row ${i + 1} label`}
                onChange={(e) =>
                  setRows((r) => r.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))
                }
                onBlur={() => onChange(rows)}
              />
              <button
                type="button"
                aria-label={`Remove legend row ${i + 1}`}
                disabled={rows.length <= 1}
                onClick={() => motion.leave(i, () => onChange(rows.filter((_, j) => j !== i)))}
                className={REMOVE_ROW}
              >
                <CloseIcon size={12} />
              </button>
            </div>
          </div>
        ))}
      </div>
      <button
        type="button"
        // No colour on the new row, so it takes the next one from the ramp.
        onClick={() => {
          motion.enter(rows.length);
          onChange([...rows, { label: `Item ${rows.length + 1}` }]);
        }}
        className={ADD_ROW}
      >
        Add Row
      </button>
    </div>
  );
}

// A pie, column or bar chart's rows in the menu (docs/specs/009-elements/pie-chart.md): each one's colour and
// label, and the button that opens them in the Chart Data dialog, as a line chart's series are summarised.
export function PieDataSummary({
  slices,
  palette = PIE_PALETTE,
  onEdit,
}: {
  slices: PieSlice[];
  palette?: readonly string[];
  onEdit: () => void;
}) {
  return (
    <div className="px-2 py-1.5">
      <div className="flex flex-col gap-1">
        {slices.map((s, i) => (
          <div
            key={i}
            className="flex items-center gap-1.5 text-[11px] text-slate-700 dark:text-slate-200"
          >
            <span
              className="inline-block h-2.5 w-2.5 shrink-0 rounded-[2px]"
              style={{ backgroundColor: s.color ?? palette[i % palette.length]! }}
            />
            <span className="min-w-0 flex-1 truncate">{s.label || `Item ${i + 1}`}</span>
            <span className="shrink-0 tabular-nums text-slate-500 dark:text-slate-400">
              {s.value}
            </span>
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
  // Rows slide in and out (docs/specs/004-interface-design/motion.md "Rows that come and go").
  const motion = useRowMotion();
  return (
    <div>
      <div className="flex flex-col">
        {rows.map((item, i) => (
          // Its own bottom padding, not a gap on the list, so a row sliding out takes its spacing with it.
          <div key={i} {...motion.rowProps(i)}>
            <div className="flex items-center gap-2 pb-2">
              <input
                type="checkbox"
                checked={item.done}
                aria-label={`Row ${i + 1} done`}
                onChange={(e) =>
                  onToggle
                    ? onToggle(i)
                    : onChange(rows.map((r, j) => (j === i ? { ...r, done: e.target.checked } : r)))
                }
                className="mx-1 size-4 shrink-0 cursor-pointer accent-brand-500"
              />
              <input
                className={`${CELL} flex-1`}
                value={item.text}
                placeholder="Task"
                aria-label={`Row ${i + 1} task`}
                maxLength={CHECKLIST_MAX_TEXT}
                onChange={(e) =>
                  setRows((r) => r.map((s, j) => (j === i ? { ...s, text: e.target.value } : s)))
                }
                onBlur={() => onChange(rows)}
              />
              <button
                type="button"
                aria-label={`Remove row ${i + 1}`}
                disabled={rows.length <= 1}
                onClick={() => motion.leave(i, () => onChange(rows.filter((_, j) => j !== i)))}
                className={REMOVE_ROW}
              >
                <CloseIcon size={12} />
              </button>
            </div>
          </div>
        ))}
      </div>
      <button
        type="button"
        disabled={rows.length >= CHECKLIST_MAX_ITEMS}
        onClick={() => {
          motion.enter(rows.length);
          onChange([...rows, { text: '', done: false }]);
        }}
        className={ADD_ROW}
      >
        + Add Row
      </button>
    </div>
  );
}
