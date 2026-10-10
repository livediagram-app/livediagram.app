// The laser pen's settings (docs/specs/008-canvas/laser-panel.md): width, colour, trail length, effect —
// plus the numbers the overlay draws from and the compact form that rides the
// wire so peers see the same pen.
//
// Device-local by design, like the avatar costume (docs/specs/008-canvas/avatar-mode.md) and the panel
// layout (docs/specs/007-editor/panel-docking.md): which pen suits you depends on your screen and the room you
// are presenting in, not on the document. It lives ONLY in localStorage and is
// never sent to the api or folded into the synced preferences blob (docs/specs/007-editor/user-preferences.md).
// It IS published alongside each laser sample, so peers draw your pen, not
// theirs.

import {
  STANDARD_COLOUR_NAMES,
  isHexColour,
  penColourHex,
  penColourLabel,
  type Appearance,
  type StandardColourName,
} from '@livediagram/document';
import { readLocalStorageSafe, safeJson, writeLocalStorageSafe } from './local-storage-safe';

export type LaserWidth = 'fine' | 'medium' | 'bold';
export type LaserTrail = 'quick' | 'normal' | 'long';
export type LaserEffect = 'beam' | 'glow' | 'comet' | 'spark';
// 'presence' means "whatever colour I am in this room" — the identity colour
// that already ties a cursor, a name chip, and an avatar's shirt together.
// Otherwise a standard colour by name (drawn in its version for the canvas,
// docs/specs/004-interface-design/colour-picker.md) or a custom `#rrggbb`.
export const LASER_PRESENCE = 'presence';
export type LaserColour = typeof LASER_PRESENCE | StandardColourName | string;

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
  { id: 'glow', label: 'Glow', hint: 'A soft halo that reads on a projector' },
  { id: 'comet', label: 'Comet', hint: 'Tapers away behind the tip' },
  { id: 'spark', label: 'Spark', hint: 'A dotted trail rather than a line' },
];

// The colours before the colour picker (docs/specs/004-interface-design/colour-picker.md), read as
// their nearest standard colour so a pen saved then keeps its colour.
const LEGACY_LASER_COLOURS: Readonly<Record<string, StandardColourName>> = {
  cyan: 'teal',
  white: 'ink',
};

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

const isStandardName = (v: unknown): v is StandardColourName =>
  (STANDARD_COLOUR_NAMES as readonly unknown[]).includes(v);

// The colour to draw with: a standard colour in its version for the canvas, a
// custom colour as it is, or the participant's own colour when it is set to
// 'presence' (and as the fallback, since every trail has a participant colour
// but not every one has a colour of its own).
export function laserColour(
  config: LaserConfig,
  participantColour: string,
  appearance: Appearance = 'light',
): string {
  const { colour } = config;
  if (isStandardName(colour)) return penColourHex(colour, appearance);
  if (isHexColour(colour)) return colour.toLowerCase();
  return participantColour;
}

/** The colour's name for the panel's collapsed row: "Your colour", "Blue", "#rrggbb". */
export function laserColourLabel(colour: LaserColour): string {
  if (isStandardName(colour)) return penColourLabel(colour);
  if (isHexColour(colour)) return colour.toLowerCase();
  return 'Your colour';
}

function parseLaserColour(value: unknown): LaserColour {
  if (typeof value !== 'string') return DEFAULT_LASER_CONFIG.colour;
  if (value === LASER_PRESENCE || isStandardName(value)) return value;
  if (isHexColour(value)) return value.toLowerCase();
  return LEGACY_LASER_COLOURS[value] ?? DEFAULT_LASER_CONFIG.colour;
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
    colour: parseLaserColour(o.colour),
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
