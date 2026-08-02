// The Spotlight's look (spec/112): light size, how dark the shroud goes, how
// soft its edge is, and its shape — plus the values the overlay draws from.
//
// Device-local, like the laser pen (spec/111) and the avatar costume
// (spec/101): it depends on your screen and the room you are presenting in,
// not on the diagram. Unlike the pen it is NOT published — Spotlight is a view
// aid for the person using it, so there is nothing on the wire (spec/09).

import { readLocalStorageSafe, safeJson, writeLocalStorageSafe } from './local-storage-safe';

export type SpotlightSize = 'small' | 'medium' | 'large';
export type SpotlightDim = 'soft' | 'normal' | 'dark' | 'blackout';
export type SpotlightEdge = 'soft' | 'crisp';
export type SpotlightShape = 'circle' | 'wide';

export type SpotlightConfig = {
  size: SpotlightSize;
  dim: SpotlightDim;
  edge: SpotlightEdge;
  shape: SpotlightShape;
};

// Today's spotlight exactly: a medium circle, an 82% shroud, a soft rim. Anyone
// who never opens the panel sees no change.
export const DEFAULT_SPOTLIGHT_CONFIG: SpotlightConfig = {
  size: 'medium',
  dim: 'normal',
  edge: 'soft',
  shape: 'circle',
};

export const SPOTLIGHT_SIZES: readonly { id: SpotlightSize; label: string }[] = [
  { id: 'small', label: 'Small' },
  { id: 'medium', label: 'Medium' },
  { id: 'large', label: 'Large' },
];

export const SPOTLIGHT_DIMS: readonly { id: SpotlightDim; label: string; hint: string }[] = [
  { id: 'soft', label: 'Soft', hint: 'Muted, but the diagram still reads' },
  { id: 'normal', label: 'Normal', hint: 'The default: dark, with a hint of what surrounds it' },
  { id: 'dark', label: 'Dark', hint: 'Only the light is legible' },
  { id: 'blackout', label: 'Blackout', hint: 'For a projector, where anything less looks grey' },
];

export const SPOTLIGHT_EDGES: readonly { id: SpotlightEdge; label: string; hint: string }[] = [
  { id: 'soft', label: 'Soft', hint: 'A feathered rim that fades out — reads as lighting' },
  { id: 'crisp', label: 'Crisp', hint: 'A defined pool of light — reads as deliberate' },
];

export const SPOTLIGHT_SHAPES: readonly { id: SpotlightShape; label: string; hint: string }[] = [
  { id: 'circle', label: 'Circle', hint: 'An even pool around the cursor' },
  { id: 'wide', label: 'Wide', hint: 'A broad ellipse — lights a lane or a table row' },
];

// --- What the overlay draws from --------------------------------------------

// The light's radius in screen px for each preset. The canvas can still grow /
// shrink freely from here by clicking (spec/09), which is why the panel labels
// an off-preset radius "Custom" rather than pretending.
const SIZE_RADIUS: Record<SpotlightSize, number> = { small: 110, medium: 170, large: 280 };

// Shroud opacity. slate-950 underneath in every case; only the alpha moves.
const DIM_ALPHA: Record<SpotlightDim, number> = {
  soft: 0.6,
  normal: 0.82,
  dark: 0.92,
  blackout: 0.985,
};

// How far inside the radius the gradient ramps from clear to full shroud.
const EDGE_FEATHER: Record<SpotlightEdge, number> = { soft: 60, crisp: 12 };

// How much wider than tall the "wide" light is. 2.2 lights a swimlane without
// reaching the ones above and below it.
const WIDE_ASPECT = 2.2;

export function spotlightRadius(size: SpotlightSize): number {
  return SIZE_RADIUS[size];
}

export function spotlightShroud(config: SpotlightConfig): string {
  return `rgba(2, 6, 23, ${DIM_ALPHA[config.dim]})`;
}

export function spotlightFeather(config: SpotlightConfig): number {
  return EDGE_FEATHER[config.edge];
}

// The light's half-width / half-height for a given radius. A circle is the
// radius both ways; "wide" spreads it sideways and flattens it, keeping
// roughly the lit area so the shroud doesn't jump when you switch shape.
export function spotlightExtent(
  config: SpotlightConfig,
  radius: number,
): { rx: number; ry: number } {
  if (config.shape === 'circle') return { rx: radius, ry: radius };
  return { rx: Math.round(radius * WIDE_ASPECT), ry: Math.round(radius / WIDE_ASPECT) };
}

// Which preset the current radius corresponds to, or null when a click has
// nudged it off one. The panel shows "Custom" for null rather than claiming a
// size the light isn't.
export function spotlightSizeOf(radius: number): SpotlightSize | null {
  const match = SPOTLIGHT_SIZES.find((size) => SIZE_RADIUS[size.id] === Math.round(radius));
  return match?.id ?? null;
}

// --- Parsing ----------------------------------------------------------------

function pick<T extends string>(value: unknown, options: readonly { id: T }[], fallback: T): T {
  return options.some((option) => option.id === value) ? (value as T) : fallback;
}

// Field by field, so one unrecognised token costs that field rather than the
// whole look. Pure, so the fallbacks are testable without touching storage.
export function parseSpotlightConfig(raw: unknown): SpotlightConfig {
  const parsed: unknown = typeof raw === 'string' ? safeJson(raw) : raw;
  if (!parsed || typeof parsed !== 'object') return { ...DEFAULT_SPOTLIGHT_CONFIG };
  const o = parsed as Record<string, unknown>;
  return {
    size: pick(o.size, SPOTLIGHT_SIZES, DEFAULT_SPOTLIGHT_CONFIG.size),
    dim: pick(o.dim, SPOTLIGHT_DIMS, DEFAULT_SPOTLIGHT_CONFIG.dim),
    edge: pick(o.edge, SPOTLIGHT_EDGES, DEFAULT_SPOTLIGHT_CONFIG.edge),
    shape: pick(o.shape, SPOTLIGHT_SHAPES, DEFAULT_SPOTLIGHT_CONFIG.shape),
  };
}

// --- Storage ----------------------------------------------------------------

const STORAGE_KEY = 'livediagram:v2:spotlight-config';

export function loadSpotlightConfig(): SpotlightConfig {
  return parseSpotlightConfig(readLocalStorageSafe(STORAGE_KEY));
}

export function saveSpotlightConfig(config: SpotlightConfig): void {
  writeLocalStorageSafe(STORAGE_KEY, JSON.stringify(config));
}
