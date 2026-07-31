'use client';

// The element-menu sections for the collaboration elements that carry
// settings: the estimate card's scale (spec/123), the agenda's segments
// (spec/127), the decision record's status / date / drivers (spec/128), and
// the chair's facing (spec/130).
//
// Their own file for the same reason BehaviourMenuSections has one: each is a
// small form, and none of it belongs in the data-shape sections beside charts
// and rails.

import { useEffect, useState } from 'react';
import {
  AGENDA_DEFAULT_MINUTES,
  AGENDA_MAX_ITEMS,
  AGENDA_MAX_MINUTES,
  AGENDA_MAX_TEXT,
  AGENDA_MIN_MINUTES,
  CHAIR_FACINGS,
  CHAIR_FACING_LABELS,
  DECISION_MAX_DRIVERS,
  DECISION_MAX_TEXT,
  DECISION_STATUSES,
  DECISION_STATUS_COLORS,
  DECISION_STATUS_LABELS,
  DEFAULT_CHAIR_FACING,
  DEFAULT_DECISION_STATUS,
  DEFAULT_ESTIMATE_SCALE,
  ESTIMATE_SCALES,
  ESTIMATE_SCALE_LABELS,
  ESTIMATE_SCALE_VALUES,
  clampAgendaMinutes,
  type AgendaItem,
  type ChairFacing,
  type DecisionStatus,
  type EstimateScale,
  type ShapeElement,
} from '@livediagram/diagram';
import { MenuAccordionSection, MenuTile, MenuTileGrid } from '@/components/primitives/PortalMenu';
import { ToolsMenuGlyph } from '@/components/palette/context-menu-icons';

// Each collaboration kind puts exactly ONE section inside the Tools flyout —
// an agenda has Segments and nothing else, a chair has Chair and nothing else.
// An accordion there is a second click that reveals the only thing behind it,
// so these open on arrival and their header reads as a label rather than a
// disclosure. The scaffold's shared `sectionProps` is still accepted (and
// still drives the flush styling); only the open/toggle pair is overridden.
function soleSection(props: { open: boolean; onToggle: () => void }) {
  return { ...props, open: true, onToggle: () => {} };
}

const fieldClass =
  'w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-700 outline-none placeholder:text-slate-400 focus:border-brand-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200';
const cellInput =
  'min-w-0 rounded border border-slate-200 bg-white px-1 py-0.5 text-[11px] text-slate-700 outline-none focus:border-brand-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200';
const labelClass = 'text-[10px] font-medium text-slate-500 dark:text-slate-400';
const addButtonClass =
  'mt-1.5 inline-flex w-full items-center justify-center rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 transition enabled:cursor-pointer enabled:hover:border-brand-300 enabled:hover:bg-brand-50 disabled:opacity-40 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:enabled:hover:border-brand-500/60 dark:enabled:hover:bg-brand-500/15';
const removeButtonClass =
  'flex h-5 w-5 shrink-0 items-center justify-center rounded text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/15';

// --- Estimate card (spec/123) ---------------------------------------------

export function EstimateMenuSection({
  target,
  sectionProps,
  onSetScale,
}: {
  target: ShapeElement | undefined;
  sectionProps: (id: string) => { open: boolean; onToggle: () => void };
  onSetScale: (scale: EstimateScale) => void;
}) {
  const current = target?.estimateScale ?? DEFAULT_ESTIMATE_SCALE;
  return (
    <MenuAccordionSection
      title="Scale"
      icon={<ToolsMenuGlyph />}
      {...soleSection(sectionProps('estimate'))}
    >
      <div className="flex flex-col gap-1 px-2 py-1.5">
        {ESTIMATE_SCALES.map((scale) => (
          <button
            key={scale}
            type="button"
            onClick={() => onSetScale(scale)}
            aria-pressed={current === scale}
            className={`flex cursor-pointer flex-col items-start rounded-md border px-2 py-1 text-left transition ${
              current === scale
                ? 'border-brand-400 bg-brand-50 dark:border-brand-500/60 dark:bg-brand-500/15'
                : 'border-slate-200 bg-white hover:border-brand-300 dark:border-slate-700 dark:bg-slate-800'
            }`}
          >
            <span className="text-[11px] font-medium text-slate-700 dark:text-slate-200">
              {ESTIMATE_SCALE_LABELS[scale]}
            </span>
            {/* The values themselves, because the name of a scale is not the
                thing being chosen between — "1 2 3 5 8" is. */}
            <span className="text-[10px] tabular-nums text-slate-500 dark:text-slate-400">
              {ESTIMATE_SCALE_VALUES[scale].join('  ')}
            </span>
          </button>
        ))}
        <p className="mt-0.5 text-[10px] leading-snug text-slate-500 dark:text-slate-400">
          Changing the scale keeps answers already cast, so clear the card first if the round has
          started.
        </p>
      </div>
    </MenuAccordionSection>
  );
}

// --- Agenda (spec/127) -----------------------------------------------------

// Mirrors the checklist's row editor (spec/83) and the record's field editor
// (spec/120) rather than inventing a third row-editing idiom.
export function AgendaMenuSection({
  target,
  sectionProps,
  onSetItems,
}: {
  target: ShapeElement | undefined;
  sectionProps: (id: string) => { open: boolean; onToggle: () => void };
  onSetItems: (items: AgendaItem[]) => void;
}) {
  const items = target?.agendaItems ?? [];
  const [rows, setRows] = useState<AgendaItem[]>(items);
  useEffect(() => setRows(items), [items]);

  const move = (from: number, to: number) => {
    if (to < 0 || to >= rows.length) return;
    const next = [...rows];
    const [moved] = next.splice(from, 1);
    if (moved) next.splice(to, 0, moved);
    onSetItems(next);
  };

  return (
    <MenuAccordionSection
      title="Segments"
      icon={<ToolsMenuGlyph />}
      {...soleSection(sectionProps('agenda'))}
    >
      <div className="px-2 py-1.5">
        <div className="flex flex-col gap-1">
          {rows.map((item, i) => (
            <div key={i} className="flex items-center gap-1">
              <input
                className={`${cellInput} flex-1`}
                value={item.label}
                placeholder="Segment"
                aria-label={`Segment ${i + 1} name`}
                maxLength={AGENDA_MAX_TEXT}
                onChange={(e) =>
                  setRows((r) => r.map((s, j) => (j === i ? { ...s, label: e.target.value } : s)))
                }
                onBlur={() => onSetItems(rows)}
              />
              <input
                className={`${cellInput} w-[3.25rem]`}
                type="number"
                min={AGENDA_MIN_MINUTES}
                max={AGENDA_MAX_MINUTES}
                value={item.minutes}
                aria-label={`Segment ${i + 1} minutes`}
                onChange={(e) =>
                  setRows((r) =>
                    r.map((s, j) => (j === i ? { ...s, minutes: Number(e.target.value) } : s)),
                  )
                }
                // Clamped on commit, so a typed 0 or 999 lands as the nearest
                // legal value rather than being kept and clamped forever after
                // on every read.
                onBlur={() =>
                  onSetItems(rows.map((s) => ({ ...s, minutes: clampAgendaMinutes(s.minutes) })))
                }
              />
              <button
                type="button"
                aria-label={`Move segment ${i + 1} up`}
                disabled={i === 0}
                onClick={() => move(i, i - 1)}
                className={`${removeButtonClass} hover:bg-slate-100 hover:text-slate-600 disabled:opacity-30 dark:hover:bg-slate-700`}
              >
                ↑
              </button>
              <button
                type="button"
                aria-label={`Remove segment ${i + 1}`}
                onClick={() => onSetItems(rows.filter((_, j) => j !== i))}
                className={removeButtonClass}
              >
                ×
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          disabled={rows.length >= AGENDA_MAX_ITEMS}
          onClick={() => onSetItems([...rows, { label: '', minutes: AGENDA_DEFAULT_MINUTES }])}
          className={addButtonClass}
        >
          Add segment
        </button>
      </div>
    </MenuAccordionSection>
  );
}

// --- Decision record (spec/128) -------------------------------------------

export function DecisionMenuSection({
  target,
  sectionProps,
  onSetStatus,
  onSetDate,
  onSetDrivers,
}: {
  target: ShapeElement | undefined;
  sectionProps: (id: string) => { open: boolean; onToggle: () => void };
  onSetStatus: (status: DecisionStatus) => void;
  onSetDate: (date: string | undefined) => void;
  onSetDrivers: (drivers: string[]) => void;
}) {
  const status = target?.decisionStatus ?? DEFAULT_DECISION_STATUS;
  const drivers = target?.decisionDrivers ?? [];
  const [rows, setRows] = useState<string[]>(drivers);
  useEffect(() => setRows(drivers), [drivers]);

  return (
    <MenuAccordionSection
      title="Decision"
      icon={<ToolsMenuGlyph />}
      {...soleSection(sectionProps('decision'))}
    >
      <div className="flex flex-col gap-2 px-2 py-1.5">
        <div>
          <span className={labelClass}>Status</span>
          <div className="mt-1 grid grid-cols-2 gap-1">
            {DECISION_STATUSES.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => onSetStatus(s)}
                aria-pressed={status === s}
                className={`cursor-pointer rounded-md border px-1.5 py-1 text-[10px] font-semibold uppercase tracking-[0.04em] transition ${
                  status === s
                    ? 'border-transparent'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-brand-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                }`}
                // The chosen status wears its own chip colours, so the picker
                // shows exactly what will land on the card.
                style={
                  status === s
                    ? {
                        backgroundColor: DECISION_STATUS_COLORS[s].bg,
                        color: DECISION_STATUS_COLORS[s].text,
                      }
                    : undefined
                }
              >
                {DECISION_STATUS_LABELS[s]}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className={labelClass} htmlFor="lvd-decision-date">
            Date
          </label>
          <input
            id="lvd-decision-date"
            type="date"
            className={`${fieldClass} mt-1`}
            value={target?.decisionDate ?? ''}
            // Empty clears the field entirely: an undated card shows nothing
            // rather than "no date" (spec/128).
            onChange={(e) => onSetDate(e.target.value || undefined)}
          />
        </div>
        <div>
          <span className={labelClass}>Drivers</span>
          <div className="mt-1 flex flex-col gap-1">
            {rows.map((driver, i) => (
              <div key={i} className="flex items-center gap-1">
                <input
                  className={`${cellInput} flex-1`}
                  value={driver}
                  placeholder="Why"
                  aria-label={`Driver ${i + 1}`}
                  maxLength={DECISION_MAX_TEXT}
                  onChange={(e) => setRows((r) => r.map((s, j) => (j === i ? e.target.value : s)))}
                  onBlur={() => onSetDrivers(rows)}
                />
                <button
                  type="button"
                  aria-label={`Remove driver ${i + 1}`}
                  onClick={() => onSetDrivers(rows.filter((_, j) => j !== i))}
                  className={removeButtonClass}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            disabled={rows.length >= DECISION_MAX_DRIVERS}
            onClick={() => onSetDrivers([...rows, ''])}
            className={addButtonClass}
          >
            Add driver
          </button>
        </div>
      </div>
    </MenuAccordionSection>
  );
}

// --- Chair (spec/130) ------------------------------------------------------

const FACING_ARROW: Record<ChairFacing, string> = { n: '↓', e: '←', s: '↑', w: '→' };

export function ChairMenuSection({
  target,
  sectionProps,
  onSetFacing,
}: {
  target: ShapeElement | undefined;
  sectionProps: (id: string) => { open: boolean; onToggle: () => void };
  onSetFacing: (facing: ChairFacing) => void;
}) {
  const facing = target?.chairFacing ?? DEFAULT_CHAIR_FACING;
  return (
    <MenuAccordionSection
      title="Chair"
      icon={<ToolsMenuGlyph />}
      {...soleSection(sectionProps('chair'))}
    >
      {/* Tiles rather than a list: the arrow IS the answer here, which is the
          same test the palette applies to its own categories (spec/110). */}
      <MenuTileGrid cols={4}>
        {CHAIR_FACINGS.map((f) => (
          <MenuTile
            key={f}
            icon={
              <span aria-hidden className="text-[15px] leading-none">
                {FACING_ARROW[f]}
              </span>
            }
            label={CHAIR_FACING_LABELS[f].replace('Facing ', '')}
            active={facing === f}
            onClick={() => onSetFacing(f)}
          />
        ))}
      </MenuTileGrid>
      <p className="px-2 pb-1.5 pt-1 text-[10px] leading-snug text-slate-500 dark:text-slate-400">
        Which way somebody sitting here faces. Walk an Avatar-mode character into the chair to sit
        down.
      </p>
    </MenuAccordionSection>
  );
}
