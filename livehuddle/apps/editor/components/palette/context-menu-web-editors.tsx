'use client';

import { useState, type ReactNode } from 'react';
import {
  CONCEPT_LABEL_MAX,
  CONCEPT_NOTE_MAX,
  CONCEPT_ROWS,
  isConceptShape,
  type ConceptRow,
  CARD_TAG_MAX,
  CARD_TAGS_MAX,
  type ShapeElement,
  type WebRows,
} from '@livehuddle/document';
import { MenuAccordionSection } from '@liveworkspace/workbench/components/primitives/PortalMenu';
import { DataMenuGlyph } from '@/components/palette/context-menu-data-rows';
import {
  MENU_ADD_ROW_BUTTON,
  MENU_CELL_INPUT,
} from '@liveworkspace/workbench/components/palette/menu-editor-classes';
import { moveRow } from '@liveworkspace/workbench/lib/move-row';

// The row editors in the Tools flyout (docs/specs/009-elements/web-components-and-no-groups.md): a card's tags and a
// concept graphic's rows. The canvas edits each row's WORDS in place; this is where rows are added, removed and
// reordered, bounded to each kind's min and max.

const rowButton =
  'flex h-5 w-5 shrink-0 items-center justify-center rounded text-slate-400 transition enabled:hover:bg-slate-100 enabled:hover:text-slate-700 disabled:opacity-30 dark:enabled:hover:bg-slate-800';

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
  const [rows, setRows] = useState<T[]>(initial);
  return (
    <div className="px-2 py-1.5">
      <div className="flex flex-col gap-1">
        {rows.map((row, i) => (
          <div key={i} className="flex items-center gap-1">
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
              onRemove={() => onChange(rows.filter((_, j) => j !== i))}
            />
          </div>
        ))}
      </div>
      <button
        type="button"
        disabled={rows.length >= max}
        onClick={() => onChange([...rows, newRow(rows.length)])}
        className={MENU_ADD_ROW_BUTTON}
      >
        {addLabel}
      </button>
    </div>
  );
}

export function TextRowsEditor({
  rows,
  min,
  max,
  noun,
  addLabel,
  nextRow,
  onChange,
  maxLength = CARD_TAG_MAX,
}: {
  rows: string[];
  min: number;
  max: number;
  noun: string;
  addLabel: string;
  nextRow: (count: number) => string;
  onChange: (rows: string[]) => void;
  // Per-row bound; a card's tag by default (docs/specs/009-elements/card.md).
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
          className={`${MENU_CELL_INPUT} flex-1`}
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

// A concept graphic's rows (docs/specs/009-elements/timeline.md): a label each, and a note where the kind
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
            className={`${MENU_CELL_INPUT} flex-1`}
            value={row.label}
            placeholder={noun}
            aria-label={`${noun} ${i + 1}`}
            maxLength={CONCEPT_LABEL_MAX}
            onChange={(e) => update((r) => ({ ...r, label: e.target.value }))}
            onBlur={commit}
          />
          {notes ? (
            <input
              className={`${MENU_CELL_INPUT} w-[4.5rem]`}
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

// The one section a row-carrying web component shows, or nothing for any
// other element.
export function WebRowsMenuSection({
  target,
  sectionProps,
  onSetRows,
}: {
  target: ShapeElement;
  sectionProps: (id: string) => { open: boolean; onToggle: () => void; flush: boolean };
  onSetRows: (rows: WebRows) => void;
}) {
  // Chevrons edit their stages on the canvas (ConceptRowBar), so they have no Rows section.
  if (isConceptShape(target.shape)) {
    const bounds = CONCEPT_ROWS[target.shape];
    return (
      <MenuAccordionSection title="Rows" icon={<DataMenuGlyph />} {...sectionProps('concept-rows')}>
        <ConceptRowsEditor
          key={JSON.stringify(target.conceptRows ?? [])}
          rows={target.conceptRows ?? []}
          min={bounds.min}
          max={bounds.max}
          noun={bounds.noun}
          notes
          onChange={(conceptRows) => onSetRows({ conceptRows })}
        />
      </MenuAccordionSection>
    );
  }
  if (target.shape === 'card') {
    return (
      <MenuAccordionSection title="Tags" icon={<DataMenuGlyph />} {...sectionProps('tags')}>
        <TextRowsEditor
          key={JSON.stringify(target.tags ?? [])}
          rows={target.tags ?? []}
          min={0}
          max={CARD_TAGS_MAX}
          noun="Tag"
          addLabel="Add Tag"
          nextRow={() => 'Tag'}
          maxLength={CARD_TAG_MAX}
          onChange={(tags) => onSetRows({ tags })}
        />
      </MenuAccordionSection>
    );
  }
  return null;
}

// Whether the element gets a row section at all (see WebRowsMenuSection).
export function hasWebRowsSection(target: { type: string; shape?: string }): boolean {
  return (
    target.type === 'shape' &&
    (target.shape === 'card' || (isConceptShape(target.shape ?? '') && target.shape !== 'chevrons'))
  );
}
