// Whether a tab offers the walk, and where opening walking puts the character (docs/specs/008-canvas/avatar-mode.md
// "Opening walking"). Pure: the editor's useOpenWalking decides when, this says whether and where.
import {
  DEFAULT_BUTTON_MODE,
  visibleLayerElements,
  type Element,
  type Layer,
  type ShapeElement,
} from '@livehuddle/document';
import { avatarSpawnFromButton, type AvatarPoint } from '@liveworkspace/avatar/walk';

// A tab's way in to the walk: its Avatar Pad (the walk itself starts the character on it), or a Selection Mode button
// set to Avatar (every Spaces template's Walk In), which the character starts just below.
export type WalkEntrance = { kind: 'pad' } | { kind: 'button'; feet: AvatarPoint };

const isShape = (el: Element): el is ShapeElement => el.type === 'shape';

/**
 * The tab's way in to the walk, read from its visible layers: a pad wins (the walk's own entry rule), then the first
 * Avatar button in layer order. Null when the tab offers no walk, so it opens on the tool it always did.
 */
export function walkEntrance(
  elements: Element[],
  layers: Layer[] | undefined,
): WalkEntrance | null {
  let button: ShapeElement | null = null;
  for (const el of visibleLayerElements(elements, layers)) {
    if (!isShape(el)) continue;
    if (el.shape === 'avatar-pad') return { kind: 'pad' };
    if (!button && el.shape === 'mode-button' && (el.mode ?? DEFAULT_BUTTON_MODE) === 'avatar')
      button = el;
  }
  if (!button) return null;
  // Exactly where a press of the button would put the character ('select' stands for any tool but Avatar).
  const feet = avatarSpawnFromButton(button, 'avatar', 'select');
  return feet ? { kind: 'button', feet } : null;
}
