// The laser pen's settings (spec/111): width, colour, trail length, effect —
// plus the numbers the overlay draws from and the compact form that rides the
// wire so peers see the same pen.
//
// Device-local by design, like the avatar costume (spec/101) and the panel
// layout (spec/63): which pen suits you depends on your screen and the room you
// are presenting in, not on the diagram. It lives ONLY in localStorage and is
// never sent to the api or folded into the synced preferences blob (spec/20).
// It IS published alongside each laser sample, so peers draw your pen, not
// theirs.

import { readLocalStorageSafe, safeJson, writeLocalStorageSafe } from './local-storage-safe';

export type LaserWidth = 'fine' | 'medium' | 'bold';
export type LaserTrail = 'quick' | 'normal' | 'long';
export type LaserEffect = 'beam' | 'glow' | 'comet' | 'spark';
// 'presence' means "whatever colour I am in this room" — the identity colour
// that already ties a cursor, a name chip, and an avatar's shirt together.
export type LaserColour =
  'presence' | 'red' | 'orange' | 'yellow' | 'green' | 'cyan' | 'blue' | 'violet' | 'white';

export type LaserConfig = {
  width: LaserWidth;
  colour: LaserColour;
  trail: LaserTrail;
  effect: LaserEffect;
};

// Today's laser, exactly: a medium beam in your own colour fading over a
// second. Someone who never opens the panel sees no change at all.
export const DEFAULT_LASER_CONFIG: LaserConfig = {
  width: 'medium',
  colour: 'presence',
  trail: 'normal',
  effect: 'beam',
};

// The catalogues, in panel order. Exported so the panel renders from the same
// source the parser validates against — an option can't appear in the UI
// without being loadable, or the reverse.
export const LASER_WIDTHS: readonly { id: LaserWidth; label: string }[] = [
  { id: 'fine', label: 'Fine' },
  { id: 'medium', label: 'Medium' },
  { id: 'bold', label: 'Bold' },
];

export const LASER_TRAILS: readonly { id: LaserTrail; label: string }[] = [
  { id: 'quick', label: 'Quick' },
  { id: 'normal', label: 'Normal' },
  { id: 'long', label: 'Long' },
];

export const LASER_EFFECTS: readonly { id: LaserEffect; label: string; hint: string }[] = [
  { id: 'beam', label: 'Beam', hint: 'A clean line with a bright tip' },
  { id: 'glow', label: 'Glow', hint: 'A soft halo — reads on a projector' },
  { id: 'comet', label: 'Comet', hint: 'Tapers away behind the tip' },
  { id: 'spark', label: 'Spark', hint: 'A dotted trail rather than a line' },
];

// The swatch palette. Deliberately a fixed set and not a picker: this gets
// changed mid-presentation, where a colour wheel is a worse answer than eight
// obvious choices.
export const LASER_COLOURS: readonly { id: LaserColour; label: string; hex: string | null }[] = [
  { id: 'presence', label: 'Your colour', hex: null },
  { id: 'red', label: 'Red', hex: '#ef4444' },
  { id: 'orange', label: 'Orange', hex: '#f97316' },
  { id: 'yellow', label: 'Yellow', hex: '#facc15' },
  { id: 'green', label: 'Green', hex: '#22c55e' },
  { id: 'cyan', label: 'Cyan', hex: '#06b6d4' },
  { id: 'blue', label: 'Blue', hex: '#3b82f6' },
  { id: 'violet', label: 'Violet', hex: '#a855f7' },
  { id: 'white', label: 'White', hex: '#f8fafc' },
];

// --- What the overlay draws from --------------------------------------------

// Stroke width in CANVAS px. The overlay divides by zoom so the on-screen
// width stays constant, the same way it always has.
const WIDTH_PX: Record<LaserWidth, number> = { fine: 2, medium: 3.5, bold: 6 };

// How long one sample lives before it has fully faded. 'normal' is the
// original 1s, so nothing changes for anyone who leaves it alone.
const TRAIL_MS: Record<LaserTrail, number> = { quick: 400, normal: 1000, long: 2500 };

export function laserStrokeWidth(config: LaserConfig): number {
  return WIDTH_PX[config.width];
}

export function laserLifetimeMs(config: LaserConfig): number {
  return TRAIL_MS[config.trail];
}

// The colour to draw with: the chosen swatch, or the participant's own colour
// when it is set to 'presence' (and as the fallback, since every trail has a
// participant colour but not every one has a swatch).
export function laserColour(config: LaserConfig, participantColour: string): string {
  const swatch = LASER_COLOURS.find((c) => c.id === config.colour);
  return swatch?.hex ?? participantColour;
}

// --- Parsing ----------------------------------------------------------------

function pick<T extends string>(value: unknown, options: readonly { id: T }[], fallback: T): T {
  return options.some((option) => option.id === value) ? (value as T) : fallback;
}

// Parse a stored (or received) config field by field, so one unrecognised
// value — a token from a later release, a hand-edited key — costs that field
// rather than the whole pen. Pure, so the fallbacks are testable without
// touching storage or a socket.
export function parseLaserConfig(raw: unknown): LaserConfig {
  const parsed: unknown = typeof raw === 'string' ? safeJson(raw) : raw;
  if (!parsed || typeof parsed !== 'object') return { ...DEFAULT_LASER_CONFIG };
  const o = parsed as Record<string, unknown>;
  return {
    width: pick(o.width, LASER_WIDTHS, DEFAULT_LASER_CONFIG.width),
    colour: pick(o.colour, LASER_COLOURS, DEFAULT_LASER_CONFIG.colour),
    trail: pick(o.trail, LASER_TRAILS, DEFAULT_LASER_CONFIG.trail),
    effect: pick(o.effect, LASER_EFFECTS, DEFAULT_LASER_CONFIG.effect),
  };
}

// --- Storage ----------------------------------------------------------------

const STORAGE_KEY = 'livediagram:v2:laser-config';

export function loadLaserConfig(): LaserConfig {
  return parseLaserConfig(readLocalStorageSafe(STORAGE_KEY));
}

export function saveLaserConfig(config: LaserConfig): void {
  writeLocalStorageSafe(STORAGE_KEY, JSON.stringify(config));
}
