// What a finished Moon Mail run posts to its machine's High Scores (docs/specs/009-elements/social-pieces.md "High
// Scores"; blueprint "The panel"): the score, if it is at least 1 and makes the table, and where it lands. Pure, so
// the panel and its tests ask the same question. Loaded with the panel, never in the first load.

import { arcadePlaceOf, isArcadeScore, type ArcadeScore } from '@livehuddle/document';

/** The parts of a run a post reads. */
export type FinishedRun = { score: number; ms: number };

/**
 * The score a run posts and the 1-based place it takes, or null: a run that scored nothing or played no time, a
 * player with no key to sign with, a score the shared check refuses, or a score the table's ten all beat.
 */
export function arcadeScoreFor(
  run: FinishedRun,
  table: readonly ArcadeScore[] | undefined,
  who: { key: string | null; name: string; now: number; id: string },
): { score: ArcadeScore; place: number } | null {
  if (run.score < 1 || run.ms < 1 || !who.key) return null;
  const score: ArcadeScore = {
    id: who.id,
    name: who.name,
    score: run.score,
    ms: run.ms,
    by: who.key,
    at: who.now,
  };
  // The check every screen and the room hold a score to (a run past two hours, say): one they drop is never
  // announced as a place on the table.
  if (!isArcadeScore(score)) return null;
  const place = arcadePlaceOf(table, score);
  return place === null ? null : { score, place };
}

/** The line Game Over says about where a score landed. */
export function arcadePlaceLine(place: number): string {
  return place === 1 ? 'New High Score!' : `You Placed #${place}`;
}
