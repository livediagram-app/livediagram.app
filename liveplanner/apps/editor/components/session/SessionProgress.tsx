'use client';

// A Session tab's progress bar (docs/specs/026-plan/session-tabs.md "The progress bar"): a segment per queued card
// (one smooth bar past SEGMENTS_MAX), a decided card's in its outcome's colour, the room's card in the accent's tint,
// filling as its timebox runs and amber once the time is up.
import type { Item } from '@liveplanner/items';
import type { SessionDecision } from '@liveplanner/project';
import { OUTCOME_LOOKS } from './session-kinds';
import type { SessionTimebox } from './useSessionTimebox';

export const SEGMENTS_MAX = 40;
const AMBER = '#f59e0b';

export function SessionProgress({
  label,
  list,
  decided,
  currentId,
  timebox,
}: {
  // The session kind's name, for the bar's accessible name.
  label: string;
  list: readonly Item[];
  decided: Readonly<Record<string, SessionDecision>> | undefined;
  currentId: string | null;
  timebox: SessionTimebox;
}) {
  const done = list.filter((i) => decided?.[i.id]).length;
  const total = list.length;
  const used = timebox ? 1 - timebox.leftMs / timebox.totalMs : 0;
  const name = `${label} progress, ${done} of ${total} decided`;
  const fillOf = (colour: string, share: number) => (
    <span
      className="absolute inset-y-0 left-0 rounded-[inherit] transition-[width] duration-700 ease-linear motion-reduce:transition-none"
      style={{ width: `${Math.round(share * 1000) / 10}%`, backgroundColor: colour }}
    />
  );
  return (
    <div
      role="progressbar"
      aria-label={name}
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={done}
      data-timebox-up={timebox?.up ? '' : undefined}
      className="flex h-2 w-full gap-[3px]"
    >
      {total > SEGMENTS_MAX ? (
        <span className="relative h-full flex-1 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
          {fillOf('var(--color-brand-600)', done / total)}
        </span>
      ) : (
        list.map((item) => {
          const outcome = decided?.[item.id]?.outcome;
          const isCurrent = item.id === currentId && !outcome;
          return (
            <span
              key={item.id}
              className={`relative h-full min-w-[3px] flex-1 overflow-hidden rounded-full ${isCurrent ? 'bg-brand-200 dark:bg-brand-900' : 'bg-slate-200 dark:bg-slate-700'}`}
            >
              {outcome
                ? fillOf(OUTCOME_LOOKS[outcome].colour, 1)
                : isCurrent && timebox
                  ? fillOf(timebox.up ? AMBER : 'var(--color-brand-500)', timebox.up ? 1 : used)
                  : null}
            </span>
          );
        })
      )}
    </div>
  );
}
