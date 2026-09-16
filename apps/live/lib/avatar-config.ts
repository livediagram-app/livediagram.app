// Avatar-mode character customisation (spec/101): the four choices the Avatar
// Panel offers, their option catalogues, and the per-browser persistence.
//
// Device-local by design, like the panel layout (spec/63) and the palette
// favourites (spec/78): which character you walk around as is an ergonomic /
// personal choice, not diagram data, so it lives ONLY in localStorage and is
// never sent to the api or folded into the synced preferences blob. It IS
// published to peers as part of the ephemeral presence snapshot, so they draw
// the same character you see.
//
// Colour is deliberately NOT here: the shirt takes the participant's presence
// colour so a character matches its owner's cursor and name chip.

import { readLocalStorageSafe, safeJson, writeLocalStorageSafe } from './local-storage-safe';
import { randomPick } from './random';

// The costume vocabulary itself lives in @livediagram/api-schema, because the
// presence packet carries it to peers and both ends must agree on the tokens
// (see that package's avatar.ts). Re-exported here so the ~10 editor modules
// that already import from this file keep their import path.
export type {
  AvatarClothing,
  AvatarConfig,
  AvatarGender,
  AvatarHair,
  AvatarSize,
} from '@livediagram/api-schema';
import type {
  AvatarClothing,
  AvatarConfig,
  AvatarGender,
  AvatarHair,
  AvatarSize,
} from '@livediagram/api-schema';

// The fallback character: what a missing / unreadable FIELD falls back to.
// Whole-config absence is different — a first-time visitor gets a RANDOM
// character instead (see randomAvatarConfig), so the mode doesn't open with
// everyone looking identical.
export const DEFAULT_AVATAR_CONFIG: AvatarConfig = {
  gender: 'male',
  clothing: 'tee',
  hair: 'short',
  size: 'regular',
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

// Which outfits swap trousers for bare legs, and which leave the arms bare.
// Sets rather than per-branch checks so the sprite's three views (front, back,
// profile) can't disagree about what an outfit implies.
export const BARE_LEG_CLOTHING: ReadonlySet<AvatarClothing> = new Set<AvatarClothing>([
  'dress',
  'skirt',
]);
export const BARE_ARM_CLOTHING: ReadonlySet<AvatarClothing> = new Set<AvatarClothing>([
  'vest',
  'hawaiian',
]);

export const AVATAR_SIZES: readonly { id: AvatarSize; label: string }[] = [
  { id: 'small', label: 'Small' },
  { id: 'regular', label: 'Regular' },
  { id: 'tall', label: 'Tall' },
];

// How much bigger / smaller each size draws the sprite. Every step sits ABOVE
// the base 40x56 sprite: at the old scale the character read as a detail on the
// canvas rather than someone standing in the room, and the four costume choices
// (a tie, a bun, a kangaroo pocket) were too small to see. Small is now roughly
// what Regular used to be.
const SIZE_SCALE: Record<AvatarSize, number> = {
  small: 1.15,
  regular: 1.5,
  tall: 1.95,
};

export function avatarScale(size: AvatarSize): number {
  return SIZE_SCALE[size];
}

// A random character for a first-time visitor: gender, clothing, and hair are
// rolled from their catalogues so two people walking into a diagram don't
// arrive as the same figure. SIZE is deliberately not rolled — it changes how
// much of the canvas the character covers, so it starts Regular and stays a
// deliberate choice.
export function randomAvatarConfig(): AvatarConfig {
  const pick = randomPick;
  return {
    gender: pick(AVATAR_GENDERS)?.id ?? DEFAULT_AVATAR_CONFIG.gender,
    clothing: pick(AVATAR_CLOTHING)?.id ?? DEFAULT_AVATAR_CONFIG.clothing,
    hair: pick(AVATAR_HAIR)?.id ?? DEFAULT_AVATAR_CONFIG.hair,
    size: DEFAULT_AVATAR_CONFIG.size,
  };
}

const STORAGE_KEY = 'livediagram:v2:avatar-config';

// Parse a stored (or received) config, field by field, so one unrecognised
// value — a stale option id from a later release, a hand-edited key — costs
// only that field rather than resetting the whole character. Pure, so the
// fallbacks are unit-testable without touching storage.
export function parseAvatarConfig(raw: unknown): AvatarConfig {
  const parsed: unknown = typeof raw === 'string' ? safeJson(raw) : raw;
  if (!parsed || typeof parsed !== 'object') return { ...DEFAULT_AVATAR_CONFIG };
  const o = parsed as Record<string, unknown>;
  const pick = <T extends string>(value: unknown, options: readonly { id: T }[], fallback: T): T =>
    options.some((opt) => opt.id === value) ? (value as T) : fallback;
  return {
    gender: pick(o.gender, AVATAR_GENDERS, DEFAULT_AVATAR_CONFIG.gender),
    clothing: pick(o.clothing, AVATAR_CLOTHING, DEFAULT_AVATAR_CONFIG.clothing),
    hair: pick(o.hair, AVATAR_HAIR, DEFAULT_AVATAR_CONFIG.hair),
    size: pick(o.size, AVATAR_SIZES, DEFAULT_AVATAR_CONFIG.size),
  };
}

// True when this browser already has a character stored — i.e. this is not the
// first use of the mode. The hook uses it to decide whether to PIN a freshly
// rolled character (see useAvatarConfig): random once, then yours.
export function hasStoredAvatarConfig(): boolean {
  return readLocalStorageSafe(STORAGE_KEY) !== null;
}

// The stored character, or a fresh random one on first use of the mode.
export function loadAvatarConfig(): AvatarConfig {
  const raw = readLocalStorageSafe(STORAGE_KEY);
  return raw === null ? randomAvatarConfig() : parseAvatarConfig(raw);
}

export function saveAvatarConfig(config: AvatarConfig): void {
  writeLocalStorageSafe(STORAGE_KEY, JSON.stringify(config));
}
