'use client';

import type { ReactNode } from 'react';
import {
  CONCEPT_LABEL_MAX,
  CONCEPT_NOTE_MAX,
  CONCEPT_ROWS,
  conceptDrawsNotes,
  isConceptShape,
  type ConceptRow,
  CARD_TAG_MAX,
  CARD_TAGS_MAX,
  NAV_LINKS_MAX,
  PROCESS_MAX_STEPS,
  PROCESS_MIN_STEPS,
  STAT_CHANGE_MAX,
  STATS_MAX,
  STATS_MIN,
  WEB_TEXT_MAX,
  type ShapeElement,
  type StatItem,
  type WebRows,
} from '@livedocuments/document';
import { MenuDialogSection } from '@liveworkspace/workbench/components/primitives/MenuDialogSection';
import { conceptTitle } from '@/components/palette/ConceptMenuSection';
import { DataMenuGlyph } from '@/components/palette/context-menu-data-rows';
import { useFollowingDraft } from '@liveworkspace/workbench/hooks/ui/useFollowingDraft';
import { useRowMotion } from '@liveworkspace/workbench/hooks/ui/useRowMotion';
import { moveRow } from '@liveworkspace/workbench/lib/move-row';
import { MenuToggleRow } from '@/components/palette/context-menu-input-rows';
import type { ElementStyleOps } from '@/lib/element-style-ops';

// The web components' row editors (docs/specs/009-elements/web-components-and-no-groups.md), in the Tools flyout beside the
// checklist's and the entity's: a stat row's cards, a process's steps and a
// header's links. The canvas edits each row's WORDS in place; this is where
// rows are added, removed and reordered, bounded to each kind's min and max.

const rowButton =
  'flex h-9 w-8 shrink-0 items-center justify-center rounded-md text-base leading-none text-slate-400 transition enabled:cursor-pointer enabled:hover:bg-slate-100 enabled:hover:text-slate-700 disabled:opacity-30 dark:enabled:hover:bg-slate-800 dark:enabled:hover:text-slate-200';
// A row's cell at a dialog's size: 36px tall, 14px text (16px on a phone, the app's anti-zoom rule).
const CELL =
  'h-9 min-w-0 rounded-md border border-slate-200 bg-white px-2.5 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-brand-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100';

// Up / down / remove for one row.
function RowControls({
  index,
  count,
  min,
  noun,
  onMove,
  onRemove,
}: {
  index: number;
  count: number;
  min: number;
  noun: string;
  onMove: (to: number) => void;
  onRemove: () => void;
}) {
  return (
    <>
      <button
        type="button"
        aria-label={`Move ${noun} up`}
        disabled={index === 0}
        onClick={() => onMove(index - 1)}
        className={rowButton}
      >
        ↑
      </button>
      <button
        type="button"
        aria-label={`Move ${noun} down`}
        disabled={index === count - 1}
        onClick={() => onMove(index + 1)}
        className={rowButton}
      >
        ↓
      </button>
      <button
        type="button"
        aria-label={`Remove ${noun}`}
        disabled={count <= min}
        onClick={onRemove}
        className={rowButton}
      >
        ×
      </button>
    </>
  );
}

// One cell's edit: applied to the row as the draft holds it now, and committed (the whole list) on blur.
type RowCellProps<T> = {
  update: (edit: (row: T) => T) => void;
  commit: () => void;
};

// The shell every row editor shares: a local draft of the rows, each row's own cells then its up / down / remove,
// and the add button, all bounded to `min` and `max`. Moves, removes and adds commit at once; typing commits on blur.
function RowListEditor<T>({
  rows: initial,
  min,
  max,
  noun,
  addLabel,
  newRow,
  onChange,
  cells,
}: {
  rows: T[];
  min: number;
  max: number;
  // The row's name in its controls' labels ("Move step up").
  noun: string;
  addLabel: string;
  newRow: (count: number) => T;
  onChange: (rows: T[]) => void;
  cells: (row: T, index: number, edit: RowCellProps<T>) => ReactNode;
}) {
  // Follows the element's rows when they change elsewhere (an edit on the canvas), keeping what is being typed.
  const [rows, setRows] = useFollowingDraft<T[]>(initial);
  // Rows slide in and out (docs/specs/004-interface-design/motion.md "Rows that come and go").
  const motion = useRowMotion();
  return (
    <div>
      <div className="flex flex-col">
        {rows.map((row, i) => (
          <div key={i} {...motion.rowProps(i)}>
            <div className="flex items-center gap-1.5 pb-2">
              {cells(row, i, {
                update: (edit) => setRows((r) => r.map((x, j) => (j === i ? edit(x) : x))),
                commit: () => onChange(rows),
              })}
              <RowControls
                index={i}
                count={rows.length}
                min={min}
                noun={noun}
                onMove={(to) => onChange(moveRow(rows, i, to))}
                onRemove={() => motion.leave(i, () => onChange(rows.filter((_, j) => j !== i)))}
              />
            </div>
          </div>
        ))}
      </div>
      <button
        type="button"
        disabled={rows.length >= max}
        onClick={() => {
          motion.enter(rows.length);
          onChange([...rows, newRow(rows.length)]);
        }}
        className="mt-1 inline-flex h-9 w-full items-center justify-center rounded-md border border-dashed border-slate-300 text-sm font-medium text-slate-600 transition enabled:cursor-pointer enabled:hover:border-brand-400 enabled:hover:bg-brand-50/50 enabled:hover:text-brand-700 disabled:opacity-40 dark:border-slate-700 dark:text-slate-300 dark:enabled:hover:border-brand-500 dark:enabled:hover:bg-brand-500/10 dark:enabled:hover:text-brand-200"
      >
        {addLabel}
      </button>
    </div>
  );
}

function StatsEditor({
  stats,
  onChange,
}: {
  stats: StatItem[];
  onChange: (stats: StatItem[]) => void;
}) {
  return (
    <RowListEditor
      rows={stats}
      min={STATS_MIN}
      max={STATS_MAX}
      noun="stat"
      addLabel="Add Stat"
      newRow={(): StatItem => ({ value: '0', caption: 'Metric' })}
      onChange={onChange}
      cells={(st, i, { update, commit }) => (
        <>
          <input
            className={`${CELL} w-24`}
            value={st.value}
            placeholder="value"
            aria-label={`Stat ${i + 1} value`}
            maxLength={WEB_TEXT_MAX}
            onChange={(e) => update((s) => ({ ...s, value: e.target.value }))}
            onBlur={commit}
          />
          <input
            className={`${CELL} flex-1`}
            value={st.caption}
            placeholder="caption"
            aria-label={`Stat ${i + 1} caption`}
            maxLength={WEB_TEXT_MAX}
            onChange={(e) => update((s) => ({ ...s, caption: e.target.value }))}
            onBlur={commit}
          />
          {/* The change line (docs/specs/009-elements/stat-row.md): "▲ 12%" goes up, "-3 pts" down. */}
          <input
            className={`${CELL} w-24`}
            value={st.change ?? ''}
            placeholder="change"
            aria-label={`Stat ${i + 1} change`}
            maxLength={STAT_CHANGE_MAX}
            onChange={(e) => update((s) => ({ ...s, change: e.target.value }))}
            onBlur={commit}
          />
        </>
      )}
    />
  );
}

/** A stat row's count-up switch: on is stored as nothing. */
function withStatCountUp<T extends { type: string; shape?: string }>(el: T, on: boolean): T {
  if (el.type !== 'shape' || el.shape !== 'stat-row') return el;
  const next = { ...el } as T & { statCountUp?: boolean };
  if (on) delete next.statCountUp;
  else next.statCountUp = false;
  return next;
}

export function TextRowsEditor({
  rows,
  min,
  max,
  noun,
  addLabel,
  nextRow,
  onChange,
  maxLength = WEB_TEXT_MAX,
}: {
  rows: string[];
  min: number;
  max: number;
  noun: string;
  addLabel: string;
  nextRow: (count: number) => string;
  onChange: (rows: string[]) => void;
  // Per-row bound; a card's tags are shorter than a step (docs/specs/009-elements/card.md).
  maxLength?: number;
}) {
  return (
    <RowListEditor
      rows={rows}
      min={min}
      max={max}
      noun={noun.toLowerCase()}
      addLabel={addLabel}
      newRow={nextRow}
      onChange={onChange}
      cells={(text, i, { update, commit }) => (
        <input
          className={`${CELL} flex-1`}
          value={text}
          placeholder={noun}
          aria-label={`${noun} ${i + 1}`}
          maxLength={maxLength}
          onChange={(e) => update(() => e.target.value)}
          onBlur={commit}
        />
      )}
    />
  );
}

// A concept graphic's rows (docs/specs/009-elements/concept-graphics.md): a label each, and a note where the kind
// draws one (a layer's side note, a funnel tier's value). Same row controls as the web components'.
export function ConceptRowsEditor({
  rows,
  min,
  max,
  noun,
  notes,
  onChange,
}: {
  rows: ConceptRow[];
  min: number;
  max: number;
  noun: string;
  notes: boolean;
  onChange: (rows: ConceptRow[]) => void;
}) {
  return (
    <RowListEditor<ConceptRow>
      rows={rows}
      min={min}
      max={max}
      noun={noun.toLowerCase()}
      addLabel={`Add ${noun}`}
      newRow={(count) => ({ label: `${noun} ${count + 1}` })}
      onChange={onChange}
      cells={(row, i, { update, commit }) => (
        <>
          <input
            className={`${CELL} flex-1`}
            value={row.label}
            placeholder={noun}
            aria-label={`${noun} ${i + 1}`}
            maxLength={CONCEPT_LABEL_MAX}
            onChange={(e) => update((r) => ({ ...r, label: e.target.value }))}
            onBlur={commit}
          />
          {notes ? (
            <input
              className={`${CELL} w-24`}
              value={row.note ?? ''}
              placeholder="note"
              aria-label={`${noun} ${i + 1} note`}
              maxLength={CONCEPT_NOTE_MAX}
              onChange={(e) => update((r) => ({ ...r, note: e.target.value }))}
              onBlur={commit}
            />
          ) : null}
        </>
      )}
    />
  );
}

// What the element's rows are called, or null for an element that has none: the menu row's name and the dialog's.
export function webRowsTitle(target: ShapeElement): string | null {
  if (target.shape === 'stat-row') return 'Stats';
  if (target.shape === 'process') return 'Steps';
  if (target.shape === 'site-header') return 'Links';
  // A concept graphic's row is named for the graphic: its dialog holds its settings as well as its rows.
  if (isConceptShape(target.shape) && target.shape !== 'chevrons')
    return conceptTitle(target.shape);
  if (target.shape === 'card') return 'Tags';
  return null;
}

// The one row a row-carrying element shows in its menu (canvas-and-palette.md "A category that opens a dialog"):
// named for its rows (Stats, Steps, Links, Tags) or, for a concept graphic, for the graphic (Layer Stack, Pyramid, Funnel, Cycle ...), it opens them in their dialog. Nothing for any other element.
export function WebRowsMenuSection({
  target,
  onOpen,
}: {
  target: ShapeElement;
  onOpen: () => void;
}) {
  const title = webRowsTitle(target);
  if (!title) return null;
  return <MenuDialogSection title={title} icon={<DataMenuGlyph />} onOpen={onOpen} flush />;
}

// The rows themselves, in their dialog (ElementRowsDialogs): the editor for whichever rows the element carries.
export function WebRowsEditor({
  target,
  onSetRows,
  ops,
}: {
  target: ShapeElement;
  onSetRows: (rows: WebRows) => void;
  // The menu's generic writer, for a stat row's Count Up When Presented switch.
  ops?: Pick<ElementStyleOps, 'commit'>;
}) {
  if (target.shape === 'stat-row') {
    const countUp = target.statCountUp !== false;
    return (
      <>
        {ops ? (
          <MenuToggleRow
            label="Count Up When Presented"
            description="Numbers count up from zero as the slide comes on"
            checked={countUp}
            onToggle={() => ops.commit((el) => withStatCountUp(el, !countUp), 'StatCountUp')}
          />
        ) : null}
        <StatsEditor stats={target.stats ?? []} onChange={(stats) => onSetRows({ stats })} />
      </>
    );
  }
  if (target.shape === 'process') {
    return (
      <>
        <TextRowsEditor
          rows={target.processSteps ?? []}
          min={PROCESS_MIN_STEPS}
          max={PROCESS_MAX_STEPS}
          noun="Step"
          addLabel="Add Step"
          nextRow={(n) => `Step ${n + 1}`}
          onChange={(processSteps) => onSetRows({ processSteps })}
        />
      </>
    );
  }
  if (target.shape === 'site-header') {
    return (
      <>
        <TextRowsEditor
          rows={target.navLinks ?? []}
          min={0}
          max={NAV_LINKS_MAX}
          noun="Link"
          addLabel="Add Link"
          nextRow={() => 'Link'}
          onChange={(navLinks) => onSetRows({ navLinks })}
        />
      </>
    );
  }
  // Chevrons edit their stages on the canvas (ConceptRowBar), so they have no Rows section.
  if (isConceptShape(target.shape) && target.shape !== 'chevrons') {
    const bounds = CONCEPT_ROWS[target.shape];
    return (
      <>
        <ConceptRowsEditor
          rows={target.conceptRows ?? []}
          min={bounds.min}
          max={bounds.max}
          noun={bounds.noun}
          notes={conceptDrawsNotes(target)}
          onChange={(conceptRows) => onSetRows({ conceptRows })}
        />
      </>
    );
  }
  if (target.shape === 'card') {
    return (
      <>
        <TextRowsEditor
          rows={target.tags ?? []}
          min={0}
          max={CARD_TAGS_MAX}
          noun="Tag"
          addLabel="Add Tag"
          nextRow={() => 'Tag'}
          maxLength={CARD_TAG_MAX}
          onChange={(tags) => onSetRows({ tags })}
        />
      </>
    );
  }
  return null;
}

// Whether the element gets a row section at all (see WebRowsMenuSection).
export function hasWebRowsSection(target: { type: string; shape?: string }): boolean {
  return (
    target.type === 'shape' &&
    (target.shape === 'stat-row' ||
      target.shape === 'process' ||
      target.shape === 'site-header' ||
      target.shape === 'card' ||
      (isConceptShape(target.shape ?? '') && target.shape !== 'chevrons'))
  );
}
