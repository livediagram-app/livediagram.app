'use client';

// The Timeline's controls: view mode and filters (spec/138 §2.3).
//
// Rendered separately from the feed so the host can place them in its
// own page-header row alongside its other actions. A second row of
// buttons directly under a header that already has one reads as two
// unrelated toolbars.
//
// Styling deliberately matches the neutral bordered button the Explorer
// header already uses, so these sit in that row as peers rather than as
// a transplant.

import { TimelineFilterPopover } from './TimelineFilterPopover';
import type { TimelineControls as Controls } from './useTimelineControls';
import type { TimelineMode } from './types';

// The shared shape: same height, radius, border and type scale as the
// header's other buttons.
const BUTTON =
  'inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm transition hover:bg-slate-50 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 dark:hover:text-white';

export function TimelineControls({ controls }: { controls: Controls }) {
  const { mode, setMode, excluded, filterAnchor, setFilterAnchor } = controls;

  return (
    <>
      {/* Segmented mode switch. One bordered shell holding two options
          keeps it the same height as the neighbouring buttons instead of
          reading as two more of them. */}
      <div className="inline-flex items-center rounded-lg border border-slate-200 bg-white p-0.5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
        {(['list', 'calendar'] as const).map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={mode === value}
            onClick={() => setMode(value as TimelineMode)}
            className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium capitalize transition ${
              mode === value
                ? 'bg-brand-600 text-white'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
            }`}
          >
            <ModeIcon mode={value} />
            {value}
          </button>
        ))}
      </div>

      <button
        type="button"
        aria-label="Filter timeline"
        aria-expanded={filterAnchor !== null}
        onClick={(e) =>
          setFilterAnchor(filterAnchor ? null : e.currentTarget.getBoundingClientRect())
        }
        className={`relative ${BUTTON}`}
      >
        <FilterIcon />
        Filter
        {excluded.size > 0 && (
          // A dot rather than a count: the number of HIDDEN types isn't
          // information anyone acts on, but "a filter is on, that's why
          // this looks short" very much is.
          <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-brand-500" />
        )}
      </button>

      {filterAnchor && (
        <TimelineFilterPopover
          anchor={filterAnchor}
          allSourceTypes={controls.allSourceTypes}
          excluded={excluded}
          onToggle={controls.toggleType}
          onReset={controls.resetTypes}
          eventDates={controls.eventDates}
          monthKey={controls.monthKey}
          onMonthChange={controls.setMonthKey}
          onPickDate={controls.pickDate}
          onClose={() => setFilterAnchor(null)}
        />
      )}
    </>
  );
}

function FilterIcon() {
  return (
    <svg
      className="h-3.5 w-3.5"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      viewBox="0 0 24 24"
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 4.5h18M6.75 12h10.5M11.25 19.5h1.5"
      />
    </svg>
  );
}

// The two modes wear their own glyphs so the pair reads at a glance
// rather than needing both labels parsed.
const MODE_ICONS: Record<TimelineMode, string> = {
  list: 'M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5',
  calendar:
    'M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5',
};

function ModeIcon({ mode }: { mode: TimelineMode }) {
  return (
    <svg
      className="h-3.5 w-3.5"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      viewBox="0 0 24 24"
      aria-hidden
    >
      <path strokeLinecap="round" strokeLinejoin="round" d={MODE_ICONS[mode]} />
    </svg>
  );
}
