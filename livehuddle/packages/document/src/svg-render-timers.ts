// The Timer and Stopwatch in an export (docs/specs/009-elements/timer-and-stopwatch.md "Export"): the body and the
// time the face shows at the moment of the export, with its state word; no buttons, no flash. The drawings are the
// canvas's (TIMER_ART, STOPWATCH_ART), so a piece on the canvas and in an export are the same piece.

import {
  PIECE_TIMER_PHASE_WORD,
  STOPWATCH_ART,
  TIMER_ART,
  TIMER_PIECE_SIZE,
  TIMER_PIECE_TONES as T,
  pieceTimerOf,
  pieceTimerPhase,
  pieceTimerReadout,
  stopwatchTicks,
  timerDigitSize,
  type TimerPieceKind,
} from './timer-pieces';
import { r2 } from './svg-render-primitives';
import { text, type Face } from './svg-render-face-kit';

const rect = (
  r: { x: number; y: number; w: number; h: number; rx: number },
  fill: string,
  extra = '',
) =>
  `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" rx="${r.rx}" fill="${fill}"${extra}/>`;

/** The piece drawn at `now`, scaled from its design box onto the element's box. */
export function timerPieceSvg(el: Face, now: number): string {
  const kind: TimerPieceKind = el.shape === 'stopwatch' ? 'stopwatch' : 'timer';
  const state = pieceTimerOf(el);
  const readout = pieceTimerReadout(kind, state, now);
  const phase = pieceTimerPhase(kind, state, now);
  const done = phase === 'done';
  const word = PIECE_TIMER_PHASE_WORD[phase];
  const size = timerDigitSize(kind, readout);
  const ink = done ? T.inkDone : T.ink;
  let body: string;
  if (kind === 'timer') {
    const a = TIMER_ART;
    body =
      rect(a.button, T.button, ` stroke="${T.edge}"`) +
      rect({ ...a.body, x: a.body.x + 1, y: a.body.y + 3 }, T.shadow, ' opacity="0.14"') +
      rect(a.body, T.body, ` stroke="${T.edge}"`) +
      rect(a.display, done ? T.displayDone : T.display) +
      text(a.digits.x, a.digits.y + (size < a.digits.size ? -2 : 0), readout, {
        size,
        weight: 700,
        color: ink,
        anchor: 'middle',
      }) +
      text(a.word.x, a.word.y, word, {
        size: a.word.size,
        weight: 600,
        color: T.word,
        anchor: 'middle',
      });
  } else {
    const a = STOPWATCH_ART;
    const ticks = stopwatchTicks()
      .map(
        (t) =>
          `<line x1="${t.x1}" y1="${t.y1}" x2="${t.x2}" y2="${t.y2}" stroke="${T.tick}" stroke-width="1.2" stroke-linecap="round"/>`,
      )
      .join('');
    body =
      rect(a.crown, T.crown, ` stroke="${T.edge}"`) +
      `<rect x="${a.stem.x}" y="${a.stem.y}" width="${a.stem.w}" height="${a.stem.h}" fill="${T.crown}"/>` +
      `<circle cx="${a.body.cx + 1}" cy="${a.body.cy + 3}" r="${a.body.r}" fill="${T.shadow}" opacity="0.14"/>` +
      `<circle cx="${a.body.cx}" cy="${a.body.cy}" r="${a.body.r}" fill="${T.body}" stroke="${T.edge}"/>` +
      // A Stopwatch never runs out, so its face is never red.
      `<circle cx="${a.face.cx}" cy="${a.face.cy}" r="${a.face.r}" fill="${T.display}"/>` +
      ticks +
      text(a.digits.x, a.digits.y, readout, { size, weight: 700, color: ink, anchor: 'middle' }) +
      text(a.word.x, a.word.y, word, {
        size: a.word.size,
        weight: 600,
        color: T.wordOnFace,
        anchor: 'middle',
      });
  }
  const box = TIMER_PIECE_SIZE[kind];
  return `<g transform="translate(${r2(el.x)} ${r2(el.y)}) scale(${r2(el.width / box.width)} ${r2(el.height / box.height)})">${body}</g>`;
}
