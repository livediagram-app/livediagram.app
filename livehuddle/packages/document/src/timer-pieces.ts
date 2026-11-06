// The Timer and Stopwatch pieces (docs/specs/009-elements/timer-and-stopwatch.md): a meeting room's clock, placed in
// the Meeting category. What is stored (`pieceTimer`), its bounds, the pure verbs every press runs, the time every
// screen works out from its own clock, and the drawings both renderers share (the editor's TimerView and the export's
// svg-render-timers). Pure: no React, no DOM, no clock of its own (every caller passes `now`).

export type TimerPieceKind = 'timer' | 'stopwatch';
export const TIMER_PIECE_KINDS: readonly TimerPieceKind[] = ['timer', 'stopwatch'];

export function isTimerPieceShape(kind: string): kind is TimerPieceKind {
  return kind === 'timer' || kind === 'stopwatch';
}

/** What a Timer or Stopwatch stores (`ShapeElement.pieceTimer`): one shape for both. */
export type PieceTimer = {
  /** Counting now. */
  running: boolean;
  /** Epoch ms the current run started; 0 while not running. */
  startedAt: number;
  /** Time counted before the current run. */
  accumulatedMs: number;
  /** A Timer's length; 0 on a Stopwatch. */
  durationMs: number;
};

const MINUTE_MS = 60_000;
/** A new Timer's length: 5 minutes. */
export const DEFAULT_TIMER_MS = 5 * MINUTE_MS;
/** The Timer length popover's preset chips, in minutes. */
export const TIMER_PRESET_MINUTES: readonly number[] = [5, 10, 15, 25];
/** A Timer's length in whole minutes: the old Session strip timer's range. */
export const TIMER_MINUTES_MIN = 1;
export const TIMER_MINUTES_MAX = 120;
/** A Stopwatch left running stops counting here, so a forgotten one cannot grow without end. */
export const STOPWATCH_MAX_MS = 7 * 24 * 60 * MINUTE_MS;

/** Each piece's design box, the size a new one is placed at; both are aspect locked. */
export const TIMER_PIECE_SIZE: Readonly<Record<TimerPieceKind, { width: number; height: number }>> =
  {
    timer: { width: 128, height: 88 },
    stopwatch: { width: 104, height: 112 },
  };

const isWhole = (v: unknown, min: number, max: number): v is number =>
  typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max;

/** A stored or delta-carried state, checked against the piece it is for. */
export function isPieceTimer(v: unknown, kind: TimerPieceKind): v is PieceTimer {
  if (typeof v !== 'object' || v === null) return false;
  const s = v as Record<string, unknown>;
  const durationOk =
    kind === 'timer'
      ? isWhole(s.durationMs, TIMER_MINUTES_MIN * MINUTE_MS, TIMER_MINUTES_MAX * MINUTE_MS)
      : s.durationMs === 0;
  return (
    typeof s.running === 'boolean' &&
    typeof s.startedAt === 'number' &&
    Number.isFinite(s.startedAt) &&
    s.startedAt >= 0 &&
    isWhole(s.accumulatedMs, 0, STOPWATCH_MAX_MS) &&
    durationOk
  );
}

/** The state a piece reads as when it stores none: idle at its default. */
export function idlePieceTimer(kind: TimerPieceKind): PieceTimer {
  return {
    running: false,
    startedAt: 0,
    accumulatedMs: 0,
    durationMs: kind === 'timer' ? DEFAULT_TIMER_MS : 0,
  };
}

/** The piece's state: its stored one when valid, else idle. */
export function pieceTimerOf(el: { shape?: string; pieceTimer?: unknown }): PieceTimer {
  const kind: TimerPieceKind = el.shape === 'stopwatch' ? 'stopwatch' : 'timer';
  return isPieceTimer(el.pieceTimer, kind) ? el.pieceTimer : idlePieceTimer(kind);
}

/** Time counted at `now`: what was counted before, plus the current run (never negative if the clock went back). */
export function pieceTimerTaken(s: PieceTimer, now: number): number {
  const run = s.running ? Math.max(0, now - s.startedAt) : 0;
  return Math.min(STOPWATCH_MAX_MS, s.accumulatedMs + run);
}

/** A Timer whose taken has reached its length. A Stopwatch never runs out. */
export function pieceTimerRanOut(kind: TimerPieceKind, s: PieceTimer, now: number): boolean {
  return kind === 'timer' && pieceTimerTaken(s, now) >= s.durationMs;
}

/** What the face shows at `now`: a Timer's time left (never below 0), a Stopwatch's time taken. */
export function pieceTimerShown(kind: TimerPieceKind, s: PieceTimer, now: number): number {
  const taken = pieceTimerTaken(s, now);
  return kind === 'timer' ? Math.max(0, s.durationMs - taken) : taken;
}

export type PieceTimerPhase = 'ready' | 'running' | 'paused' | 'done';

export function pieceTimerPhase(kind: TimerPieceKind, s: PieceTimer, now: number): PieceTimerPhase {
  if (pieceTimerRanOut(kind, s, now)) return 'done';
  if (s.running) return 'running';
  return s.accumulatedMs === 0 ? 'ready' : 'paused';
}

/** The word under the digits. */
export const PIECE_TIMER_PHASE_WORD: Readonly<Record<PieceTimerPhase, string>> = {
  ready: 'Ready',
  running: 'Running',
  paused: 'Paused',
  done: "Time's Up",
};

// --- The verbs -----------------------------------------------------------------------------------------------

/** Start (or resume) it; a Timer that ran out starts again from its full length. */
export function startPieceTimer(kind: TimerPieceKind, s: PieceTimer, now: number): PieceTimer {
  const accumulatedMs = pieceTimerRanOut(kind, s, now) ? 0 : pieceTimerTaken(s, now);
  return { running: true, startedAt: now, accumulatedMs, durationMs: s.durationMs };
}

/** Pause it where it stands; a Timer's taken never passes its length. */
export function pausePieceTimer(kind: TimerPieceKind, s: PieceTimer, now: number): PieceTimer {
  const taken = pieceTimerTaken(s, now);
  return {
    running: false,
    startedAt: 0,
    accumulatedMs: kind === 'timer' ? Math.min(taken, s.durationMs) : taken,
    durationMs: s.durationMs,
  };
}

/** Back to idle: a Timer at its full length, a Stopwatch at 0. */
export function resetPieceTimer(s: PieceTimer): PieceTimer {
  return { running: false, startedAt: 0, accumulatedMs: 0, durationMs: s.durationMs };
}

/** A Timer's new length in whole minutes (clamped to the range): a new round, so it resets. */
export function setPieceTimerMinutes(minutes: number): PieceTimer {
  return {
    running: false,
    startedAt: 0,
    accumulatedMs: 0,
    durationMs: clampTimerMinutes(minutes) * MINUTE_MS,
  };
}

export function clampTimerMinutes(minutes: number): number {
  if (!Number.isFinite(minutes)) return DEFAULT_TIMER_MS / MINUTE_MS;
  return Math.min(TIMER_MINUTES_MAX, Math.max(TIMER_MINUTES_MIN, Math.round(minutes)));
}

/** Do two states say the same thing? (A press that changes nothing sends nothing.) */
export function samePieceTimer(a: PieceTimer, b: PieceTimer): boolean {
  return (
    a.running === b.running &&
    a.startedAt === b.startedAt &&
    a.accumulatedMs === b.accumulatedMs &&
    a.durationMs === b.durationMs
  );
}

// --- The readout ---------------------------------------------------------------------------------------------

/**
 * The readout for `ms`: `m:ss` under an hour, `h:mm:ss` from an hour on. A Timer rounds up (5:00 for the whole first
 * second, 0:00 exactly at zero); a Stopwatch rounds down.
 */
export function formatPieceTimer(ms: number, round: 'up' | 'down'): string {
  const total = round === 'up' ? Math.ceil(ms / 1000) : Math.floor(ms / 1000);
  const s = Math.max(0, total);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
}

/** The face's readout for a piece at `now`. */
export function pieceTimerReadout(kind: TimerPieceKind, s: PieceTimer, now: number): string {
  return formatPieceTimer(pieceTimerShown(kind, s, now), kind === 'timer' ? 'up' : 'down');
}

// --- The drawings --------------------------------------------------------------------------------------------

/** Fixed tones: a real object, the same on every paper, as a Room Sign's plaque is. */
export const TIMER_PIECE_TONES = {
  body: '#374151',
  edge: '#1f2937',
  shadow: '#000000',
  display: '#f8fafc',
  displayDone: '#fecaca',
  ink: '#0f172a',
  inkDone: '#b91c1c',
  word: '#e2e8f0',
  wordOnFace: '#475569',
  button: '#f59e0b',
  crown: '#94a3b8',
  tick: '#94a3b8',
} as const;

/** The Timer's drawing on its 128 × 88 design box: a rounded body, an amber top button and a pale display. */
export const TIMER_ART = {
  button: { x: 52, y: 0, w: 24, h: 8, rx: 3 },
  body: { x: 2, y: 6, w: 124, h: 80, rx: 14 },
  display: { x: 12, y: 14, w: 104, h: 46, rx: 8 },
  digits: { x: 64, y: 47, size: 30, longSize: 21 },
  word: { x: 64, y: 76, size: 9 },
} as const;

/** The Stopwatch's drawing on its 104 × 112 design box: a crown, a round case and a pale face. */
export const STOPWATCH_ART = {
  crown: { x: 44, y: 0, w: 16, h: 9, rx: 3 },
  stem: { x: 49, y: 8, w: 6, h: 8 },
  body: { cx: 52, cy: 62, r: 48 },
  face: { cx: 52, cy: 62, r: 40 },
  ticks: 12,
  digits: { x: 52, y: 67, size: 23, longSize: 16 },
  word: { x: 52, y: 84, size: 8 },
} as const;

/** The digits' size on a piece: smaller once the readout grows to `h:mm:ss`. */
export function timerDigitSize(kind: TimerPieceKind, readout: string): number {
  const d = kind === 'timer' ? TIMER_ART.digits : STOPWATCH_ART.digits;
  return readout.length > 5 ? d.longSize : d.size;
}

/** The ticks round a Stopwatch's face, as line ends in its design box. */
export function stopwatchTicks(): { x1: number; y1: number; x2: number; y2: number }[] {
  const { cx, cy, r } = STOPWATCH_ART.face;
  const out: { x1: number; y1: number; x2: number; y2: number }[] = [];
  for (let k = 0; k < STOPWATCH_ART.ticks; k++) {
    const a = (k * Math.PI * 2) / STOPWATCH_ART.ticks;
    const inner = k % 3 === 0 ? r - 6 : r - 4;
    const n = (v: number) => Math.round(v * 100) / 100;
    out.push({
      x1: n(cx + Math.sin(a) * inner),
      y1: n(cy - Math.cos(a) * inner),
      x2: n(cx + Math.sin(a) * (r - 1.5)),
      y2: n(cy - Math.cos(a) * (r - 1.5)),
    });
  }
  return out;
}

/** The piece's name, for its accessible label and the palette. */
export const TIMER_PIECE_NAME: Readonly<Record<TimerPieceKind, string>> = {
  timer: 'Timer',
  stopwatch: 'Stopwatch',
};
