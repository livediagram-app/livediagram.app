'use client';

// The door to Subscribe to Calendar (docs/specs/026-plan/calendar-feed.md "Where it lives"): set by CalendarFeedHost
// for someone who may have a feed, null for everyone else, so the tab menu's row reads one value and draws nothing
// without it.
import { createContext, useContext } from 'react';

// `badges`: what it needs first (Sign In, Sync Plan) while a press opens its gate.
export type CalendarFeedDoor = { open: () => void; badges?: readonly string[] | undefined };

export const CalendarFeedDoorContext = createContext<CalendarFeedDoor | null>(null);

export const useCalendarFeedDoor = () => useContext(CalendarFeedDoorContext);
