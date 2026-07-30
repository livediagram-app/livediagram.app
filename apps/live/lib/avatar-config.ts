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

import { readLocalStorageSafe, writeLocalStorageSafe } from './local-storage-safe';

export type AvatarGender = 'male' | 'female';
export type AvatarClothing = 'tee' | 'hoodie' | 'suit' | 'dress';
export type AvatarHair = 'short' | 'long' | 'ponytail' | 'bald';
export type AvatarSize = 'small' | 'regular' | 'tall';

export type AvatarConfig = {
  gender: AvatarGender;
  clothing: AvatarClothing;
  hair: AvatarHair;
  size: AvatarSize;
};

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
  { id: 'hoodie', label: 'Hoodie' },
  { id: 'suit', label: 'Suit' },
  { id: 'dress', label: 'Dress' },
];

export const AVATAR_HAIR: readonly { id: AvatarHair; label: string }[] = [
  { id: 'short', label: 'Short' },
  { id: 'long', label: 'Long' },
  { id: 'ponytail', label: 'Ponytail' },
  { id: 'bald', label: 'Bald' },
];

export const AVATAR_SIZES: readonly { id: AvatarSize; label: string }[] = [
  { id: 'small', label: 'Small' },
  { id: 'regular', label: 'Regular' },
  { id: 'tall', label: 'Tall' },
];

// How much bigger / smaller each size draws the sprite. Small stays legible at
// low zoom; tall stops short of towering over a shape (a 56px character next
// to a 90px box is already a person-in-a-room read).
const SIZE_SCALE: Record<AvatarSize, number> = {
  small: 0.75,
  regular: 1,
  tall: 1.3,
};

export function avatarScale(size: AvatarSize): number {
  return SIZE_SCALE[size];
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

function safeJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function loadAvatarConfig(): AvatarConfig {
  return parseAvatarConfig(readLocalStorageSafe(STORAGE_KEY));
}

export function saveAvatarConfig(config: AvatarConfig): void {
  writeLocalStorageSafe(STORAGE_KEY, JSON.stringify(config));
}
