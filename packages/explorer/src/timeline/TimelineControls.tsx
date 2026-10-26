'use client';

// The Timeline's controls (livediagram's TimelineControls and TimelineFilterPopover): the Cards / Calendar switch
// and Filter, set in the pane header beside its other buttons. Filter opens a popover with whose doings to show,
// a chip per kind of event, and a mini calendar that jumps to a day. Below `sm` the mode switch moves into the
// popover, so a phone's header holds one button rather than a crowd of glyphs.

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Portal } from '@liveworkspace/ui';
import { SOLID_BRAND_DARK_CONTROL } from '../ui/classes';
import { Chevron, FilterIcon, MODE_LABELS, ModeIcon, TIMELINE_MODES } from './icons';
import {
  buildMonthCells,
  CATEGORY_LABELS,
  formatMonth,
  shiftMonth,
  type TimelineCategory,
  type TimelineMode,
} from './model';
import { useDismiss } from './Timeline';
import type { TimelineActorFilter, TimelineControls as Controls } from './useTimelineControls';

const BUTTON =
  'inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-600 shadow-sm transition hover:bg-slate-50 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 dark:hover:text-white';
const ON = `bg-brand-700 text-white ${SOLID_BRAND_DARK_CONTROL}`;
const OFF = 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white';

export function TimelineControls({ controls }: { controls: Controls }) {
  const { mode, setMode, excluded, filterAnchor, setFilterAnchor, actorFilter } = controls;
  // One dot whichever control narrowed the feed: the reader wondering why it looks short needs one signal.
  const filtered = excluded.size > 0 || actorFilter !== 'all';
  return (
    <>
      <div
        role="group"
        aria-label="Timeline view"
        className="hidden h-8 items-center rounded-lg border border-slate-200 bg-white p-0.5 shadow-sm sm:inline-flex dark:border-slate-700 dark:bg-slate-800"
      >
        {TIMELINE_MODES.map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={mode === value}
            onClick={() => setMode(value)}
            className={`inline-flex h-full items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition ${
              mode === value ? ON : OFF
            }`}
          >
            <ModeIcon mode={value} />
            {MODE_LABELS[value]}
          </button>
        ))}
      </div>
      <button
        type="button"
        aria-label="View and filter timeline"
        aria-expanded={filterAnchor !== null}
        data-timeline-filter-button=""
        onClick={(e) =>
          setFilterAnchor(filterAnchor ? null : e.currentTarget.getBoundingClientRect())
        }
        className={`relative ${BUTTON}`}
      >
        <FilterIcon />
        Filter
        {filtered ? (
          <span
            data-timeline-filtered=""
            className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-brand-500"
          />
        ) : null}
      </button>
      {filterAnchor ? (
        <TimelineFilterPopover
          anchor={filterAnchor}
          mode={mode}
          onModeChange={setMode}
          allCategories={controls.allCategories}
          excluded={excluded}
          onToggle={controls.toggleCategory}
          onReset={controls.resetFilters}
          eventDates={controls.eventDates}
          monthKey={controls.monthKey}
          onMonthChange={controls.setMonthKey}
          actorFilter={actorFilter}
          onActorFilterChange={controls.setActorFilter}
          onPickDate={controls.pickDate}
          onClose={() => setFilterAnchor(null)}
        />
      ) : null}
    </>
  );
}

const WIDTH = 272;
const GAP = 8;
const MARGIN = 8;
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(value, max));
const HEADING =
  'text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400';

function TimelineFilterPopover({
  anchor,
  mode,
  onModeChange,
  allCategories,
  excluded,
  onToggle,
  onReset,
  actorFilter,
  onActorFilterChange,
  eventDates,
  monthKey,
  onMonthChange,
  onPickDate,
  onClose,
}: {
  anchor: DOMRect;
  mode: TimelineMode;
  onModeChange: (mode: TimelineMode) => void;
  allCategories: TimelineCategory[];
  excluded: Set<TimelineCategory>;
  onToggle: (category: TimelineCategory) => void;
  onReset: () => void;
  actorFilter: TimelineActorFilter;
  onActorFilterChange: (filter: TimelineActorFilter) => void;
  eventDates: Set<string>;
  monthKey: string;
  onMonthChange: (monthKey: string) => void;
  onPickDate: (dateKey: string) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ left: anchor.left, top: anchor.bottom + GAP });
  // Placed before paint, flipping above the button when there is no room below.
  useLayoutEffect(() => {
    const height = ref.current?.offsetHeight ?? 320;
    setPosition({
      left: clamp(anchor.right - WIDTH, MARGIN, window.innerWidth - WIDTH - MARGIN),
      top:
        anchor.bottom + GAP + height > window.innerHeight - MARGIN
          ? Math.max(MARGIN, anchor.top - GAP - height)
          : anchor.bottom + GAP,
    });
  }, [anchor]);
  useDismiss(ref, onClose, true, '[data-timeline-filter-button]');
  // The panel is portalled to the end of the page, so Tab from the button would never reach it: it takes focus
  // when it opens, and hands it back to the button when it closes with focus inside (Escape, a picked day).
  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const node = ref.current;
    node?.focus({ preventScroll: true });
    return () => {
      const active = document.activeElement;
      if (!active || active === document.body || node?.contains(active)) {
        opener?.focus({ preventScroll: true });
      }
    };
  }, []);
  useEffect(() => {
    window.addEventListener('resize', onClose);
    return () => window.removeEventListener('resize', onClose);
  }, [onClose]);
  const cells = buildMonthCells(monthKey);
  const segment = (on: boolean) =>
    `flex flex-1 items-center justify-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition ${on ? ON : OFF}`;

  return (
    <Portal>
      <div
        ref={ref}
        role="dialog"
        aria-label="Timeline filters"
        tabIndex={-1}
        style={{ position: 'fixed', left: position.left, top: position.top, width: WIDTH }}
        className="z-50 rounded-xl border border-slate-200 bg-white p-3 shadow-lg outline-none dark:border-slate-700 dark:bg-slate-900"
      >
        <div className="sm:hidden">
          <p className={`mb-2 ${HEADING}`}>View</p>
          <div className="mb-4 flex rounded-lg border border-slate-200 p-0.5 dark:border-slate-700">
            {TIMELINE_MODES.map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={mode === value}
                onClick={() => onModeChange(value)}
                className={segment(mode === value)}
              >
                <ModeIcon mode={value} />
                {MODE_LABELS[value]}
              </button>
            ))}
          </div>
        </div>
        <p className={`mb-2 ${HEADING}`}>Activity by</p>
        <div className="mb-4 flex rounded-lg border border-slate-200 p-0.5 dark:border-slate-700">
          {(
            [
              ['all', 'Everyone'],
              ['others', 'Other people'],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={actorFilter === value}
              onClick={() => onActorFilterChange(value)}
              className={segment(actorFilter === value)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="mb-2 flex items-center justify-between">
          <p className={HEADING}>Show</p>
          {excluded.size > 0 || actorFilter !== 'all' ? (
            <button
              type="button"
              onClick={onReset}
              className="text-[11px] text-brand-700 hover:underline dark:text-brand-400"
            >
              Reset
            </button>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {allCategories.map((category) => {
            const on = !excluded.has(category);
            return (
              <button
                key={category}
                type="button"
                aria-pressed={on}
                onClick={() => onToggle(category)}
                // Brand, not the event tones: colour on this surface already means what happened.
                className={`rounded-full border px-2.5 py-1 text-[11px] transition ${
                  on
                    ? `border-transparent ${ON}`
                    : 'border-slate-200 text-slate-500 hover:text-slate-700 dark:border-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
              >
                {CATEGORY_LABELS[category]}
              </button>
            );
          })}
        </div>
        <div className="mt-4">
          <div className="mb-1.5 flex items-center justify-between">
            <button
              type="button"
              aria-label="Previous month"
              onClick={() => onMonthChange(shiftMonth(monthKey, -1))}
              className="rounded p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <Chevron direction={-1} />
            </button>
            <p className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
              {formatMonth(monthKey)}
            </p>
            <button
              type="button"
              aria-label="Next month"
              onClick={() => onMonthChange(shiftMonth(monthKey, 1))}
              className="rounded p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <Chevron direction={1} />
            </button>
          </div>
          <div className="grid grid-cols-7 gap-0.5">
            {cells.map((cell, index) => {
              if (!cell.key) return <div key={`pad-${index}`} className="h-7" />;
              const has = eventDates.has(cell.key);
              return (
                <button
                  key={cell.key}
                  type="button"
                  disabled={!has}
                  onClick={() => {
                    onPickDate(cell.key!);
                    onClose();
                  }}
                  className={`h-7 rounded text-[11px] transition ${
                    has
                      ? 'font-semibold text-brand-700 hover:bg-brand-50 dark:text-brand-300 dark:hover:bg-brand-500/15'
                      : 'text-slate-300 dark:text-slate-600'
                  }`}
                >
                  {cell.day}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </Portal>
  );
}
