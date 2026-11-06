'use client';

import { useCallback, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { Tooltip } from '@livehuddle/ui';
import {
  PIECE_TIMER_PHASE_WORD,
  STOPWATCH_ART,
  TIMER_ART,
  TIMER_PIECE_NAME,
  TIMER_PIECE_SIZE,
  TIMER_PIECE_TONES as T,
  pausePieceTimer,
  pieceTimerOf,
  pieceTimerPhase,
  pieceTimerReadout,
  resetPieceTimer,
  setPieceTimerMinutes,
  startPieceTimer,
  stopwatchTicks,
  timerDigitSize,
  type PieceTimer,
  type PieceTimerPhase,
  type ShapeElement,
  type TimerPieceKind,
} from '@livehuddle/document';
import { pieceControlProps } from '@/lib/piece-control';
import { useTickerValue } from '@/lib/timer-ticker';
import { useTimerChime } from '@/lib/timer-chime';
import { pressTimerPiece, useTimerTakePart } from '@/lib/timer-piece-controls';
import { track } from '@/lib/telemetry';

// The length popover loads on the first press of Set, so a canvas of Timers carries only the face.
const TimerLengthPopover = dynamic(
  () => import('./TimerLengthPopover').then((m) => m.TimerLengthPopover),
  { ssr: false },
);

// The Timer and Stopwatch faces (docs/specs/009-elements/timer-and-stopwatch.md): the body, the display with the time
// every screen works out from its own clock, the state word, and the controls as the piece's own buttons under it
// (a press is the control's alone, never a selection, a drag or a walk: pieceControlProps). The time comes from the
// one shared ticker, and only while the piece runs; the face re-renders when its readout changes, once a second. A
// placement preview (`live` false) draws the idle face with no buttons and no ticking.

const PILL =
  'pointer-events-auto flex cursor-pointer items-center gap-1 whitespace-nowrap rounded-full border border-slate-300 bg-white/95 px-2 py-[2px] text-[9px] font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-sky-500 dark:border-slate-600 dark:bg-slate-800/95 dark:text-slate-100 dark:hover:bg-slate-700';

/** The readout and phase at `now`, as one string so equal ticks keep the render. */
function readKey(kind: TimerPieceKind, state: PieceTimer, now: number): string {
  return `${pieceTimerPhase(kind, state, now)}|${pieceTimerReadout(kind, state, now)}`;
}

export function TimerView({ element, live = false }: { element: ShapeElement; live?: boolean }) {
  const kind: TimerPieceKind = element.shape === 'stopwatch' ? 'stopwatch' : 'timer';
  const stored = element.pieceTimer;
  const state = useMemo(() => pieceTimerOf({ shape: kind, pieceTimer: stored }), [kind, stored]);
  const read = useCallback((now: number) => readKey(kind, state, now), [kind, state]);
  // Subscribed while running, and keeping the ticker going only until a Timer's end: a paused, idle or finished piece
  // costs nothing.
  const until =
    kind === 'timer' ? state.startedAt + state.durationMs - state.accumulatedMs : Infinity;
  const key = useTickerValue(live && state.running, read, until);
  const cut = key.indexOf('|');
  const phase = key.slice(0, cut) as PieceTimerPhase;
  const readout = key.slice(cut + 1);
  useTimerChime(element.id, live ? kind : 'none', state);
  const name = TIMER_PIECE_NAME[kind];
  const word = PIECE_TIMER_PHASE_WORD[phase];
  const box = TIMER_PIECE_SIZE[kind];
  return (
    <div className="pointer-events-none absolute inset-0">
      <svg
        viewBox={`0 0 ${box.width} ${box.height}`}
        className="absolute inset-0 h-full w-full overflow-visible"
        role="img"
        aria-label={`${name}, ${readout} ${kind === 'timer' ? 'left' : 'taken'}, ${word}`}
        data-timer-phase={phase}
      >
        {kind === 'timer' ? (
          <TimerBody readout={readout} word={word} done={phase === 'done'} />
        ) : (
          <StopwatchBody readout={readout} word={word} done={phase === 'done'} />
        )}
      </svg>
      {live ? <TimerControls element={element} kind={kind} state={state} phase={phase} /> : null}
    </div>
  );
}

function Digits({ kind, readout, done }: { kind: TimerPieceKind; readout: string; done: boolean }) {
  const d = kind === 'timer' ? TIMER_ART.digits : STOPWATCH_ART.digits;
  const size = timerDigitSize(kind, readout);
  return (
    <text
      x={d.x}
      y={d.y - (kind === 'timer' && size < d.size ? 2 : 0)}
      textAnchor="middle"
      fontSize={size}
      fontWeight={700}
      fill={done ? T.inkDone : T.ink}
      style={{ fontVariantNumeric: 'tabular-nums' }}
    >
      {readout}
    </text>
  );
}

function TimerBody({ readout, word, done }: { readout: string; word: string; done: boolean }) {
  const a = TIMER_ART;
  return (
    <>
      <rect {...rectOf(a.button)} fill={T.button} stroke={T.edge} />
      <rect {...rectOf(a.body)} x={a.body.x + 1} y={a.body.y + 3} fill={T.shadow} opacity={0.14} />
      <rect {...rectOf(a.body)} fill={T.body} stroke={T.edge} />
      <rect
        {...rectOf(a.display)}
        fill={done ? T.displayDone : T.display}
        className={done ? 'lh-timer-flash' : undefined}
      />
      <Digits kind="timer" readout={readout} done={done} />
      <text
        x={a.word.x}
        y={a.word.y}
        textAnchor="middle"
        fontSize={a.word.size}
        fontWeight={600}
        fill={T.word}
      >
        {word}
      </text>
    </>
  );
}

const TICKS = stopwatchTicks();

function StopwatchBody({ readout, word, done }: { readout: string; word: string; done: boolean }) {
  const a = STOPWATCH_ART;
  return (
    <>
      <rect {...rectOf(a.crown)} fill={T.crown} stroke={T.edge} />
      <rect x={a.stem.x} y={a.stem.y} width={a.stem.w} height={a.stem.h} fill={T.crown} />
      <circle cx={a.body.cx + 1} cy={a.body.cy + 3} r={a.body.r} fill={T.shadow} opacity={0.14} />
      <circle cx={a.body.cx} cy={a.body.cy} r={a.body.r} fill={T.body} stroke={T.edge} />
      <circle
        cx={a.face.cx}
        cy={a.face.cy}
        r={a.face.r}
        fill={done ? T.displayDone : T.display}
        className={done ? 'lh-timer-flash' : undefined}
      />
      {TICKS.map((t, i) => (
        <line key={i} {...t} stroke={T.tick} strokeWidth={1.2} strokeLinecap="round" />
      ))}
      <Digits kind="stopwatch" readout={readout} done={done} />
      <text
        x={a.word.x}
        y={a.word.y}
        textAnchor="middle"
        fontSize={a.word.size}
        fontWeight={600}
        fill={T.wordOnFace}
      >
        {word}
      </text>
    </>
  );
}

const rectOf = (r: { x: number; y: number; w: number; h: number; rx: number }) => ({
  x: r.x,
  y: r.y,
  width: r.w,
  height: r.h,
  rx: r.rx,
});

// The buttons under the piece, for those who may run it (`can.takePart`); a Viewer sees none.
function TimerControls({
  element,
  kind,
  state,
  phase,
}: {
  element: ShapeElement;
  kind: TimerPieceKind;
  state: PieceTimer;
  phase: PieceTimerPhase;
}) {
  const takePart = useTimerTakePart();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  if (!takePart) return null;
  const name = TIMER_PIECE_NAME[kind];
  const token = kind === 'timer' ? 'Timer' : 'Stopwatch';
  const running = state.running && phase !== 'done';
  const primary = running ? 'Pause' : phase === 'done' ? 'Restart' : 'Start';
  const press = (next: PieceTimer) => pressTimerPiece(element.id, next);
  const onPrimary = () => {
    const now = Date.now();
    if (running) {
      press(pausePieceTimer(kind, state, now));
      track('Element', 'Toggled', `${token}Paused`);
      return;
    }
    press(startPieceTimer(kind, state, now));
    track('Element', 'Started', token);
  };
  const onReset = () => {
    press(resetPieceTimer(state));
    track('Element', 'Changed', `${token}Reset`);
  };
  return (
    <div className="pointer-events-none absolute left-1/2 top-[calc(100%+3px)] flex -translate-x-1/2 gap-1">
      <Tooltip label={`${primary} ${name}`}>
        <button
          type="button"
          className={PILL}
          aria-label={`${primary} ${name}`}
          // The piece's main action: a click anywhere on it while walking presses this (avatar-click-intent).
          data-piece-main=""
          {...pieceControlProps}
          onClick={(e) => {
            e.stopPropagation();
            onPrimary();
          }}
        >
          <span aria-hidden>{running ? '❚❚' : '▶'}</span>
          {primary}
        </button>
      </Tooltip>
      {phase !== 'ready' ? (
        <Tooltip label={`Reset ${name}`}>
          <button
            type="button"
            className={PILL}
            aria-label={`Reset ${name}`}
            {...pieceControlProps}
            onClick={(e) => {
              e.stopPropagation();
              onReset();
            }}
          >
            <span aria-hidden>↺</span>
            Reset
          </button>
        </Tooltip>
      ) : null}
      {kind === 'timer' ? (
        <Tooltip label="Set Timer Length">
          <button
            type="button"
            className={PILL}
            aria-label="Set Timer Length"
            aria-haspopup="dialog"
            aria-expanded={anchor !== null}
            {...pieceControlProps}
            onClick={(e) => {
              e.stopPropagation();
              const at = e.currentTarget;
              setAnchor((v) => (v ? null : at));
            }}
          >
            Set
          </button>
        </Tooltip>
      ) : null}
      {anchor ? (
        <TimerLengthPopover
          anchor={anchor}
          minutes={Math.round(state.durationMs / 60_000)}
          onClose={() => setAnchor(null)}
          onSet={(minutes) => {
            press(setPieceTimerMinutes(minutes));
            track('Element', 'Changed', 'TimerLength');
            setAnchor(null);
          }}
        />
      ) : null}
    </div>
  );
}
