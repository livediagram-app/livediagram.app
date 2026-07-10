'use client';

// The facilitator session tools (spec/39): the Countdown and Stopwatch
// timers and the dot-vote, with their full controls (duration picker,
// pause / resume / reset, dots-per-person stepper, reveal). Split into
// independent category bodies — Countdown, Stopwatch, and Vote — so the tab
// context menu surfaces each as its own collapsible category. Each renders
// just the category BODY; the caller wraps it in its own
// MenuAccordionSection.
//
// One timer runs per tab (Tab.timer holds a single TabTimer): starting a
// countdown replaces a running stopwatch and vice versa, and each section
// says so before it happens.

import { useEffect, useState } from 'react';
import {
  timerDisplayMs,
  type TabTimer,
  type TabVote,
  type TimerMode,
  formatTimerClock,
} from '@livediagram/diagram';

const sessChip = (on: boolean) =>
  on
    ? 'flex-1 rounded-md border border-brand-400 bg-brand-50 px-2 py-1 text-[11px] font-medium text-brand-800 dark:bg-brand-500/20 dark:text-brand-100'
    : 'flex-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-600 transition hover:border-brand-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300';
const sessBtn =
  'inline-flex w-full items-center justify-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-[11px] font-medium text-slate-700 transition hover:border-brand-300 hover:bg-brand-50/40 hover:text-brand-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-brand-500/60 dark:hover:bg-brand-500/15';
const sessBtnPrimary =
  'inline-flex w-full items-center justify-center gap-1 rounded-md bg-brand-500 px-2 py-1.5 text-[11px] font-semibold text-white transition hover:bg-brand-600';

type TimerProps = {
  timer: TabTimer | null;
  onStartTimer: (mode: TimerMode, durationMs?: number) => void;
  onPauseTimer: () => void;
  onResumeTimer: () => void;
  onResetTimer: () => void;
  onClearTimer: () => void;
};

// Half-second tick while a timer is on screen, so the clock readout runs
// live instead of freezing at whatever Date.now() the last render saw.
function useTimerTick(active: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(id);
  }, [active]);
  return active ? now : Date.now();
}

// The running / paused timer card the Countdown and Stopwatch categories
// share: a live big-digit clock, a status line, a progress track for
// countdowns, and the pause / resume / reset / clear row.
function RunningTimerCard({
  timer,
  onPauseTimer,
  onResumeTimer,
  onResetTimer,
  onClearTimer,
}: Omit<TimerProps, 'timer' | 'onStartTimer'> & { timer: TabTimer }) {
  const now = useTimerTick(true);
  const ms = timerDisplayMs(timer, now);
  const done = timer.mode === 'countdown' && ms <= 0;
  const pct =
    timer.mode === 'countdown' && timer.durationMs
      ? Math.max(0, Math.min(1, ms / timer.durationMs))
      : null;
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-col items-center rounded-lg border border-slate-200 bg-slate-50/70 px-2 py-2 dark:border-slate-700 dark:bg-slate-800/60">
        <span
          className={`text-2xl font-semibold leading-tight tabular-nums ${
            done ? 'text-rose-600 dark:text-rose-400' : 'text-slate-800 dark:text-slate-100'
          }`}
        >
          {formatTimerClock(ms)}
        </span>
        <span className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider text-slate-400 dark:text-slate-500">
          {timer.running && !done ? (
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" aria-hidden />
          ) : null}
          {done ? "Time's up" : timer.running ? 'Running' : 'Paused'}
        </span>
        {pct !== null ? (
          <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
            <div
              className={`h-full rounded-full transition-[width] duration-500 ease-linear ${
                done ? 'bg-rose-500' : 'bg-brand-500'
              }`}
              style={{ width: `${pct * 100}%` }}
            />
          </div>
        ) : null}
      </div>
      <div className="grid grid-cols-3 gap-1">
        {timer.running ? (
          <button type="button" onClick={onPauseTimer} className={sessBtn}>
            Pause
          </button>
        ) : (
          <button type="button" onClick={onResumeTimer} className={sessBtn}>
            Resume
          </button>
        )}
        <button type="button" onClick={onResetTimer} className={sessBtn}>
          Reset
        </button>
        <button type="button" onClick={onClearTimer} className={sessBtn}>
          Clear
        </button>
      </div>
    </div>
  );
}

// One-line heads-up that starting this tool replaces the other one (a tab
// runs a single timer, spec/39).
function ReplacesNote({ other }: { other: 'countdown' | 'stopwatch' }) {
  return (
    <p className="rounded-md bg-amber-50 px-2 py-1 text-[10px] leading-snug text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
      Starting resets the running {other}.
    </p>
  );
}

// The Countdown category body: duration picker + start, or the running
// card when the tab's timer is a countdown.
export function SessionCountdownSection({
  timer,
  onStartTimer,
  onPauseTimer,
  onResumeTimer,
  onResetTimer,
  onClearTimer,
}: TimerProps) {
  const [durationMin, setDurationMin] = useState(5);
  return (
    <div className="px-2.5 pb-2 pt-1">
      {timer?.mode === 'countdown' ? (
        <RunningTimerCard
          timer={timer}
          onPauseTimer={onPauseTimer}
          onResumeTimer={onResumeTimer}
          onResetTimer={onResetTimer}
          onClearTimer={onClearTimer}
        />
      ) : (
        <div className="flex flex-col gap-1.5">
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
          {timer ? <ReplacesNote other="stopwatch" /> : null}
          <button
            type="button"
            onClick={() => onStartTimer('countdown', durationMin * 60_000)}
            className={sessBtnPrimary}
          >
            Start {durationMin}m countdown
          </button>
        </div>
      )}
    </div>
  );
}

// The Stopwatch category body: start, or the running card when the tab's
// timer is a stopwatch.
export function SessionStopwatchSection({
  timer,
  onStartTimer,
  onPauseTimer,
  onResumeTimer,
  onResetTimer,
  onClearTimer,
}: TimerProps) {
  return (
    <div className="px-2.5 pb-2 pt-1">
      {timer?.mode === 'stopwatch' ? (
        <RunningTimerCard
          timer={timer}
          onPauseTimer={onPauseTimer}
          onResumeTimer={onResumeTimer}
          onResetTimer={onResetTimer}
          onClearTimer={onClearTimer}
        />
      ) : (
        <div className="flex flex-col gap-1.5">
          {timer ? <ReplacesNote other="countdown" /> : null}
          <button
            type="button"
            onClick={() => onStartTimer('stopwatch')}
            className={sessBtnPrimary}
          >
            Start stopwatch
          </button>
        </div>
      )}
    </div>
  );
}

type VoteProps = {
  vote: TabVote | null;
  onStartVote: (votesPerPerson: number) => void;
  onEndVote: () => void;
  onRevealVote: () => void;
  onClearVote: () => void;
};

// The Vote category body: the dots-per-person stepper before start, then the
// live-vote controls (end / reveal / clear).
export function SessionVoteSection({
  vote,
  onStartVote,
  onEndVote,
  onRevealVote,
  onClearVote,
}: VoteProps) {
  const [votesPerPerson, setVotesPerPerson] = useState(3);
  const totalVotesCast = vote ? Object.values(vote.votes).reduce((n, ids) => n + ids.length, 0) : 0;

  return (
    <div className="px-2.5 pb-2 pt-1">
      {!vote ? (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] text-slate-600 dark:text-slate-300">Dots per person</span>
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
            onClick={() => onStartVote(votesPerPerson)}
            className={sessBtnPrimary}
          >
            Start vote
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          <p className="text-[11px] text-slate-600 dark:text-slate-300">
            {vote.active ? 'Voting open' : vote.revealed ? 'Results shown' : 'Voting ended'} ·{' '}
            <span className="font-semibold tabular-nums">{totalVotesCast}</span> cast ·{' '}
            {vote.votesPerPerson} each
          </p>
          <div className="grid grid-cols-2 gap-1">
            {vote.active ? (
              <button type="button" onClick={onEndVote} className={sessBtn}>
                End vote
              </button>
            ) : !vote.revealed ? (
              <button type="button" onClick={onRevealVote} className={sessBtn}>
                Show results
              </button>
            ) : (
              <span />
            )}
            <button type="button" onClick={onClearVote} className={sessBtn}>
              Clear
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
