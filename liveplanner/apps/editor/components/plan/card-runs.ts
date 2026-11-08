// A busy board's cells draw their cards in runs (docs/specs/026-plan/plan-board.md "A busy board"; blueprint
// plan-board.md "Card runs"): a few cards at a time, each run skipped by the browser while it is out of view
// (globals.css `plan-card-run`). A run's edges follow the cards, never their count: a run starts at a card whose id
// hashes to a start (one in RUN_SPREAD), or once a run holds CARD_RUN_MAX cards. So a card moved in or out of a
// cell changes only the run it lands in or leaves, the others keep their cards (and React their elements), and a run
// is keyed by its first card.

// One card in this many starts a run, so a run holds this many on average. Measured in Safari on a 2,000-card board:
// runs of 8 (at most 16) cost 0.3 to 0.5 s each time a carried card crossed the board's edge (it grew with a run's
// length), runs of 2 slowed every gap change; 4 keeps both under the board without runs.
export const RUN_SPREAD = 4;
// The most cards in one run.
export const CARD_RUN_MAX = 8;

// FNV-1a over the id: the same start on every machine and every render.
function startsRun(id: string): boolean {
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0) % RUN_SPREAD === 0;
}

export function cardRuns<T extends { id: string }>(cards: readonly T[]): T[][] {
  const runs: T[][] = [];
  let run: T[] = [];
  for (const card of cards) {
    if (run.length > 0 && (run.length >= CARD_RUN_MAX || startsRun(card.id))) {
      runs.push(run);
      run = [];
    }
    run.push(card);
  }
  if (run.length > 0) runs.push(run);
  return runs;
}
