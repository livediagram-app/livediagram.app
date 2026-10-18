'use client';

import { setCoachSlot } from './coach-dock-slots';

// The dock's place (docs/specs/007-editor/coach-dock.md "Where it sits"): a row of the editor's column between
// the canvas and the tab bar, empty (zero height) until a tour draws into it, so the canvas gives up exactly the
// room the dock takes.
export function CoachDockSlot() {
  return (
    <div
      data-coach-dock-slot=""
      className="relative shrink-0"
      ref={(el) => {
        if (!el) return;
        setCoachSlot('dock', el);
        return () => setCoachSlot('dock', null, el);
      }}
    />
  );
}

// The tour chip's place in the tab bar, before Search: nothing until an offer folds into it.
export function CoachChipSlot() {
  return (
    <span
      data-coach-chip-slot=""
      className="ml-1 flex shrink-0 items-center empty:hidden"
      ref={(el) => {
        if (!el) return;
        setCoachSlot('chip', el);
        return () => setCoachSlot('chip', null, el);
      }}
    />
  );
}
