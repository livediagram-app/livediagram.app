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
  onClear,
}: {
  timer: TabTimer;
  readOnly: boolean;
  onPause: () => void;
  onResume: () => void;
  onReset: () => void;
  // Dismiss the timer entirely. Reset only returns it to its starting value,
  // so without this the pill could be stopped but never got off the canvas
  // except by going back into the tab menu that started it.
  onClear: () => void;
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

  // Countdowns drain: the pill starts fully tinted and empties left-to-right
  // as time runs out, so the remaining time is readable at a glance from
  // across a room without parsing the digits. Same read as the progress
  // track in the tab menu's timer card.
  //
  // Painted as a hard-stop background gradient rather than an absolutely
  // positioned fill layer — no extra DOM, and the clock / buttons stay on
  // top without a stacking context. A stopwatch counts UP with no known
  // end, so it has nothing to drain and gets no fill.
  const remaining =
    timer.mode === 'countdown' && timer.durationMs
      ? Math.max(0, Math.min(1, ms / timer.durationMs))
      : null;
  const fillPct = remaining === null ? null : remaining * 100;
  const fillColor = done
    ? 'rgb(244 63 94 / 0.22)'
    : 'color-mix(in srgb, var(--color-brand-500) 22%, transparent)';

  return (
    <TopCenterBanner
      tone={done ? 'danger' : 'neutral'}
      className={'gap-2 py-1 pl-3 pr-1.5' + (done ? ' animate-pulse' : '')}
      style={
        fillPct === null
          ? undefined
          : {
              // Hard stop = a crisp fill edge rather than a smear.
              backgroundImage: `linear-gradient(to right, ${fillColor} ${fillPct}%, transparent ${fillPct}%)`,
              transition: 'background-image 250ms linear',
            }
      }
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
          <button type="button" aria-label="Remove timer" onClick={onClear} className={btn}>
            <CloseIcon />
          </button>
        </div>
      ) : null}
    </TopCenterBanner>
  );
}

function CloseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M4.5 4.5l7 7M11.5 4.5l-7 7"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
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
