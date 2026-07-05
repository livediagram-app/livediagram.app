'use client';

import { useEffect, useState } from 'react';
import { timerDisplayMs, timerDone, type TabTimer, formatTimerClock } from '@livediagram/diagram';
import { TopCenterBanner } from '@/components/chrome/TopCenter';

// Floating session-timer pill (spec/39). Renders the active tab's
// countdown / stopwatch, ticking LOCALLY off the timer's absolute anchor
// (no per-second network traffic — all clients compute the same value).
// Facilitators (edit-role) get pause/resume + reset inline; viewers see a
// read-only clock. Start / duration / clear live in the Tab Settings.
export function TimerWidget({
  timer,
  readOnly,
  onPause,
  onResume,
  onReset,
}: {
  timer: TabTimer;
  readOnly: boolean;
  onPause: () => void;
  onResume: () => void;
  onReset: () => void;
}) {
  // Re-render ~4x/sec while running so the clock advances. Paused timers
  // are static, so we don't spin a timer then.
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!timer.running) return;
    const id = setInterval(() => setTick((n) => n + 1), 250);
    return () => clearInterval(id);
  }, [timer.running]);

  const ms = timerDisplayMs(timer, Date.now());
  const done = timerDone(timer, Date.now());
  const btn =
    'flex h-6 w-6 items-center justify-center rounded-md text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800';

  return (
    <TopCenterBanner
      tone={done ? 'danger' : 'neutral'}
      className={'gap-2 py-1 pl-3 pr-1.5' + (done ? ' animate-pulse' : '')}
    >
      <span className="select-none text-[10px] font-medium uppercase tracking-wide opacity-70">
        {timer.mode === 'countdown' ? 'Timer' : 'Stopwatch'}
      </span>
      <span className="select-none text-sm font-semibold tabular-nums">{formatTimerClock(ms)}</span>
      {!readOnly ? (
        <div className="flex items-center gap-0.5">
          {timer.running ? (
            <button type="button" aria-label="Pause timer" onClick={onPause} className={btn}>
              <PauseIcon />
            </button>
          ) : (
            <button type="button" aria-label="Resume timer" onClick={onResume} className={btn}>
              <PlayIcon />
            </button>
          )}
          <button type="button" aria-label="Reset timer" onClick={onReset} className={btn}>
            <ResetIcon />
          </button>
        </div>
      ) : null}
    </TopCenterBanner>
  );
}

function PauseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      <rect x="4" y="3" width="3" height="10" rx="1" />
      <rect x="9" y="3" width="3" height="10" rx="1" />
    </svg>
  );
}
function PlayIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      <path d="M5 3.5v9l8-4.5z" />
    </svg>
  );
}
function ResetIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M2.5 8a5.5 5.5 0 1 0 1.7-4" />
      <path d="M3.5 2.5v3h3" />
    </svg>
  );
}
