// The palette's ready-made components (docs/specs/008-canvas/canvas-and-palette.md) livehuddle still carries: the
// Avatar, plus the createComponent dispatcher and its natural size. The Banner, Stat row, Process steps and Header
// (part 1), and the Callout and the Hero (part 3) left its element engine
// (docs/specs/002-project-scope/not-in-livehuddle.md "The element engine").
//
// The Avatar is ONE element, a circular image.

import type { Element, ImageElement } from './index';
import { createImage } from './factories';

// The component catalogue. The ids are the palette's (tile ids, favourites and telemetry types all key off them).
export type ComponentKind = 'avatar';

const AVATAR_SIZE = 96;

// Natural bounds: the tap-to-drop size, and the aspect a drag-to-draw keeps
// when Shift is held.
export const COMPONENT_SIZE: Record<ComponentKind, { width: number; height: number }> = {
  avatar: { width: AVATAR_SIZE, height: AVATAR_SIZE },
};

// Avatar (docs/specs/008-canvas/canvas-and-palette.md): a circular image. Square + aspect-locked with a 'full'
// corner radius (CSS clamps that to a circle). Centred on (cx, cy); imageId
// is null until the picker fills it.
export function createAvatar(cx: number, cy: number): ImageElement {
  return {
    ...createImage(cx - AVATAR_SIZE / 2, cy - AVATAR_SIZE / 2),
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: 'full',
    objectFit: 'cover',
    aspectLocked: true,
  };
}

export function createComponent(kind: ComponentKind, cx: number, cy: number): Element {
  switch (kind) {
    case 'avatar':
      return createAvatar(cx, cy);
  }
}
