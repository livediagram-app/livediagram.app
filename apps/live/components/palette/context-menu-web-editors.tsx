'use client';

import { useState } from 'react';
import {
  NAV_LINKS_MAX,
  PROCESS_MAX_STEPS,
  PROCESS_MIN_STEPS,
  STATS_MAX,
  STATS_MIN,
  WEB_TEXT_MAX,
  type ShapeElement,
  type StatItem,
  type WebRows,
} from '@livediagram/diagram';
import { MenuAccordionSection } from '@/components/primitives/PortalMenu';
import { DataMenuGlyph } from '@/components/palette/context-menu-data-rows';

// The web components' row editors (docs/specs/009-elements/web-components-and-no-groups.md), in the Tools flyout beside the
// checklist's and the entity's: a stat row's cards, a process's steps and a
// header's links. The canvas edits each row's WORDS in place; this is where
// rows are added, removed and reordered, bounded to each kind's min and max.

const cellInput =
  'min-w-0 rounded border border-slate-200 bg-white px-1 py-0.5 text-[11px] text-slate-700 outline-none focus:border-brand-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200';
const rowButton =
  'flex h-5 w-5 shrink-0 items-center justify-center rounded text-slate-400 transition enabled:hover:bg-slate-100 enabled:hover:text-slate-700 disabled:opacity-30 dark:enabled:hover:bg-slate-800';
const removeButton =
  'flex h-5 w-5 shrink-0 items-center justify-center rounded text-slate-400 transition enabled:hover:bg-rose-50 enabled:hover:text-rose-600 disabled:opacity-30 dark:enabled:hover:bg-rose-500/15';
const addButton =
  'mt-1.5 inline-flex w-full items-center justify-center rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 transition enabled:cursor-pointer enabled:hover:border-brand-300 enabled:hover:bg-brand-50 disabled:opacity-40 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:enabled:hover:border-brand-500/60 dark:enabled:hover:bg-brand-500/15';

function move<T>(list: T[], from: number, to: number): T[] {
  if (to < 0 || to >= list.length) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item!);
  return next;
}

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
              className={`${cellInput} w-[4.5rem]`}
              value={st.value}
              placeholder="value"
              aria-label={`Stat ${i + 1} value`}
              maxLength={WEB_TEXT_MAX}
              onChange={(e) => set(i, { value: e.target.value })}
              onBlur={() => onChange(rows)}
            />
            <input
              className={`${cellInput} flex-1`}
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
        className={addButton}
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
}: {
  rows: string[];
  min: number;
  max: number;
  noun: string;
  addLabel: string;
  nextRow: (count: number) => string;
  onChange: (rows: string[]) => void;
}) {
  const [rows, setRows] = useState<string[]>(initial);
  return (
    <div className="px-2 py-1.5">
      <div className="flex flex-col gap-1">
        {rows.map((text, i) => (
          <div key={i} className="flex items-center gap-1">
            <input
              className={`${cellInput} flex-1`}
              value={text}
              placeholder={noun}
              aria-label={`${noun} ${i + 1}`}
              maxLength={WEB_TEXT_MAX}
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
        className={addButton}
      >
        {addLabel}
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
  return null;
}

// Whether the element gets a row section at all (see WebRowsMenuSection).
export function hasWebRowsSection(target: { type: string; shape?: string }): boolean {
  return (
    target.type === 'shape' &&
    (target.shape === 'stat-row' || target.shape === 'process' || target.shape === 'site-header')
  );
}
