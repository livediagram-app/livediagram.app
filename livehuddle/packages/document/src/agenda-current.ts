// Which segment an Agenda is on, kept true as its rows and the tab timer change
// (docs/specs/012-collaboration/agenda.md "The current segment"). Pure.
//
// `agendaCurrent` is an index into `agendaItems`, so anything that reorders or
// removes rows has to carry it along, and the live time it shows is only the
// tab timer's while that timer is still the one the segment started.

import type { AgendaItem } from './collab-shapes';
import { timerDisplayMs, type TabTimer } from './session';

// Where the current index lands after the row at `from` moves to `to`.
export function moveAgendaCurrent(current: number | undefined, from: number, to: number) {
  if (current === undefined) return undefined;
  if (current === from) return to;
  if (from < to && current > from && current <= to) return current - 1;
  if (from > to && current >= to && current < from) return current + 1;
  return current;
}

// Where the current index lands after the row at `removed` goes: cleared when
// it was the current row, shifted up when it was below it.
export function removeAgendaCurrent(current: number | undefined, removed: number) {
  if (current === undefined || current === removed) return undefined;
  return current > removed ? current - 1 : current;
}

const sameItem = (a: AgendaItem | undefined, b: AgendaItem | undefined) =>
  !!a && !!b && a.label === b.label && a.minutes === b.minutes;

// The current index carried from one list of rows to another when nothing
// says how they map (an undo restoring older rows): the same row where it
// was, else the first row like it, else none.
export function followAgendaCurrent(
  current: number | undefined,
  before: readonly AgendaItem[],
  after: readonly AgendaItem[],
): number | undefined {
  if (current === undefined) return undefined;
  const row = before[current];
  if (sameItem(row, after[current])) return current;
  const found = after.findIndex((item) => sameItem(row, item));
  return found === -1 ? undefined : found;
}

// Whether the tab timer is the countdown the current segment started: not
// another timer, not a stopwatch, not one restarted from the Timer menu.
export function agendaOwnsTimer(
  element: { agendaCurrent?: number; agendaTimerStartedAt?: number },
  timer: TabTimer | undefined,
): timer is TabTimer {
  if (element.agendaCurrent === undefined || element.agendaTimerStartedAt === undefined) {
    return false;
  }
  return timer?.mode === 'countdown' && timer.startedAt === element.agendaTimerStartedAt;
}

// The current segment's time left, or null when the tab timer is not its run:
// the agenda then shows the segment's minutes instead of someone else's clock.
export function agendaRemainingMs(
  element: { agendaCurrent?: number; agendaTimerStartedAt?: number },
  timer: TabTimer | undefined,
  now: number,
): number | null {
  return agendaOwnsTimer(element, timer) ? timerDisplayMs(timer, now) : null;
}
