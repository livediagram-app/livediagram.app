// The Behaviours family (docs/specs/010-palette/palette-top-level-categories.md): every shape kind whose content arrives at
// RUNTIME rather than being drawn by the author — the ones that do something
// when pressed (docs/specs/009-elements/mode-button.md to docs/specs/012-collaboration/picker.md, docs/specs/009-elements/reaction-pad.md) and the ones that collect what
// the room thinks (docs/specs/012-collaboration/participant-responses.md to docs/specs/009-elements/chair.md, docs/specs/012-collaboration/comment-pin.md).
//
// A LEAF module (a set and two predicates) for the same reason
// `collab-shapes.ts` is one.
//
// It exists because the palette merge made the family a single thing to name,
// and because the editor needs to answer one question about all of them at
// once: does this element carry a `…` on its face?

import type { ShapeKind } from './index';

// Every kind the palette's Behaviours category can place.
export const BEHAVIOUR_SHAPES: readonly ShapeKind[] = [
  'mode-button',
  'portal',
  'session-button',
  'reveal',
  'picker',
  'reaction-pad',
  'chair',
  'done-check',
  'estimate',
  'temperature',
  'idea-box',
  'qa-board',
  'agenda',
  'decision',
  'roll-call',
  'comment-pin',
  'action-card',
  // Bring Focus (docs/specs/012-collaboration/bring-focus.md): what it does only happens when somebody presses
  // it, which is the whole of what makes a kind a Behaviour.
  'focus-button',
];

export function isBehaviourShape(kind: ShapeKind): boolean {
  return BEHAVIOUR_SHAPES.includes(kind);
}

/**
 * Does this kind draw its OWN `…` menu, with quick settings in it?
 *
 * The ones that do earned it: a Timer's length, a Vote's dots and a Poll's
 * question are the settings you change mid-session, and a Done check's round
 * and an Idea box's contents are reset from the same place, as are a Q&A
 * board's spotlight and notes (docs/specs/012-collaboration/qa-board.md). Everything else in
 * the family gets the shared settings `…` instead, which opens the element's
 * context menu.
 *
 * The distinction matters because the two must never both render — they sit in
 * the same corner of the same card, and two ellipses side by side is a bug you
 * can see from across the room.
 */
export function drawsOwnElementMenu(kind: ShapeKind): boolean {
  return (
    kind === 'session-button' || kind === 'done-check' || kind === 'idea-box' || kind === 'qa-board'
  );
}

/**
 * Does this kind carry the shared settings `…` at all (docs/specs/008-canvas/canvas-and-palette.md)?
 *
 * Most of the family does, beyond the ones that draw their own richer `…`
 * above. Two do not:
 *
 * - Bring Focus (docs/specs/012-collaboration/bring-focus.md) is a button whose whole behaviour is "press me".
 *   Its colours and label are reached the ordinary way, by right-clicking the
 *   element like any other, so a `…` would only open the menu that was already
 *   one click away: one more dot on the card and one more thing to explain.
 * - A chair (docs/specs/009-elements/chair.md) is furniture, not a card. Its one setting, which way it
 *   faces, is set from the element menu, and an ellipsis floating over the
 *   backrest read as a control on the seat.
 */
export function carriesSharedSettingsMenu(kind: ShapeKind): boolean {
  if (kind === 'focus-button' || kind === 'chair') return false;
  return isBehaviourShape(kind) && !drawsOwnElementMenu(kind);
}
