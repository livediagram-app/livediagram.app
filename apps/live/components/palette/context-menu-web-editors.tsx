'use client';

import { useState } from 'react';
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
  STATS_MAX,
  STATS_MIN,
  WEB_TEXT_MAX,
  type ShapeElement,
  type StatItem,
  type WebRows,
} from '@livediagram/document';
import { MenuAccordionSection } from '@/components/primitives/PortalMenu';
import { DataMenuGlyph } from '@/components/palette/context-menu-data-rows';
import { MENU_ADD_ROW_BUTTON, MENU_CELL_INPUT } from './menu-editor-classes';

// The web components' row editors (docs/specs/009-elements/web-components-and-no-groups.md), in the Tools flyout beside the
// checklist's and the entity's: a stat row's cards, a process's steps and a
// header's links. The canvas edits each row's WORDS in place; this is where
// rows are added, removed and reordered, bounded to each kind's min and max.

const rowButton =
  'flex h-5 w-5 shrink-0 items-center justify-center rounded text-slate-400 transition enabled:hover:bg-slate-100 enabled:hover:text-slate-700 disabled:opacity-30 dark:enabled:hover:bg-slate-800';
const removeButton =
  'flex h-5 w-5 shrink-0 items-center justify-center rounded text-slate-400 transition enabled:hover:bg-slate-100 enabled:hover:text-slate-700 disabled:opacity-30 dark:enabled:hover:bg-slate-800';

export function move<T>(list: T[], from: number, to: number): T[] {
  if (to < 0 || to >= list.length) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item!);
  return next;
}

// Up / down / remove for one row.
export function RowControls({
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
        className={removeButton}
      >
        ×
      </button>
    </>
  );
}

export function StatsEditor({
  stats,
  onChange,
}: {
  stats: StatItem[];
  onChange: (stats: StatItem[]) => void;
}) {
  const [rows, setRows] = useState<StatItem[]>(stats);
  const set = (i: number, patch: Partial<StatItem>) =>
    setRows((r) => r.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  return (
    <div className="px-2 py-1.5">
      <div className="flex flex-col gap-1">
        {rows.map((st, i) => (
          <div key={i} className="flex items-center gap-1">
            <input
              className={`${MENU_CELL_INPUT} w-[4.5rem]`}
              value={st.value}
              placeholder="value"
              aria-label={`Stat ${i + 1} value`}
              maxLength={WEB_TEXT_MAX}
              onChange={(e) => set(i, { value: e.target.value })}
              onBlur={() => onChange(rows)}
            />
            <input
              className={`${MENU_CELL_INPUT} flex-1`}
              value={st.caption}
              placeholder="caption"
              aria-label={`Stat ${i + 1} caption`}
              maxLength={WEB_TEXT_MAX}
              onChange={(e) => set(i, { caption: e.target.value })}
              onBlur={() => onChange(rows)}
            />
            <RowControls
              index={i}
              count={rows.length}
              min={STATS_MIN}
              noun="stat"
              onMove={(to) => onChange(move(rows, i, to))}
              onRemove={() => onChange(rows.filter((_, j) => j !== i))}
            />
          </div>
        ))}
      </div>
      <button
        type="button"
        disabled={rows.length >= STATS_MAX}
        onClick={() => onChange([...rows, { value: '0', caption: 'Metric' }])}
        className={MENU_ADD_ROW_BUTTON}
      >
        Add Stat
      </button>
    </div>
  );
}

export function TextRowsEditor({
  rows: initial,
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
  const [rows, setRows] = useState<string[]>(initial);
  return (
    <div className="px-2 py-1.5">
      <div className="flex flex-col gap-1">
        {rows.map((text, i) => (
          <div key={i} className="flex items-center gap-1">
            <input
              className={`${MENU_CELL_INPUT} flex-1`}
              value={text}
              placeholder={noun}
              aria-label={`${noun} ${i + 1}`}
              maxLength={maxLength}
              onChange={(e) => setRows((r) => r.map((s, j) => (j === i ? e.target.value : s)))}
              onBlur={() => onChange(rows)}
            />
            <RowControls
              index={i}
              count={rows.length}
              min={min}
              noun={noun.toLowerCase()}
              onMove={(to) => onChange(move(rows, i, to))}
              onRemove={() => onChange(rows.filter((_, j) => j !== i))}
            />
          </div>
        ))}
      </div>
      <button
        type="button"
        disabled={rows.length >= max}
        onClick={() => onChange([...rows, nextRow(rows.length)])}
        className={MENU_ADD_ROW_BUTTON}
      >
        {addLabel}
      </button>
    </div>
  );
}

// A concept graphic's rows (docs/specs/009-elements/concept-graphics.md): a label each, and a note where the kind
// draws one (a layer's side note, a funnel tier's value). Same row controls as the web components'.
export function ConceptRowsEditor({
  rows: initial,
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
  const [rows, setRows] = useState<ConceptRow[]>(initial);
  const set = (i: number, patch: Partial<ConceptRow>) =>
    setRows((r) => r.map((row, j) => (j === i ? { ...row, ...patch } : row)));
  return (
    <div className="px-2 py-1.5">
      <div className="flex flex-col gap-1">
        {rows.map((row, i) => (
          <div key={i} className="flex items-center gap-1">
            <input
              className={`${MENU_CELL_INPUT} flex-1`}
              value={row.label}
              placeholder={noun}
              aria-label={`${noun} ${i + 1}`}
              maxLength={CONCEPT_LABEL_MAX}
              onChange={(e) => set(i, { label: e.target.value })}
              onBlur={() => onChange(rows)}
            />
            {notes ? (
              <input
                className={`${MENU_CELL_INPUT} w-[4.5rem]`}
                value={row.note ?? ''}
                placeholder="note"
                aria-label={`${noun} ${i + 1} note`}
                maxLength={CONCEPT_NOTE_MAX}
                onChange={(e) => set(i, { note: e.target.value })}
                onBlur={() => onChange(rows)}
              />
            ) : null}
            <RowControls
              index={i}
              count={rows.length}
              min={min}
              noun={noun.toLowerCase()}
              onMove={(to) => onChange(move(rows, i, to))}
              onRemove={() => onChange(rows.filter((_, j) => j !== i))}
            />
          </div>
        ))}
      </div>
      <button
        type="button"
        disabled={rows.length >= max}
        onClick={() => onChange([...rows, { label: `${noun} ${rows.length + 1}` }])}
        className={MENU_ADD_ROW_BUTTON}
      >
        Add {noun}
      </button>
    </div>
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
  if (target.shape === 'stat-row') {
    return (
      <MenuAccordionSection title="Stats" icon={<DataMenuGlyph />} {...sectionProps('stats')}>
        {/* Keyed on the rows so a change from elsewhere (an inline edit, the
            ring's Add) resets the local draft rather than being shadowed by it. */}
        <StatsEditor
          key={JSON.stringify(target.stats ?? [])}
          stats={target.stats ?? []}
          onChange={(stats) => onSetRows({ stats })}
        />
      </MenuAccordionSection>
    );
  }
  if (target.shape === 'process') {
    return (
      <MenuAccordionSection title="Steps" icon={<DataMenuGlyph />} {...sectionProps('steps')}>
        <TextRowsEditor
          key={JSON.stringify(target.processSteps ?? [])}
          rows={target.processSteps ?? []}
          min={PROCESS_MIN_STEPS}
          max={PROCESS_MAX_STEPS}
          noun="Step"
          addLabel="Add Step"
          nextRow={(n) => `Step ${n + 1}`}
          onChange={(processSteps) => onSetRows({ processSteps })}
        />
      </MenuAccordionSection>
    );
  }
  if (target.shape === 'site-header') {
    return (
      <MenuAccordionSection title="Links" icon={<DataMenuGlyph />} {...sectionProps('links')}>
        <TextRowsEditor
          key={JSON.stringify(target.navLinks ?? [])}
          rows={target.navLinks ?? []}
          min={0}
          max={NAV_LINKS_MAX}
          noun="Link"
          addLabel="Add Link"
          nextRow={() => 'Link'}
          onChange={(navLinks) => onSetRows({ navLinks })}
        />
      </MenuAccordionSection>
    );
  }
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
          notes={conceptDrawsNotes(target)}
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
    (target.shape === 'stat-row' ||
      target.shape === 'process' ||
      target.shape === 'site-header' ||
      target.shape === 'card' ||
      isConceptShape(target.shape ?? ''))
  );
}
