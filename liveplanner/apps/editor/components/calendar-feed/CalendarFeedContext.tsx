'use client';

// The door to Subscribe to Calendar (docs/specs/026-plan/calendar-feed.md "Where it lives"): set by CalendarFeedHost
// for someone who may have a feed, null for everyone else, so the tab menu's row reads one value and draws nothing
// without it.
import { createContext, useContext } from 'react';

export type CalendarFeedDoor = { open: () => void };

export const CalendarFeedDoorContext = createContext<CalendarFeedDoor | null>(null);

export const useCalendarFeedDoor = () => useContext(CalendarFeedDoorContext);
