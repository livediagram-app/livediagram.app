// The Avatar sprite's colour palette (docs/specs/008-canvas/avatar-mode.md), shared by the sprite body and
// the head-and-hair views next door. Colour is the one thing every part of the
// figure has to agree on, so it lives in one file rather than being threaded
// between them or duplicated per view.

import { avatarBindings } from '../bindings';
import { hairColourHex, type AvatarHairColour } from '../config';
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
export const DENIM_LIGHT = AVATAR_PALETTE.denimLight;
export const COAT = AVATAR_PALETTE.coat;
export const COAT_DARK = AVATAR_PALETTE.coatDark;
export const APRON = AVATAR_PALETTE.apron;
export const APRON_DARK = AVATAR_PALETTE.apronDark;
export const BRASS = AVATAR_PALETTE.brass;
export const LEAF = AVATAR_PALETTE.leaf;
export const BLOOM = AVATAR_PALETTE.bloom;
export const PETAL = AVATAR_PALETTE.petal;

// A darker companion to an arbitrary shirt colour, for the shaded side. Mixes
// the hex 22% toward black (the product's bound `shade`); falls back to the
// default pair when the colour isn't a plain `#`-prefixed 6-digit hex (a CSS
// name or rgb() string from an older presence packet).
export function shade(hex: string | undefined): { base: string; dark: string } {
  const base = hex ?? DEFAULT_SHIRT;
  if (!/^#[0-9a-f]{6}$/i.test(base)) return { base, dark: base };
  return { base, dark: avatarBindings.shade(base, 0.22) };
}

// The tones an outfit paints with, all derived from the one shirt colour so an outfit is told apart by shape and
// detail, never by a hue of its own (docs/specs/008-canvas/avatar-mode.md "Clothes"):
//   - base / dark: the shirt and its shaded side (as `shade`);
//   - deep / deeper: a much darker cloth (a suit's jacket and its shaded side);
//   - alt / altDark: a second cloth of a clearly different lightness (the skirt's top): paler than a dark shirt,
//     deeper than a light one, so it never fades into a light or a dark theme;
//   - accent: a mid-contrast trim (ribbing, hood, check lines), darker on a light shirt and lighter on a dark one;
//   - contrast: the strongest trim (stripes, a polo collar, a varsity letter), the same rule pushed further;
//   - lightShirt: whether the shirt is light, for the few fixed accents that flip with it (a Hawaiian petal).
export type OutfitTones = {
  base: string;
  dark: string;
  deep: string;
  deeper: string;
  alt: string;
  altDark: string;
  accent: string;
  contrast: string;
  lightShirt: boolean;
};

// Perceived lightness of a #rrggbb colour, 0 to 1 (Rec. 601 weights, enough to pick a trim's direction).
export function lightness(hex: string): number {
  const n = Number.parseInt(hex.slice(1), 16);
  return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
}

// Presence colours are a small set, so a tiny cache keeps the sprite's per-frame render from redoing the colour
// maths. Bounded: it is cleared rather than grown past the cap.
const TONE_CACHE = new Map<string, OutfitTones>();
const TONE_CACHE_CAP = 64;

export function outfitTones(hex: string | undefined): OutfitTones {
  const { base, dark } = shade(hex);
  const cached = TONE_CACHE.get(base);
  if (cached) return cached;
  let tones: OutfitTones;
  if (!/^#[0-9a-f]{6}$/i.test(base)) {
    // Not a hex we can do maths on: keep the shirt itself and use fixed neutrals for every trim.
    tones = {
      base,
      dark,
      deep: TROUSERS_DARK,
      deeper: SHOE,
      alt: SHIRT_WHITE,
      altDark: COAT_DARK,
      accent: SHIRT_WHITE,
      contrast: SHIRT_WHITE,
      lightShirt: false,
    };
  } else {
    const lightShirt = lightness(base) > 0.62;
    const { shade: darken, tint } = avatarBindings;
    tones = {
      base,
      dark,
      deep: darken(base, 0.55),
      deeper: darken(base, 0.68),
      alt: lightShirt ? darken(base, 0.35) : tint(base, 0.6),
      altDark: lightShirt ? darken(base, 0.5) : tint(base, 0.4),
      accent: lightShirt ? darken(base, 0.42) : tint(base, 0.45),
      contrast: lightShirt ? darken(base, 0.62) : tint(base, 0.78),
      lightShirt,
    };
  }
  if (TONE_CACHE.size >= TONE_CACHE_CAP) TONE_CACHE.clear();
  TONE_CACHE.set(base, tones);
  return tones;
}

// Hair's two tones for a hair colour (docs/specs/008-canvas/avatar-mode.md "Hair Colour"): the colour and its
// shaded side, darkened 32% by the bound colour maths. Brown (and no colour, an older build's config) keeps the
// palette's own pair, so a character without the field looks exactly as it always did.
export type HairTones = { base: string; dark: string };
const BROWN_HAIR: HairTones = { base: HAIR, dark: HAIR_DARK };
const HAIR_CACHE = new Map<string, HairTones>();

export function hairTones(colour: AvatarHairColour | undefined): HairTones {
  const base = hairColourHex(colour);
  if (base === HAIR) return BROWN_HAIR;
  let tones = HAIR_CACHE.get(base);
  if (!tones) {
    // Bounded by the catalogue: one entry per hair colour.
    tones = { base, dark: avatarBindings.shade(base, 0.32) };
    HAIR_CACHE.set(base, tones);
  }
  return tones;
}
