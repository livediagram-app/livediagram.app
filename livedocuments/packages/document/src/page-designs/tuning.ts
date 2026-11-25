// A page design as stored (docs/specs/011-theme/page-designs.md "Stored data", "Fine tuning"): a catalogue id and its
// tuning, every field absent at the design's default. Read leniently: an id the catalogue does not hold drops the
// design, and a field of the wrong type or out of range drops that field. Pure.
import { PAGE_DESIGN_BY_ID, isPageDesignId, type PageDesignId } from './catalogue';

export type PageDesignGuard = 'scrim' | 'warn';

export type PageDesign = {
  id: PageDesignId;
  // The three colours it draws in; absent, the theme's.
  colors?: [string, string, string];
  intensity?: number;
  scale?: number;
  angle?: number;
  // Its focus, as fractions of the page: [x, y].
  focus?: [number, number];
  seed?: number;
  blur?: number;
  grain?: number;
  // The safe area: how calm the middle stays.
  calm?: number;
  // One of the design's own styles.
  variant?: string;
  animate?: true;
  speed?: number;
  // The tab design's options: bold title and section pages, and flowing across pages.
  rhythm?: true;
  flow?: true;
  // Absent is 'scrim'.
  guard?: 'warn';
};

// A page that wears no design while its tab has one.
export const PAGE_DESIGN_NONE = 'none';
export type PageDesignNone = { id: typeof PAGE_DESIGN_NONE };
export type PageDesignOverride = PageDesign | PageDesignNone;

/** Each tuning number's range (docs/specs/011-theme/blueprints/page-designs.md "Constants and configuration"). */
export const DESIGN_RANGES = {
  intensity: [0.1, 1],
  scale: [0.5, 2],
  angle: [0, 359],
  seed: [1, 9999],
  blur: [0, 1],
  grain: [0, 1],
  calm: [0, 1],
  speed: [0.25, 3],
} as const;
type RangeKey = keyof typeof DESIGN_RANGES;

/** A design's tuning with every default filled in: what it is drawn from. */
export type DesignTuning = {
  colors: [string, string, string] | undefined;
  intensity: number;
  scale: number;
  angle: number;
  focus: [number, number];
  seed: number;
  blur: number;
  grain: number;
  calm: number;
  variant: string;
  animate: boolean;
  speed: number;
  rhythm: boolean;
  flow: boolean;
  guard: PageDesignGuard;
};

const HEX = /^#[0-9a-f]{6}$/i;
const isRecord = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);
const inRange = (v: unknown, key: RangeKey): v is number =>
  typeof v === 'number' &&
  Number.isFinite(v) &&
  v >= DESIGN_RANGES[key][0] &&
  v <= DESIGN_RANGES[key][1];

function readFocus(v: unknown): [number, number] | undefined {
  if (!Array.isArray(v) || v.length !== 2) return undefined;
  const [x, y] = v as unknown[];
  const ok = (n: unknown): n is number => typeof n === 'number' && n >= 0 && n <= 1;
  return ok(x) && ok(y) ? [x, y] : undefined;
}

function readColors(v: unknown): [string, string, string] | undefined {
  if (!Array.isArray(v) || v.length !== 3) return undefined;
  const hexes = (v as unknown[]).filter((c): c is string => typeof c === 'string' && HEX.test(c));
  if (hexes.length !== 3) return undefined;
  const [a, b, c] = hexes.map((h) => h.toLowerCase());
  return [a!, b!, c!];
}

/** A stored design, keeping its valid fields; undefined when its id is not a catalogue design. */
export function parsePageDesign(v: unknown): PageDesign | undefined {
  if (!isRecord(v) || !isPageDesignId(v.id)) return undefined;
  const def = PAGE_DESIGN_BY_ID[v.id];
  const out: PageDesign = { id: v.id };
  const colors = readColors(v.colors);
  if (colors) out.colors = colors;
  for (const key of ['intensity', 'scale', 'blur', 'grain', 'calm', 'speed'] as const)
    if (inRange(v[key], key)) out[key] = v[key];
  if (typeof v.angle === 'number' && Number.isFinite(v.angle))
    out.angle = ((Math.round(v.angle) % 360) + 360) % 360;
  if (inRange(v.seed, 'seed')) out.seed = Math.round(v.seed);
  const focus = readFocus(v.focus);
  if (focus) out.focus = focus;
  if (typeof v.variant === 'string' && def.variants?.some((s) => s.id === v.variant))
    out.variant = v.variant;
  if (v.animate === true && def.animates) out.animate = true;
  if (v.rhythm === true) out.rhythm = true;
  if (v.flow === true && def.flows) out.flow = true;
  if (v.guard === 'warn') out.guard = 'warn';
  return compactPageDesign(out);
}

/** A page's stored override: no design, or a design. */
export function parsePageDesignOverride(v: unknown): PageDesignOverride | undefined {
  if (isRecord(v) && v.id === PAGE_DESIGN_NONE) return { id: PAGE_DESIGN_NONE };
  return parsePageDesign(v);
}

export function isNoDesign(d: PageDesignOverride | undefined): d is PageDesignNone {
  return d?.id === PAGE_DESIGN_NONE;
}

/** The design with every field at its default left out, so what is stored stays small. */
export function compactPageDesign(d: PageDesign): PageDesign {
  const t = defaultTuning(d.id);
  const out: PageDesign = { id: d.id };
  if (d.colors) out.colors = d.colors;
  for (const key of ['intensity', 'scale', 'angle', 'seed', 'blur', 'grain', 'calm'] as const) {
    const v = d[key];
    if (v !== undefined && Math.abs(v - t[key]) > 1e-9) out[key] = v;
  }
  if (d.focus && (d.focus[0] !== t.focus[0] || d.focus[1] !== t.focus[1])) out.focus = d.focus;
  if (d.variant && d.variant !== t.variant) out.variant = d.variant;
  if (d.animate) out.animate = true;
  if (d.speed !== undefined && d.speed !== 1) out.speed = d.speed;
  if (d.rhythm) out.rhythm = true;
  if (d.flow) out.flow = true;
  if (d.guard === 'warn') out.guard = 'warn';
  return out;
}

/** A design's own defaults (the catalogue's), with nothing tuned. */
export function defaultTuning(id: PageDesignId): DesignTuning {
  const def = PAGE_DESIGN_BY_ID[id];
  const d = def.defaults ?? {};
  return {
    colors: undefined,
    intensity: d.intensity ?? 0.7,
    scale: 1,
    angle: d.angle ?? 0,
    focus: d.focus ?? [0.5, 0.5],
    seed: 1,
    blur: d.blur ?? 0.5,
    grain: 0,
    calm: d.calm ?? 0.5,
    variant: def.variants?.[0]?.id ?? '',
    animate: false,
    speed: 1,
    rhythm: false,
    flow: false,
    guard: 'scrim',
  };
}

/** The tuning a design is drawn from: its stored fields over its defaults. */
export function resolveTuning(d: PageDesign): DesignTuning {
  const t = defaultTuning(d.id);
  return {
    colors: d.colors ?? t.colors,
    intensity: d.intensity ?? t.intensity,
    scale: d.scale ?? t.scale,
    angle: d.angle ?? t.angle,
    focus: d.focus ?? t.focus,
    seed: d.seed ?? t.seed,
    blur: d.blur ?? t.blur,
    grain: d.grain ?? t.grain,
    calm: d.calm ?? t.calm,
    variant: d.variant ?? t.variant,
    animate: d.animate === true,
    speed: d.speed ?? 1,
    rhythm: d.rhythm === true,
    flow: d.flow === true,
    guard: d.guard === 'warn' ? 'warn' : 'scrim',
  };
}

/** Whether two designs are the same once compacted. */
export function samePageDesign(
  a: PageDesignOverride | undefined,
  b: PageDesignOverride | undefined,
) {
  if (!a || !b) return !a && !b;
  return JSON.stringify(a) === JSON.stringify(b);
}

/** The tab's own design, read leniently. */
export function tabPageDesignOf(tab: { pageDesign?: unknown }): PageDesign | undefined {
  return parsePageDesign(tab.pageDesign);
}
