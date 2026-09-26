'use client';

// The Timer tool (docs/specs/012-collaboration/session-tools.md). Countdown and Stopwatch are one tool with two
// modes, because a tab runs ONE timer: they used to be two sibling menu
// categories, each warning that starting it would reset the other, which is
// the interface admitting it had split one thing in two.
//
// Setting up, the dial is the input: drag round to the length, or tap a
// preset. Running, the same dial becomes the readout, with media-player
// transport underneath and quick "+1 min" extensions for the moment the
// room needs a little longer.

import { useState } from 'react';
import {
  formatTimerClock,
  timerDisplayMs,
  type TabTimer,
  type TimerMode,
} from '@livediagram/diagram';
import { useNow } from '@/hooks/ui/useNow';
import type { SessionToolsProps } from '@/components/chrome/session-tools-props';
import { DIAL_LAP_MINUTES, dialFraction, formatMinutesLabel } from './session-studio';
import { TimerDial, type DialTone } from './TimerDial';
import { TimerSetupBody } from './TimerSetupBody';
import { PauseGlyph, PlayGlyph, RestartGlyph, StopGlyph, TransportButton } from './studio-ui';

const EXTENSIONS = [
  { ms: 30_000, label: '+30s' },
  { ms: 60_000, label: '+1 min' },
  { ms: 5 * 60_000, label: '+5 min' },
] as const;

type TimerPaneProps = Pick<
  SessionToolsProps,
  | 'timer'
  | 'onStartTimer'
  | 'onPauseTimer'
  | 'onResumeTimer'
  | 'onResetTimer'
  | 'onClearTimer'
  | 'onExtendTimer'
>;

export function TimerPane(props: TimerPaneProps) {
  return props.timer ? <LiveTimer {...props} timer={props.timer} /> : <TimerSetup {...props} />;
}

function TimerSetup({ onStartTimer }: TimerPaneProps) {
  const [mode, setMode] = useState<TimerMode>('countdown');
  const [minutes, setMinutes] = useState(5);
  return (
    <TimerSetupBody
      minutes={minutes}
      onMinutesChange={setMinutes}
      mode={mode}
      onModeChange={setMode}
      onStartTimer={onStartTimer}
    />
  );
}

function LiveTimer({
  timer,
  onStartTimer,
  onPauseTimer,
  onResumeTimer,
  onResetTimer,
  onClearTimer,
  onExtendTimer,
}: TimerPaneProps & { timer: TabTimer }) {
  const now = useNow(timer.running);
  const ms = timerDisplayMs(timer, now);
  const countdown = timer.mode === 'countdown';
  const done = countdown && ms <= 0;
  const status = done ? "Time's up" : timer.running ? 'Running' : 'Paused';

  // The wedge is time LEFT against a one-hour lap; the stopwatch sweeps once
  // a minute so something visibly moves while it counts.
  const fraction = countdown ? dialFraction(ms) : (ms % 60_000) / 60_000;
  const tone: DialTone = done
    ? 'rose'
    : !timer.running
      ? 'slate'
      : countdown && ms <= 60_000
        ? 'amber'
        : 'brand';

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-200">
          {countdown
            ? `Countdown · ${formatMinutesLabel(Math.round((timer.durationMs ?? 0) / 60_000))}`
            : 'Stopwatch'}
        </span>
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
            done
              ? 'bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300'
              : timer.running
                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
                : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
          }`}
        >
          {timer.running && !done ? (
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" aria-hidden />
          ) : null}
          {status}
        </span>
      </div>
      <TimerDial
        fraction={fraction}
        variant={countdown ? 'wedge' : 'sweep'}
        tone={tone}
        extraLap={countdown && ms > DIAL_LAP_MINUTES * 60_000}
      >
        <span
          className={`text-[26px] font-semibold leading-none tabular-nums ${
            done ? 'text-rose-600 dark:text-rose-400' : 'text-slate-800 dark:text-slate-100'
          }`}
        >
          {formatTimerClock(ms)}
        </span>
        <span className="mt-1 text-[9px] font-medium uppercase tracking-wider text-slate-400">
          {countdown ? 'left' : 'elapsed'}
        </span>
      </TimerDial>
      {countdown ? (
        <div className="grid grid-cols-3 gap-1" role="group" aria-label="Add time">
          {EXTENSIONS.map((x) => (
            <button
              key={x.ms}
              type="button"
              onClick={() => onExtendTimer(x.ms)}
              className="rounded-md bg-slate-100 py-1 text-[11px] font-semibold text-slate-600 transition hover:bg-brand-50 hover:text-brand-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-brand-500/15 dark:hover:text-brand-200"
            >
              {x.label}
            </button>
          ))}
        </div>
      ) : null}
      <div className="flex items-end justify-center gap-6">
        <TransportButton label="Reset" icon={<RestartGlyph />} onClick={onResetTimer} />
        {done ? (
          <TransportButton
            primary
            label="Again"
            icon={<RestartGlyph />}
            onClick={() => onStartTimer('countdown', timer.durationMs)}
          />
        ) : timer.running ? (
          <TransportButton primary label="Pause" icon={<PauseGlyph />} onClick={onPauseTimer} />
        ) : (
          <TransportButton primary label="Resume" icon={<PlayGlyph />} onClick={onResumeTimer} />
        )}
        <TransportButton label="End" icon={<StopGlyph />} onClick={onClearTimer} />
      </div>
      <p className="text-center text-[10px] leading-snug text-slate-400 dark:text-slate-500">
        A tab runs one timer. End this one to start a different kind.
      </p>
    </div>
  );
}
