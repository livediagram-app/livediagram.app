// The Behaviours family (spec/110): every shape kind whose content arrives at
// RUNTIME rather than being drawn by the author — the ones that do something
// when pressed (spec/103 to spec/107, spec/135) and the ones that collect what
// the room thinks (spec/122 to spec/130, spec/136).
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
  'agenda',
  'decision',
  'roll-call',
  'comment-pin',
  // Bring Focus (spec/144): what it does only happens when somebody presses
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
 * and an Idea box's contents are reset from the same place. Everything else in
 * the family gets the shared settings `…` instead, which opens the element's
 * context menu.
 *
 * The distinction matters because the two must never both render — they sit in
 * the same corner of the same card, and two ellipses side by side is a bug you
 * can see from across the room.
 */
export function drawsOwnElementMenu(kind: ShapeKind): boolean {
  return kind === 'session-button' || kind === 'done-check' || kind === 'idea-box';
}
