'use client';

// The timer's setup UI (spec/39): mode toggle, dial, presets, and the button
// that starts it. ONE component, rendered in three places — the Session
// Studio's Timer pane, a timer element's `…` quick menu, and that element's
// right-click Session category — because they were three different UIs for one
// question and drifted accordingly: a dial here, a row of eight "N minutes"
// rows there, a number field in the third.
//
// CONTROLLED, which is what lets one component serve both jobs. In the Studio
// `minutes` is local state and means "what I am about to start". On an element
// it is the element's stored config, so dragging the dial SETS THE BUTTON and
// pressing Start also runs it now. Those are the same number, which is why one
// component can do both without a mode flag.

import { formatTimerClock, type TimerMode } from '@livediagram/diagram';
import {
  DIAL_LAP_MINUTES,
  clampTimerMinutes,
  dialFraction,
  formatMinutesLabel,
} from './session-studio';
import { TimerPresetChips } from './TimerPresetChips';
import { TimerDial } from './TimerDial';
import { PlayGlyph, StudioButton, StudioSegmented } from './studio-ui';

const MODE_OPTIONS = [
  { value: 'countdown', label: 'Countdown' },
  { value: 'stopwatch', label: 'Stopwatch' },
] as const;

export function TimerSetupBody({
  minutes,
  onMinutesChange,
  mode,
  onModeChange,
  onStartTimer,
  showModeToggle = true,
}: {
  minutes: number;
  onMinutesChange: (minutes: number) => void;
  mode: TimerMode;
  onModeChange: (mode: TimerMode) => void;
  onStartTimer: (mode: TimerMode, durationMs?: number) => void;
  /**
   * The Studio offers both modes, because it is the one place you choose which
   * kind of clock to run. A TIMER ELEMENT does not: it is a countdown you
   * placed on the canvas, and a stopwatch is its own element (spec/105), so a
   * toggle here would offer to turn one element into another.
   */
  showModeToggle?: boolean;
}) {
  const nudge = (d: number) => onMinutesChange(clampTimerMinutes(minutes + d));

  return (
    <div className="flex flex-col gap-3">
      {showModeToggle ? (
        <div className="flex justify-center">
          <StudioSegmented
            label="Timer mode"
            options={MODE_OPTIONS}
            value={mode}
            onChange={onModeChange}
          />
        </div>
      ) : null}
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
                onSetMinutes={onMinutesChange}
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
          <TimerPresetChips minutes={minutes} onPick={onMinutesChange} />
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
