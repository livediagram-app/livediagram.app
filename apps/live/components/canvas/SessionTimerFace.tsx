'use client';

import { useEffect, useState } from 'react';
import { DialTicks } from '@/components/canvas/paper-kit';

import { formatTimerClock, timerDone, type TabTimer } from '@livediagram/diagram';

import {
  TIMER_BUTTON_CLASS,
  TimerPillBody,
  TimerPlayIcon,
  timerFillStyle,
} from '@/components/chrome/timer-pill';
import {
  ElementEllipsisMenu,
  ElementMenuSettingsRow,
} from '@/components/canvas/ElementEllipsisMenu';
import { SessionTimerSettings } from '@/components/canvas/SessionElementSettings';

// The face of a Timer session element (spec/105) once it is a real timer
// rather than a button that starts one somewhere else.
//
// It is the SAME timer as the pill in the top chrome, in every sense worth
// having: the same `TabTimer` on the same tab field, the same pure
// `timerDisplayMs`, and — since `timer-pill` was extracted — literally the
// same clock, drain and controls. Pausing here pauses there. Every client
// computes the value locally off an absolute anchor, so there is no
// per-second network traffic and no drift between machines.
//
// Only the furniture differs: a floating banner in the chrome, the element's
// own box on the canvas.

export function SessionTimerFace({
  timer,
  durationMs,
  readOnly,
  borderPx,
  onStart,
  onPause,
  onResume,
  onReset,
  onClear,
  minutes,
  onSetMinutes,
  onOpenSettings,
}: {
  // Null when no timer is running for this tab: the element shows its
  // configured length and a Start.
  timer: TabTimer | null;
  /** The button's own configured length, shown before a timer exists. */
  durationMs: number;
  readOnly: boolean;
  /** The element's own border width, so the drain can cover it. */
  borderPx: number;
  onStart?: () => void;
  onPause?: () => void;
  onResume?: () => void;
  onReset?: () => void;
  onClear?: () => void;
  /** The element's configured length, which the `…` menu edits. */
  minutes: number;
  onSetMinutes?: (minutes: number) => void;
  /** The way out of the presets to the element's full menu (spec/09). */
  onOpenSettings?: () => void;
}) {
  // Re-render 4x a second while running so the clock advances, exactly as the
  // chrome pill does. A paused or absent timer is static, so nothing spins.
  const [, setTick] = useState(0);
  const running = timer?.running === true;
  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => setTick((n) => n + 1), 250);
    return () => window.clearInterval(id);
  }, [running]);

  const now = Date.now();
  const done = timer ? timerDone(timer, now) : false;
  // The canvas treats a press on an element as select-and-maybe-drag, so the
  // controls stop the gesture before it reaches the canvas — otherwise the
  // element moves whenever somebody tries to pause it.
  const swallow = (e: React.PointerEvent) => e.stopPropagation();

  return (
    <div
      className={`pointer-events-none absolute flex items-center justify-center gap-2 overflow-hidden rounded-[inherit] px-3 ${
        done ? 'animate-pulse' : ''
      }`}
      style={{
        // Out to the BORDER box, not the padding box. An absolutely
        // positioned child is placed against the padding box, so at inset-0
        // the drain stopped short and left the element's border as an
        // unpainted ring around a nearly-full timer.
        inset: -borderPx,
        ...(timer ? timerFillStyle(timer, now) : {}),
      }}
    >
      {onSetMinutes ? (
        <ElementEllipsisMenu label="Timer options">
          {(close) => (
            <>
              {/* The Studio's own timer UI, not a second design of it
                  (spec/39): dial, presets, and the Start that runs it for the
                  room. Dragging the dial sets THIS element's length. */}
              <SessionTimerSettings
                config={{ tool: 'timer', minutes }}
                onChange={(next) => onSetMinutes(next.minutes ?? minutes)}
                onClose={close}
              />
              {onOpenSettings ? (
                <ElementMenuSettingsRow
                  onOpen={() => {
                    onOpenSettings();
                    close();
                  }}
                />
              ) : null}
            </>
          )}
        </ElementEllipsisMenu>
      ) : null}
      {/* A DIAL (spec/122). Ticks along the edge you read the digits against
          say "instrument"; the drain behind them is the hand. */}
      <DialTicks textColor="currentColor" />
      {timer ? (
        <TimerPillBody
          timer={timer}
          now={now}
          readOnly={readOnly}
          onPause={onPause ?? (() => {})}
          onResume={onResume ?? (() => {})}
          onReset={onReset ?? (() => {})}
          onClear={onClear ?? (() => {})}
          onPointerDownCapture={swallow}
        />
      ) : (
        <>
          {/* Idle: the same kicker and clock, showing the configured length,
              with one control. Reading identically to a running timer is the
              point — the element does not change shape when it starts. */}
          <span className="select-none text-[10px] font-medium uppercase tracking-wide opacity-70">
            Timer
          </span>
          <span className="select-none text-sm font-semibold tabular-nums">
            {formatTimerClock(durationMs)}
          </span>
          {!readOnly && onStart ? (
            <div className="flex items-center gap-0.5" onPointerDownCapture={swallow}>
              <button
                type="button"
                aria-label="Start timer"
                onClick={onStart}
                className={`pointer-events-auto ${TIMER_BUTTON_CLASS}`}
              >
                <TimerPlayIcon />
              </button>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
