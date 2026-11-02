'use client';

// The ticking parts of time tracking (docs/specs/026-plan/item-types.md "Time Spent"): a running timer's elapsed time,
// and the card face's running-timer pill. Only the elapsed text subscribes to the shared clock, so a tick redraws one
// text node per readout, never its card or board.
import { durationSpoken, elapsedClock, MINUTE_MS, type ItemPerson } from '@liveplanner/items';
import { Tooltip, lucideGlyph } from '@liveplanner/ui';
import { lucidePlay, lucideSquare, lucideX } from '@liveworkspace/icons/lucide';
import { PersonDisc } from '../PersonDisc';
import { useNowSeconds } from './use-now-seconds';

export const PlayIcon = lucideGlyph(lucidePlay, 12);
export const StopIcon = lucideGlyph(lucideSquare, 11);
export const DiscardIcon = lucideGlyph(lucideX, 12);

// The green of a running timer, as the exports draw it (svg-render-plan-card.ts TIMER_RUNNING_GREEN).
export const TIMER_GREEN = '#16a34a';

// A timer's elapsed time since `start`, ticking ("12:05").
export function Elapsed({ start, className }: { start: number; className?: string }) {
  const now = useNowSeconds();
  return (
    <span className={`tabular-nums ${className ?? ''}`} aria-hidden>
      {elapsedClock(now - start)}
    </span>
  );
}

// The pulsing dot of a running timer; still with reduced motion.
export function RunningDot() {
  return (
    <span aria-hidden className="relative flex h-2 w-2 shrink-0">
      <span
        className="absolute inset-0 rounded-full opacity-60 motion-safe:animate-ping"
        style={{ backgroundColor: TIMER_GREEN }}
      />
      <span className="relative h-2 w-2 rounded-full" style={{ backgroundColor: TIMER_GREEN }} />
    </span>
  );
}

const DISCS_SHOWN = 3;

// What the running pill says to assistive technology: "Timer running: Sam, 12 minutes" (minutes worked out when it is
// drawn, not each second, so it never chatters).
function runningLabel(people: readonly ItemPerson[], start: number): string {
  const names =
    people.length > 1
      ? `${people
          .slice(0, -1)
          .map((p) => p.name)
          .join(', ')} and ${people[people.length - 1]!.name}`
      : (people[0]?.name ?? 'Someone');
  const minutes = Math.max(0, Math.floor((Date.now() - start) / MINUTE_MS));
  return `Timer running: ${names}, ${durationSpoken(minutes)}`;
}

// The runners' discs, overlapping: three, then +N.
function RunnerDiscs({ people }: { people: readonly ItemPerson[] }) {
  const more = people.length - DISCS_SHOWN;
  return (
    <span className="flex -space-x-1.5">
      {people.slice(0, DISCS_SHOWN).map((p) => (
        <span key={p.id} className="rounded-full ring-2 ring-white dark:ring-slate-900">
          <PersonDisc person={p} />
        </span>
      ))}
      {more > 0 ? (
        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-slate-200 px-1 text-[10px] font-semibold text-slate-700 ring-2 ring-white dark:bg-slate-700 dark:text-slate-100 dark:ring-slate-900">
          <span className="text-optical-centre">+{more}</span>
        </span>
      ) : null}
    </span>
  );
}

// The card face's pill while anyone's timer runs on the card, at every size: the runners' discs (three, then +N), the
// green dot and the earliest timer's elapsed time.
export function RunningTimerPill({
  people,
  start,
  border,
}: {
  // Everyone with a timer running on the card, earliest first.
  people: readonly ItemPerson[];
  // The earliest timer's start.
  start: number;
  border: string;
}) {
  if (people.length === 0) return null;
  const label = runningLabel(people, start);
  return (
    <Tooltip label={label}>
      <span
        role="img"
        aria-label={label}
        className="inline-flex h-6 shrink-0 items-center gap-1.5 rounded-full border bg-emerald-50 py-0.5 pl-0.5 pr-2 text-[11px] font-semibold text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-200"
        style={{ borderColor: border }}
      >
        <RunnerDiscs people={people} />
        <RunningDot />
        <Elapsed start={start} />
      </span>
    </Tooltip>
  );
}
