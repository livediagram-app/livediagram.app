// A press that pans the canvas although it lands inside an element: a finger on a board's empty space
// (docs/specs/026-plan/plan-board.md "On a phone"), or a finger on an element too big for the screen
// (docs/specs/008-canvas/canvas-and-palette.md "Touch (iOS / iPad)"). The element marks the press; the element's own press
// handler then stands aside (no select, no drag), and the canvas surface pans as if its background had been
// pressed. A press that never moves is a tap: it runs the element's `onTap` when it gave one, and otherwise
// deselects, as a tap on the background does.
const PANS = new WeakMap<Event, { onTap?: () => void }>();

export function markPanThrough(e: { nativeEvent: Event }, onTap?: () => void): void {
  PANS.set(e.nativeEvent, onTap ? { onTap } : {});
}

export function isPanThrough(e: { nativeEvent: Event }): boolean {
  return PANS.has(e.nativeEvent);
}

// What a tap on the marked press does instead of deselecting; undefined when it deselects.
export function panThroughTap(e: { nativeEvent: Event }): (() => void) | undefined {
  return PANS.get(e.nativeEvent)?.onTap;
}
