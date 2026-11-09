// The Arcade Machine's High Scores (docs/specs/009-elements/social-pieces.md "High Scores"): what a score is, the
// bound a run's score is held to, and the table's order, as pure functions every screen and the room run alike.
//
// The game (Moon Mail, apps/editor/lib/arcade/moon-mail.ts) runs on the player's screen alone, so a score is that
// screen's word. The scoring rules that bound it live here, beside the check, and the game imports them, so the rule
// the room checks and the rule the game plays cannot drift apart.
//
// A LEAF module: element-deltas and collab-ledger import it.

/** One score on a machine's table. */
export type ArcadeScore = {
  id: string;
  /** The player's display name in the Space, cut to ARCADE_NAME_MAX; "Guest" with none. */
  name: string;
  score: number;
  /** How long the run played, paused time not counted. */
  ms: number;
  /** The poster's adder key (an Editor without one writes their participant key). */
  by: string;
  /** When it was posted, epoch ms. */
  at: number;
};

/** Moon Mail's scoring, the rules a score is held to (social-pieces.md "Moon Mail", "Trust"). */
export const MOON_MAIL_SCORING = {
  /** Letters waiting when a run starts. */
  startLetters: 3,
  /** A new letter appears at most this often. */
  letterEveryMs: 900,
  /** A letter's points at ×1. */
  letterPoints: 10,
  /** The streak's highest multiplier. */
  streakMax: 5,
  /** Letters in a row that raise the streak by one. */
  streakEvery: 5,
} as const;

/** How many scores a machine keeps. */
export const ARCADE_SCORES_MAX = 10;
export const ARCADE_NAME_MAX = 24;
/** The longest run a score may claim: two hours. */
export const ARCADE_RUN_MS_MAX = 2 * 60 * 60 * 1000;
const ID_MAX = 64;
const BY_MAX = 128;

/** The name a score is posted under: the display name, trimmed and cut, or "Guest". */
export function arcadeName(displayName: string | undefined): string {
  const name = (displayName ?? '').trim().slice(0, ARCADE_NAME_MAX).trim();
  return name.length > 0 ? name : 'Guest';
}

/**
 * The most a run of `ms` can score: letters appear at most one every `letterEveryMs` after the ones a run starts
 * with, each worth at most `letterPoints * streakMax`.
 */
export function arcadeScoreCeiling(ms: number): number {
  const { startLetters, letterEveryMs, letterPoints, streakMax } = MOON_MAIL_SCORING;
  return (startLetters + Math.floor(ms / letterEveryMs)) * letterPoints * streakMax;
}

/** The latest time a JavaScript date holds (8.64e15 ms, about the year 275760). */
const DATE_MS_MAX = 8.64e15;

const isIntIn = (v: unknown, min: number, max: number): v is number =>
  typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max;

const isStrIn = (v: unknown, max: number): v is string =>
  typeof v === 'string' && v.length > 0 && v.length <= max;

export function isArcadeScore(v: unknown): v is ArcadeScore {
  if (typeof v !== 'object' || v === null) return false;
  const s = v as Record<string, unknown>;
  return (
    isStrIn(s.id, ID_MAX) &&
    isStrIn(s.name, ARCADE_NAME_MAX) &&
    s.name.trim().length > 0 &&
    isIntIn(s.ms, 1, ARCADE_RUN_MS_MAX) &&
    isIntIn(s.score, 1, arcadeScoreCeiling(s.ms)) &&
    isStrIn(s.by, BY_MAX) &&
    // A time a date can show: the table formats it as a day, which throws past Date's range.
    isIntIn(s.at, 0, DATE_MS_MAX)
  );
}

/** The score's own fields alone, so a field the wire does not define is never stored on the machine. */
function ownFields(s: ArcadeScore): ArcadeScore {
  return { id: s.id, name: s.name, score: s.score, ms: s.ms, by: s.by, at: s.at };
}

export function isArcadeScores(v: unknown): v is ArcadeScore[] {
  if (!Array.isArray(v) || v.length > ARCADE_SCORES_MAX || !v.every(isArcadeScore)) return false;
  return new Set(v.map((s) => s.id)).size === v.length;
}

/** Table order: the higher score first, then the earlier, then by id, so every screen sorts alike. */
export function compareArcadeScores(a: ArcadeScore, b: ArcadeScore): number {
  if (a.score !== b.score) return b.score - a.score;
  if (a.at !== b.at) return a.at - b.at;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/**
 * The 1-based place `score` would take on `table`, or null when it does not make it (the table full of scores that
 * sort ahead of it).
 */
export function arcadePlaceOf(
  table: readonly ArcadeScore[] | undefined,
  score: ArcadeScore,
): number | null {
  const ahead = (table ?? []).filter((s) => compareArcadeScores(s, score) < 0).length;
  return ahead < ARCADE_SCORES_MAX ? ahead + 1 : null;
}

/**
 * The table with `score` in its place and cut to ARCADE_SCORES_MAX, or null when nothing changes: a score that does
 * not make it, one the table already holds (a replay) or one that is not a valid score.
 */
export function arcadeTableWith(
  table: readonly ArcadeScore[] | undefined,
  score: unknown,
): ArcadeScore[] | null {
  if (!isArcadeScore(score)) return null;
  const rows = table ?? [];
  if (rows.some((s) => s.id === score.id)) return null;
  if (arcadePlaceOf(rows, score) === null) return null;
  return [...rows, ownFields(score)].sort(compareArcadeScores).slice(0, ARCADE_SCORES_MAX);
}
