// Where a running deck is (docs/specs/012-collaboration/presentation-mode.md "Presenting"): the SLIDE on screen, by
// id, rather than its place in the run. The run is derived from the deck and the tabs, and either can change under
// a presenter (a peer deletes a tab, hides or moves a slide), so a stored index would jump to another slide or end
// the deck. The place is worked out from the id on every render; `at` is only where the slide was last, so a slide
// that has gone hands over to the one now in its place (the last one when it was last), never to the end state.
export type PresentingPosition = {
  // The slide on screen, or null for the end state.
  slideId: string | null;
  at: number;
};

type Run = readonly { slide: { id: string } }[];

// The position for a place in the run (run.length or past it is the end state).
export function positionAt(index: number, run: Run): PresentingPosition {
  const step = run[index];
  return { slideId: step ? step.slide.id : null, at: Math.min(index, run.length) };
}

// The place in the run of the position's slide: where that slide now is; the end state at the end, however long the
// run has become; a slide gone, the one now in its place, clamped to the last (the end state only once nothing is
// left).
export function presentingIndex(position: PresentingPosition, run: Run): number {
  if (position.slideId === null) return run.length;
  const at = run.findIndex((step) => step.slide.id === position.slideId);
  if (at >= 0) return at;
  return Math.min(position.at, Math.max(0, run.length - 1));
}
