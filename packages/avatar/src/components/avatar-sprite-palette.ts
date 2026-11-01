// The Avatar sprite's colour palette (docs/specs/008-canvas/avatar-mode.md), shared by the sprite body and
// the head-and-hair views next door. Colour is the one thing every part of the
// figure has to agree on, so it lives in one file rather than being threaded
// between them or duplicated per view.

import { avatarBindings } from '../bindings';
import { AVATAR_PALETTE } from '../palette';

// The tones themselves live in ../palette (AVATAR_PALETTE), shared with the Avatar Pad
// (docs/specs/009-elements/avatar-pad.md) so the pad is drawn in the characters' own palette.
export const SKIN = AVATAR_PALETTE.skin;
export const SKIN_DARK = AVATAR_PALETTE.skinDark;
export const HAIR = AVATAR_PALETTE.hair;
export const HAIR_DARK = AVATAR_PALETTE.hairDark;
const DEFAULT_SHIRT = AVATAR_PALETTE.shirt;
export const TROUSERS = AVATAR_PALETTE.trousers;
export const TROUSERS_DARK = AVATAR_PALETTE.trousersDark;
export const SHOE = AVATAR_PALETTE.shoe;
export const EYE = AVATAR_PALETTE.eye;
export const SHIRT_WHITE = AVATAR_PALETTE.shirtWhite;
export const FLAG_POLE = AVATAR_PALETTE.flagPole;
export const FLAG_CLOTH = AVATAR_PALETTE.flagCloth;
export const DENIM = AVATAR_PALETTE.denim;
export const DENIM_DARK = AVATAR_PALETTE.denimDark;
export const COAT = AVATAR_PALETTE.coat;
export const COAT_DARK = AVATAR_PALETTE.coatDark;
export const APRON = AVATAR_PALETTE.apron;

// A darker companion to an arbitrary shirt colour, for the shaded side. Mixes
// the hex 22% toward black (the product's bound `shade`); falls back to the
// default pair when the colour isn't a plain `#`-prefixed 6-digit hex (a CSS
// name or rgb() string from an older presence packet).
export function shade(hex: string | undefined): { base: string; dark: string } {
  const base = hex ?? DEFAULT_SHIRT;
  if (!/^#[0-9a-f]{6}$/i.test(base)) return { base, dark: base };
  return { base, dark: avatarBindings.shade(base, 0.22) };
}
