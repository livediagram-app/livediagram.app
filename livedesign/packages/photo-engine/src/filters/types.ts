// What a filter is (docs/specs/031-photo/photo-adjustments.md "Filters"): its settings as the dialog
// shows them, how far past its own pixels it reads, and the change itself.
import type { Raster } from '../raster/raster';

export type FilterCategory =
  | 'blur'
  | 'sharpen'
  | 'noise'
  | 'stylize'
  | 'pixelate'
  | 'distort'
  | 'render'
  | 'enhance'
  | 'other';

export const FILTER_CATEGORY_NAMES: Record<FilterCategory, string> = {
  blur: 'Blur',
  sharpen: 'Sharpen',
  noise: 'Noise',
  stylize: 'Stylize',
  pixelate: 'Pixelate',
  distort: 'Distort',
  render: 'Render',
  enhance: 'Enhance',
  other: 'Other',
};

export type ParamSpec =
  | {
      key: string;
      name: string;
      kind: 'number';
      min: number;
      max: number;
      step: number;
      default: number;
      unit?: 'px' | '%' | '°';
    }
  | {
      key: string;
      name: string;
      kind: 'choice';
      options: { value: string; label: string }[];
      default: string;
    }
  | { key: string; name: string; kind: 'toggle'; default: boolean }
  // A place on the picture, as fractions of its width and height (a centre placed on the preview).
  | { key: string; name: string; kind: 'point'; default: { x: number; y: number } }
  // A 5 x 5 grid of whole numbers (Custom).
  | { key: string; name: string; kind: 'kernel'; default: number[] };

export type FilterContext = {
  signal?: AbortSignal;
  progress?: (done: number) => void;
  // Repeatable randomness for noise and the like.
  seed: number;
  foreground: readonly [number, number, number];
  background: readonly [number, number, number];
  // The whole photo's size, for filters placed by its centre when run on part of it.
  photo?: { width: number; height: number; x: number; y: number };
};

export type FilterParams = Record<string, unknown>;

export type FilterDef = {
  id: string;
  name: string;
  category: FilterCategory;
  params: ParamSpec[];
  // How far past the pixels it changes it reads, px, for a preview drawn in parts; Infinity when it
  // needs the whole picture (distortions placed by the centre).
  margin: (p: FilterParams) => number;
  run: (src: Raster, p: FilterParams, ctx: FilterContext) => Raster;
};

export class FilterCancelled extends Error {
  constructor() {
    super('Filter cancelled');
    this.name = 'FilterCancelled';
  }
}

/** Throws when the filter was cancelled; reports progress (0..1) every so often. */
export function checkpoint(ctx: FilterContext, done: number): void {
  if (ctx.signal?.aborted) throw new FilterCancelled();
  ctx.progress?.(done);
}

/** A setting's value within its spec. */
export function paramValue(spec: ParamSpec, p: FilterParams): unknown {
  const v = p[spec.key];
  switch (spec.kind) {
    case 'number':
      return typeof v === 'number' && Number.isFinite(v)
        ? Math.min(spec.max, Math.max(spec.min, v))
        : spec.default;
    case 'choice':
      return typeof v === 'string' && spec.options.some((o) => o.value === v) ? v : spec.default;
    case 'toggle':
      return typeof v === 'boolean' ? v : spec.default;
    case 'point': {
      const pt = v as { x?: unknown; y?: unknown } | undefined;
      return pt && typeof pt.x === 'number' && typeof pt.y === 'number'
        ? { x: Math.min(1, Math.max(0, pt.x)), y: Math.min(1, Math.max(0, pt.y)) }
        : spec.default;
    }
    case 'kernel':
      return Array.isArray(v) &&
        v.length === 25 &&
        v.every((n) => typeof n === 'number' && Number.isFinite(n))
        ? v.map((n: number) => Math.round(Math.min(999, Math.max(-999, n))))
        : spec.default;
  }
}

/** Every setting read within its spec. */
export function readParams(specs: readonly ParamSpec[], p: FilterParams): Record<string, unknown> {
  return Object.fromEntries(specs.map((s) => [s.key, paramValue(s, p)]));
}

export const num = (
  key: string,
  name: string,
  min: number,
  max: number,
  def: number,
  step = 1,
  unit?: 'px' | '%' | '°',
): ParamSpec => ({
  key,
  name,
  kind: 'number',
  min,
  max,
  step,
  default: def,
  ...(unit ? { unit } : {}),
});
export const toggle = (key: string, name: string, def: boolean): ParamSpec => ({
  key,
  name,
  kind: 'toggle',
  default: def,
});
export const choice = (
  key: string,
  name: string,
  options: [string, string][],
  def: string,
): ParamSpec => ({
  key,
  name,
  kind: 'choice',
  options: options.map(([value, label]) => ({ value, label })),
  default: def,
});
export const point = (key: string, name: string): ParamSpec => ({
  key,
  name,
  kind: 'point',
  default: { x: 0.5, y: 0.5 },
});
