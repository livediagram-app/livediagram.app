// Quiz (docs/specs/012-collaboration/quiz.md): one multiple-choice question,
// opened for the room by the facilitator, locked when its time is up, and
// revealed with who answered correctly.
//
// A LEAF module (types only) for the same reason collab-shapes.ts is one:
// factories.ts reads these constants at module-init time, and importing them
// from './index' would put a runtime read inside the index ⇄ factories cycle.

import type { ShapeKind } from './index';
import type { ParticipantResponse } from './responses';

export const QUIZ_MIN_OPTIONS = 2;
export const QUIZ_MAX_OPTIONS = 6;
export const QUIZ_OPTION_MAX_TEXT = 80;
// How long a round stays open, in seconds. Clamped where read rather than
// rejected on load, the same rule the agenda's minutes take.
export const QUIZ_MIN_SECONDS = 5;
export const QUIZ_MAX_SECONDS = 300;
export const QUIZ_DEFAULT_SECONDS = 20;
// The lengths the Edit Quiz dialog offers. Any clamped value is legal in the
// document; these are just the sensible ones to pick from.
export const QUIZ_SECONDS_CHOICES: readonly number[] = [10, 20, 30, 45, 60, 90, 120];

export function isQuizShape(kind: ShapeKind): boolean {
  return kind === 'quiz';
}

// The fields a quiz reads, structurally, so the helpers below take a plain
// object in tests and a ShapeElement in the editor.
export type QuizFields = {
  label?: string;
  quizOptions?: string[];
  quizCorrect?: number;
  quizSeconds?: number;
  quizStartedAt?: number;
  quizLockedAt?: number;
  quizRevealed?: boolean;
  responses?: ParticipantResponse[];
};

export type QuizPhase = 'setup' | 'ready' | 'open' | 'locked' | 'revealed';

export function clampQuizSeconds(seconds: number | undefined): number {
  if (!Number.isFinite(seconds)) return QUIZ_DEFAULT_SECONDS;
  return Math.max(QUIZ_MIN_SECONDS, Math.min(QUIZ_MAX_SECONDS, Math.round(seconds as number)));
}

// Whether the card can be started: at least two answers with text, and the
// right answer pointing at one of them.
export function isQuizReady(q: QuizFields): boolean {
  const options = q.quizOptions ?? [];
  const filled = options.filter((o) => o.trim().length > 0).length;
  const correct = q.quizCorrect;
  return (
    filled >= QUIZ_MIN_OPTIONS &&
    correct !== undefined &&
    Number.isInteger(correct) &&
    correct >= 0 &&
    correct < options.length &&
    (options[correct] ?? '').trim().length > 0
  );
}

// The instant the round stops taking picks: an early Lock now, else the start
// plus the limit. Null before the first start.
export function quizLockAt(q: QuizFields): number | null {
  if (q.quizStartedAt === undefined) return null;
  return q.quizLockedAt ?? q.quizStartedAt + clampQuizSeconds(q.quizSeconds) * 1000;
}

// The one phase derivation every surface reads (docs/specs/012-collaboration/quiz.md, "Phases").
export function quizPhase(q: QuizFields, now: number): QuizPhase {
  if (!isQuizReady(q)) return 'setup';
  if (q.quizRevealed) return 'revealed';
  const lockAt = quizLockAt(q);
  if (lockAt === null) return 'ready';
  return now < lockAt ? 'open' : 'locked';
}

// Milliseconds left in an open round, floored at 0.
export function quizRemainingMs(q: QuizFields, now: number): number {
  const lockAt = quizLockAt(q);
  return lockAt === null ? 0 : Math.max(0, lockAt - now);
}

// How many people picked each answer, index-aligned to `quizOptions`. A value
// that names no answer (a pick against answers since edited away) counts
// nowhere.
export function quizTally(q: QuizFields): number[] {
  const counts = (q.quizOptions ?? []).map(() => 0);
  for (const r of q.responses ?? []) {
    const i = Number(r.value);
    if (Number.isInteger(i) && i >= 0 && i < counts.length) counts[i] = (counts[i] ?? 0) + 1;
  }
  return counts;
}

// Who picked each answer, index-aligned to `quizOptions`, each list in the
// order people answered. What the reveal draws beside every answer.
export function quizPickerKeys(q: QuizFields): string[][] {
  const keys = (q.quizOptions ?? []).map((): string[] => []);
  for (const r of q.responses ?? []) {
    const i = Number(r.value);
    if (Number.isInteger(i) && i >= 0 && i < keys.length) keys[i]!.push(r.participantId);
  }
  return keys;
}

// The participant keys that picked the right answer, in the order they
// answered (the responses list is kept in answer order by setResponse).
export function quizCorrectKeys(q: QuizFields): string[] {
  if (q.quizCorrect === undefined) return [];
  const value = String(q.quizCorrect);
  return (q.responses ?? []).filter((r) => r.value === value).map((r) => r.participantId);
}

// The patch that starts a fresh round. `round` is the new collabRound, passed
// in so this stays pure.
export function quizStartPatch(now: number, round: string) {
  return {
    quizStartedAt: now,
    quizLockedAt: undefined,
    quizRevealed: false,
    responses: [] as ParticipantResponse[],
    collabRound: round,
  };
}

// The patch that returns the card to `ready`, for Run again and after an edit.
export function quizResetPatch(round: string) {
  return {
    quizStartedAt: undefined,
    quizLockedAt: undefined,
    quizRevealed: false,
    responses: [] as ParticipantResponse[],
    collabRound: round,
  };
}

// Where answer `index` of `count` sits around the disc, as an angle in
// radians measured clockwise from 12 o'clock. Even spacing, answer A at the
// top, so the order reads like a clock face.
export function quizOptionAngle(index: number, count: number): number {
  return (index / Math.max(1, count)) * Math.PI * 2;
}

// A, B, C … for the answer badges.
export function quizOptionLetter(index: number): string {
  return String.fromCharCode(65 + index);
}

// --- Layout (shared by the canvas face and the export) ----------------------
//
// In DESIGN units on the kind's default square (SHAPE_DEFAULT_SIZE.quiz), then
// scaled to the element's box, the same way every Collaborate card is.

export const QUIZ_DESIGN_SIZE = 520;
// The reveal's green: a fixed colour rather than a theme one, because "right"
// has to read as right on any canvas (the decision record's chips take the
// same exception, docs/specs/012-collaboration/decision-record.md).
export const QUIZ_CORRECT_GREEN = '#16a34a';
export const QUIZ_DISC_RADIUS = 108;
export const QUIZ_OPTION_WIDTH = 132;
export const QUIZ_OPTION_HEIGHT = 52;
// Clear air between the disc's edge and the nearest point of an answer.
const QUIZ_OPTION_GAP = 18;

// The centre of each answer, in design units from the top-left of the square.
//
// Each answer HUGS the disc rather than sitting on a fixed ring: its distance
// from the centre is the disc plus the gap plus the answer's own half-extent
// along that direction. A fixed ring either let the wide side answers overlap
// the disc or pushed the top and bottom ones off the square, because a pill is
// much wider than it is tall.
export function quizOptionCentres(count: number): { x: number; y: number }[] {
  const c = QUIZ_DESIGN_SIZE / 2;
  return Array.from({ length: count }, (_, i) => {
    const a = quizOptionAngle(i, count);
    const dx = Math.sin(a);
    const dy = -Math.cos(a);
    const half = (Math.abs(dx) * QUIZ_OPTION_WIDTH) / 2 + (Math.abs(dy) * QUIZ_OPTION_HEIGHT) / 2;
    const d = QUIZ_DISC_RADIUS + QUIZ_OPTION_GAP + half;
    return { x: c + dx * d, y: c + dy * d };
  });
}

// An answer longer than this many characters is set a size smaller (QuizOption, the export), so the
// longest one (QUIZ_OPTION_MAX_TEXT) fits about six lines and its pill stays inside the quiz's square.
export const QUIZ_OPTION_LONG_TEXT = 36;

// Which way an answer grows when its text needs more than the pill's two lines
// (docs/specs/012-collaboration/quiz.md "Answers"): away from the disc, so it never
// runs into it. Above the disc it grows up, below it down, level with it both ways
// (the disc is beside it, not above or below). The canvas and the export share it.
export type QuizOptionGrowth = 'up' | 'down' | 'both';

export function quizOptionGrowth(at: { y: number }): QuizOptionGrowth {
  const c = QUIZ_DESIGN_SIZE / 2;
  return at.y < c - 1 ? 'up' : at.y > c + 1 ? 'down' : 'both';
}

// The top of an answer `height` tall around its default spot `at`, grown as quizOptionGrowth says.
export function quizOptionTop(at: { y: number }, height: number): number {
  const growth = quizOptionGrowth(at);
  if (growth === 'up') return at.y + QUIZ_OPTION_HEIGHT / 2 - height;
  if (growth === 'down') return at.y - QUIZ_OPTION_HEIGHT / 2;
  return at.y - height / 2;
}

// Tidy an edited set of answers for saving: blank rows dropped, and the right
// answer's index moved to follow its row. Null when what is left cannot run
// (fewer than two answers, or the right one was blank), which is what the
// Edit Quiz dialog disables Save on.
export function compactQuizOptions(
  options: readonly string[],
  correct: number,
): { options: string[]; correct: number } | null {
  const kept: string[] = [];
  let next = -1;
  options.forEach((raw, i) => {
    const text = raw.trim();
    if (!text) return;
    if (i === correct) next = kept.length;
    kept.push(text.slice(0, QUIZ_OPTION_MAX_TEXT));
  });
  if (kept.length < QUIZ_MIN_OPTIONS || kept.length > QUIZ_MAX_OPTIONS || next < 0) return null;
  return { options: kept, correct: next };
}
