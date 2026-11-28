'use client';

// A Session tab with no card left to go (docs/specs/026-plan/session-tabs.md "When the queue is done"): how many got
// each of the kind's outcomes (Refined, Skipped and Flagged; Committed and Skipped), a kind's own summary (Sprint
// Planning's tally), and for the facilitator Review Skipped and Start Again. An empty set-up says so instead, with
// Session Settings for an Editor.
import type { ReactNode } from 'react';
import { SESSION_KIND_OUTCOMES, type SessionOutcome } from '@liveplanner/items';
import type { SessionDecision } from '@liveplanner/project';
import { OUTCOME_LOOKS } from './session-kinds';

const button =
  'inline-flex h-10 cursor-pointer items-center rounded-lg border border-slate-200 bg-white px-4 text-[13px] font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800';
const primary =
  'inline-flex h-10 cursor-pointer items-center rounded-lg bg-brand-700 px-4 text-[13px] font-semibold text-white hover:bg-brand-800 dark:bg-brand-600 dark:hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2';

export function SessionComplete({
  outcomes = SESSION_KIND_OUTCOMES.refinement,
  summary,
  empty,
  decided,
  runs,
  onReviewSkipped,
  onStartAgain,
  onSettings,
}: {
  // The kind's outcomes, its completing one first (its glyph heads the page).
  outcomes?: readonly SessionOutcome[];
  // A kind's own line under the counts (Sprint Planning's tally).
  summary?: ReactNode;
  // No card was ever picked: the set-up needs changing.
  empty: boolean;
  decided: Readonly<Record<string, SessionDecision>> | undefined;
  runs: boolean;
  onReviewSkipped: (() => void) | null;
  onStartAgain: () => void;
  // Session Settings, an Editor's; absent for everyone else.
  onSettings?: (() => void) | undefined;
}) {
  if (empty) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
        <h2 className="text-[18px] font-semibold text-slate-900 dark:text-slate-50">
          No cards to work through
        </h2>
        <p className="max-w-sm text-[13px] text-slate-500 dark:text-slate-400">
          No card is of a picked type in a picked stage right now.
        </p>
        {onSettings ? (
          <button type="button" className={primary} onClick={onSettings}>
            Session Settings
          </button>
        ) : null}
      </div>
    );
  }
  const DoneIcon = OUTCOME_LOOKS[outcomes[0]!].Icon;
  const counts = new Map<SessionOutcome, number>();
  for (const d of Object.values(decided ?? {}))
    counts.set(d.outcome, (counts.get(d.outcome) ?? 0) + 1);
  return (
    <div
      className="flex flex-1 flex-col items-center justify-center gap-5 p-8 text-center"
      role="status"
    >
      <span className="flex size-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-700 dark:bg-brand-950/50 dark:text-brand-300">
        <DoneIcon size={28} aria-hidden />
      </span>
      <h2 className="text-[20px] font-semibold tracking-tight text-slate-900 dark:text-slate-50">
        Session Complete
      </h2>
      <dl className="flex gap-6">
        {outcomes.map((o) => {
          const look = OUTCOME_LOOKS[o];
          return (
            <div key={o} className="flex flex-col items-center gap-1">
              <dt className="order-2 flex items-center gap-1 text-[12px] text-slate-500 dark:text-slate-400">
                <span style={{ color: look.colour }}>
                  <look.Icon size={13} aria-hidden />
                </span>
                {look.done}
              </dt>
              <dd className="order-1 text-[24px] font-semibold tabular-nums text-slate-900 dark:text-slate-50">
                {counts.get(o) ?? 0}
              </dd>
            </div>
          );
        })}
      </dl>
      {summary}
      {runs ? (
        <div className="flex flex-wrap justify-center gap-2">
          {onReviewSkipped ? (
            <button type="button" className={button} onClick={onReviewSkipped}>
              Review Skipped
            </button>
          ) : null}
          <button type="button" className={button} onClick={onStartAgain}>
            Start Again
          </button>
        </div>
      ) : null}
    </div>
  );
}
