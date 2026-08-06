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

import { ModeIcon, TIMELINE_MODES } from './ModeIcon';
import { TimelineFilterPopover } from './TimelineFilterPopover';
import type { TimelineControls as Controls } from './useTimelineControls';

// The shared shape: same height, radius, border and type scale as the
// header's other buttons.
const BUTTON =
  'inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm transition hover:bg-slate-50 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 dark:hover:text-white';

export function TimelineControls({ controls }: { controls: Controls }) {
  const { mode, setMode, excluded, filterAnchor, setFilterAnchor, actorFilter } = controls;
  // The dot means "the feed you're looking at is narrowed", whichever
  // control did the narrowing — a reader wondering why it looks short
  // needs one signal, not one per filter.
  const filtered = excluded.size > 0 || actorFilter !== 'all';

  return (
    <>
      {/* Segmented mode switch. One bordered shell holding three options
          keeps it the same height as the neighbouring buttons instead of
          reading as three more of them.

          Gone below `sm:`, where it moves into the filter popover
          (spec/138 §2.3): collapsing the labels to icons bought enough
          room for a while, but three of them plus Filter, Help and New
          diagram still crowded a phone's header into a scrum of glyphs.
          One button that opens everything beats five that fit. */}
      <div className="hidden items-center rounded-lg border border-slate-200 bg-white p-0.5 shadow-sm sm:inline-flex dark:border-slate-700 dark:bg-slate-800">
        {TIMELINE_MODES.map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={mode === value}
            onClick={() => setMode(value)}
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
        // On a phone this button is also where the view modes live, and
        // a label that only mentions filtering would hide them.
        aria-label="View and filter timeline"
        aria-expanded={filterAnchor !== null}
        onClick={(e) =>
          setFilterAnchor(filterAnchor ? null : e.currentTarget.getBoundingClientRect())
        }
        className={`relative ${BUTTON}`}
      >
        <FilterIcon />
        Filter
        {filtered && (
          // A dot rather than a count: the number of hidden things isn't
          // information anyone acts on, but "a filter is on, that's why
          // this looks short" very much is.
          <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-brand-500" />
        )}
      </button>

      {filterAnchor && (
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
