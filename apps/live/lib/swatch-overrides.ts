// Custom swatches (docs/specs/008-canvas/quick-style-panel.md "Custom swatches"): a colour of your own
// saved into one of a row's six theme slots. Pure; the hook
// (useSwatchOverrides) owns the state and the storage.
import {
  hueName,
  isQuickSwatchSlot,
  type QuickSwatch,
  type QuickSwatchRole,
  type QuickSwatchSlot,
} from '@livediagram/diagram';
import { safeJson } from './local-storage-safe';

export type SwatchOverrideRow = Partial<Record<QuickSwatchSlot, string>>;
export type SwatchOverrides = Partial<Record<QuickSwatchRole, SwatchOverrideRow>>;

// A swatch as the panel shows it: the theme's, or a custom one that remembers
// what it replaced.
export type ShownSwatch = QuickSwatch & {
  override?: { themeColor: string; themeName: string };
};

const HEX = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;

export function normaliseHex(value: string): string | null {
  const m = HEX.exec(value.trim());
  if (!m) return null;
  const digits = m[1]!.toLowerCase();
  const full = digits.length === 3 ? [...digits].map((d) => d + d).join('') : digits;
  return `#${full}`;
}

export function applySwatchOverrides(
  swatches: QuickSwatch[],
  row: SwatchOverrideRow | undefined,
): ShownSwatch[] {
  if (!row || Object.keys(row).length === 0) return swatches;
  return swatches.map((s) => {
    const custom = s.slot === 0 ? undefined : row[s.slot];
    if (!custom) return s;
    return {
      slot: s.slot,
      color: custom,
      name: `Custom ${hueName(custom).toLowerCase()}, in place of ${s.name}`,
      override: { themeColor: s.color, themeName: s.name },
    };
  });
}

export function withOverride(
  overrides: SwatchOverrides,
  role: QuickSwatchRole,
  slot: QuickSwatchSlot,
  hex: string,
): SwatchOverrides {
  return { ...overrides, [role]: { ...overrides[role], [slot]: hex } };
}

export function withoutOverride(
  overrides: SwatchOverrides,
  role: QuickSwatchRole,
  slot: QuickSwatchSlot,
): SwatchOverrides {
  const row = overrides[role];
  if (!row || !(slot in row)) return overrides;
  const { [slot]: _gone, ...rest } = row;
  const next = { ...overrides };
  if (Object.keys(rest).length === 0) delete next[role];
  else next[role] = rest;
  return next;
}

// Stored overrides are untrusted: keep known rows, slots 1-6 and real colours.
export function parseSwatchOverrides(raw: string | null): SwatchOverrides {
  const data = raw === null ? null : safeJson(raw);
  if (!data || typeof data !== 'object' || Array.isArray(data)) return {};
  const out: SwatchOverrides = {};
  for (const role of ['stroke', 'fill'] as const) {
    const row = (data as Record<string, unknown>)[role];
    if (!row || typeof row !== 'object') continue;
    const kept: SwatchOverrideRow = {};
    for (const [key, value] of Object.entries(row as Record<string, unknown>)) {
      const slot = Number(key);
      const hex = typeof value === 'string' ? normaliseHex(value) : null;
      if (isQuickSwatchSlot(slot) && hex) kept[slot] = hex;
    }
    if (Object.keys(kept).length > 0) out[role] = kept;
  }
  return out;
}
