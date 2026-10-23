'use client';

// The Timeline's control state (livediagram's useTimelineControls), held apart from the feed: the buttons sit in
// the pane header and the feed in the body, and sharing one hook keeps a filter chip and the list it filters from
// ever disagreeing. Everything derived from the events (which chips exist, which days have events, what survives
// the filters) is worked out here too, so both halves read one source.

import { useCallback, useMemo, useState } from 'react';
import {
  collapseSameDayCreate,
  dateKey,
  eventCategory,
  monthKeyOf,
  sortCategories,
  type TimelineCategory,
  type TimelineEvent,
  type TimelineMode,
} from './model';

/** Whose doings to show. */
export type TimelineActorFilter = 'all' | 'others';

export type TimelineControls = {
  mode: TimelineMode;
  setMode: (mode: TimelineMode) => void;
  actorFilter: TimelineActorFilter;
  setActorFilter: (filter: TimelineActorFilter) => void;
  /** Categories switched off. */
  excluded: Set<TimelineCategory>;
  toggleCategory: (category: TimelineCategory) => void;
  /** Clears the chips and the actor filter: one way out, whichever narrowed the feed. */
  resetFilters: () => void;
  /** Categories present in the loaded events, so the chips describe this feed. */
  allCategories: TimelineCategory[];
  /** What the feed draws: the loaded events after the filters. */
  visibleEvents: TimelineEvent[];
  /** Local days (YYYY-MM-DD) with at least one visible event, for the mini calendar. */
  eventDates: Set<string>;
  monthKey: string;
  setMonthKey: (monthKey: string) => void;
  /** The filter button's rectangle while its popover is open. */
  filterAnchor: DOMRect | null;
  setFilterAnchor: (anchor: DOMRect | null) => void;
  /** The day pulsed after a pick in the mini calendar. */
  pulseDay: string | null;
  pickDate: (dateKey: string) => void;
  clearPulse: () => void;
};

export function useTimelineControls(
  events: TimelineEvent[],
  opts: {
    viewerId?: string | null;
    onModeChange?: (mode: TimelineMode) => void;
    onCategoryToggle?: (category: TimelineCategory, on: boolean) => void;
    onActorFilterChange?: (filter: TimelineActorFilter) => void;
  } = {},
): TimelineControls {
  const { viewerId, onModeChange, onCategoryToggle, onActorFilterChange } = opts;
  // Not remembered: someone who looked at the calendar once should not find it there a week later.
  const [mode, setModeState] = useState<TimelineMode>('list');
  const [excluded, setExcluded] = useState<Set<TimelineCategory>>(() => new Set());
  const [monthKey, setMonthKey] = useState(() => monthKeyOf(Date.now()));
  const [filterAnchor, setFilterAnchor] = useState<DOMRect | null>(null);
  const [pulseDay, setPulseDay] = useState<string | null>(null);
  // Everyone by default: opening on "other people" would hide the reader's own afternoon.
  const [actorFilter, setActorFilterState] = useState<TimelineActorFilter>('all');

  const allCategories = useMemo(() => {
    const seen = new Set<TimelineCategory>();
    for (const event of events) seen.add(eventCategory(event.type));
    return sortCategories(seen);
  }, [events]);

  const visibleEvents = useMemo(() => {
    let out = collapseSameDayCreate(events);
    if (excluded.size > 0) out = out.filter((e) => !excluded.has(eventCategory(e.type)));
    if (actorFilter === 'others' && viewerId) out = out.filter((e) => e.actorId !== viewerId);
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
      const on = excluded.has(category);
      setExcluded((prev) => {
        const next = new Set(prev);
        if (next.has(category)) next.delete(category);
        else next.add(category);
        return next;
      });
      onCategoryToggle?.(category, on);
    },
    [excluded, onCategoryToggle],
  );

  const resetFilters = useCallback(() => {
    setExcluded(new Set());
    setActorFilterState('all');
  }, []);

  const setActorFilter = useCallback(
    (next: TimelineActorFilter) => {
      setActorFilterState(next);
      onActorFilterChange?.(next);
    },
    [onActorFilterChange],
  );

  // "Take me to this day": the calendar moves to its month; the list scrolls to its group and pulses it.
  const pickDate = useCallback(
    (key: string) => {
      if (mode === 'calendar') {
        setMonthKey(key.slice(0, 7));
        return;
      }
      document
        .querySelector(`[data-timeline-day="${key}"]`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setPulseDay(key);
    },
    [mode],
  );

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
    filterAnchor,
    setFilterAnchor,
    pulseDay,
    pickDate,
    clearPulse,
  };
}
