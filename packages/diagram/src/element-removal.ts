import { stripDanglingDocks } from './event-storming-dock';
import type { Element } from './index';

// What every deletion has to do AFTER the survivors are chosen: heal the
// references the removed elements leave behind.
//
// Every removal path (delete-selection, delete-multi-selection, delete-a-layer)
// goes through this one pass, so a new kind of relation is healed everywhere
// by adding it here once. A relation that points at nothing is a bug that only
// shows up later, somewhere else.
//
// - A workshop note docked to a HOST that just went becomes standalone
//   (spec/139 Phase 7).
//
// Returns the same array it was given when nothing needed healing.
export function afterElementsRemoved(survivors: Element[]): Element[] {
  return stripDanglingDocks(survivors);
}
