// A press that pans the canvas although it lands inside an element (docs/specs/026-plan/plan-board.md "On a
// phone"): a finger on a board's empty space. The element marks the press; the element's own press handler then
// stands aside (no select, no drag), and the canvas surface pans as if its background had been pressed.
const PANS = new WeakSet<Event>();

export function markPanThrough(e: { nativeEvent: Event }): void {
  PANS.add(e.nativeEvent);
}

export function isPanThrough(e: { nativeEvent: Event }): boolean {
  return PANS.has(e.nativeEvent);
}
