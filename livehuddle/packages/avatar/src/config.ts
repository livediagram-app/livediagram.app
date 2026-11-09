// Avatar-mode character customisation (docs/specs/008-canvas/avatar-mode.md): the choices the Avatar
// Panel offers, their option catalogues, and the per-browser persistence.
//
// Device-local by design, like the panel layout (docs/specs/007-editor/panel-docking.md): which character you walk around as is an ergonomic /
// personal choice, not document data, so it lives ONLY in localStorage and is
// never sent to the api or folded into the synced preferences blob. It IS
// published to peers as part of the ephemeral presence snapshot, so they draw
// the same character you see.
//
// Shirt colour is deliberately NOT here: the shirt takes the participant's presence
// colour so a character matches its owner's cursor and name chip. Hair colour is a
// plain look choice (AVATAR_HAIR_COLOURS).

import {
  readLocalStorageSafe,
  pickOption,
  storedRecord,
  writeLocalStorageSafe,
} from '@liveworkspace/workbench/lib/local-storage-safe';
import { randomPick } from '@liveworkspace/workbench/lib/random';
import { avatarBindings } from './bindings';
import { AVATAR_SIZE_SCALE } from './size-scale';

// The costume vocabulary itself lives in @liveworkspace/api-schema, because the
// presence packet carries it to peers and both ends must agree on the tokens
// (see that package's avatar.ts). Re-exported here so the modules that import
// from this file keep one path.
export type {
  AvatarClothing,
  AvatarConfig,
  AvatarGender,
  AvatarHair,
  AvatarHairColour,
  AvatarSize,
} from './wire';
import type {
  AvatarClothing,
  AvatarConfig,
  AvatarGender,
  AvatarHair,
  AvatarHairColour,
  AvatarSize,
} from './wire';
import { AVATAR_PALETTE } from './palette';

// The fallback character: what a missing / unreadable FIELD falls back to.
// Whole-config absence is different — a first-time visitor gets a RANDOM
// character instead (see randomAvatarConfig), so the mode doesn't open with
// everyone looking identical.
/** The colour a character and its speech take before its person's presence colour is known: the brand sky. */
export const AVATAR_FALLBACK_COLOUR = '#0ea5e9';

export const DEFAULT_AVATAR_CONFIG: AvatarConfig = {
  gender: 'male',
  clothing: 'tee',
  hair: 'short',
  size: 'regular',
  hairColour: 'brown',
};

// The option catalogues, in panel order. Exported so the panel renders from
// the same source the parser validates against — a new option can't appear in
// the UI without becoming loadable, or vice versa.
export const AVATAR_GENDERS: readonly { id: AvatarGender; label: string }[] = [
  { id: 'male', label: 'Male' },
  { id: 'female', label: 'Female' },
];

export const AVATAR_CLOTHING: readonly { id: AvatarClothing; label: string }[] = [
  { id: 'tee', label: 'T-shirt' },
  { id: 'stripes', label: 'Stripes' },
  { id: 'jumper', label: 'Jumper' },
  { id: 'hoodie', label: 'Hoodie' },
  { id: 'vest', label: 'Vest' },
  { id: 'suit', label: 'Suit' },
  { id: 'dress', label: 'Dress' },
  { id: 'skirt', label: 'Skirt' },
  { id: 'polo', label: 'Polo' },
  { id: 'flannel', label: 'Flannel' },
  { id: 'overalls', label: 'Overalls' },
  { id: 'labcoat', label: 'Lab coat' },
  { id: 'hawaiian', label: 'Hawaiian' },
  { id: 'varsity', label: 'Varsity' },
  { id: 'turtleneck', label: 'Turtleneck' },
  { id: 'apron', label: 'Apron' },
];

export const AVATAR_HAIR: readonly { id: AvatarHair; label: string }[] = [
  { id: 'short', label: 'Short' },
  { id: 'buzz', label: 'Buzz' },
  { id: 'curly', label: 'Curly' },
  { id: 'long', label: 'Long' },
  { id: 'ponytail', label: 'Ponytail' },
  { id: 'bun', label: 'Bun' },
  { id: 'mohawk', label: 'Mohawk' },
  { id: 'bald', label: 'Bald' },
  { id: 'pigtails', label: 'Pigtails' },
  { id: 'afro', label: 'Afro' },
  { id: 'spiky', label: 'Spiky' },
  { id: 'bob', label: 'Bob' },
  { id: 'braid', label: 'Braid' },
  { id: 'topknot', label: 'Top knot' },
];

// Which outfits swap trousers for bare legs. A set rather than per-branch checks so the sprite's three views
// (front, back, profile) can't disagree about what an outfit implies. Sleeves (long, short, white under a vest)
// are the sprite's own outfitLook.
export const BARE_LEG_CLOTHING: ReadonlySet<AvatarClothing> = new Set<AvatarClothing>([
  'dress',
  'skirt',
]);

// Hair colours (docs/specs/008-canvas/avatar-mode.md "Hair Colour"), in swatch order: the natural ones (which a
// random roll picks from), then a few bold ones. Brown is the palette's own hair, the one every character had before
// the choice existed, so a config without the field looks exactly as it always did.
export const AVATAR_HAIR_COLOURS: readonly {
  id: AvatarHairColour;
  label: string;
  hex: string;
  natural: boolean;
}[] = [
  { id: 'black', label: 'Black', hex: '#24201f', natural: true },
  { id: 'dark-brown', label: 'Dark Brown', hex: '#3d2618', natural: true },
  { id: 'brown', label: 'Brown', hex: AVATAR_PALETTE.hair, natural: true },
  { id: 'auburn', label: 'Auburn', hex: '#8c3a22', natural: true },
  { id: 'ginger', label: 'Ginger', hex: '#c8642c', natural: true },
  { id: 'blonde', label: 'Blonde', hex: '#e2b85e', natural: true },
  { id: 'platinum', label: 'Platinum', hex: '#eee2bf', natural: true },
  { id: 'grey', label: 'Grey', hex: '#9a9ea6', natural: true },
  { id: 'white', label: 'White', hex: '#f2f1ec', natural: true },
  { id: 'blue', label: 'Blue', hex: '#3b7bea', natural: false },
  { id: 'pink', label: 'Pink', hex: '#e8559c', natural: false },
  { id: 'purple', label: 'Purple', hex: '#8a5ae6', natural: false },
  { id: 'green', label: 'Green', hex: '#2fae5b', natural: false },
];

const NATURAL_HAIR_COLOURS = AVATAR_HAIR_COLOURS.filter((c) => c.natural);

/** A hair colour token's hex; Brown (the palette's hair) for none or one this build does not know. */
export function hairColourHex(id: AvatarHairColour | undefined): string {
  return AVATAR_HAIR_COLOURS.find((c) => c.id === id)?.hex ?? AVATAR_PALETTE.hair;
}

export const AVATAR_SIZES: readonly { id: AvatarSize; label: string }[] = [
  { id: 'small', label: 'Small' },
  { id: 'regular', label: 'Regular' },
  { id: 'tall', label: 'Tall' },
];

export function avatarScale(size: AvatarSize): number {
  // A product without the Size choice (AvatarBindings.sizes) draws everyone at Regular.
  return AVATAR_SIZE_SCALE[avatarBindings.sizes ? size : 'regular'];
}

// A random character for a first-time visitor: gender, clothing, hair and a natural hair colour are
// rolled from their catalogues so two people walking into a document don't
// arrive as the same figure. SIZE is deliberately not rolled — it changes how
// much of the canvas the character covers, so it starts Regular and stays a
// deliberate choice.
export function randomAvatarConfig(): AvatarConfig {
  return {
    gender: randomPick(AVATAR_GENDERS)?.id ?? DEFAULT_AVATAR_CONFIG.gender,
    clothing: randomPick(AVATAR_CLOTHING)?.id ?? DEFAULT_AVATAR_CONFIG.clothing,
    hair: randomPick(AVATAR_HAIR)?.id ?? DEFAULT_AVATAR_CONFIG.hair,
    size: DEFAULT_AVATAR_CONFIG.size,
    // Natural colours only: a bold one is a deliberate choice, like Size.
    hairColour: randomPick(NATURAL_HAIR_COLOURS)?.id ?? 'brown',
  };
}

// The key the costume is kept under: the product's prefix (`livehuddle:v2:`), bound at startup
// (../bindings), then `avatar-config`.
const storageKey = (): string => `${avatarBindings.storagePrefix}avatar-config`;

// Parse a stored (or received) config, field by field, so one unrecognised
// value — a stale option id from a later release, a hand-edited key — costs
// only that field rather than resetting the whole character. Pure, so the
// fallbacks are unit-testable without touching storage.
export function parseAvatarConfig(raw: unknown): AvatarConfig {
  const o = storedRecord(raw);
  if (!o) return { ...DEFAULT_AVATAR_CONFIG };
  return {
    gender: pickOption(o.gender, AVATAR_GENDERS, DEFAULT_AVATAR_CONFIG.gender),
    clothing: pickOption(o.clothing, AVATAR_CLOTHING, DEFAULT_AVATAR_CONFIG.clothing),
    hair: pickOption(o.hair, AVATAR_HAIR, DEFAULT_AVATAR_CONFIG.hair),
    size: pickOption(o.size, AVATAR_SIZES, DEFAULT_AVATAR_CONFIG.size),
    // Absent (an older build's store or packet) or unknown: Brown, the hair every character had before.
    hairColour: pickOption(o.hairColour, AVATAR_HAIR_COLOURS, 'brown'),
  };
}

// A peer's costume as the canvas draws it, read once per costume rather than on every frame of their walk
// (docs/specs/008-canvas/canvas-performance.md "Walking renders the characters, not the canvas"). The presence
// coalescer keeps each peer's costume object across their lean packets, so the object is the key; a full packet brings
// an equal costume in a new object, and the value key hands back the same config for it. Read-only: never mutate it.
const parsedByObject = new WeakMap<object, AvatarConfig>();
// Bounded by construction: a parsed costume holds only known options, whatever a peer sent.
const parsedByValue = new Map<string, AvatarConfig>();
let parsedDefault: AvatarConfig | null = null;

export function peerAvatarConfig(raw: unknown): AvatarConfig {
  if (raw && typeof raw === 'object') {
    const hit = parsedByObject.get(raw);
    if (hit) return hit;
  } else if (raw === undefined || raw === null) {
    parsedDefault ??= parseAvatarConfig(raw);
    return parsedDefault;
  }
  const parsed = parseAvatarConfig(raw);
  const key = `${parsed.gender}|${parsed.clothing}|${parsed.hair}|${parsed.size}|${parsed.hairColour}`;
  let config = parsedByValue.get(key);
  if (!config) {
    config = parsed;
    parsedByValue.set(key, config);
  }
  if (raw && typeof raw === 'object') parsedByObject.set(raw, config);
  return config;
}

// True when this browser already has a character stored — i.e. this is not the
// first use of the mode. The hook uses it to decide whether to PIN a freshly
// rolled character (see useAvatarConfig): random once, then yours.
export function hasStoredAvatarConfig(): boolean {
  return readLocalStorageSafe(storageKey()) !== null;
}

// The stored character, or a fresh random one on first use of the mode.
export function loadAvatarConfig(): AvatarConfig {
  const raw = readLocalStorageSafe(storageKey());
  return raw === null ? randomAvatarConfig() : parseAvatarConfig(raw);
}

export function saveAvatarConfig(config: AvatarConfig): void {
  writeLocalStorageSafe(storageKey(), JSON.stringify(config));
}
