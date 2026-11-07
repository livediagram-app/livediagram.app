// Whether a tab offers the walk, and where opening walking puts the character (docs/specs/008-canvas/avatar-mode.md
// "Opening walking"). Pure: the editor's useOpenWalking decides when, this says whether and where.
import { DEFAULT_BUTTON_MODE, type Element, type ShapeElement } from '@livehuddle/document';
import { holdsOnlyPads } from './pad-only-tab';

// The box of the button the character starts below (avatarSpawnBelow, at the character's own Size).
export type WalkInButton = { x: number; y: number; width: number; height: number };

// A tab's way in to the walk: its Avatar Pad (the walk itself starts the character on it; every Spaces template has
// one at its entrance), or a Selection Mode button set to Avatar (a board made before the pads kept its Walk In), which
// the character starts just below. The button's box, not a
// spot: where the feet go depends on the character's Size, which only the canvas knows (useWalkIn).
export type WalkEntrance = { kind: 'pad' } | { kind: 'button'; button: WalkInButton };

const isShape = (el: Element): el is ShapeElement => el.type === 'shape';

/**
 * The tab's way in to the walk: a pad wins (the walk's own entry rule), then the first Avatar button in paint
 * order. Null when the tab offers no walk, so it opens on the tool it always did: a tab with neither, and a blank tab
 * holding nothing but its pad (holdsOnlyPads), which has nothing to walk round yet and an Editor about to build.
 */
export function walkEntrance(elements: Element[]): WalkEntrance | null {
  if (holdsOnlyPads(elements)) return null;
  let button: ShapeElement | null = null;
  for (const el of elements) {
    if (!isShape(el)) continue;
    if (el.shape === 'avatar-pad') return { kind: 'pad' };
    if (!button && el.shape === 'mode-button' && (el.mode ?? DEFAULT_BUTTON_MODE) === 'avatar')
      button = el;
  }
  if (!button) return null;
  const { x, y, width, height } = button;
  return { kind: 'button', button: { x, y, width, height } };
}
