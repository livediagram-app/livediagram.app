'use client';

import { formatTimerClock, timerDone, timerDisplayMs, type TabTimer } from '@livediagram/document';
import { Glyph } from '@livediagram/ui';

// The session timer's LOOK, in one place (docs/specs/012-collaboration/session-tools.md, docs/specs/012-collaboration/session-button.md).
//
// Two surfaces show the same `TabTimer` and should not be two drawings of it
// that drift: the Timer element on the canvas renders the pill, and the
// Session strip's Timer button shares its drain (`timerFillStyle`).
//
// Presentation only. The timer state, the ticking and the handlers belong to
// the caller: each surface ticks for itself, and neither owns the other's
// re-render.

/** Icon buttons, shared so the two surfaces cannot drift on the glyphs either. */
export function TimerCloseIcon() {
  return (
    <Glyph size={14} units={16}>
      <path d="M4.5 4.5l7 7M11.5 4.5l-7 7" />
    </Glyph>
  );
}

export function TimerPauseIcon() {
  return (
    <Glyph size={14} units={16} filled>
      <rect x="4" y="3" width="3" height="10" rx="1" />
      <rect x="9" y="3" width="3" height="10" rx="1" />
    </Glyph>
  );
}

export function TimerPlayIcon() {
  return (
    <Glyph size={14} units={16} filled>
      <path d="M5 3.5v9l8-4.5z" />
    </Glyph>
  );
}

export function TimerResetIcon() {
  return (
    <Glyph size={14} units={16}>
      <path d="M2.5 8a5.5 5.5 0 1 0 1.7-4" />
      <path d="M3.5 2.5v3h3" />
    </Glyph>
  );
}

export const TIMER_BUTTON_CLASS =
  'flex h-6 w-6 items-center justify-center rounded-md text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white';

/**
 * The drain: a countdown empties left to right as time runs out, so the
 * remaining time is readable from across a room without parsing the digits.
 *
 * Painted as a hard-stop background gradient rather than a positioned fill
 * layer — no extra DOM, and the clock and buttons stay on top without needing
 * a stacking context. A stopwatch counts up with no known end, so it has
 * nothing to drain and gets no fill.
 */
export function timerFillStyle(
  timer: TabTimer,
  now: number,
): { backgroundImage: string; transition: string } | undefined {
  const ms = timerDisplayMs(timer, now);
  const total = timer.mode === 'countdown' ? timer.durationMs : undefined;
  if (!total) return undefined;
  const pct = Math.max(0, Math.min(1, ms / total)) * 100;
  const color = timerDone(timer, now)
    ? 'rgb(244 63 94 / 0.22)'
    : 'color-mix(in srgb, var(--color-brand-500) 22%, transparent)';
  return {
    // Hard stop = a crisp fill edge rather than a smear.
    backgroundImage: `linear-gradient(to right, ${color} ${pct}%, transparent ${pct}%)`,
    transition: 'background-image 250ms linear',
  };
}

/**
 * The pill's contents: the kicker, the clock, and the controls.
 *
 * The caller supplies the container, because the two surfaces sit in different
 * furniture — a floating banner in the chrome, the element's own box on the
 * canvas — and only the container differs.
 */
export function TimerPillBody({
  timer,
  now,
  readOnly,
  onPause,
  onResume,
  onReset,
  onClear,
  onPointerDownCapture,
}: {
  timer: TabTimer;
  now: number;
  readOnly: boolean;
  onPause: () => void;
  onResume: () => void;
  onReset: () => void;
  onClear: () => void;
  // The canvas treats a press on an element as select-and-maybe-drag, so the
  // element surface passes a stopPropagation here. The chrome passes nothing.
  onPointerDownCapture?: (e: React.PointerEvent) => void;
}) {
  const ms = timerDisplayMs(timer, now);
  return (
    <>
      <span className="select-none text-[10px] font-medium uppercase tracking-wide opacity-70">
        {timer.mode === 'countdown' ? 'Timer' : 'Stopwatch'}
      </span>
      <span className="select-none text-sm font-semibold tabular-nums">{formatTimerClock(ms)}</span>
      {/* pointer-events-auto below: on the canvas the element's face is inert
          so drags reach the canvas, and the controls have to opt back in. It
          changes nothing in the chrome, where everything is already live. */}
      {!readOnly ? (
        <div
          className="pointer-events-auto flex items-center gap-0.5"
          onPointerDownCapture={onPointerDownCapture}
        >
          {timer.running ? (
            <button
              type="button"
              aria-label="Pause timer"
              onClick={onPause}
              className={TIMER_BUTTON_CLASS}
            >
              <TimerPauseIcon />
            </button>
          ) : (
            <button
              type="button"
              aria-label="Resume timer"
              onClick={onResume}
              className={TIMER_BUTTON_CLASS}
            >
              <TimerPlayIcon />
            </button>
          )}
          <button
            type="button"
            aria-label="Reset timer"
            onClick={onReset}
            className={TIMER_BUTTON_CLASS}
          >
            <TimerResetIcon />
          </button>
          <button
            type="button"
            aria-label="Remove timer"
            onClick={onClear}
            className={TIMER_BUTTON_CLASS}
          >
            <TimerCloseIcon />
          </button>
        </div>
      ) : null}
    </>
  );
}
