'use client';

// The Timer tool (spec/39). Countdown and Stopwatch are one tool with two
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
import {
  DIAL_LAP_MINUTES,
  clampTimerMinutes,
  dialFraction,
  formatMinutesLabel,
} from './session-studio';
import { TimerDial, type DialTone } from './TimerDial';
import {
  PauseGlyph,
  PlayGlyph,
  RestartGlyph,
  StopGlyph,
  StudioButton,
  StudioSegmented,
  TransportButton,
} from './studio-ui';

const PRESETS = [1, 3, 5, 10, 15, 30] as const;
const EXTENSIONS = [
  { ms: 30_000, label: '+30s' },
  { ms: 60_000, label: '+1 min' },
  { ms: 5 * 60_000, label: '+5 min' },
] as const;
const MODE_OPTIONS = [
  { value: 'countdown', label: 'Countdown' },
  { value: 'stopwatch', label: 'Stopwatch' },
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
  const nudge = (d: number) => setMinutes((m) => clampTimerMinutes(m + d));

  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-center">
        <StudioSegmented
          label="Timer mode"
          options={MODE_OPTIONS}
          value={mode}
          onChange={setMode}
        />
      </div>
      {mode === 'countdown' ? (
        <>
          <div className="flex items-center gap-1">
            <NudgeButton label="One minute less" onClick={() => nudge(-1)} disabled={minutes <= 1}>
              −
            </NudgeButton>
            <div className="min-w-0 flex-1">
              <TimerDial
                fraction={dialFraction(Math.min(minutes, DIAL_LAP_MINUTES) * 60_000)}
                extraLap={minutes > DIAL_LAP_MINUTES}
                setMinutes={Math.min(minutes, DIAL_LAP_MINUTES)}
                onSetMinutes={setMinutes}
              >
                <span className="text-[22px] font-semibold leading-none tabular-nums text-slate-800 dark:text-slate-100">
                  {formatTimerClock(minutes * 60_000)}
                </span>
                <span className="mt-1 text-[9px] font-medium uppercase tracking-wider text-slate-400">
                  Drag to set
                </span>
              </TimerDial>
            </div>
            <NudgeButton label="One minute more" onClick={() => nudge(1)} disabled={minutes >= 120}>
              +
            </NudgeButton>
          </div>
          <div className="grid grid-cols-6 gap-1" role="group" aria-label="Preset lengths">
            {PRESETS.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMinutes(m)}
                aria-pressed={minutes === m}
                className={`rounded-md py-1 text-[11px] font-semibold tabular-nums transition ${
                  minutes === m
                    ? 'bg-brand-500 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-brand-50 hover:text-brand-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-brand-500/15'
                }`}
              >
                {m}m
              </button>
            ))}
          </div>
          <StudioButton
            variant="primary"
            icon={<PlayGlyph size={12} />}
            onClick={() => onStartTimer('countdown', minutes * 60_000)}
          >
            Start {formatMinutesLabel(minutes)} countdown
          </StudioButton>
        </>
      ) : (
        <>
          <TimerDial fraction={0} variant="sweep">
            <span className="text-[22px] font-semibold leading-none tabular-nums text-slate-800 dark:text-slate-100">
              0:00
            </span>
            <span className="mt-1 text-[9px] font-medium uppercase tracking-wider text-slate-400">
              Counts up
            </span>
          </TimerDial>
          <StudioButton
            variant="primary"
            icon={<PlayGlyph size={12} />}
            onClick={() => onStartTimer('stopwatch')}
          >
            Start stopwatch
          </StudioButton>
        </>
      )}
      <p className="text-center text-[10px] leading-snug text-slate-400 dark:text-slate-500">
        Everyone on this tab sees the same clock.
      </p>
    </div>
  );
}

function NudgeButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-[15px] font-semibold text-slate-600 transition hover:border-brand-300 hover:text-brand-700 disabled:opacity-30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
    >
      {children}
    </button>
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
