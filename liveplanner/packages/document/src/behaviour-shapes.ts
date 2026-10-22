// The Behaviours family (docs/specs/010-palette/palette-top-level-categories.md): every shape kind whose content arrives at
// RUNTIME rather than being drawn by the author — the ones that do something
// when pressed (docs/specs/012-collaboration/session-button.md, docs/specs/012-collaboration/picker.md) and the ones that collect what
// the room thinks (docs/specs/012-collaboration/participant-responses.md, docs/specs/012-collaboration/comment-pin.md).
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
  'portal',
  'session-button',
  'picker',
  'temperature',
  'decision',
  'comment-pin',
  'action-card',
];

export function isBehaviourShape(kind: ShapeKind): boolean {
  return BEHAVIOUR_SHAPES.includes(kind);
}

/**
 * Does this kind draw its OWN `…` menu, with quick settings in it?
 *
 * The one that does earned it: a Timer's length and a Vote's dots are the
 * settings you change mid-session. Everything else in the family gets the
 * shared settings `…` instead, which opens the element's context menu.
 *
 * The distinction matters because the two must never both render — they sit in
 * the same corner of the same card, and two ellipses side by side is a bug you
 * can see from across the room.
 */
export function drawsOwnElementMenu(kind: ShapeKind): boolean {
  return kind === 'session-button';
}

/**
 * Does this kind carry the shared settings `…` at all (docs/specs/008-canvas/canvas-and-palette.md)?
 *
 * Most of the family does, beyond the one that draws its own richer `…`
 * above. Two do not:
 *
 * - The Comment and Action panels (docs/specs/012-collaboration/comment-pin.md, action-panel.md) have
 *   no settings of their own: everything they do is on the card (reply,
 *   resolve, complete, edit), and their right-click menu is the ordinary
 *   element menu. A `…` opening that menu was a control with nothing behind it.
 */
export function carriesSharedSettingsMenu(kind: ShapeKind): boolean {
  if (kind === 'comment-pin' || kind === 'action-card') return false;
  return isBehaviourShape(kind) && !drawsOwnElementMenu(kind);
}
