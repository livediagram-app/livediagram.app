// The Avatar sprite's sixteen outfits (docs/specs/008-canvas/avatar-mode.md "Clothes"), split out of
// avatar-sprite.tsx so the body file keeps to the skeleton (legs, arms, poses) and this one owns what is worn on it.
//
// The shirt is always the participant's presence colour, so no two outfits may differ by hue alone: each has a
// signature of shape and detail that reads at palette-tile size (about 3x) in every facing, every pose, both builds
// and any shirt colour. Secondary tones come from outfitTones (shades and tints of the shirt) or fixed neutrals
// (white, denim, a lab coat, an apron), never a colour of their own.
//
// An outfit is three things:
//   - its look: what the torso, the sleeves and the legs are made of (outfitLook), which the body file paints;
//   - its detail per facing, painted over the torso (OutfitFront / OutfitBack / OutfitProfile);
//   - anything below the waist (OutfitLower*: a dress, a skirt, a coat's tails, an apron) and above the neckline
//     (OutfitCollar: the turtleneck), drawn where the body file asks.
// Flat rects only, a handful per outfit, so the sprite's render cost stays flat.
import type { AvatarConfig } from '../config';
import {
  COAT,
  COAT_DARK,
  DENIM,
  DENIM_DARK,
  SHIRT_WHITE,
  TROUSERS,
  TROUSERS_DARK,
  type OutfitTones,
} from './avatar-sprite-palette';

export {
  HoodProfile,
  OutfitBack,
  OutfitCollar,
  OutfitFront,
  OutfitProfile,
} from './avatar-sprite-outfit-torso';
export { OutfitLowerFront, OutfitLowerProfile } from './avatar-sprite-outfit-lower';

export type Clothing = AvatarConfig['clothing'];

export type ClothPair = { base: string; dark: string };

// A sleeve, painted in four cells from the shoulder to the wrist (offset 0 to 3). A short sleeve leaves the last
// two as skin; a band repaints one cell (a cuff, a polo's tipping, a stripe).
export type SleeveLook = {
  cloth: ClothPair;
  short: boolean;
  bands: readonly { at: 0 | 1 | 2 | 3; fill: string }[];
};

export type OutfitLook = { body: ClothPair; sleeve: SleeveLook; legs: ClothPair };

const TROUSER_PAIR: ClothPair = { base: TROUSERS, dark: TROUSERS_DARK };
const WHITE_PAIR: ClothPair = { base: SHIRT_WHITE, dark: COAT_DARK };
const COAT_PAIR: ClothPair = { base: COAT, dark: COAT_DARK };
const DENIM_PAIR: ClothPair = { base: DENIM, dark: DENIM_DARK };

// What the torso, sleeves and legs are cut from. The silhouette rules live here (short sleeves, white sleeves,
// matching or denim legs) so the front, back and profile views cannot disagree about them.
export function outfitLook(clothing: Clothing, t: OutfitTones): OutfitLook {
  const shirt: ClothPair = { base: t.base, dark: t.dark };
  const sleeve = (
    short: boolean,
    bands: SleeveLook['bands'] = [],
    cloth: ClothPair = shirt,
  ): SleeveLook => ({ cloth, short, bands });
  switch (clothing) {
    case 'stripes':
      return {
        body: shirt,
        sleeve: sleeve(false, [
          { at: 1, fill: t.contrast },
          { at: 3, fill: t.contrast },
        ]),
        legs: TROUSER_PAIR,
      };
    case 'jumper':
    case 'hoodie':
      return {
        body: shirt,
        sleeve: sleeve(false, [{ at: 3, fill: t.accent }]),
        legs: TROUSER_PAIR,
      };
    case 'vest':
      // A waistcoat over a white shirt: the sleeves are the shirt's.
      return { body: shirt, sleeve: sleeve(false, [], WHITE_PAIR), legs: TROUSER_PAIR };
    case 'suit': {
      const jacket: ClothPair = { base: t.deep, dark: t.deeper };
      return {
        body: jacket,
        sleeve: sleeve(false, [{ at: 3, fill: SHIRT_WHITE }], jacket),
        legs: jacket,
      };
    }
    case 'skirt':
      // A top in a second tone (alt) over a skirt in the shirt colour.
      return {
        body: { base: t.alt, dark: t.altDark },
        sleeve: sleeve(false, [], { base: t.alt, dark: t.altDark }),
        legs: TROUSER_PAIR,
      };
    case 'polo':
      return {
        body: shirt,
        sleeve: sleeve(true, [{ at: 1, fill: t.contrast }]),
        legs: TROUSER_PAIR,
      };
    case 'flannel':
      return {
        body: shirt,
        sleeve: sleeve(false, [{ at: 2, fill: t.accent }]),
        legs: TROUSER_PAIR,
      };
    case 'overalls':
      return { body: shirt, sleeve: sleeve(true), legs: DENIM_PAIR };
    case 'labcoat':
      return { body: COAT_PAIR, sleeve: sleeve(false, [], COAT_PAIR), legs: TROUSER_PAIR };
    case 'varsity':
      return {
        body: shirt,
        sleeve: sleeve(false, [{ at: 3, fill: t.accent }], WHITE_PAIR),
        legs: TROUSER_PAIR,
      };
    case 'tee':
    case 'dress':
    case 'hawaiian':
      return { body: shirt, sleeve: sleeve(true), legs: TROUSER_PAIR };
    default:
      // turtleneck, apron: plain long sleeves.
      return { body: shirt, sleeve: sleeve(false), legs: TROUSER_PAIR };
  }
}
