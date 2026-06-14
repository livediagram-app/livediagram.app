import { useState } from 'react';
import { Accordion } from './palette-controls';
import { timerDisplayMs, type TimerMode } from '@livediagram/diagram';

import type { TabSectionControls } from './CommandPalette';

// Theme, Canvas (background) and Font now live in the Tab Appearance modal
// (CanvasThemeDialog), and Auto-align lives in the canvas / tab context
// menu; the tab editor keeps only the Session tools.
export type TabAccordionState = {
  session: boolean;
};

export function TabSection({
  tab,
  open,
  setOpen,
}: {
  tab: TabSectionControls;
  open: TabAccordionState;
  setOpen: React.Dispatch<React.SetStateAction<TabAccordionState>>;
}) {
  // Mutually exclusive (matches SelectedElementSection).
  const toggle = (key: keyof TabAccordionState) =>
    setOpen((prev) => {
      const closed: TabAccordionState = { session: false };
      if (prev[key]) return closed;
      return { ...closed, [key]: true };
    });

  // Session-tool pickers (spec/39): the chosen timer mode + countdown
  // length, and the votes-per-person budget, are local until the
  // facilitator hits Start.
  const [timerMode, setTimerMode] = useState<TimerMode>('countdown');
  const [durationMin, setDurationMin] = useState(5);
  const [votesPerPerson, setVotesPerPerson] = useState(3);
  const timer = tab.timer;
  const vote = tab.vote;
  const totalVotesCast = vote ? Object.values(vote.votes).reduce((n, ids) => n + ids.length, 0) : 0;
  const fmtClock = (ms: number) => {
    const s = Math.round(ms / 1000);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  };
  const sessBtn =
    'inline-flex w-full items-center justify-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-[11px] font-medium text-slate-700 transition hover:border-brand-300 hover:bg-brand-50/40 hover:text-brand-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-brand-500/60 dark:hover:bg-brand-500/15';
  const sessBtnPrimary =
    'inline-flex w-full items-center justify-center gap-1 rounded-md bg-brand-500 px-2 py-1.5 text-[11px] font-semibold text-white transition hover:bg-brand-600';
  const sessChip = (active: boolean) =>
    active
      ? 'flex-1 rounded-md border border-brand-400 bg-brand-50 px-2 py-1 text-[11px] font-medium text-brand-800 dark:bg-brand-500/20 dark:text-brand-100'
      : 'flex-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-600 transition hover:border-brand-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300';

  return (
    <div className="flex flex-col">
      {tab.importError ? (
        <p className="rounded-md border border-rose-200 bg-rose-50 px-2 py-1.5 text-[11px] text-rose-700">
          {tab.importError}
        </p>
      ) : null}
      {/* Live session tools (spec/39): facilitator-run countdown / stopwatch
          + dot-voting, synced to every participant. */}
      <Accordion title="Session" open={open.session} onToggle={() => toggle('session')}>
        {/* Timer */}
        <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Timer
        </p>
        {!timer ? (
          <div className="mt-1 flex flex-col gap-1.5">
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => setTimerMode('countdown')}
                className={sessChip(timerMode === 'countdown')}
              >
                Countdown
              </button>
              <button
                type="button"
                onClick={() => setTimerMode('stopwatch')}
                className={sessChip(timerMode === 'stopwatch')}
              >
                Stopwatch
              </button>
            </div>
            {timerMode === 'countdown' ? (
              <div className="grid grid-cols-4 gap-1">
                {[1, 3, 5, 10].map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setDurationMin(m)}
                    className={sessChip(durationMin === m)}
                  >
                    {m}m
                  </button>
                ))}
              </div>
            ) : null}
            <button
              type="button"
              onClick={() =>
                tab.onStartTimer(
                  timerMode,
                  timerMode === 'countdown' ? durationMin * 60_000 : undefined,
                )
              }
              className={sessBtnPrimary}
            >
              Start {timerMode === 'countdown' ? `${durationMin}m countdown` : 'stopwatch'}
            </button>
          </div>
        ) : (
          <div className="mt-1 flex flex-col gap-1.5">
            <p className="text-[11px] text-slate-600 dark:text-slate-300">
              {timer.mode === 'countdown' ? 'Countdown' : 'Stopwatch'} ·{' '}
              <span className="font-semibold tabular-nums">
                {fmtClock(timerDisplayMs(timer, Date.now()))}
              </span>{' '}
              {timer.running ? 'running' : 'paused'}
            </p>
            <div className="grid grid-cols-3 gap-1">
              {timer.running ? (
                <button type="button" onClick={tab.onPauseTimer} className={sessBtn}>
                  Pause
                </button>
              ) : (
                <button type="button" onClick={tab.onResumeTimer} className={sessBtn}>
                  Resume
                </button>
              )}
              <button type="button" onClick={tab.onResetTimer} className={sessBtn}>
                Reset
              </button>
              <button type="button" onClick={tab.onClearTimer} className={sessBtn}>
                Clear
              </button>
            </div>
          </div>
        )}
        {/* Vote */}
        <p className="mt-3 border-t border-slate-100 pt-3 text-[10px] font-medium uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:text-slate-400">
          Vote
        </p>
        {!vote ? (
          <div className="mt-1 flex flex-col gap-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] text-slate-600 dark:text-slate-300">
                Dots per person
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  aria-label="Fewer dots"
                  onClick={() => setVotesPerPerson((n) => Math.max(1, n - 1))}
                  className="flex h-6 w-6 items-center justify-center rounded-md border border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-300"
                >
                  −
                </button>
                <span className="w-4 text-center text-[12px] font-semibold tabular-nums">
                  {votesPerPerson}
                </span>
                <button
                  type="button"
                  aria-label="More dots"
                  onClick={() => setVotesPerPerson((n) => Math.min(20, n + 1))}
                  className="flex h-6 w-6 items-center justify-center rounded-md border border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-300"
                >
                  +
                </button>
              </div>
            </div>
            <button
              type="button"
              onClick={() => tab.onStartVote(votesPerPerson)}
              className={sessBtnPrimary}
            >
              Start vote
            </button>
          </div>
        ) : (
          <div className="mt-1 flex flex-col gap-1.5">
            <p className="text-[11px] text-slate-600 dark:text-slate-300">
              {vote.active ? 'Voting open' : vote.revealed ? 'Results shown' : 'Voting ended'} ·{' '}
              <span className="font-semibold tabular-nums">{totalVotesCast}</span> cast ·{' '}
              {vote.votesPerPerson} each
            </p>
            <div className="grid grid-cols-2 gap-1">
              {vote.active ? (
                <button type="button" onClick={tab.onEndVote} className={sessBtn}>
                  End vote
                </button>
              ) : !vote.revealed ? (
                <button type="button" onClick={tab.onRevealVote} className={sessBtn}>
                  Show results
                </button>
              ) : (
                <span />
              )}
              <button type="button" onClick={tab.onClearVote} className={sessBtn}>
                Clear
              </button>
            </div>
          </div>
        )}
      </Accordion>
    </div>
  );
}
