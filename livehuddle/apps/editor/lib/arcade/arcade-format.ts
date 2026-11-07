// How an Arcade Machine's scores read (docs/specs/009-elements/social-pieces.md "High Scores"): the figures in the
// High Scores table and the bubble's best line. A leaf of its own, so the bubble (in a Space's first load) shares it
// with the lazy panel without pulling in any of the game.

const SCORE = new Intl.NumberFormat('en-GB');

/** A score in grouped figures: 1240 is "1,240". */
export function formatArcadeScore(score: number): string {
  return SCORE.format(score);
}
