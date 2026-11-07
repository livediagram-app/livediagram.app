// The avatar palette's flyout widths and what its flyouts act on (docs/specs/008-canvas/avatar-mode.md "The avatar
// palette"), apart from the flyouts' bodies, so the strip (AvatarPalette) hangs a flyout before its code has loaded.

import type { AvatarConfig } from '@liveworkspace/avatar/config';
import type { AvatarReactionKind } from '@liveworkspace/avatar/reactions';
import type { Reaction } from '@liveworkspace/avatar/reaction-bursts';
import type { AvatarStatus } from '@liveworkspace/avatar/status';
import type { AvatarPaletteCategoryId } from '@/lib/avatar-palette';

/** What the flyouts change and play: the character, its choices' handlers, and the actions. */
export type AvatarPaletteActions = {
  config: AvatarConfig;
  // One field at a time: the config hook persists it and peers get it with the next presence.
  onChange: <K extends keyof AvatarConfig>(field: K, value: AvatarConfig[K]) => void;
  // A whole new character (keeping the size).
  onRandomise: () => void;
  onReaction: (kind: AvatarReactionKind) => void;
  onBurst?: ((reaction: Reaction) => void) | undefined;
  // Your presence colour: the shirt every tile wears.
  shirt?: string | undefined;
  status: AvatarStatus | null;
  onSetStatus?: ((status: AvatarStatus | null) => void) | undefined;
};

// Each flyout's design width, px (the category bar measures where to hang it from this) and its class.
export const AVATAR_FLYOUT_WIDTH: Record<AvatarPaletteCategoryId, number> = {
  character: 320,
  clothes: 416,
  hair: 416,
  status: 576,
  behaviour: 448,
  reactions: 448,
};
export const AVATAR_FLYOUT_WIDTH_CLASS: Record<AvatarPaletteCategoryId, string> = {
  character: 'w-[20rem]',
  clothes: 'w-[26rem]',
  hair: 'w-[26rem]',
  status: 'w-[36rem]',
  behaviour: 'w-[28rem]',
  reactions: 'w-[28rem]',
};

// The preview card beside a flyout (docs/specs/008-canvas/avatar-mode.md "The preview, beside the flyout"): its
// design width, the gap it keeps from the flyout, and the room it keeps from the window's edge.
export const PREVIEW_PX = 208;
export const PREVIEW_GAP_PX = 8;
export const PREVIEW_EDGE_PX = 8;

/** Whether the preview card fits right of a flyout whose right edge is `right` px in from the strip root's. */
export function previewFits(rootRight: number, right: number, windowWidth: number): boolean {
  const flyoutRight = rootRight - right;
  return flyoutRight + PREVIEW_GAP_PX + PREVIEW_PX <= windowWidth - PREVIEW_EDGE_PX;
}
