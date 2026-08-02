// The format painter's settings (spec/117): which parts of a copied style
// actually get painted, and whether the brush stays loaded afterwards.
//
// lib/format-painter.ts stays the single source of truth for WHAT can be
// painted; this module decides WHICH OF IT does. The field → group mapping
// below is what makes the panel honest: a test asserts every field either
// projection produces is assigned to a group, so a field added to the painter
// later can't quietly escape the toggles and always travel.
//
// Device-local, like the other tool panels. Never sent to the api.

import { readLocalStorageSafe, safeJson, writeLocalStorageSafe } from './local-storage-safe';

export type FormatGroup = 'fill' | 'border' | 'text' | 'effects' | 'size';
export type FormatMode = 'keep' | 'once';

export type FormatConfig = {
  // Which groups travel. All on is today's painter exactly.
  copies: Record<FormatGroup, boolean>;
  mode: FormatMode;
};

export const DEFAULT_FORMAT_CONFIG: FormatConfig = {
  copies: { fill: true, border: true, text: true, effects: true, size: true },
  mode: 'keep',
};

export const FORMAT_GROUPS: readonly { id: FormatGroup; label: string; hint: string }[] = [
  { id: 'fill', label: 'Fill', hint: 'The fill colour and its theme preset' },
  {
    id: 'border',
    label: 'Border',
    hint: 'Stroke colour, width, pattern, corners — and an arrow’s line',
  },
  { id: 'text', label: 'Text', hint: 'Colour, size, weight, font, alignment' },
  { id: 'effects', label: 'Effects', hint: 'Shadow, opacity, and animations' },
  { id: 'size', label: 'Size', hint: 'Width, height, aspect lock, padding' },
];

export const FORMAT_MODES: readonly { id: FormatMode; label: string; hint: string }[] = [
  { id: 'keep', label: 'Keep the brush', hint: 'Paint one element after another' },
  { id: 'once', label: 'Paint once', hint: 'The brush empties after one apply' },
];

// Every field the two projections can produce, mapped to the toggle that owns
// it. Exhaustive by test (format-config.test.ts), not by hope.
const FIELD_GROUP: Record<string, FormatGroup> = {
  // Fill.
  fillColor: 'fill',
  colorPreset: 'fill',
  // Border — and, for an arrow, the whole line look: an arrowhead is to a
  // connector what a corner radius is to a box.
  strokeColor: 'border',
  strokeWidth: 'border',
  strokeStyle: 'border',
  borderRadius: 'border',
  arrowEnds: 'border',
  arrowheadSize: 'border',
  arrowheadShape: 'border',
  arrowStyle: 'border',
  routeBehind: 'border',
  // Text.
  textColor: 'text',
  textSize: 'text',
  textAlignX: 'text',
  textAlignY: 'text',
  textBold: 'text',
  textItalic: 'text',
  textUnderline: 'text',
  textStrikethrough: 'text',
  font: 'text',
  // Effects.
  shadow: 'effects',
  opacity: 'effects',
  animation: 'effects',
  animationSpeed: 'effects',
  animationRepeat: 'effects',
  iconAnimation: 'effects',
  iconAnimationSpeed: 'effects',
  iconAnimationRepeat: 'effects',
  flow: 'effects',
  flowSpeed: 'effects',
  flowRepeat: 'effects',
  // Size.
  width: 'size',
  height: 'size',
  aspectLocked: 'size',
  padding: 'size',
  iconSize: 'size',
};

export function formatGroupOf(field: string): FormatGroup | undefined {
  return FIELD_GROUP[field];
}

// Narrow a painter projection to the enabled groups. A field with no group
// would be unreachable from the panel, so it is dropped rather than smuggled
// through — the test above is what stops that ever being a silent loss.
export function filterPaintedFields<T extends object>(projection: T, config: FormatConfig): T {
  return Object.fromEntries(
    Object.entries(projection).filter(([field]) => {
      const group = formatGroupOf(field);
      return group !== undefined && config.copies[group];
    }),
  ) as T;
}

// Nothing enabled means nothing to paint: the panel says so and the brush goes
// inert, rather than every tap being a silent no-op.
export function formatPaintsAnything(config: FormatConfig): boolean {
  return FORMAT_GROUPS.some((group) => config.copies[group.id]);
}

// The enabled groups, in panel order, for the collapsed header ("Border, Text").
export function formatCopiesSummary(config: FormatConfig): string {
  const on = FORMAT_GROUPS.filter((group) => config.copies[group.id]);
  if (on.length === FORMAT_GROUPS.length) return 'Everything';
  if (on.length === 0) return 'Nothing';
  return on.map((group) => group.label).join(', ');
}

// --- Parsing ----------------------------------------------------------------

export function parseFormatConfig(raw: unknown): FormatConfig {
  const parsed: unknown = typeof raw === 'string' ? safeJson(raw) : raw;
  if (!parsed || typeof parsed !== 'object') return structuredCopy(DEFAULT_FORMAT_CONFIG);
  const o = parsed as { copies?: unknown; mode?: unknown };
  const copies = { ...DEFAULT_FORMAT_CONFIG.copies };
  if (o.copies && typeof o.copies === 'object') {
    for (const group of FORMAT_GROUPS) {
      const value = (o.copies as Record<string, unknown>)[group.id];
      // Field by field: an unreadable entry costs that toggle, not the set.
      if (typeof value === 'boolean') copies[group.id] = value;
    }
  }
  const mode = FORMAT_MODES.some((m) => m.id === o.mode)
    ? (o.mode as FormatMode)
    : DEFAULT_FORMAT_CONFIG.mode;
  return { copies, mode };
}

function structuredCopy(config: FormatConfig): FormatConfig {
  return { copies: { ...config.copies }, mode: config.mode };
}

// --- Storage ----------------------------------------------------------------

const STORAGE_KEY = 'livediagram:v2:format-config';

export function loadFormatConfig(): FormatConfig {
  return parseFormatConfig(readLocalStorageSafe(STORAGE_KEY));
}

export function saveFormatConfig(config: FormatConfig): void {
  writeLocalStorageSafe(STORAGE_KEY, JSON.stringify(config));
}
