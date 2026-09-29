// Custom swatches (docs/specs/008-canvas/quick-style-panel.md "Custom swatches"): a colour of your own
// saved into one of a row's six theme slots, for one theme. Pure; the hook
// (useSwatchOverrides) reads and writes it through the preferences blob.
import {
  hueName,
  isQuickSwatchSlot,
  type QuickSwatch,
  type QuickSwatchRole,
  type QuickSwatchSlot,
} from '@livediagram/diagram';

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

// Where overrides live (docs/specs/008-canvas/quick-style-panel.md "Custom swatches"): per user, synced,
// keyed by theme, in the preferences blob beside `customSwatches`. An entry
// says "in theme t, these slots are these colours". Newest-edited first. Short
// keys (t / s / f / x), because the whole blob shares the api's 4 KB cap.
export type ThemeSwatchOverrides = {
  t: string;
  s?: SwatchOverrideRow;
  f?: SwatchOverrideRow;
  // The Text colour row (x, since t is the theme).
  x?: SwatchOverrideRow;
};
export type SwatchOverrideStore = ThemeSwatchOverrides[];

// A theme id is a built-in id or `custom:<uuid>` (43 chars).
export const SWATCH_OVERRIDE_MAX_THEME_ID = 64;
export const SWATCH_OVERRIDE_MAX_THEMES = 8;
// The store's share of the 4 KB preferences blob: recent-exclusions can take
// ~2.4 KB, so this keeps every other preference writable.
export const SWATCH_OVERRIDE_MAX_BYTES = 800;

const KEY: Record<QuickSwatchRole, 's' | 'f' | 'x'> = { stroke: 's', fill: 'f', text: 'x' };
const ROLES = Object.keys(KEY) as QuickSwatchRole[];

export function overridesForTheme(store: SwatchOverrideStore, themeId: string): SwatchOverrides {
  const entry = store.find((e) => e.t === themeId);
  if (!entry) return {};
  const out: SwatchOverrides = {};
  for (const role of ROLES) {
    const row = entry[KEY[role]];
    if (row) out[role] = row;
  }
  return out;
}

// The theme just edited moves to the front; the oldest themes go when the
// store runs over its theme count or byte budget.
function capped(store: SwatchOverrideStore): SwatchOverrideStore {
  const out = store.slice(0, SWATCH_OVERRIDE_MAX_THEMES);
  while (out.length > 1 && JSON.stringify(out).length > SWATCH_OVERRIDE_MAX_BYTES) out.pop();
  return out;
}

export function storeWithOverride(
  store: SwatchOverrideStore,
  themeId: string,
  role: QuickSwatchRole,
  slot: QuickSwatchSlot,
  hex: string,
): SwatchOverrideStore {
  const key = KEY[role];
  const entry = store.find((e) => e.t === themeId) ?? { t: themeId };
  const next = { ...entry, [key]: { ...entry[key], [slot]: hex } };
  return capped([next, ...store.filter((e) => e.t !== themeId)]);
}

export function storeWithoutOverride(
  store: SwatchOverrideStore,
  themeId: string,
  role: QuickSwatchRole,
  slot: QuickSwatchSlot,
): SwatchOverrideStore {
  const key = KEY[role];
  const entry = store.find((e) => e.t === themeId);
  const row = entry?.[key];
  if (!entry || !row || !(slot in row)) return store;
  const { [slot]: _gone, ...rest } = row;
  const next: ThemeSwatchOverrides = { ...entry };
  if (Object.keys(rest).length === 0) delete next[key];
  else next[key] = rest;
  const empty = !next.s && !next.f && !next.x;
  return store.flatMap((e) => (e.t !== themeId ? [e] : empty ? [] : [next]));
}

// A theme that no longer exists (a deleted custom theme) takes its overrides
// with it.
export function pruneSwatchOverrideStore(
  store: SwatchOverrideStore,
  keep: (themeId: string) => boolean,
): SwatchOverrideStore {
  const next = store.filter((e) => keep(e.t));
  return next.length === store.length ? store : next;
}

function parseRow(value: unknown): SwatchOverrideRow | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const kept: SwatchOverrideRow = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    const slot = Number(k);
    const hex = typeof v === 'string' ? normaliseHex(v) : null;
    if (isQuickSwatchSlot(slot) && hex) kept[slot] = hex;
  }
  return Object.keys(kept).length > 0 ? kept : undefined;
}

// The synced blob is untrusted: another client version or a hand edit may
// have written it. Keep valid themes, slots 1-6 and real colours; the first
// entry for a theme wins; the caps apply.
export function parseSwatchOverrideStore(value: unknown): SwatchOverrideStore {
  if (!Array.isArray(value)) return [];
  const out: SwatchOverrideStore = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') continue;
    const { t, s, f, x } = item as Record<string, unknown>;
    if (typeof t !== 'string' || t.length === 0 || t.length > SWATCH_OVERRIDE_MAX_THEME_ID)
      continue;
    if (out.some((e) => e.t === t)) continue;
    const stroke = parseRow(s);
    const fill = parseRow(f);
    const text = parseRow(x);
    if (!stroke && !fill && !text) continue;
    out.push({
      t,
      ...(stroke ? { s: stroke } : {}),
      ...(fill ? { f: fill } : {}),
      ...(text ? { x: text } : {}),
    });
  }
  return capped(out);
}
