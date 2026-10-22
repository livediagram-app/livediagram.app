// Every filter (docs/specs/031-photo/photo-adjustments.md "Filters"), by id, in the Filter menu's
// order: its categories in turn, each category's filters as the spec lists them.
import { BLUR_FILTERS } from './blur';
import { DISTORT_FILTERS } from './distort';
import { RENDER_ENHANCE_OTHER_FILTERS } from './render-enhance-other';
import { SHARPEN_NOISE_FILTERS } from './sharpen-noise';
import { STYLIZE_PIXELATE_FILTERS } from './stylize-pixelate';
import type { FilterCategory, FilterDef } from './types';

export const FILTER_LIST: readonly FilterDef[] = [
  ...BLUR_FILTERS,
  ...SHARPEN_NOISE_FILTERS,
  ...STYLIZE_PIXELATE_FILTERS,
  ...DISTORT_FILTERS,
  ...RENDER_ENHANCE_OTHER_FILTERS,
];

export const FILTERS: Readonly<Record<string, FilterDef>> = Object.fromEntries(
  FILTER_LIST.map((f) => [f.id, f]),
);

export const FILTER_CATEGORIES: readonly FilterCategory[] = [
  'blur',
  'sharpen',
  'noise',
  'stylize',
  'pixelate',
  'distort',
  'render',
  'enhance',
  'other',
];

export function filtersIn(category: FilterCategory): FilterDef[] {
  return FILTER_LIST.filter((f) => f.category === category);
}

/** The settings a filter starts with. */
export function filterDefaults(f: FilterDef): Record<string, unknown> {
  return Object.fromEntries(f.params.map((s) => [s.key, s.default]));
}
