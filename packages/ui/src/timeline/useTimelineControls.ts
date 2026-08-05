'use client';

// The Timeline's control state, held apart from the feed that renders
// under it (spec/138 §2.3).
//
// It lives in its own hook because the two halves are rendered in
// different places: the buttons belong in the host's page-header row
// beside its other actions, and the feed belongs in the body. Sharing a
// hook rather than duplicating state is what keeps a filter chip and
// the list it filters from ever disagreeing.
//
// Everything derived from the events (which chips exist, which days are
// populated, what survives the filter) is computed here too, so both
// halves read one source.

import { useCallback, useMemo, useState } from 'react';
import { eventCategory, sortCategories, type TimelineCategory } from './eventCategory';
import { monthKeyOf, weekStartOf } from './monthCells';
import { dateKey } from './useTimelineGrouping';
import type { TimelineEvent, TimelineMode } from './types';

/** Whose activity to show. */
export type TimelineActorFilter = 'all' | 'others';

export type TimelineControls = {
  mode: TimelineMode;
  setMode: (mode: TimelineMode) => void;
  actorFilter: TimelineActorFilter;
  setActorFilter: (filter: TimelineActorFilter) => void;
  /** Categories the reader has switched off. */
  excluded: Set<TimelineCategory>;
  toggleCategory: (category: TimelineCategory) => void;
  /** Clears the category chips AND the actor filter. */
  resetFilters: () => void;
  /** Categories present in the feed, so the chips describe THIS feed. */
  allCategories: TimelineCategory[];
  /** The events left after the chips are applied — what the feed renders. */
  visibleEvents: TimelineEvent[];
  /** YYYY-MM-DD keys with at least one event, for the mini calendar. */
  eventDates: Set<string>;
  monthKey: string;
  setMonthKey: (monthKey: string) => void;
  weekKey: string;
  setWeekKey: (weekKey: string) => void;
  /** Anchor rect for the filter popover; null when it's closed. */
  filterAnchor: DOMRect | null;
  setFilterAnchor: (anchor: DOMRect | null) => void;
  /** The day-group briefly highlighted after a mini-calendar pick. */
  pulseDay: string | null;
  pickDate: (dateKey: string) => void;
  clearPulse: () => void;
};

export function useTimelineControls(
  events: TimelineEvent[],
  opts: {
    /** The reader, so "others" can mean anything but them. */
    viewerId?: string | null;
    onModeChange?: (mode: TimelineMode) => void;
    onFilterChange?: (excluded: TimelineCategory[]) => void;
    onActorFilterChange?: (filter: TimelineActorFilter) => void;
  } = {},
): TimelineControls {
  const { viewerId, onModeChange, onFilterChange, onActorFilterChange } = opts;
  // Not persisted across navigation, on purpose: someone who looked at
  // the calendar once should not find the feed in calendar mode a week
  // later wondering where their list went.
  const [mode, setModeState] = useState<TimelineMode>('list');
  const [excluded, setExcluded] = useState<Set<TimelineCategory>>(() => new Set());
  const [monthKey, setMonthKey] = useState(() => monthKeyOf(Date.now()));
  const [weekKey, setWeekKey] = useState(() => weekStartOf(dateKey(Date.now())));
  const [filterAnchor, setFilterAnchor] = useState<DOMRect | null>(null);
  const [pulseDay, setPulseDay] = useState<string | null>(null);
  // Defaults to everything. "What did I miss" is the sharper question,
  // but opening on a filtered view would leave a reader wondering why
  // their own afternoon's work is absent.
  const [actorFilter, setActorFilterState] = useState<TimelineActorFilter>('all');

  // Derived from the events actually present rather than the full
  // catalogue: a reader with no teams shouldn't be offered a Teams chip
  // that filters nothing, and a new event type from a newer worker gets
  // a chip for free.
  const allCategories = useMemo(() => {
    const seen = new Set<TimelineCategory>();
    for (const event of events) seen.add(eventCategory(event.eventType));
    return sortCategories(seen);
  }, [events]);

  const visibleEvents = useMemo(() => {
    let out = events;
    if (excluded.size > 0) out = out.filter((e) => !excluded.has(eventCategory(e.eventType)));
    if (actorFilter === 'others' && viewerId) {
      // Keeps system events (actorId null): an expiring token is
      // nobody's doing and is exactly the kind of thing "what did I
      // miss" is asking about.
      out = out.filter((e) => e.actorId !== viewerId);
    }
    return out;
  }, [events, excluded, actorFilter, viewerId]);

  const eventDates = useMemo(() => {
    const set = new Set<string>();
    for (const event of visibleEvents) set.add(dateKey(event.occurredAt));
    return set;
  }, [visibleEvents]);

  const setMode = useCallback(
    (next: TimelineMode) => {
      setModeState(next);
      onModeChange?.(next);
    },
    [onModeChange],
  );

  const toggleCategory = useCallback(
    (category: TimelineCategory) => {
      setExcluded((prev) => {
        const next = new Set(prev);
        if (next.has(category)) next.delete(category);
        else next.add(category);
        onFilterChange?.([...next]);
        return next;
      });
    },
    [onFilterChange],
  );

  // Clears EVERY narrowing control, not just the category chips.
  //
  // It used to clear only `excluded`, which made both of its buttons inert
  // in the one case they exist for. A solo user picking "Other people" has
  // no events by anyone else, so the feed empties, "No events match these
  // filters" appears with its Clear filters button — and clicking it did
  // nothing, because the thing narrowing the feed wasn't a category. The
  // popover's own Reset was hidden in that state too (it gated on
  // `excluded.size`), so neither control could undo it.
  //
  // TimelineControls already draws its "you are filtered" dot from
  // `excluded.size > 0 || actorFilter !== 'all'`, on the stated grounds that
  // a reader needs one signal whichever control narrowed the feed. Undoing
  // it is the same argument: one button, whichever control did it.
  const resetFilters = useCallback(() => {
    setExcluded(new Set());
    setActorFilterState('all');
    onFilterChange?.([]);
    onActorFilterChange?.('all');
  }, [onFilterChange, onActorFilterChange]);

  const setActorFilter = useCallback(
    (next: TimelineActorFilter) => {
      setActorFilterState(next);
      onActorFilterChange?.(next);
    },
    [onActorFilterChange],
  );

  const pickDate = useCallback((key: string) => {
    // The group may be far down a long feed, so scroll to it rather
    // than assuming it's on screen, then pulse it — otherwise the
    // reader lands somewhere new with no signal about why.
    document
      .querySelector(`[data-timeline-day="${key}"]`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setPulseDay(key);
  }, []);

  const clearPulse = useCallback(() => setPulseDay(null), []);

  return {
    mode,
    setMode,
    actorFilter,
    setActorFilter,
    excluded,
    toggleCategory,
    resetFilters,
    allCategories,
    visibleEvents,
    eventDates,
    monthKey,
    setMonthKey,
    weekKey,
    setWeekKey,
    filterAnchor,
    setFilterAnchor,
    pulseDay,
    pickDate,
    clearPulse,
  };
}
