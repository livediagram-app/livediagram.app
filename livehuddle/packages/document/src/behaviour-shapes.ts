// The Behaviours family (docs/specs/010-palette/palette-top-level-categories.md): every shape kind whose content arrives at
// RUNTIME rather than being drawn by the author: the ones that do something
// when pressed (docs/specs/009-elements/mode-button.md, docs/specs/012-collaboration/bring-focus.md) and the ones a walking character uses (docs/specs/009-elements/chair.md,
// docs/specs/009-elements/office.md).
//
// A LEAF module (a set and two predicates) for the same reason
// `collab-shapes.ts` is one.
//
// It exists because the palette merge made the family a single thing to name,
// and because the editor needs to answer one question about all of them at
// once: does this element carry a `…` on its face?

import { isOfficeShape } from './office';
import { isMeetingPieceShape } from './meeting-pieces';
import { isSeatingShape } from './seating';
import type { ShapeKind } from './index';

// Every kind the palette's Behaviours category can place.
export const BEHAVIOUR_SHAPES: readonly ShapeKind[] = [
  'mode-button',
  'portal',
  'chair',
  // Fence (docs/specs/009-elements/fence.md): it does nothing until a character walks into it.
  'fence',
  // Avatar Pad (docs/specs/009-elements/avatar-pad.md): it does nothing until somebody enters Avatar mode.
  'avatar-pad',
  'desk',
  'sofa',
  // The virtual office (docs/specs/009-elements/office.md): what happens is a character walking in, round
  // or up to it.
  'room',
  'meeting-table',
  'plant',
  'bookshelf',
  'water-cooler',
  'coffee-machine',
  'rug',
  'stage',
  'office-pod',
  'bar',
  'bar-stool',
  'drinks-cabinet',
  'drinks-fridge',
  'outdoor-plant',
  'tree',
  'garden-path',
  'grass',
  'garden-fence',
  // The social pieces (docs/specs/009-elements/social-pieces.md). Walked to, round, sat at or used.
  'notice-board',
  'world-clock',
  'jukebox',
  'ping-pong-table',
  'arcade-machine',
  'fireplace',
  'campfire',
  'bench',
  'picnic-table',
  'hammock',
  'garden-umbrella',
  'fountain',
  'pond',
  // The Door (docs/specs/009-elements/room-builder.md): walked through.
  'door',
  // Wayfinding (docs/specs/009-elements/directory.md, elevator.md): pressed, or walked into, to go somewhere.
  'directory',
  'elevator',
  // The meeting pieces (docs/specs/009-elements/screen-and-room-sign.md): a Screen pressed to open large, a Room
  // Sign knocked on.
  'screen',
  'room-sign',
  // The Timer and Stopwatch (docs/specs/009-elements/timer-and-stopwatch.md).
  'timer',
  'stopwatch',
  // Bring Focus (docs/specs/012-collaboration/bring-focus.md): what it does only happens when somebody presses
  // it, which is the whole of what makes a kind a Behaviour.
  'focus-button',
];

export function isBehaviourShape(kind: ShapeKind): boolean {
  return BEHAVIOUR_SHAPES.includes(kind);
}

/**
 * Does this kind carry the shared settings `…` at all (docs/specs/008-canvas/canvas-and-palette.md)?
 *
 * Most of the family does. These do not:
 *
 * - Bring Focus (docs/specs/012-collaboration/bring-focus.md) is a button whose whole behaviour is "press me".
 *   Its colours and label are reached the ordinary way, by right-clicking the
 *   element like any other, so a `…` would only open the menu that was already
 *   one click away: one more dot on the card and one more thing to explain.
 * - A chair (docs/specs/009-elements/chair.md) is furniture, not a card. Its one setting, which way it
 *   faces, is set from the element menu, and an ellipsis floating over the
 *   backrest read as a control on the seat.
 * - The fence, the Avatar Pad and the office pieces, for the chair's reason.
 */
export function carriesSharedSettingsMenu(kind: ShapeKind): boolean {
  if (
    kind === 'focus-button' ||
    isSeatingShape(kind) ||
    kind === 'fence' ||
    kind === 'avatar-pad' ||
    isOfficeShape(kind) ||
    isMeetingPieceShape(kind)
  )
    return false;
  return isBehaviourShape(kind);
}
