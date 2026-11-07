import type { AvatarSize } from '@liveworkspace/api-schema/avatar';

// How much bigger / smaller each size draws the sprite. Every step sits ABOVE
// the base 40x56 sprite: at the old scale the character read as a detail on the
// canvas rather than someone standing in the room, and the four costume choices
// (a tie, a bun, a kangaroo pocket) were too small to see. Small is now roughly
// what Regular used to be.
//
// Pure, with no browser or editor import, so a Worker that lays out a template (livehuddle's api, through
// @livehuddle/templates) can size a character without reaching the editor's storage helpers (config.ts).
export const AVATAR_SIZE_SCALE: Readonly<Record<AvatarSize, number>> = {
  small: 1.15,
  regular: 1.5,
  tall: 1.95,
};
