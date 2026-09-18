import { freezeDanglingGroupEnds } from './groups';
import { stripDanglingDocks } from './event-storming-dock';
import type { Element } from './index';

// What every deletion has to do AFTER the survivors are chosen: heal the
// references the removed elements leave behind.
//
// Two of them so far, and the pair had three call sites before this module
// existed (delete-selection, delete-multi-selection, delete-a-layer) — which
// is exactly how one of them gets forgotten at the fourth. A relation that
// points at nothing is a bug that only shows up later, somewhere else, so the
// healing belongs in ONE place that every removal path goes through.
//
// - An arrow pinned to a GROUP whose last member just went freezes to a free
//   endpoint at its pre-delete position (spec/09).
// - A workshop note docked to a HOST that just went becomes standalone
//   (spec/139 Phase 7).
//
// Returns the same array it was given when nothing needed healing.
export function afterElementsRemoved(before: Element[], after: Element[]): Element[] {
  return stripDanglingDocks(freezeDanglingGroupEnds(before, after));
}
